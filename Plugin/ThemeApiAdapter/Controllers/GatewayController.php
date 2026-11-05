<?php

namespace Plugin\ThemeApiAdapter\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class GatewayController extends Controller
{
    // 前后端对齐的主混淆密钥
    private const MASTER_KEY = 'xboard_aether_m3_secure_seed';

    /**
     * 极速对称解密流 (RC4 算法)
     */
    private static function rc4(string $key, string $data): string
    {
        $s = range(0, 255);
        $j = 0;
        $keyLen = strlen($key);
        for ($i = 0; $i < 256; $i++) {
            $j = ($j + $s[$i] + ord($key[$i % $keyLen])) % 256;
            [$s[$i], $s[$j]] = [$s[$j], $s[$i]];
        }
        $i = $j = 0;
        $res = '';
        $dataLen = strlen($data);
        for ($y = 0; $y < $dataLen; $y++) {
            $i = ($i + 1) % 256;
            $j = ($j + $s[$i]) % 256;
            [$s[$i], $s[$j]] = [$s[$j], $s[$i]];
            $res .= chr(ord($data[$y]) ^ $s[($s[$i] + $s[$j]) % 256]);
        }
        return $res;
    }

    /**
     * 网关核心分发：将 /api/v1/e/{cipher} 解密还原并派发
     */
    public function dispatchGateway(Request $request, string $cipher): Response
    {
        if (strlen($cipher) < 10 || !ctype_xdigit($cipher)) {
            abort(404);
        }

        try {
            // 1. 提取动态盐并解密完整路径 (包含 ?id=xx / ?language=xx 等参数)
            $salt = substr($cipher, 0, 8);
            $rawCipher = hex2bin(substr($cipher, 8));
            $sessionKey = $salt . '_' . self::MASTER_KEY;
            $realPathWithQuery = self::rc4($sessionKey, $rawCipher);

            if (!$realPathWithQuery || !str_contains($realPathWithQuery, '/')) {
                abort(404);
            }

            // 🌟 2. 精确拆分 URI 路径与 Query 查询参数
            $parts = explode('?', $realPathWithQuery, 2);
            $cleanPath = trim($parts[0], '/');
            $queryString = $parts[1] ?? '';

            $extraQuery = [];
            if (!empty($queryString)) {
                parse_str($queryString, $extraQuery);
            }
            // 合并外部可能携带的 query 与密文内部解出来的 query
            $allQuery = array_merge($request->query->all(), $extraQuery);

            // 构造标准完整目标 URI
            $targetUri = '/api/v1/' . $cleanPath;
            if (!empty($allQuery)) {
                $targetUri .= '?' . http_build_query($allQuery);
            }

            // 🌟 3. 构造子请求 (确保 GET/POST 下的 input('id') 均可无损读取)
            $subRequest = Request::create(
                $targetUri,
                $request->getMethod(),
                $request->isMethod('GET') ? $allQuery : array_merge($request->all(), $allQuery),
                $request->cookies->all(),
                $request->files->all(),
                array_merge($request->server->all(), [
                    'REQUEST_URI' => $targetUri,
                    'QUERY_STRING' => http_build_query($allQuery)
                ]),
                $request->getContent()
            );

            // 继承所有请求头 (Authorization, Content-Type, Accept 等)
            $subRequest->headers->replace($request->headers->all());

            // 继承用户鉴权上下文
            if (isset($request->user)) {
                $subRequest->user = $request->user;
            }
            $subRequest->setUserResolver(fn () => $request->user());

            // 🌟 核心破案点：将 subRequest 绑定到 Laravel 全局服务容器的 'request' 实例！
            // 这样无论是 TicketController 还是 KnowledgeController，注入的 $request 都能拿到真实的 ?id=xx 参数！
            $originalRequest = app('request');
            app()->instance('request', $subRequest);

            try {
                return app('router')->dispatch($subRequest);
            } finally {
                // 执行完成后干净复原
                app()->instance('request', $originalRequest);
            }

        } catch (\Throwable $e) {
            \Log::warning('[Gateway] 动态路径分发异常: ' . $e->getMessage(), [
                'cipher' => $cipher,
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);
            abort(404);
        }
    }
}
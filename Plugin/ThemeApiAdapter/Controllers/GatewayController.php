<?php

namespace Plugin\ThemeApiAdapter\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class GatewayController extends Controller
{
    // 🌟 前后端对齐的主混淆密钥 (可与前端统一)
    private const MASTER_KEY = 'xboard_aether_m3_secure_seed';

    /**
     * 极速对称解密流 (RC4 算法，内存开销 0.01ms，前后端 100% 字节对齐)
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
        // 1. 至少包含 8 字节的 Salt + 密文
        if (strlen($cipher) < 10 || !ctype_xdigit($cipher)) {
            abort(404);
        }

        try {
            // 2. 提取 8 字符动态盐
            $salt = substr($cipher, 0, 8);
            $rawCipher = hex2bin(substr($cipher, 8));
            
            // 3. 解密还原原本的相对路径 (如 "user/server/fetch" 或 "user/order/detail?trade_no=123")
            $sessionKey = $salt . '_' . self::MASTER_KEY;
            $realPathWithQuery = self::rc4($sessionKey, $rawCipher);

            if (!$realPathWithQuery || !str_contains($realPathWithQuery, '/')) {
                abort(404);
            }

            // 4. 解析路径与 Query 参数
            $parsed = parse_url($realPathWithQuery);
            $cleanPath = ltrim($parsed['path'] ?? '', '/');
            
            // 5. 合并并重写 Query 参数
            $extraQuery = [];
            if (!empty($parsed['query'])) {
                parse_str($parsed['query'], $extraQuery);
            }
            $allQuery = array_merge($request->query->all(), $extraQuery);

            // 6. 构造原生的内部对等子请求 (Sub-Request)
            $targetUri = '/api/v1/' . $cleanPath;
            $subRequest = Request::create(
                $targetUri,
                $request->getMethod(),
                $allQuery,
                $request->cookies->all(),
                $request->files->all(),
                array_merge($request->server->all(), [
                    'REQUEST_URI' => $targetUri,
                    'QUERY_STRING' => http_build_query($allQuery)
                ]),
                $request->getContent()
            );

            // 继承所有请求头（包括 Sanctum Token、MIME 等）
            $subRequest->headers->replace($request->headers->all());

            // 🌟 核心：在内存中直接调度 Laravel 官方路由管道执行，鉴权与业务 100% 保持原生！
            return app('router')->dispatch($subRequest);

        } catch (\Throwable $e) {
            \Log::warning('[Gateway] 动态路径分发失败: ' . $e->getMessage());
            abort(404);
        }
    }
}
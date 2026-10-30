<?php

namespace Plugin\ThemeApiAdapter\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

class BinaryInterceptor
{
    public function handle(Request $request, Closure $next)
    {
        // 1. 多重嗅探是否要求 MsgPack (防止被 ForceJson 篡改覆盖)
        $accept = $request->header('Accept', '');
        $rawAccept = $request->server('HTTP_ACCEPT', ''); // 读取未经 ForceJson 污染的原生头
        $customHeader = $request->header('X-Response-Format', '') ?: $request->header('X-Accept', '');
        $queryFormat = $request->query('format', '');

        $wantsMsgPack = str_contains($accept, 'application/msgpack') || 
                        str_contains($accept, 'application/x-msgpack') ||
                        str_contains($rawAccept, 'application/msgpack') ||
                        str_contains($rawAccept, 'application/x-msgpack') ||
                        $customHeader === 'msgpack' ||
                        $queryFormat === 'msgpack';

        // 2. 关键：用 try...catch 兜住 Xboard 的 abort(403) 未登录等抛出的异常
        try {
            $response = $next($request);
        } catch (\Throwable $e) {
            // 将异常就地交由 Laravel 官方 Handler 渲染成正常的 JsonResponse 报错对象
            $response = app(\Illuminate\Contracts\Debug\ExceptionHandler::class)->render($request, $e);
        }

        // 如果用户不要 MsgPack，原样放行
        if (!$wantsMsgPack) {
            return $response;
        }

        // 304 缓存直接放行
        if ($response->getStatusCode() === 304) {
            return $response;
        }

        // 3. 提取数据并序列化
        $data = null;
        if ($response instanceof JsonResponse) {
            $data = $response->getData(true);
        } else {
            // 兼容被直接输出为 JSON 字符串的 Response
            $content = $response->getContent();
            $data = json_decode($content, true);
        }

        // 如果解析出有效数据或报错对象，将其无损压成 MsgPack 二进制
        if ($data !== null) {
            try {
                $packedData = self::pack($data);
                $response->setContent($packedData);
                $response->header('Content-Type', 'application/msgpack');
                $response->header('Content-Length', strlen($packedData));
                $response->headers->remove('ETag');
            } catch (\Throwable $e) {
                \Log::warning('[ThemeApiAdapter] 二进制压缩失败: ' . $e->getMessage());
            }
        }

        return $response;
    }

    /**
     * 原生纯 PHP MessagePack 打包器
     */
    public static function pack(mixed $data): string
    {
        if (function_exists('msgpack_pack')) {
            return msgpack_pack($data);
        }

        if (is_null($data)) return "\xc0";
        if (is_bool($data)) return $data ? "\xc3" : "\xc2";
        if (is_int($data)) {
            if ($data >= 0) {
                if ($data <= 0x7f) return chr($data);
                if ($data <= 0xff) return "\xcc" . pack('C', $data);
                if ($data <= 0xffff) return "\xcd" . pack('n', $data);
                if ($data <= 0xffffffff) return "\xce" . pack('N', $data);
                return "\xcf" . pack('J', $data);
            } else {
                if ($data >= -32) return chr($data & 0xff);
                if ($data >= -128) return "\xd0" . pack('c', $data);
                if ($data >= -32768) return "\xd1" . pack('n', $data & 0xffff);
                if ($data >= -2147483648) return "\xd2" . pack('N', $data & 0xffffffff);
                return "\xd3" . pack('J', $data);
            }
        }
        if (is_float($data)) {
            return "\xcb" . pack('E', $data);
        }
        if (is_string($data)) {
            $len = strlen($data);
            if ($len <= 31) return chr(0xa0 | $len) . $data;
            if ($len <= 0xff) return "\xd9" . pack('C', $len) . $data;
            if ($len <= 0xffff) return "\xda" . pack('n', $len) . $data;
            return "\xdb" . pack('N', $len) . $data;
        }
        if (is_array($data)) {
            $isList = function_exists('array_is_list') 
                ? array_is_list($data) 
                : ($data === [] || array_keys($data) === range(0, count($data) - 1));

            $count = count($data);

            if ($isList) {
                $header = '';
                if ($count <= 15) $header = chr(0x90 | $count);
                elseif ($count <= 0xffff) $header = "\xdc" . pack('n', $count);
                else $header = "\xdd" . pack('N', $count);

                $payload = '';
                foreach ($data as $v) {
                    $payload .= self::pack($v);
                }
                return $header . $payload;
            } else {
                $header = '';
                if ($count <= 15) $header = chr(0x80 | $count);
                elseif ($count <= 0xffff) $header = "\xde" . pack('n', $count);
                else $header = "\xdf" . pack('N', $count);

                $payload = '';
                foreach ($data as $k => $v) {
                    $payload .= self::pack((string)$k) . self::pack($v);
                }
                return $header . $payload;
            }
        }

        return "\xc0";
    }
}
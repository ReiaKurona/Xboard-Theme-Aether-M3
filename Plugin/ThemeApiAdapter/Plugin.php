<?php

namespace Plugin\ThemeApiAdapter;

use App\Services\Plugin\AbstractPlugin;

class Plugin extends AbstractPlugin
{
    public function boot(): void
    {
        if ($this->getConfig('enable_acceleration', true)) {
            // 关键：prepend 插入到 API 管道最前面，包裹住整个请求生命周期
            app('router')->prependMiddlewareToGroup(
                'api',
                \Plugin\ThemeApiAdapter\Middleware\BinaryInterceptor::class
            );
        }

        $this->filter('guest_comm_config', function ($config) {
            $config['theme_api_accelerated'] = $this->getConfig('enable_acceleration', true);
            return $config;
        });

        // 🌟 新增：Service Worker 根作用域双重响应通道
        app('router')->get('/sw.js', function () {
            $candidates = [
                public_path('sw.js'),
                public_path('theme/MD3-Theme/assets/sw.js'),
                storage_path('theme/MD3-Theme/assets/sw.js')
            ];
            foreach ($candidates as $file) {
                if (file_exists($file)) {
                    return response(file_get_contents($file), 200, [
                        'Content-Type' => 'application/javascript; charset=utf-8',
                        'Service-Worker-Allowed' => '/',
                        'Cache-Control' => 'no-cache, no-store, must-revalidate'
                    ]);
                }
            }
            return response('// sw not found', 404);
        });
    }
}
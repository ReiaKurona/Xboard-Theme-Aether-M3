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
    }
}
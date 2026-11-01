import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const distDir = path.resolve(rootDir, 'dist')
const distAssetsDir = path.resolve(distDir, 'assets')

const indexHtmlPath = path.resolve(distAssetsDir, 'index.html')
if (!fs.existsSync(indexHtmlPath)) {
  console.error('❌ 未找到构建产物，请先执行 npm run build')
  process.exit(1)
}
const htmlContent = fs.readFileSync(indexHtmlPath, 'utf-8')

// 替换为 Xboard 标准动态前缀
const formatTag = (tag) => {
  return tag
    .replace(/(src|href)="\.\/assets\//g, '$1="/theme/{{$theme}}/assets/')
    .replace(/(src|href)="\.\/(js|css)\//g, '$1="/theme/{{$theme}}/assets/$2/')
    .replace(/(src|href)="\/(js|css)\//g, '$1="/theme/{{$theme}}/assets/$2/')
    .replace(/(src|href)="(js|css)\//g, '$1="/theme/{{$theme}}/assets/$2/')
}

const modulePreloadMatches = (htmlContent.match(/<link rel="modulepreload".*?>/g) || []).map(formatTag)
const cssMatches = (htmlContent.match(/<link rel="stylesheet".*?>/g) || []).map(formatTag)
const scriptMatches = (htmlContent.match(/<script type="module".*?><\/script>/g) || []).map(formatTag)

const bladeTemplate = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="referrer" content="no-referrer">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>{{$title}}</title>
  
  @php
    try {
      $swSrc = public_path('theme/' . ($theme ?? 'MD3-Theme') . '/assets/sw.js');
      $swDst = public_path('sw.js');
      if (file_exists($swSrc) && (!file_exists($swDst) || filemtime($swSrc) > filemtime($swDst))) {
          @copy($swSrc, $swDst);
      }
    } catch (\\Throwable $e) {}
  @endphp

  ${modulePreloadMatches.join('\n  ')}

<!-- 🌟 核心安全防线：强效 Cache 缓存 + 匿名沙盒中继加载器 -->
  @if(!empty($theme_config['custom_icon_url']))
    @if(str_ends_with(trim($theme_config['custom_icon_url']), '.css'))
      <link rel="stylesheet" href="{{ trim($theme_config['custom_icon_url']) }}" referrerpolicy="no-referrer" />
    @else
      <script>
        (async function() {
          var fontUrl = {!! json_encode(trim($theme_config['custom_icon_url'])) !!};
          if (!fontUrl) return;

          var CACHE_NAME = 'xboard-theme-assets-v1';

          try {
            var cache = await caches.open(CACHE_NAME);
            var cachedRes = await cache.match(fontUrl);
            
            // 🌟 如果浏览器本地已经存过，直接 0ms 内存渲染，流量开销为 0！
            if (cachedRes) {
              var buf = await cachedRes.arrayBuffer();
              var font = new FontFace('Material Symbols Outlined', buf);
              var loadedFont = await font.load();
              document.fonts.add(loadedFont);
              return;
            }
          } catch (e) {}

          // 缓存未命中：建立微型沙盒匿名下载
          var sandboxFrame = document.createElement('iframe');
          sandboxFrame.style.display = 'none';
          sandboxFrame.sandbox = 'allow-scripts';

          window.addEventListener('message', function onFontMsg(e) {
            if (e.data && e.data.type === 'ANON_FONT_SUCCESS') {
              window.removeEventListener('message', onFontMsg);
              try {
                var buf = e.data.buffer;
                var font = new FontFace('Material Symbols Outlined', buf);
                font.load().then(function(loadedFont) {
                  document.fonts.add(loadedFont);
                  sandboxFrame.remove();
                  
                  // 🌟 写盘固化：持久化存入 Cache Storage，跨重启永久保留
                  caches.open(CACHE_NAME).then(function(cache) {
                    cache.put(fontUrl, new Response(buf, { headers: { 'Content-Type': 'font/woff2', 'Cache-Control': 'max-age=31536000' } }));
                  });
                });
              } catch(err) {}
            }
          });

          sandboxFrame.srcdoc = '<!DOCTYPE html><html><head><meta name="referrer" content="no-referrer"></head><body><script>' +
            'fetch(' + JSON.stringify(fontUrl) + ', { referrerPolicy: "no-referrer" })' +
            '.then(function(r){ return r.arrayBuffer(); })' +
            '.then(function(buf){ window.parent.postMessage({ type: "ANON_FONT_SUCCESS", buffer: buf }, "*", [buf]); })' +
            '.catch(function(){ window.parent.postMessage({ type: "ANON_FONT_FAIL" }, "*"); });' +
            '<\\/script></body></html>';

          document.head.appendChild(sandboxFrame);
        })();
      </script>
    @endif
  @else
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
  @endif
   
  <!-- Xboard 全局运行时配置注入 -->
  <script>
    window.routerBase = "/";
    window.settings = {
      title: '{{$title}}',
      description: '{{$description}}',
      assets_path: '/theme/{{$theme}}/assets',
      version: '{{$version}}',
      background_url: '{{$theme_config["background_url"] ?? ""}}',
      logo: '{{$logo}}',
      custom_html: {!! json_encode($theme_config['custom_html'] ?? '') !!},
      komari_enabled: {!! json_encode(($theme_config['komari_enabled'] ?? '0') === '1') !!},
      komari_url: {!! json_encode($theme_config['komari_url'] ?? '') !!},
      download_center_url: {!! json_encode($theme_config['download_center_url'] ?? 'https://install.example.com') !!},
      activity_float_enabled: {!! json_encode(($theme_config['activity_float_enabled'] ?? '1') === '1') !!},
      activity_custom_code: {!! json_encode($theme_config['activity_custom_code'] ?? '') !!},
      custom_icon_url: {!! json_encode($theme_config['custom_icon_url'] ?? '') !!},
    };
  </script>

  ${cssMatches.join('\n  ')}
</head>
<body>
  <div id="app"></div>
  ${scriptMatches.join('\n  ')}
  {!! $theme_config['custom_html'] ?? '' !!}
</body>
</html>`

fs.writeFileSync(path.resolve(distDir, 'dashboard.blade.php'), bladeTemplate)

fs.copyFileSync(
  path.resolve(rootDir, 'theme.config.json'),
  path.resolve(distDir, 'config.json')
)

if (fs.existsSync(indexHtmlPath)) {
  fs.unlinkSync(indexHtmlPath)
}

console.log('✅ Xboard 标准结构合成完毕！')

// 🌟 核心修复：彻底消灭多余的 "." 目录，将 2 文件 1 目录直接置于 ZIP 第一级根目录
const zipOutputPath = path.resolve(rootDir, 'MD3-Theme.zip')
if (fs.existsSync(zipOutputPath)) {
  fs.unlinkSync(zipOutputPath)
}

try {
  // 直接以 dist 目录为当前上下文，精准打包 assets、dashboard.blade.php、config.json
  if (process.platform === 'win32') {
    execSync(`tar -a -cf "${zipOutputPath}" assets dashboard.blade.php config.json`, {
      cwd: distDir
    })
  } else {
    execSync(`zip -r "${zipOutputPath}" assets dashboard.blade.php config.json`, {
      cwd: distDir
    })
  }
  console.log(`🎁 【第一级根目录纯净 ZIP 打包成功】: ${zipOutputPath}`)
} catch (e) {
  console.error('打包压缩异常:', e)
}
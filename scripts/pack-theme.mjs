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

  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" /> 
   
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
    }
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
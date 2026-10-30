import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag.startsWith('md-')
        }
      }
    })
  ],
  base: './', // 相对路径适配 Xboard
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname || '', './src')
    }
  },
  build: {
    outDir: 'dist/assets',
    emptyOutDir: true,
    
    // 🌟 1. 样式完整单包输出（不碎裂，杜绝丢样式）
    cssCodeSplit: true,
    
    // 🌟 2. 彻底禁用 CSS 裁剪，保留所有滤镜、前缀与流动模糊
    cssMinify: false,

    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // 🌟 稳健拓扑拆包，避免循环依赖与 CJS 混调异常
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          // 1. Vue 基础生态 (纯 ESM，高稳强缓存)
          if (id.includes('vue') || id.includes('pinia')) {
            return 'vendor-vue-core'
          }

          // 2. Markdown 工具库
          if (id.includes('marked') || id.includes('dompurify')) {
            return 'vendor-markdown'
          }

          // 3. 将 Material Web 与 Lit 归为一个稳定大块，避免内部深层小组件循环死锁
          if (id.includes('@material/web') || id.includes('lit')) {
            return 'vendor-m3'
          }
        },

        entryFileNames: 'js/[name]-[hash].js',
        chunkFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'css/style-[hash].css'
          }
          return '[ext]/[name]-[hash].[ext]'
        }
      }
    }
  },
  server: { //配置本地开发代理
    proxy: {
      '/api': {
        target: 'https://next.example.com',
        changeOrigin: true
      },
      '/komari-proxy': {
        target: 'https://next.example.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/komari-proxy/, ''),
        headers: {
          Referer: 'https://next.example.com',
          Origin: 'https://next.example.com'
        }
      }
    }
  }
})
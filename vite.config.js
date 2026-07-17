import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // 浏览器端使用 elkjs 的 bundled 版本，避免打包时解析 Node 专用模块
      // 但保留 elkjs/lib/elk-api 等子路径的访问
      'elkjs/lib/main': 'elkjs/lib/elk.bundled.js',
    },
  },
  worker: {
    format: 'es',
  },
  build: {
    // DBML 解析器依赖 @dbml/core（~16 MB），已独立拆分为动态 chunk，
    // 此处放宽警告阈值以避免构建时误报。
    chunkSizeWarningLimit: 17000,
  },
})

import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { planPlugin } from './director/pipeline/vite-plan-plugin';

// 单文件产物：一份 index.html，双击即开，也能直接发布成 Artifact。
export default defineConfig(({ command }) => ({
  root: '.',
  base: './',
  plugins: [planPlugin(), command === 'build' ? viteSingleFile({ removeViteModuleLoader: true }) : null],
  server: { host: '127.0.0.1', port: Number(process.env.PORT ?? 5173), strictPort: false },
  build: {
    outDir: process.env.ZHUZI_OUT ?? 'dist',
    emptyOutDir: true,
    target: 'es2022',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 4000,
    rollupOptions: { input: process.env.ZHUZI_ENTRY ?? 'index.html' },
  },
}));

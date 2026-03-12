import { defineConfig, loadEnv } from 'vite'
import type { ConfigEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default ({ mode }: ConfigEnv) => {
  // Load environment variables based on current mode
  const env = loadEnv(mode, process.cwd(), '')

  return defineConfig({
    plugins: [react()],
    server: {
      hmr: true,
      host: '0.0.0.0',
      allowedHosts: true, // allow any host (safe in Docker behind Nginx)
      port: 8501,
    },
  })
}

import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],

  // Vite options tailored for Tauri development
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // ignore watching src-tauri
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    outDir: "build",
  },
})

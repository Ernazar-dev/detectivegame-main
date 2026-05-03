import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react":  ["react", "react-dom"],
          "vendor-antd":   ["antd", "@ant-design/icons"],
          "vendor-motion": ["framer-motion"],
          "vendor-query":  ["@tanstack/react-query"],
          "vendor-charts": ["recharts"],
        },
      },
    },
  },

  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8081",
        changeOrigin: true,
        ws: true,   // WebSocket proxy (xterm.js uchun)
      },
    },
  },
});
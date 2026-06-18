import { defineConfig } from "vite";

/** 静的 HTML をルートから配信（file:// ではなく http://localhost で確認） */
export default defineConfig({
  appType: "mpa",
  root: ".",
  publicDir: false,
  define: {
    global: "globalThis",
  },
  optimizeDeps: {
    include: ["three", "@pixiv/three-vrm"],
  },
  server: {
    port: 5173,
    strictPort: false,
    open: "/gen-ai-workspace.html",
  },
  preview: {
    port: 4173,
  },
});

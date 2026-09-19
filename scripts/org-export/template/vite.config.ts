import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const upstream =
    env.FREEOS_UPSTREAM || process.env.FREEOS_UPSTREAM || "http://127.0.0.1:8088";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "org-ui": path.resolve(__dirname, "src/org-ui"),
      },
      dedupe: ["react", "react-dom"],
    },
    css: {
      modules: {
        localsConvention: "camelCase",
      },
    },
    server: {
      host: "0.0.0.0",
      port: Number(process.env.PORT || 3780),
      proxy: {
        "/api": {
          target: upstream,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: "0.0.0.0",
      port: Number(process.env.PORT || 3780),
      proxy: {
        "/api": {
          target: upstream,
          changeOrigin: true,
        },
      },
    },
  };
});

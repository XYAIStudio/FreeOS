import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative URLs so `dist/` works at domain root or a GitHub Pages project path.
  base: "./",
});

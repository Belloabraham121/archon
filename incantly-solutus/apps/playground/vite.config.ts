import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const packageSource = (name: string) => new URL(`../../packages/${name}/src/index.ts`, import.meta.url).pathname;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@incantly/core": packageSource("core"),
      "@incantly/math": packageSource("math"),
      "@incantly/scene": packageSource("scene"),
      "@incantly/tiptap": packageSource("tiptap"),
      "@incantly/audio-web": packageSource("audio-web"),
      "@incantly/sdk": packageSource("sdk"),
    },
  },
  server: { port: 5173, strictPort: true },
});

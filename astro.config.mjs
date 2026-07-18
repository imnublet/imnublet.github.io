// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@tailwindcss/vite';

// User GitHub Pages site (served at the domain root) built into ./docs.
export default defineConfig({
  site: 'https://imnublet.github.io',
  outDir: './docs',
  build: { format: 'directory' },
  vite: { plugins: [tailwind()] },
});

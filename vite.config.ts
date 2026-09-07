import { sites } from '@openai/sites-vite-plugin';
import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';

// This song catalogue is fully static; no Cloudflare Worker runtime is needed.
export default defineConfig({
 css: { postcss: { plugins: [tailwindcss()] } },
 plugins: [vinext(), sites()],
});

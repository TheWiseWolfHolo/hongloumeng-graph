import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://honglou.wolfholo.com',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  devToolbar: { enabled: false }
});

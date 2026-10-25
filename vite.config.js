import {defineConfig} from 'vite';

// base './' makes the build work from any sub-path, e.g. https://<user>.github.io/starwake/
export default defineConfig({
  base: './',
  server: {host: true},          // reachable from your phone on the same Wi-Fi
  build: {target: 'es2020', chunkSizeWarningLimit: 1200},
  test: {environment: 'node'},
});

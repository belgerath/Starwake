import {defineConfig} from 'vite';

// base './' makes the build work from any sub-path, e.g. https://<user>.github.io/starwake/
export default defineConfig({
  base: './',
  server: {host: true},          // reachable from your phone on the same Wi-Fi
  // The hangar's three.js add-ons are imported on demand; bundled up front so the dev server does not
  // reload the page the first time you dock.
  optimizeDeps: {include: ['three/examples/jsm/loaders/GLTFLoader.js', 'three/examples/jsm/libs/meshopt_decoder.module.js', 'three/examples/jsm/utils/SkeletonUtils.js', 'three/examples/jsm/environments/RoomEnvironment.js']},
  build: {target: 'es2020', chunkSizeWarningLimit: 1200},
  test: {environment: 'node'},
});

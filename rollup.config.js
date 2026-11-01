import { nodeResolve } from '@rollup/plugin-node-resolve';
import dynamicImportVars from '@rollup/plugin-dynamic-import-vars';
import terser from '@rollup/plugin-terser';
import glsl from 'rollup-plugin-glsl';

// Workbox and a few dependencies read `process.env.NODE_ENV` at runtime. There
// is no Node `process` in the browser or in a service worker, so replace it at
// build time instead of shipping a runtime shim.
const nodeEnv = () => ({
  name: 'node-env',
  transform(code) {
    if (!code.includes('process.env.NODE_ENV')) return null;
    return {
      code: code.replaceAll('process.env.NODE_ENV', JSON.stringify('production')),
      map: null,
    };
  },
});

export default [
  {
    input: ['src/js/index.js'],
    output: {
      dir: '_site/js',
      format: 'es',
      sourcemap: false,
    },
    plugins: [
      nodeResolve(),
      nodeEnv(),
      glsl({
        include: 'src/js/shaders/*.glsl',
      }),
      dynamicImportVars({
        include: 'src/js/routes/**.js',
      }),
      terser(),
    ],
  },
  {
    // The service worker is bundled separately so Workbox can inject the
    // precache manifest after Eleventy and image optimisation have finished.
    input: 'src/sw/service-worker.js',
    output: {
      file: '.cache/sw-bundle.js',
      format: 'iife',
      sourcemap: false,
    },
    plugins: [nodeResolve(), nodeEnv(), terser()],
  },
];

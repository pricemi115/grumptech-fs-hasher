import nodePolyfills  from 'rollup-plugin-node-polyfills';
import json           from '@rollup/plugin-json';

export default {
  external: ['fs', 'path', 'crypto', 'tty', 'util', 'os', 'events'],
  input: 'src/main.js',
  output: [
    {
      file: 'dist/grumptech-fs-hasher.js',
      format: 'cjs',
      exports: 'named'
    },
  ],
  plugins: [
    nodePolyfills(),
    json()
  ]
};

import css from 'rollup-plugin-import-css';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import posthtml from 'rollup-plugin-posthtml-template';
import include from 'posthtml-include';

export default {
  input: "src/app.js",
  output: {
    dir: "dist",
    format: "iife"
  },
  plugins: [
    css(),
    nodeResolve(),
    posthtml({
      template: true,
      plugins: [include()]
    })
  ]
}
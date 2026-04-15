import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');

// Ensure dist directory exists
mkdirSync(resolve(__dirname, 'dist'), { recursive: true });

// Bundle content script (single IIFE file containing everything)
const buildOptions = {
  entryPoints: [resolve(__dirname, 'src/content/main.ts')],
  bundle: true,
  outfile: resolve(__dirname, 'dist/content.js'),
  format: 'iife',
  target: 'chrome120',
  minify: false,
  sourcemap: true,
};

if (watch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await esbuild.build(buildOptions);
  console.log('Build complete.');
}

// Copy static files to dist
cpSync(resolve(__dirname, 'manifest.json'), resolve(__dirname, 'dist/manifest.json'));
cpSync(resolve(__dirname, 'src/content/content.css'), resolve(__dirname, 'dist/content.css'));

// Copy icons if they exist
if (existsSync(resolve(__dirname, 'icons'))) {
  cpSync(resolve(__dirname, 'icons'), resolve(__dirname, 'dist/icons'), { recursive: true });
}

console.log('Static files copied.');

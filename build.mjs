import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');

// Build target: "chrome" (default) or "firefox". Picks which manifest to copy
// and which output dir to populate. The bundled JS itself is identical —
// Firefox MV3 aliases the chrome.* namespace, so no source-level branching
// is needed.
const targetArg = process.argv.find((a) => a.startsWith('--target='));
const target = targetArg ? targetArg.split('=')[1] : 'chrome';
if (target !== 'chrome' && target !== 'firefox') {
  console.error(`Unknown --target=${target}. Expected "chrome" or "firefox".`);
  process.exit(1);
}

const outDir = target === 'firefox' ? 'dist-firefox' : 'dist';
const manifestFile = target === 'firefox' ? 'manifest.firefox.json' : 'manifest.json';

mkdirSync(resolve(__dirname, outDir), { recursive: true });

// Bundle content script (single IIFE file containing everything).
// CSS files are imported as raw text and injected into a Shadow DOM at runtime,
// so the host page can't style our overlay and our styles can't leak out.
const buildOptions = {
  entryPoints: [resolve(__dirname, 'src/content/main.ts')],
  bundle: true,
  outfile: resolve(__dirname, `${outDir}/content.js`),
  format: 'iife',
  target: target === 'firefox' ? 'firefox115' : 'chrome120',
  minify: false,
  sourcemap: true,
  loader: {
    '.css': 'text',
  },
};

if (watch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log(`Watching for changes (target: ${target}, out: ${outDir}/)...`);
} else {
  await esbuild.build(buildOptions);
  console.log(`Build complete (target: ${target}).`);
}

// Copy static files to output dir. CSS is bundled into content.js (see loader
// above), so we no longer copy it as a separate file. The target-specific
// manifest is always written as "manifest.json" in the output.
cpSync(resolve(__dirname, manifestFile), resolve(__dirname, `${outDir}/manifest.json`));

// Copy icons if they exist
if (existsSync(resolve(__dirname, 'icons'))) {
  cpSync(resolve(__dirname, 'icons'), resolve(__dirname, `${outDir}/icons`), { recursive: true });
}

console.log(`Static files copied to ${outDir}/.`);

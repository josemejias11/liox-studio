import { build } from 'esbuild';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const webSrc = path.join(root, '..', '..', 'apps', 'web', 'src');
const outDir = path.join(root, 'dist');

await mkdir(outDir, { recursive: true });

await build({
  entryPoints: [path.join(root, 'src', 'player-bundle', 'entry.tsx')],
  bundle: true,
  minify: true,
  format: 'iife',
  outfile: path.join(outDir, 'player.js'),
  jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  alias: {
    '@': webSrc,
    // Scoped to this build only — apps/web keeps using the real next/image everywhere
    // else. The standalone bundle has no Next.js server behind it, so next/image's
    // default loader (which calls /_next/image?url=...) would 404 on every image; this
    // aliases it to a plain <img>-rendering shim instead. See next-image-shim.tsx.
    'next/image': path.join(root, 'src', 'player-bundle', 'next-image-shim.tsx'),
  },
  // 'process.env' as a whole (in addition to the specific NODE_ENV key) because the
  // bundled Next.js internals (next/image, next/link) read several other
  // process.env.__NEXT_* flags directly with no runtime guard; without a catch-all
  // those throw "process is not defined" in the browser, since no Node "process"
  // global exists there.
  define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' },
});

const cssEntry = path.join(root, 'src', 'player-bundle', 'styles.css');
const cssSource = await readFile(cssEntry, 'utf8');
const result = await postcss([tailwindcss()]).process(cssSource, { from: cssEntry, to: path.join(outDir, 'player.css') });
await writeFile(path.join(outDir, 'player.css'), result.css);

const fontsSource = path.join(root, 'src', 'player-bundle', 'fonts');
const fontsOut = path.join(outDir, 'fonts');
await mkdir(fontsOut, { recursive: true });
await cp(fontsSource, fontsOut, { recursive: true });

console.log('Built packages/scorm-export/dist/player.js, player.css, and fonts/');

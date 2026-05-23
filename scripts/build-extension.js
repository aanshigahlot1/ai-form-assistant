// scripts/build-extension.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT   = path.join(__dirname, '..');
const EXT    = path.join(ROOT, 'extension');
const DIST   = path.join(ROOT, 'dist');

console.log('🔨 Assembling extension dist...');
if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true });
fs.mkdirSync(DIST, { recursive: true });

// 1. Manifest
cp(path.join(EXT, 'manifest', 'manifest.json'), path.join(DIST, 'manifest.json'));

// 2. Icons
cpDir(path.join(EXT, 'icons'), path.join(DIST, 'icons'));

// 3. Background (self-contained plain JS — no bundle needed)
cpDir(path.join(EXT, 'background'), path.join(DIST, 'background'));

// 4. Content script: copy content.js as content.bundle.js + CSS
fs.mkdirSync(path.join(DIST, 'content'), { recursive: true });
fs.copyFileSync(path.join(EXT, 'content', 'content.js'), path.join(DIST, 'content', 'content.bundle.js'));
fs.copyFileSync(path.join(EXT, 'content', 'content.css'), path.join(DIST, 'content', 'content.css'));
console.log('  ✓ content/');

// 5. Popup (pre-built by Vite)
const popupBuild = path.join(EXT, 'popup', 'dist');
if (!fs.existsSync(popupBuild)) { console.error('❌ Popup not built. Run: cd extension/popup && npm run build'); process.exit(1); }
cpDir(popupBuild, path.join(DIST, 'popup'));

// 6. Verify manifest references exist
const manifest = JSON.parse(fs.readFileSync(path.join(DIST, 'manifest.json'), 'utf8'));
const checks = [
  manifest.background.service_worker,
  manifest.content_scripts[0].js[0],
  manifest.content_scripts[0].css[0],
  manifest.action.default_popup,
  ...Object.values(manifest.icons)
];
let allOk = true;
for (const ref of checks) {
  const full = path.join(DIST, ref);
  if (!fs.existsSync(full)) { console.error(`  ✗ MISSING: ${ref}`); allOk = false; }
  else console.log(`  ✓ ${ref}`);
}
if (!allOk) { console.error('❌ Build has missing files'); process.exit(1); }

console.log('\n✅ Extension ready in /dist/');
console.log('   → chrome://extensions/ → Load unpacked → select /dist/');

function cp(src, dest) { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(src, dest); }
function cpDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src)) {
    const s = path.join(src, e), d = path.join(dest, e);
    fs.statSync(s).isDirectory() ? cpDir(s, d) : fs.copyFileSync(s, d);
  }
  console.log(`  ✓ ${path.basename(dest)}/`);
}

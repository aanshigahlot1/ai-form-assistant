// scripts/package-extension.js
// Creates a .zip ready for Chrome Web Store upload

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createWriteStream } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

async function createZip() {
  // Dynamic import of archiver
  const { default: archiver } = await import('archiver');

  if (!fs.existsSync(DIST)) {
    console.error('❌ /dist not found. Run: npm run build first.');
    process.exit(1);
  }

  const version = JSON.parse(fs.readFileSync(path.join(DIST, 'manifest.json'), 'utf8')).version;
  const outPath = path.join(ROOT, `ai-form-assistant-v${version}.zip`);

  const output = createWriteStream(outPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  output.on('close', () => {
    console.log(`✅ Packaged: ${path.basename(outPath)} (${(archive.pointer() / 1024).toFixed(1)} KB)`);
  });

  archive.on('error', err => { throw err; });
  archive.pipe(output);
  archive.directory(DIST, false);
  await archive.finalize();
}

createZip().catch(console.error);

/**
 * Sync monorepo shared CSS into AmroGen frontend for Cloud Run / Docker builds.
 * Build context is frontend/ only — ../../shared is not in the Docker image.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stylesDir = path.join(frontendRoot, 'styles');

/** @param {string} sharedRelative e.g. ../../shared/foo.css */
function syncSharedCss(sharedRelative, targetFileName, canonicalPath) {
  const source = path.resolve(frontendRoot, sharedRelative);
  const target = path.join(stylesDir, targetFileName);

  if (!fs.existsSync(source)) {
    if (fs.existsSync(target)) {
      return;
    }
    console.error(`Missing ${sharedRelative} and styles/${targetFileName}`);
    process.exit(1);
  }

  fs.mkdirSync(stylesDir, { recursive: true });
  const sharedCss = fs.readFileSync(source, 'utf8');
  const banner = `/**\n * Source of truth: ${canonicalPath} (synced by scripts/sync-shared-typography.mjs).\n */\n\n`;
  const body = sharedCss.replace(/^\/\*\*[\s\S]*?\*\/\s*/m, '');
  fs.writeFileSync(target, banner + body, 'utf8');
}

const dockerContext = process.argv.includes('--docker-context');

if (dockerContext) {
  const required = [
    'amro-typography.css',
    'amro-design-tokens.css',
    'article-process-flow.css',
  ];
  const missing = required.filter((file) => !fs.existsSync(path.join(stylesDir, file)));
  if (missing.length > 0) {
    console.error(
      `Missing styles/{${missing.join(', ')}} (required for Docker / Cloud Run build — run: npm run prebuild)`
    );
    process.exit(1);
  }
  console.log('Docker context: vendored shared CSS present.');
  process.exit(0);
}

syncSharedCss('../../shared/amro-typography.css', 'amro-typography.css', '../../shared/amro-typography.css');
syncSharedCss(
  '../../shared/amro-design-tokens.css',
  'amro-design-tokens.css',
  '../../shared/amro-design-tokens.css'
);
syncSharedCss(
  '../../shared/process-flow/article-process-flow.css',
  'article-process-flow.css',
  '../../shared/process-flow/article-process-flow.css'
);

console.log('Synced shared CSS → styles/');

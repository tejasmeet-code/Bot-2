// Entry point that runs the compiled application directly
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

console.log('⚡ Starting Zenith Bot service...');

const distFile = path.resolve('./artifacts/api-server/dist/index.mjs');
if (!existsSync(distFile)) {
  console.log('🔨 Build output missing. Running automatic build via esbuild...');
  try {
    execSync('node ./artifacts/api-server/build.mjs', { stdio: 'inherit' });
  } catch (e) {
    console.error('❌ Automatic build failed:', e);
  }
}

import('./artifacts/api-server/dist/index.mjs').catch((err) => {
  console.error('❌ Failed to launch application:', err);
  process.exit(1);
});

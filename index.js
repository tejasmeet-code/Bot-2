import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

console.log('==============================================');
console.log('🚀 Launching Zenith Discord Bot on HeavenCloud');
console.log('==============================================');

// Ensure requirements are installed
const reqPath = path.resolve('./bot/requirements.txt');
if (fs.existsSync(reqPath)) {
  try {
    console.log('📦 Installing / verifying Python dependencies from bot/requirements.txt...');
    execSync('pip3 install -r bot/requirements.txt --break-system-packages --no-warn-script-location --quiet', { stdio: 'inherit' });
    console.log('✅ Python dependencies verified.');
  } catch (err) {
    console.warn('⚠️ pip install notice:', err.message);
  }
}

// Launch the Python bot process
console.log('🤖 Starting bot/CodeX.py ...');
const bot = spawn('python3', ['bot/CodeX.py'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PYTHONUNBUFFERED: '1',
    brand_name: 'Zenith',
    NEXT_PUBLIC_BRAND_NAME: 'Zenith'
  }
});

bot.on('error', (err) => {
  console.error('❌ Failed to start Python bot process:', err);
});

bot.on('exit', (code, signal) => {
  console.log(`⚠️ Bot process exited with code ${code} / signal ${signal}`);
  process.exit(code || 0);
});

import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  try {
    fs.appendFileSync(path.resolve('./bot.log'), line);
  } catch (_) {}
}

log('==============================================');
log('🚀 Launching Zenith Discord Bot on HeavenCloud');
log('==============================================');

// Find or bootstrap Python virtualenv
const possibleVenvs = [
  path.resolve('./.venv/bin/python3'),
  '/home/container/.venv/bin/python3',
  process.env.VIRTUAL_ENV ? path.join(process.env.VIRTUAL_ENV, 'bin/python3') : null,
  '/usr/local/bin/python3',
  '/usr/bin/python3',
  'python3'
].filter(Boolean);

let pythonBin = 'python3';
for (const p of possibleVenvs) {
  if (fs.existsSync(p)) {
    pythonBin = p;
    break;
  }
}

// If on HeavenCloud / Pterodactyl container without venv, auto-setup via uv
const venvPath = path.resolve('./.venv/bin/python3');
if (!fs.existsSync(venvPath) && !fs.existsSync('/home/container/.venv/bin/python3')) {
  try {
    log('📦 Python venv not found. Auto-bootstrapping with uv...');
    const uvBin = fs.existsSync('/home/container/.local/bin/uv') ? '/home/container/.local/bin/uv' : 'uv';
    try {
      execSync(`${uvBin} --version`, { stdio: 'ignore' });
    } catch {
      log('⬇️ Installing standalone uv...');
      execSync('curl -LsSf https://astral.sh/uv/install.sh | sh', { stdio: 'inherit' });
    }
    const finalUv = fs.existsSync('/home/container/.local/bin/uv') ? '/home/container/.local/bin/uv' : 'uv';
    log('🔨 Initializing Python virtual environment (.venv)...');
    execSync(`${finalUv} venv /home/container/.venv`, { stdio: 'inherit' });
    log('📥 Installing dependencies from bot/requirements.txt...');
    execSync(`${finalUv} pip install -r bot/requirements.txt --python /home/container/.venv`, { stdio: 'inherit' });
    pythonBin = '/home/container/.venv/bin/python3';
    log('✅ Virtual environment ready.');
  } catch (err) {
    log(`⚠️ Automated venv setup notice: ${err.message}`);
  }
} else if (fs.existsSync('/home/container/.venv/bin/python3')) {
  pythonBin = '/home/container/.venv/bin/python3';
}

log(`🐍 Selected Python Binary: ${pythonBin}`);

// Start HTTP health-check server to satisfy Pterodactyl egg startup check and external monitors
const port = parseInt(process.env.SERVER_PORT || process.env.PORT || '3046', 10);
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'online',
    bot: 'Zenith',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  }));
});

server.listen(port, '0.0.0.0', () => {
  log(`Listening on port ${port}`);
  log(`Server listening on port ${port}`);
  log(`Ready! Bot is running.`);
});

// Launch Python bot
const botCwd = path.resolve('./bot');
log(`🤖 Spawning Zenith bot process in cwd: ${botCwd} ...`);

const bot = spawn(pythonBin, ['CodeX.py'], {
  cwd: botCwd,
  env: {
    ...process.env,
    PYTHONUNBUFFERED: '1',
    brand_name: 'Zenith',
    NEXT_PUBLIC_BRAND_NAME: 'Zenith'
  }
});

bot.stdout.on('data', (d) => {
  const str = d.toString();
  log(`[BOT STDOUT] ${str}`);
});

bot.stderr.on('data', (d) => {
  const str = d.toString();
  log(`[BOT STDERR] ${str}`);
});

bot.on('error', (err) => {
  log(`❌ Failed to start Python bot process: ${err.message}`);
});

bot.on('exit', (code, signal) => {
  log(`⚠️ Bot process exited with code ${code} / signal ${signal}`);
  setTimeout(() => process.exit(code || 0), 5000);
});

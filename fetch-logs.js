import WebSocket from 'ws';

const apiKey = "ptlc_hmAxzmforsuv89WoYJq0klQE2RWmwXtBfXgxQp4UsyL";
const serverId = "ab1dac28";

async function run() {
  console.log('Fetching fresh websocket credentials from Heaven Cloud...');
  const res = await fetch(`https://control.heavencloud.in/api/client/servers/${serverId}/websocket`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch websocket credentials: ${res.statusText}`);
  }

  const payload = await res.json();
  const { token, socket } = payload.data;

  console.log('Connecting to', socket);
  const ws = new WebSocket(socket, {
    rejectUnauthorized: false,
    headers: {
      'Origin': 'https://control.heavencloud.in'
    }
  });

  ws.on('open', () => {
    console.log('WebSocket connection opened');
    ws.send(JSON.stringify({
      event: 'auth',
      args: [token]
    }));
  });

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.event === 'console output') {
        console.log('[CONSOLE]', msg.args ? msg.args.join(' ') : '');
      } else {
        console.log(`[Event: ${msg.event}]`, msg.args ? msg.args.join(' ') : '');
      }
      
      if (msg.event === 'auth success') {
        console.log('Authentication successful. Requesting logs...');
        ws.send(JSON.stringify({
          event: 'send logs',
          args: []
        }));
      }
    } catch (e) {
      console.log('Raw message:', data.toString());
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });

  ws.on('close', (code, reason) => {
    console.log(`WebSocket closed: Code ${code}, Reason: ${reason}`);
  });

  // Keep alive for 8 seconds to capture logs
  setTimeout(() => {
    console.log('Timing out, closing websocket');
    ws.close();
    process.exit(0);
  }, 8000);
}

run().catch(console.error);

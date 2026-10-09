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
    throw new Error(`Failed to fetch credentials: ${res.statusText}`);
  }

  const { data } = await res.json();
  const socketUrl = data.socket;
  const token = data.token;

  console.log('Connecting to WebSocket:', socketUrl);

  const socket = new WebSocket(socketUrl, {
    headers: {
      'Origin': 'https://control.heavencloud.in'
    }
  });

  socket.on('open', () => {
    console.log('WebSocket connection opened. Sending auth token...');
    socket.send(JSON.stringify({
      event: 'auth',
      args: [token]
    }));
  });

  socket.on('message', (msgStr) => {
    try {
      const msg = JSON.parse(msgStr);
      if (msg.event === 'auth success') {
        console.log('Auth success!');
        // Request logs
        socket.send(JSON.stringify({
          event: 'send logs',
          args: []
        }));
      } else if (msg.event === 'console output') {
        console.log('CONSOLE:', msg.args.join(' '));
      } else if (msg.event === 'status') {
        console.log('STATUS:', msg.args[0]);
      } else {
        console.log('EVENT:', msg.event, msg.args);
      }
    } catch (e) {
      console.log('RAW MSG:', msgStr.toString());
    }
  });

  socket.on('error', (err) => {
    console.error('WebSocket Error:', err);
  });

  socket.on('close', (code, reason) => {
    console.log(`WebSocket closed: ${code} - ${reason}`);
  });

  // Keep alive / exit after 10 seconds
  setTimeout(() => {
    console.log('Closing socket after 10 seconds.');
    socket.close();
  }, 10000);
}

run().catch(console.error);

import WebSocket from 'ws';

const socketUrl = "wss://dallas.heavencloud.in:8080/api/servers/ab1dac28-54d4-449b-9c32-9d0bc3a2a6da/ws";
const token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImp0aSI6ImQ0ZmY5M2UxZGNhYTY4MmIwYThhMDhlYzExZTJmZjZjY2Q0NzU3OWY4OGU4YTgyNjRlOTg4M2YzZTQxOGZkMmEifQ.eyJpc3MiOiJodHRwczovL2NvbnRyb2wuaGVhdmVuY2xvdWQuaW4iLCJhdWQiOlsiaHR0cHM6Ly9kYWxsYXMuaGVhdmVuY2xvdWQuaW46ODA4MCJdLCJqdGkiOiJkNGZmOTNlMWRjYWE2ODJiMGE4YTA4ZWMxMWUyZmY2Y2NkNDc1NzlmODhlOGE4MjY0ZTk4ODNmM2U0MThmZDJhIiwiaWF0IjoxNzkxNTUwMTkxLCJuYmYiOjE3OTE1NDk4OTEsImV4cCI6MTc5MTU1MDc5MSwic2VydmVyX3V1aWQiOiJhYjFkYWMyOC01NGQ0LTQ0OWItOWMzMi05ZDBiYzNhMmE2ZGEiLCJwZXJtaXNzaW9ucyI6WyIqIl0sInNjb3BlIjoid2Vic29ja2V0IiwidXNlcl91dWlkIjoiZDU3MTljZWUtZmFjYS00ZjI2LTgwNmEtYjk4MjRjNTJlNmI1IiwidW5pcXVlX2lkIjoiQTFZVGZvR0toV0RzZ1hHVyJ9.UxGFIT4-E-hfqDbo95b9YSS73D9--2WswE_F3lO17tE";

console.log('Connecting to WebSocket...');
const ws = new WebSocket(socketUrl, {
  headers: {
    'Origin': 'https://control.heavencloud.in'
  }
});

ws.on('open', () => {
  console.log('WebSocket open! Authenticating...');
  ws.send(JSON.stringify({
    event: 'auth',
    args: [token]
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.event === 'token expiring' || msg.event === 'token expired') {
    console.log('Token expiring or expired.');
  } else if (msg.event === 'auth success') {
    console.log('Auth success! Requesting logs...');
    ws.send(JSON.stringify({
      event: 'send logs',
      args: []
    }));
  } else if (msg.event === 'console output') {
    const line = msg.args[0];
    console.log(line);
    if (line.includes('Gateway connected!') || line.includes('Zenith Bot starting') || line.includes('[STARTUP]')) {
      console.log('Detected successful startup logs!');
    }
  } else if (msg.event === 'status') {
    console.log('--- SERVER STATUS:', msg.args[0]);
    if (msg.args[0] === 'running') {
      console.log('🎉🎉🎉 SERVER IS OFFICIALLY RUNNING / ONLINE !!! 🎉🎉🎉');
    }
  } else if (msg.event === 'stats') {
    try {
      const stats = JSON.parse(msg.args[0]);
      console.log(`--- Server Stats: CPU: ${stats.cpu_absolute}%, Memory: ${(stats.memory_bytes / 1024 / 1024).toFixed(1)} MB, State: ${stats.state}`);
      if (stats.state === 'running') {
        console.log('🎉🎉🎉 SERVER IS OFFICIALLY RUNNING / ONLINE !!! 🎉🎉🎉');
      }
    } catch {}
  }
});

ws.on('error', (err) => {
  console.error('WS Error:', err);
});

ws.on('close', (code, reason) => {
  console.log('WS Close:', code, reason.toString());
  process.exit(0);
});

// Exit after 45 seconds
setTimeout(() => {
  console.log('Monitoring period finished.');
  ws.close();
  process.exit(0);
}, 45000);

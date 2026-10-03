import https from 'node:https';

const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  console.error('DISCORD_BOT_TOKEN not found');
  process.exit(1);
}

console.log('Testing connection to Discord API...');
console.log('Token length:', token.length);

const options = {
  hostname: 'discord.com',
  port: 443,
  path: '/api/v10/users/@me',
  method: 'GET',
  headers: {
    'Authorization': `Bot ${token}`,
    'User-Agent': 'DiscordBot (https://github.com/discordjs/discord.js, 14.16.3)'
  }
};

const req = https.request(options, (res) => {
  console.log('Status code:', res.statusCode);
  console.log('Headers:', res.headers);

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Response body:', data);
    try {
        const json = JSON.parse(data);
        if (json.id) {
            console.log('✅ Token is valid! Bot ID:', json.id, 'Username:', json.username);
        } else {
            console.log('❌ Token might be invalid or restricted.');
        }
    } catch (e) {
        console.log('❌ Failed to parse JSON response');
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request error:', e);
});

req.end();

setTimeout(() => {
    console.log('Timeout reached after 10s');
    process.exit(1);
}, 10000);

const net = require('net');

const HOST = process.argv[2] || 'localhost';
const PORT = process.argv[3] || 5005;
const HEX  = process.argv[4] || '0140d0fd6908cc6e0d5010e84300001e100e';

console.log(`Sending to ${HOST}:${PORT} — payload: ${HEX}`);

const client = net.createConnection({ port: Number(PORT), host: HOST }, () => {
    client.write(HEX);
    client.end();
});

client.on('data', (data) => console.log('Server response:', data.toString()));
client.on('end',  () => console.log('✅ Done — check server logs for insert confirmation'));
client.on('error', (err) => console.error('❌ Connection error:', err.message));

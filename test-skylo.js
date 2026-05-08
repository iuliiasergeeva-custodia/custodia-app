const http = require('http');
const https = require('https');

const HOST    = process.argv[2] || 'localhost';
const PORT    = process.argv[3] || '1000';
const HEX     = process.argv[4] || '0140d0fd6908cc6e0d5010e84300001e100e';
const useHttps = HOST !== 'localhost' && HOST !== '127.0.0.1';

const options = {
    hostname: HOST,
    port:     PORT,
    path:     '/api/skylo/ingest',
    method:   'POST',
    headers:  {
        'Content-Type':   'text/plain',
        'Content-Length': Buffer.byteLength(HEX),
    },
};

console.log(`Sending to ${useHttps ? 'https' : 'http'}://${HOST}:${PORT}/api/skylo/ingest`);
console.log(`Payload: ${HEX}`);

const transport = useHttps ? https : http;
const req = transport.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log(`Response: ${data}`);
        if (res.statusCode === 200) console.log('✅ Success!');
        else console.log('❌ Failed — check server logs');
    });
});

req.on('error', err => console.error('❌ Request error:', err.message));
req.write(HEX);
req.end();

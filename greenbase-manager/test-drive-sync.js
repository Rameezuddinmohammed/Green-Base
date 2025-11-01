// Quick test script to debug Google Drive sync
const https = require('https');

const sourceId = '5bcf7ca0-1416-43d4-826c-24f72963e483';

// Test 1: Reset change token to force full sync
console.log('🔄 Testing Google Drive sync...');

const postData = JSON.stringify({
  syncType: 'manual',
  resetChangeToken: true
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: `/api/sources/${sourceId}/sync`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    // Add cookie header if needed for auth
    'Cookie': 'sb-yjlmfreyaenqjhnvmkje-auth-token=...' // You'd need to get this from browser
  }
};

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers)}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', JSON.parse(data));
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(postData);
req.end();
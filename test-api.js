// Quick API test script
const http = require('http');

function testEndpoint(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const options = {
      hostname: '192.168.1.111',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        console.log(`${method} ${path} => ${res.statusCode}`);
        try {
          console.log(JSON.parse(body));
        } catch(e) {
          console.log(body.substring(0, 200));
        }
        resolve();
      });
    });

    req.on('error', (err) => {
      console.log(`${method} ${path} => ERROR: ${err.message}`);
      resolve();
    });

    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('=== Testing ZenScreen API ===\n');
  
  // 1. Health check
  await testEndpoint('GET', '/health');
  
  // 2. Register
  console.log('\n--- Register ---');
  await testEndpoint('POST', '/api/auth/register', {
    name: 'TestUser',
    email: 'apitest@test.com',
    password: 'password123'
  });
  
  // 3. Login
  console.log('\n--- Login ---');
  await testEndpoint('POST', '/api/auth/login', {
    email: 'apitest@test.com',
    password: 'password123'
  });

  console.log('\n=== Done ===');
}

main();

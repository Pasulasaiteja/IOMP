// DIAGNOSTIC: Login Error Troubleshooting

// Step 1: Verify server is reachable
console.log('[TEST] Server health check...');
fetch('http://192.168.1.111:3001/health')
  .then(r => r.json())
  .then(d => console.log('[✅ SERVER OK]', d))
  .catch(e => console.error('[❌ SERVER UNREACHABLE]', e));

// Step 2: Test login endpoint directly
console.log('[TEST] Testing login endpoint...');
fetch('http://192.168.1.111:3001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    email: 'test@example.com', 
    password: 'password123' 
  })
})
  .then(r => {
    console.log('[✅ RESPONSE RECEIVED]', 'Status:', r.status);
    return r.json();
  })
  .then(d => {
    if (d.token) {
      console.log('[✅ LOGIN SUCCESS]', 'Token:', d.token.substring(0, 20) + '...');
      console.log('[✅ USER DATA]', d.user);
    } else {
      console.error('[❌ NO TOKEN]', d);
    }
  })
  .catch(e => console.error('[❌ LOGIN FAILED]', e.message));

// Step 3: Check API variable
console.log('[TEST] API Configuration...');
console.log('API URL:', typeof API !== 'undefined' ? API : 'NOT DEFINED');
console.log('Capacitor:', typeof window.Capacitor);

// Step 4: Check token storage
console.log('[TEST] Token storage...');
console.log('localStorage token:', localStorage.getItem('zs_token') ? 'EXISTS' : 'EMPTY');

// Step 5: Test form field values
console.log('[TEST] Form fields...');
const emailField = document.getElementById('login-email');
const pwField = document.getElementById('login-pw');
console.log('Email field exists:', !!emailField);
console.log('Password field exists:', !!pwField);

// Step 6: Simulate login
console.log('[TEST] Attempting login with test credentials...');
if (emailField && pwField) {
  emailField.value = 'test@example.com';
  pwField.value = 'password123';
  console.log('Fields populated, ready for doLogin()');
  console.log('Run: doLogin()');
}

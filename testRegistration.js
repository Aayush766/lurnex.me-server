// testRegistration.js
// Run this from your server folder:  node testRegistration.js
//
// This sends a real registration request directly to your backend
// (bypassing the browser/frontend entirely), so we can see exactly
// what the server does with it.
//
// Make sure `node server.js` is running in ANOTHER terminal before
// you run this script.

const BASE_URL = 'https://lurnex-me-server.onrender.com/api';

// Use a random email each time so "user already exists" never blocks the test
const randomId = Math.floor(Math.random() * 1000000);
const testEmail = `testuser${randomId}@example.com`;

const payload = {
  name: 'Test Student ' + randomId,
  email: testEmail,
  mobile: '+919999999999',
  course: 'JEE',
  grade: '11',
  school: 'Test School',
  country: 'India',
};

console.log('--- Sending test registration ---');
console.log(payload);
console.log('----------------------------------\n');

(async () => {
  try {
    const res = await fetch(`${BASE_URL}/auth/register-student`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const status = res.status;
    let body;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }

    console.log('HTTP Status:', status);
    console.log('Response Body:', body);

    if (status === 201) {
      console.log('\n✅ Registration succeeded.');
      console.log('Now check the OTHER terminal (where node server.js is running)');
      console.log('for a line starting with "[emailService] Registration alert..."');
    } else {
      console.log('\n❌ Registration did NOT succeed. See the response body above for the reason.');
    }
  } catch (err) {
    console.error('\n❌ Request failed to reach the server at all.');
    console.error('Error:', err.message);
    console.error('\nThis usually means:');
    console.error(' - node server.js is not running, OR');
    console.error(' - it is running on a different port than 5000, OR');
    console.error(' - a firewall is blocking the connection.');
  }
})();
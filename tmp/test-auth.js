// Using built-in fetch in Node 21+


async function test() {
    const baseUrl = 'http://localhost:3000/api/auth';
    
    console.log('--- TEST 1: Login with unregistered email ---');
    try {
        const res = await fetch(`${baseUrl}/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'not-registered-at-all@example.com', type: 'login' })
        });
        const data = await res.json();
        console.log('Status:', res.status);
        console.log('Data:', data);
    } catch (err) {
        console.error('Error:', err.message);
    }

    console.log('\n--- TEST 2: Register with new email ---');
    try {
        const res = await fetch(`${baseUrl}/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'new-user-test@example.com', type: 'register' })
        });
        const data = await res.json();
        console.log('Status:', res.status);
        console.log('Data:', data);
    } catch (err) {
        console.error('Error:', err.message);
    }
}

test();

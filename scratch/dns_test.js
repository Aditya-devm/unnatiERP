const dns = require('dns');
dns.lookup('identitytoolkit.googleapis.com', (err, address, family) => {
  console.log('address: %j family: IPv%s', address, family);
  if (err) {
    console.error('Error:', err);
  }
});

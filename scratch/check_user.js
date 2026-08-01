require('dotenv').config({ path: '.env.local' });
const { getAdminDb } = require('./lib/firebase/admin');

const admin = require('firebase-admin');

async function checkUser() {
  try {
    const db = getAdminDb();
    const snapshot = await db.collection('users')
      .where('name', '==', 'Kishan Upadhyay')
      .get();

    if (snapshot.empty) {
      console.log('User not found');
      return;
    }

    snapshot.forEach(doc => {
      console.log('User found:', doc.id);
      console.log('Data:', JSON.stringify(doc.data(), null, 2));
    });
  } catch (error) {
    console.error('Error checking user:', error);
  }
}

checkUser();

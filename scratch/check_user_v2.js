require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}

const db = admin.firestore();

async function checkUser() {
  try {
    console.log('Searching for all students...');
    const snapshot = await db.collection('users')
      .where('role', '==', 'student')
      .get();

    if (snapshot.empty) {
      console.log('User not found');
      // Let's list all users to see what we have
      const allUsers = await db.collection('users').get();
      console.log('Available users:');
      allUsers.forEach(doc => console.log(`- ${doc.data().name} (${doc.data().role})`));
      return;
    }

    snapshot.forEach(doc => {
      console.log('User found:', doc.id);
      const data = doc.data();
      console.log('Name:', data.name);
      console.log('Role:', data.role);
      console.log('InstCode:', data.instCode);
      console.log('RollNo:', data.rollNo);
      console.log('Password:', data.password); // Checking if it matches what user might be typing
    });
  } catch (error) {
    console.error('Error checking user:', error);
  }
}

checkUser();

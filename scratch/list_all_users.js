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

async function listUsers() {
  try {
    const allUsers = await db.collection('users').get();
    console.log('Available users:');
    allUsers.forEach(doc => {
        const data = doc.data();
        console.log(`- ID: ${doc.id}`);
        console.log(`  Name: ${data.name}`);
        console.log(`  Role: ${data.role}`);
        console.log(`  InstCode: ${data.instCode}`);
        console.log(`  RollNo: ${data.rollNo}`);
        console.log(`  Email: ${data.email}`);
        console.log('-------------------');
    });
  } catch (error) {
    console.error('Error listing users:', error);
  }
}

listUsers();

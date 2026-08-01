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

async function fixUser() {
  try {
    const userId = 'Blcw7tDn9AeEnKLHqwkZ1UeILxn2';
    console.log(`Updating user ${userId} (Kishan Upadhyay)...`);
    
    await db.collection('users').doc(userId).update({
      instCode: 'HPBBJA'
    });
    
    console.log('Update successful!');
  } catch (error) {
    console.error('Error updating user:', error);
  }
}

fixUser();

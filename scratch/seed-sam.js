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

async function seedSam() {
  try {
    const targetEmail = 'samxlnc56@gmail.com';
    const instituteId = 'ZA7wk0M2oXtrl3rd5FY3';
    
    console.log(`Checking user: ${targetEmail}`);
    const usersSnapshot = await db.collection('users').where('email', '==', targetEmail).get();

    if (usersSnapshot.empty) {
      console.log(`User document not found for ${targetEmail}. Finding/Creating Auth user...`);
      let authUser;
      try {
        authUser = await admin.auth().getUserByEmail(targetEmail);
        console.log(`Found auth user ID: ${authUser.uid}`);
      } catch (err) {
        console.log(`Auth user not found for ${targetEmail}. Creating Auth user...`);
        authUser = await admin.auth().createUser({
          email: targetEmail,
          emailVerified: true
        });
      }

      await db.collection('users').doc(authUser.uid).set({
        name: 'Administrator',
        email: targetEmail,
        role: 'admin',
        instituteId: instituteId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      console.log(`Successfully created Firestore user document with role: "admin" and instituteId: "${instituteId}"`);
    } else {
      const userDoc = usersSnapshot.docs[0];
      await db.collection('users').doc(userDoc.id).update({
        role: 'admin',
        instituteId: instituteId,
        updatedAt: new Date().toISOString()
      });
      console.log(`Successfully updated existing Firestore user ${userDoc.id} (${targetEmail}) to role: "admin" and instituteId: "${instituteId}"`);
    }
  } catch (error) {
    console.error('Error seeding Sam account:', error);
  }
}

seedSam();

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

async function initializeErp() {
  try {
    console.log('Starting ERP initialization...');

    // 1. Create a new institute document
    const instituteRef = db.collection('institutes').doc();
    const instituteId = instituteRef.id;

    const instituteData = {
      name: 'Aditya tiwari',
      address: 'F-21, Fortune empire, Borisana road, Kalol - 382721',
      phone: '+91 9510434702 & +91 6351235473',
      email: 'unnaticlasseskalol@gmail.com',
      createdAt: new Date().toISOString()
    };

    await instituteRef.set(instituteData);
    console.log(`Created institute document in Firestore. ID: ${instituteId}`);
    console.log('Institute Details:', instituteData);

    // 2. Locate owner user (email: unnaticlasseskalol@gmail.com)
    const targetEmail = 'unnaticlasseskalol@gmail.com';
    const usersSnapshot = await db.collection('users').where('email', '==', targetEmail).get();

    if (usersSnapshot.empty) {
      console.error(`ERROR: No user found in Firestore with email: ${targetEmail}`);
      console.log('Creating a user document for this email to set up...');
      
      // Let's check if they exist in Firebase Auth
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
        email: targetEmail,
        role: 'owner',
        instituteId: instituteId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      console.log(`Successfully created user record in Firestore and assigned owner/instituteId: ${instituteId}`);
    } else {
      const userDoc = usersSnapshot.docs[0];
      await db.collection('users').doc(userDoc.id).update({
        role: 'owner',
        instituteId: instituteId,
        updatedAt: new Date().toISOString()
      });
      console.log(`Successfully updated existing user ${userDoc.id} (${targetEmail}) to role: "owner" and instituteId: "${instituteId}"`);
    }

    console.log('ERP Initialization completed successfully!');
  } catch (error) {
    console.error('Error initializing ERP:', error);
  }
}

initializeErp();

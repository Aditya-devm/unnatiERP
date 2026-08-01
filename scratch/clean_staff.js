const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = require('dotenv').parse(fs.readFileSync(envPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

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

async function cleanupStaff() {
  console.log('Starting staff cleanup...');
  const usersSnap = await db.collection('users').get();
  console.log(`Total users found: ${usersSnap.size}`);

  let deletedCount = 0;
  let preservedCount = 0;

  for (const docSnap of usersSnap.docs) {
    const data = docSnap.data();
    const role = (data.role || '').toLowerCase();
    const email = (data.email || '').toLowerCase();

    const isPreservedRole = role === 'owner' || role === 'admin';
    const isPreservedEmail = email === 'aditiwari13705@gmail.com';

    if (isPreservedRole || isPreservedEmail) {
      console.log(`PRESERVED: User [${docSnap.id}] - Email: ${data.email} | Role: ${data.role}`);
      preservedCount++;
    } else {
      console.log(`DELETING: User [${docSnap.id}] - Email: ${data.email} | Role: ${data.role}`);
      await db.collection('users').doc(docSnap.id).delete();
      deletedCount++;
    }
  }

  // Also check `institutes/{instId}/staff` subcollections if present
  const instsSnap = await db.collection('institutes').get();
  for (const instDoc of instsSnap.docs) {
    const staffSnap = await db.collection('institutes').doc(instDoc.id).collection('staff').get();
    for (const sDoc of staffSnap.docs) {
      const sData = sDoc.data();
      const sRole = (sData.role || '').toLowerCase();
      const sEmail = (sData.email || '').toLowerCase();

      if (sRole === 'owner' || sRole === 'admin' || sEmail === 'aditiwari13705@gmail.com') {
        console.log(`PRESERVED STAFF SUBCOL: [${sDoc.id}] - Email: ${sData.email}`);
      } else {
        console.log(`DELETING STAFF SUBCOL: [${sDoc.id}] - Email: ${sData.email}`);
        await db.collection('institutes').doc(instDoc.id).collection('staff').doc(sDoc.id).delete();
      }
    }
  }

  console.log(`\nCleanup Complete! Deleted: ${deletedCount} staff member(s), Preserved: ${preservedCount} admin/owner account(s).`);
  process.exit(0);
}

cleanupStaff().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});

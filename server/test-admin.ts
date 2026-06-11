import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

async function main() {
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // Is there a GOOGLE_APPLICATION_CREDENTIALS environment variable?
    console.log("GOOGLE_APPLICATION_CREDENTIALS:", process.env.GOOGLE_APPLICATION_CREDENTIALS);
    console.log("GCP_PROJECT:", process.env.GCP_PROJECT);
    console.log("GCLOUD_PROJECT:", process.env.GCLOUD_PROJECT);

    const app = initializeApp({
      projectId: firebaseConfig.projectId,
    });
    const db = getFirestore(app);
    db.settings({ databaseId: firebaseConfig.firestoreDatabaseId || '(default)' });
    
    console.log("Admin Firestore client initialized.");
    
    // Test a read
    const snap = await db.collection('users').limit(1).get();
    console.log("Read success. Users count:", snap.size);
    
    // Test a write
    await db.collection('users').doc('test').set({ hello: 'world' });
    console.log("Write success.");
    
    process.exit(0);
  } catch (err: any) {
    console.error("TEST FAILED. name:", err.name, "message:", err.message, "code:", err.code);
    process.exit(1);
  }
}

main();

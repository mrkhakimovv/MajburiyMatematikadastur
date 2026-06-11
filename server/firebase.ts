import { initializeApp, cert, getApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

let firestoreDb: FirebaseFirestore.Firestore | null = null;
let firebaseAuth: any = null;

try {
  let credential = undefined;
  
  // 1. Try to load Service Account from Envs to bypass rules
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      credential = cert(sa);
      console.log('Firebase Admin loaded credentials from env.');
    } catch(err) {
      console.error('Invalid FIREBASE_SERVICE_ACCOUNT_JSON format:', err);
    }
  }

  // 2. Read AI studio configuration
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  
  const initOptions: any = {};
  if (credential) {
    initOptions.credential = credential;
  }

  let dbId = '(default)';
  
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    initOptions.projectId = firebaseConfig.projectId;
    dbId = firebaseConfig.firestoreDatabaseId || '(default)';
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    initOptions.projectId = sa.project_id;
  } else if (process.env.GCP_PROJECT) {
    initOptions.projectId = process.env.GCP_PROJECT;
  }

  if (Object.keys(initOptions).length > 0) {
    const app = getApps().length === 0 ? initializeApp(initOptions) : getApp();
    firestoreDb = getFirestore(app);
    firestoreDb.settings({ databaseId: dbId });
    console.log('Firebase Admin SDK initialized successfully.');
  } else {
    console.warn('Neither firebase-applet-config.json nor FIREBASE_SERVICE_ACCOUNT_JSON was found. Firebase may not function.');
  }
} catch (e) {
  console.error('Error initializing Firebase Admin:', e);
}

export const dbFirestore = firestoreDb;
export const auth = firebaseAuth;





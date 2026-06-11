import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query, setDoc, doc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

async function main() {
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
    console.log("Firestore client initialized.");
    
    const randomCollectionName = 'test_col_' + Date.now();
    
    // Test a read on random collection
    const q = query(collection(db, randomCollectionName), limit(1));
    const snap = await getDocs(q);
    console.log(`Read success on ${randomCollectionName}. count:`, snap.size);
    
    // Test a write on random collection
    await setDoc(doc(db, randomCollectionName, 'test'), { hello: 'world' });
    console.log(`Write success on ${randomCollectionName}.`);
    
    process.exit(0);
  } catch (err: any) {
    console.error("TEST FAILED. name:", err.name, "message:", err.message, "code:", err.code);
    process.exit(1);
  }
}

main();

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query, setDoc, doc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

async function main() {
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    const app = initializeApp(firebaseConfig);
    // CONNECT TO DEFAULT DB
    const db = getFirestore(app);
    console.log("Firestore client initialized to (default) DB.");
    
    // Test a read
    const q = query(collection(db, 'users'), limit(1));
    const snap = await getDocs(q);
    console.log("Read success. Users count:", snap.size);
    
    // Test a write
    await setDoc(doc(db, 'users', 'test'), { hello: 'world' });
    console.log("Write success.");
    
    process.exit(0);
  } catch (err: any) {
    console.error("TEST FAILED. name:", err.name, "message:", err.message, "code:", err.code);
    process.exit(1);
  }
}

main();

import { dbFirestore } from './server/firebase.ts';
async function run() {
  const doc = await dbFirestore.collection('tests').doc('9YiFzo0vGjQ4xC48jMW3').get();
  console.log(doc.exists ? doc.data() : 'Not found');
  process.exit();
}
run();

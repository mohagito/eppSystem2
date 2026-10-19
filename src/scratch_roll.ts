import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function checkRoll() {
  const rollSnap = await getDoc(doc(db, 'rolls', 'roll-seed-white-1'));
  const r = rollSnap.data();
  console.log(`=== ROLL roll-seed-white-1 ===`);
  console.log(`Barcode: ${r?.barcode}`);
  console.log(`Produced pieces: ${r?.producedPieces}`);
  console.log(`Expected pieces: ${r?.expectedPieces}`);
  console.log(`Records length: ${(r?.productionRecords || []).length}`);
  (r?.productionRecords || []).forEach((rec: any, idx: number) => {
    console.log(` Record [${idx+1}]: id=${rec.id}, qty=${rec.quantity}, date=${rec.date}, time=${rec.time}`);
  });
  process.exit(0);
}

checkRoll().catch(console.error);

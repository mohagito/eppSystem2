import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function checkAllRolls() {
  const rollsSnap = await getDocs(collection(db, 'rolls'));
  console.log(`Total rolls: ${rollsSnap.size}`);
  rollsSnap.forEach(d => {
    const r = d.data();
    console.log(`Roll docId=${d.id}, barcode=${r.barcode}, mat=${r.materialName}, status=${r.status}, producedPieces=${r.producedPieces}, expectedPieces=${r.expectedPieces}, recCount=${(r.productionRecords || []).length}`);
  });
  process.exit(0);
}

checkAllRolls().catch(console.error);

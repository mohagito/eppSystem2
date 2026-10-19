import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function check() {
  console.log("Checking stock_entries...");
  const snap = await getDocs(collection(db, 'stock_entries'));
  console.log(`Total stock_entries in Firestore: ${snap.size}`);
  snap.forEach(d => {
    const data = d.data();
    if (data.modelId === 'CRAFTER') {
      console.log(`CRAFTER entry: id=${d.id}, qty=${data.quantity}, worker=${data.workerName}, date=${data.date}, type=${data.type}`);
    }
  });

  console.log("\nChecking rolls...");
  const rollsSnap = await getDocs(collection(db, 'rolls'));
  console.log(`Total rolls: ${rollsSnap.size}`);
  rollsSnap.forEach(d => {
    const r = d.data();
    if (r.materialName === 'White Huesker' || (r.referenceId && r.referenceId.includes('CRAFTER')) || (r.barcode && r.barcode.includes('2600056310'))) {
      console.log(`Roll: id=${d.id}, barcode=${r.barcode}, mat=${r.materialName}, status=${r.status}, produced=${r.producedPieces}, exp=${r.expectedPieces}, recsCount=${(r.productionRecords || []).length}`);
      if (r.productionRecords && r.productionRecords.length > 0) {
        console.log("Records:", JSON.stringify(r.productionRecords));
      }
    }
  });
  process.exit(0);
}

check().catch(e => {
  console.error("Error checking Firestore:", e);
  process.exit(1);
});

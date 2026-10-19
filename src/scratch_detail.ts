import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function detailCheck() {
  const rollSnap = await getDoc(doc(db, 'rolls', 'roll-seed-white-1'));
  if (rollSnap.exists()) {
    const r = rollSnap.data();
    console.log(`=== ROLL roll-seed-white-1 ===`);
    console.log(`Status: ${r.status}, Material: ${r.materialName}, Produced: ${r.producedPieces}, Expected: ${r.expectedPieces}`);
    console.log(`Total productionRecords on roll: ${(r.productionRecords || []).length}`);
    (r.productionRecords || []).forEach((rec: any, i: number) => {
      console.log(` [${i+1}] ${rec.date} ${rec.time} - ${rec.quantity} pcs (${rec.referenceId}) by ${rec.operator} - id: ${rec.id}`);
    });
  }

  const stockSnap = await getDocs(collection(db, 'stock_entries'));
  const crafterEntries: any[] = [];
  stockSnap.forEach(d => {
    const data = d.data();
    if (data.modelId === 'CRAFTER') {
      crafterEntries.push({ id: d.id, ...data });
    }
  });

  crafterEntries.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  console.log(`\n=== CRAFTER STOCK ENTRIES (${crafterEntries.length}) ===`);
  let totalCrafterStock = 0;
  crafterEntries.forEach((e, i) => {
    totalCrafterStock += e.quantity;
    console.log(` [${i+1}] ${e.date} (${e.createdAt}) - ${e.quantity >= 0 ? '+' : ''}${e.quantity} pcs - type: ${e.type || 'standard'} - worker: ${e.workerName} - id: ${e.id} - rollId: ${e.rollId}`);
  });
  console.log(`\nTotal CRAFTER Stock: ${totalCrafterStock}`);

  process.exit(0);
}

detailCheck().catch(console.error);

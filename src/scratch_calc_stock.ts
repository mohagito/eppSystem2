import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function checkStock() {
  const stockSnap = await getDocs(collection(db, 'stock_entries'));
  const entries: any[] = [];
  stockSnap.forEach(d => {
    const data = d.data();
    if (data.modelId === 'CRAFTER') {
      entries.push({ id: d.id, ...data });
    }
  });

  const delSnap = await getDocs(collection(db, 'deliveries'));
  const deliveries: any[] = [];
  delSnap.forEach(d => {
    const data = d.data();
    if (data.modelId === 'CRAFTER') {
      deliveries.push({ id: d.id, ...data });
    }
  });

  const totalDelivered = deliveries.reduce((s, d) => s + (d.quantity || 0), 0);
  const totalProduced = entries.reduce((s, e) => s + (e.quantity || 0), 0);
  console.log(`CRAFTER total produced in entries: ${totalProduced}`);
  console.log(`CRAFTER total delivered: ${totalDelivered}`);
  console.log(`CRAFTER net available: ${totalProduced - totalDelivered}`);

  // Also check packaged calculation as done in StockManagement.tsx
  const pkgSize = 360;
  const sorted = [...entries].sort((a, b) => {
    const timeA = new Date(a.createdAt || a.date).getTime();
    const timeB = new Date(b.createdAt || b.date).getTime();
    return timeA - timeB;
  });

  let currentUnpackaged = 0;
  let currentPackaged = 0;
  sorted.forEach(e => {
    if (e.type === 'production') {
      const prevUnpackaged = currentUnpackaged;
      const newProduction = e.quantity;
      const totalAvailable = prevUnpackaged + newProduction;
      let autoPackaged = Math.floor(totalAvailable / pkgSize) * pkgSize;
      let remainingUnpackaged = totalAvailable % pkgSize;
      currentPackaged += autoPackaged;
      currentUnpackaged = remainingUnpackaged;
    } else if (e.type === 'packaging' || e.type === undefined) {
      currentPackaged += e.quantity;
    }
  });

  console.log(`Packaged: ${currentPackaged}, Unpackaged: ${currentUnpackaged}`);
  console.log(`Packaged after deliveries: ${Math.max(0, currentPackaged - totalDelivered)}`);
  console.log(`Total available: ${Math.max(0, currentPackaged - totalDelivered) + currentUnpackaged}`);

  process.exit(0);
}

checkStock().catch(console.error);

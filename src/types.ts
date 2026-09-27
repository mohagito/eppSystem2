export type UserRole = 'manager' | 'worker';

export interface UserProfile {
  id: string;
  email?: string;
  username?: string;
  password?: string;
  name: string;
  role: UserRole;
  avatarUrl?: string; // Kept for compatibility but we won't render it in the UI
  station?: string;
}

export type AirbagModel = 'BCB' | 'CRAFTER' | 'CADDY' | 'KUGA LHD' | 'KUGA RHD' | 'TETOUAN' | 'SK216' | 'VW217';

export interface StockEntry {
  id: string;
  modelId: AirbagModel;
  workerName: string;
  date: string; // YYYY-MM-DD
  quantity: number;
  createdBy: string; // Profile user ID
  createdAt: string; // ISO string
  machine?: MachineType; // Optional: target machine context
  planId?: string;       // Optional: directly associated production plan ID
  type?: 'production' | 'packaging'; // production = manufactured pieces, packaging = packaged pieces
  
  // Traceability to source physical roll
  rollId?: string;
  rollBarcode?: string;
  referenceId?: string;
  time?: string;
  notes?: string;

  // Correction System Fields
  originalQuantity?: number;
  correctedQuantity?: number;
  difference?: number;
  edited?: boolean;
  editedBy?: string;
  editedByProfileId?: string;
  editedAt?: any; // Firestore ServerTimestamp or ISO string
  editReason?: string;
}

export interface DeliveryEntry {
  id: string;
  modelId: AirbagModel;
  model: AirbagModel;
  workerName: string;
  loadedBy: string;
  date: string; // YYYY-MM-DD
  deliveryDate: string; // DD/MM/YYYY
  deliveryTime: string; // HH:MM
  quantity: number;
  createdBy: string; // Creator profile name
  createdAt: any; // ISO string or Firestore timestamp
  invoiceNumber: string;
  carrier?: string;
}

export type MachineType = 'Big Machine' | 'Small Machine';
export type ShiftType = 'Morning' | 'Evening';

export interface ProductionPlan {
  id: string;
  planDate: string; // YYYY-MM-DD
  machine: MachineType;
  shift: ShiftType;
  model: AirbagModel;
  quantityPlanned: number;
  quantityCompleted?: number; // Accumulated incremental completions (progress)
  assignedWorker: string; // Worker profile name or ID
  notes?: string;
  createdBy: string; // Manager ID
  createdAt: string; // ISO string
  status: 'Pending' | 'Completed' | 'Delayed';
  updatedAt?: string;
  updatedBy?: string;
  copiedFrom?: string;
  duplicatedFromId?: string;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export type RollMaterial = 'White Huesker' | 'Yellow Huesker' | 'Delcotex India' | 'Kuga';

export interface RollMaterialCostConfig {
  material: RollMaterial;
  referenceName: string;
  widthM?: number;
  lengthM: number;
  priceUnit: '€/m²' | '€/ml';
  unitPrice: number;
  areaM2?: number;
  costPerRoll: number;
}

export interface RollEntry {
  id: string;
  materialName: string;
  date?: string; // YYYY-MM-DD
  openedAt?: string; // ISO string timestamps (optional for unopened)
  barcode?: string; // generated QR/barcode string or blank for unopened stock
  operator?: string; // profile/worker name
  createdBy: string; // profile user id
  status: any;
  notes?: string;
  initialWeightKg?: number; // optional tracking parameter (e.g., standard roll weights)
  metersTotal?: number; // optional length
  consumedMeters?: number; // tracker for cutting traceability
  closedAt?: string; // ISO timestamp when roll is fully consumed
  closedBy?: string; // name of operator who closed it

  // Automatic Linkage: ROLL → EXPECTED PIECES → PRODUCTION → PIECE STOCK → FINANCIAL RESULT
  referenceId?: string; // e.g. 'BCB-FRA', 'TETOUAN / XJX-MARR', 'CRAFTER', 'SK216'
  expectedPieces?: number; // Expected finished pieces from this roll
  producedPieces?: number; // Actual total produced pieces so far
  remainingPieces?: number; // expectedPieces - producedPieces
  wastePieces?: number; // Optional waste / defective pieces
  pricePerPiece?: number; // Locked piece price for this roll
  rollCost?: number; // Actual physical roll cost
  productionValue?: number; // producedPieces * pricePerPiece
  grossProfit?: number; // productionValue - rollCost
  profitPercent?: number; // (grossProfit / rollCost) * 100
  productionRecords?: RollProductionRecord[]; // Independent log of production batches

  // Enhanced Industrial Physical Roll fields
  rollNumber?: string;
  materialId?: string;
  materialCode?: string;
  supplierId?: string;
  supplierName?: string;
  batchNumber?: string;
  lotNumber?: string;
  receptionDate?: string;
  originalLength?: number;
  remainingLength?: number;
  width?: number;
  pricingType?: 'PER_LINEAR_METER' | 'PER_SQUARE_METER';
  originalUnitPrice?: number;
  originalArea?: number;
  originalValue?: number;
  remainingArea?: number;
  remainingValue?: number;
  locationId?: string;
  locationName?: string;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
}

// ==========================================
// FINANCIAL EVALUATION & PIECE PRICING TYPES
// ==========================================

export type MaterialFamily = 'HUESKER 22' | 'HUESKER 82' | 'INDIA / DELCOTEX' | 'KUGA';

export interface FinishedPiecePrice {
  id: string; // e.g. 'BCB-FRA', 'CRAFTER', etc.
  reference: string; // Name of the finished piece reference
  material: RollMaterial; // Target roll material: Yellow Huesker, White Huesker, Delcotex India, Kuga
  materialFamily: MaterialFamily;
  pricePerPiece: number; // In Euros, e.g. 0.5984
  isActive: boolean; // false for CADDY (stopped)
  updatedAt?: string;
  updatedBy?: string;
}

export interface RollProductionItem {
  reference: string;
  pieces: number;
  pricePerPiece: number; // Historical snapshot price per piece at calculation time
  productionValue: number; // pieces * pricePerPiece
}

export interface RollFinancialRecord {
  id: string; // Unique record ID (often matched with rollId or unique)
  rollId: string;
  rollBarcode: string;
  rollNumber?: string;
  materialName: RollMaterial;
  rollLength: number; // Actual physical length in meters
  rollCost: number; // Real physical roll cost
  items: RollProductionItem[]; // Can hold multiple references produced from one roll
  totalPieces: number;
  totalProductionValue: number; // Sum of productionValue of all items
  grossProfit: number; // totalProductionValue - rollCost
  profitPercentage: number; // (grossProfit / rollCost) * 100
  evaluatedAt: string; // YYYY-MM-DD or ISO timestamp
  evaluatedBy: string; // Manager name or ID
  notes?: string;
  updatedAt?: string;
}

export interface RollProductionRecord {
  id: string;
  rollId: string;
  rollBarcode: string;
  referenceId: string;
  quantity: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  operator: string;
  machine?: MachineType | string;
  notes?: string;
  createdAt: string;
}

export interface ExpectedYieldConfig {
  id: string; // referenceId
  reference: string;
  material: RollMaterial;
  materialFamily: MaterialFamily;
  expectedPieces: number;
  updatedAt?: string;
  updatedBy?: string;
}



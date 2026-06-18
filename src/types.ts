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

export type AirbagModel = 'BCB' | 'CRAFTER' | 'CADDY' | 'KUGA LHD' | 'KUGA RHD' | 'TETOUAN' | 'SK216' | 'VW217' | 'VW110';

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

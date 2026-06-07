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

export type AirbagModel = 'BCB' | 'CRAFTER' | 'CADDY' | 'KUGA LHD' | 'KUGA RHD' | 'TETOUAN';

export interface StockEntry {
  id: string;
  modelId: AirbagModel;
  workerName: string;
  date: string; // YYYY-MM-DD
  quantity: number;
  createdBy: string; // Profile user ID
  createdAt: string; // ISO string
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
  assignedWorker: string; // Worker profile name or ID
  notes?: string;
  createdBy: string; // Manager ID
  createdAt: string; // ISO string
  status: 'Pending' | 'Completed' | 'Delayed';
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

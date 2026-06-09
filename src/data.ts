import { AirbagModel, StockEntry, ProductionPlan, UserProfile } from './types';

export const AIRBAG_MODELS: AirbagModel[] = [
  'BCB',
  'CRAFTER',
  'CADDY',
  'KUGA LHD',
  'KUGA RHD',
  'TETOUAN'
];

export const MOCK_PROFILES: UserProfile[] = [
  {
    id: 'mgr-1',
    username: 'gonzalo',
    password: 'gonzalo@epp',
    name: 'Gonzalo',
    role: 'manager',
    station: 'Central Station'
  },
  {
    id: 'wrk-1',
    username: 'mohamed',
    password: 'mohamed@epp',
    name: 'Mohamed',
    role: 'worker',
    station: 'Both Machines (Big & Small)'
  },
  {
    id: 'wrk-2',
    username: 'mouad',
    password: 'mouad@epp',
    name: 'Mouad',
    role: 'worker',
    station: 'Both Machines (Big & Small)'
  }
];

// Generate consistent mock stock entries
export const INITIAL_STOCK_ENTRIES: StockEntry[] = [
  {
    id: 'se-1',
    modelId: 'BCB',
    workerName: 'Mohamed',
    date: '2026-06-01',
    quantity: 120,
    createdBy: 'wrk-1',
    createdAt: '2026-06-01T14:30:00Z'
  },
  {
    id: 'se-2',
    modelId: 'CRAFTER',
    workerName: 'Mouad',
    date: '2026-06-01',
    quantity: 95,
    createdBy: 'wrk-2',
    createdAt: '2026-06-01T15:00:00Z'
  },
  {
    id: 'se-3',
    modelId: 'KUGA LHD',
    workerName: 'Mohamed',
    date: '2026-06-02',
    quantity: 140,
    createdBy: 'wrk-1',
    createdAt: '2026-06-02T13:45:00Z'
  },
  {
    id: 'se-4',
    modelId: 'TETOUAN',
    workerName: 'Mouad',
    date: '2026-06-02',
    quantity: 80,
    createdBy: 'wrk-2',
    createdAt: '2026-06-02T17:15:00Z'
  },
  {
    id: 'se-5',
    modelId: 'CADDY',
    workerName: 'Mohamed',
    date: '2026-06-03',
    quantity: 110,
    createdBy: 'wrk-1',
    createdAt: '2026-06-03T11:20:00Z'
  },
  {
    id: 'se-6',
    modelId: 'KUGA RHD',
    workerName: 'Mouad',
    date: '2026-06-03',
    quantity: 75,
    createdBy: 'wrk-2',
    createdAt: '2026-06-03T16:05:00Z'
  },
  {
    id: 'se-7',
    modelId: 'BCB',
    workerName: 'Mohamed',
    date: '2026-06-04',
    quantity: 135,
    createdBy: 'wrk-1',
    createdAt: '2026-06-04T12:00:00Z'
  },
  {
    id: 'se-8',
    modelId: 'CRAFTER',
    workerName: 'Mouad',
    date: '2026-06-04',
    quantity: 105,
    createdBy: 'wrk-2',
    createdAt: '2026-06-04T14:40:00Z'
  },
  {
    id: 'se-9',
    modelId: 'TETOUAN',
    workerName: 'Mohamed',
    date: '2026-06-05',
    quantity: 90,
    createdBy: 'wrk-1',
    createdAt: '2026-06-05T09:30:00Z'
  },
  {
    id: 'se-10',
    modelId: 'KUGA LHD',
    workerName: 'Mouad',
    date: '2026-06-05',
    quantity: 150,
    createdBy: 'wrk-2',
    createdAt: '2026-06-05T15:10:00Z'
  }
];

// Generate consistent mock plans
export const INITIAL_PLANS: ProductionPlan[] = [
  {
    id: 'pl-1',
    planDate: '2026-06-05',
    machine: 'Big Machine',
    shift: 'Morning',
    model: 'KUGA LHD',
    quantityPlanned: 150,
    assignedWorker: 'Mohamed',
    notes: 'Prioritize LHD line as per custom backlog requirements.',
    createdBy: 'mgr-1',
    createdAt: '2026-06-04T08:00:00Z',
    status: 'Completed'
  },
  {
    id: 'pl-2',
    planDate: '2026-06-05',
    machine: 'Small Machine',
    shift: 'Morning',
    model: 'TETOUAN',
    quantityPlanned: 100,
    assignedWorker: 'Mouad',
    notes: 'Maintain strict tension tolerances during fold assembly.',
    createdBy: 'mgr-1',
    createdAt: '2026-06-04T08:05:00Z',
    status: 'Completed'
  },
  {
    id: 'pl-3',
    planDate: '2026-06-05',
    machine: 'Big Machine',
    shift: 'Evening',
    model: 'CRAFTER',
    quantityPlanned: 110,
    assignedWorker: 'Mohamed',
    notes: 'Test sensor clip brackets before final casing seal.',
    createdBy: 'mgr-1',
    createdAt: '2026-06-04T08:10:00Z',
    status: 'Pending'
  },
  {
    id: 'pl-4',
    planDate: '2026-06-06',
    machine: 'Big Machine',
    shift: 'Morning',
    model: 'BCB',
    quantityPlanned: 130,
    assignedWorker: 'Mohamed',
    notes: 'Calibrate pressure valves prior to line initiation.',
    createdBy: 'mgr-1',
    createdAt: '2026-06-05T10:00:00Z',
    status: 'Pending'
  },
  {
    id: 'pl-5',
    planDate: '2026-06-06',
    machine: 'Small Machine',
    shift: 'Morning',
    model: 'CADDY',
    quantityPlanned: 115,
    assignedWorker: 'Mouad',
    notes: 'Use recycled poly-blend for test samples.',
    createdBy: 'mgr-1',
    createdAt: '2026-06-05T10:15:00Z',
    status: 'Pending'
  },
  {
    id: 'pl-6',
    planDate: '2026-06-07',
    machine: 'Big Machine',
    shift: 'Morning',
    model: 'KUGA RHD',
    quantityPlanned: 90,
    assignedWorker: 'Mouad',
    notes: 'Double check visual surface uniformity.',
    createdBy: 'mgr-1',
    createdAt: '2026-06-05T11:00:00Z',
    status: 'Pending'
  }
];

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
  materialEfficiency?: number; // Material Efficiency % = Produced PCS ÷ Expected PCS × 100
  wastePieces?: number; // Optional waste / defective pieces
  pricePerPiece?: number; // Locked piece price for this roll
  rollCost?: number; // Actual physical roll cost
  productionValue?: number; // producedPieces * pricePerPiece
  grossProfit?: number; // productionValue - rollCost
  profitPercent?: number; // (grossProfit / rollCost) * 100
  productionRecords?: RollProductionRecord[]; // Independent log of production batches

  // NOK Defective Formats Adjustment (Universal for all roll references)
  nokFormats?: number; // Count of defective formats found in the roll
  nokWidthCm?: number; // Defective format width in cm (e.g. 70, 73)
  nokHeightCm?: number; // Defective format height in cm (e.g. 90)
  nokTotalAreaCm2?: number; // Total NOK area in cm2 (nokFormats * nokWidthCm * nokHeightCm)
  nokEquivalentPieces?: number; // Equivalent finished pieces
  adjustedExpectedPieces?: number; // max(0, originalExpectedPieces - nokEquivalentPieces)

  // Reconciliation & Stock Snapshots (ROLLS + FINISHED PIECE STOCK + PRODUCTION + UNPACKAGED PIECES + ROLL CLOSING)
  openingStockSnapshot?: Record<string, number>; // Reference -> Opening stock quantity at roll activation
  rollOpeningStock?: Record<string, number>; // Immutable snapshot of reference stock at roll open
  openingStockDetails?: Record<string, { packaged: number; unpackaged: number; total: number }>; // Detailed snapshot breakdown
  totalOpeningStock?: number; // Total opening stock snapshot sum
  relatedReferences?: string[]; // Multiple finished references linked to this roll (e.g. SK216, VW217)
  piecesByReference?: Record<string, number>; // Live pieces produced by reference
  productionValueByReference?: Record<string, number>; // Live production value by reference
  closingUnpackaged?: Record<string, number>; // Reference -> Remaining unpackaged pieces entered at close
  reconciliation?: RollReconciliationData; // Final reconciliation data calculated at roll close

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

export interface RollReferenceReconciliation {
  reference: string;
  openingStock: number; // Snapshot of finished pieces stock when roll was opened
  productionDuringRoll: number; // Pieces logged in production movements during this roll
  closingUnpackaged: number; // Physical unpackaged pieces verified at roll closing
  actualProduction: number; // Total actual pieces produced from this roll (productionDuringRoll + closingUnpackaged)
  pricePerPiece: number; // Applicable price per piece (€)
  productionValue: number; // actualProduction * pricePerPiece (€)
  finalStock: number; // Current / final available piece stock
}

export interface RollReconciliationData {
  references: RollReferenceReconciliation[];
  totalActualPieces: number;
  totalProductionValue: number;
  rollCost: number;
  grossProfit: number;
  profitPercent: number;
  expectedPieces?: number;
  materialEfficiency?: number; // Material Efficiency % = Produced PCS ÷ Expected PCS × 100
  nokFormats?: number;
  nokWidthCm?: number;
  nokHeightCm?: number;
  nokTotalAreaCm2?: number;
  nokEquivalentPieces?: number;
  adjustedExpectedPieces?: number;
  closedAt: string;
  closedBy: string;
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
  expectedPieces?: number;
  materialEfficiency?: number; // (totalPieces / expectedPieces) * 100
  nokFormats?: number;
  nokWidthCm?: number;
  nokHeightCm?: number;
  nokTotalAreaCm2?: number;
  nokEquivalentPieces?: number;
  adjustedExpectedPieces?: number;
  evaluatedAt: string; // YYYY-MM-DD or ISO timestamp
  evaluatedBy: string; // Manager name or ID
  notes?: string;
  updatedAt?: string;
  
  // Reconciled stock tracking
  openingStockSnapshot?: Record<string, number>;
  rollOpeningStock?: Record<string, number>;
  openingStockDetails?: Record<string, { packaged: number; unpackaged: number; total: number }>;
  totalOpeningStock?: number;
  piecesByReference?: Record<string, number>;
  productionValueByReference?: Record<string, number>;
  closingUnpackaged?: Record<string, number>;
  reconciliation?: RollReferenceReconciliation[];
  status?: string;
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

// ==========================================
// MADRID STOCK MANAGEMENT TYPES
// ==========================================

export type StockLocationView = 'tanger' | 'madrid' | 'combined';

export interface MadridReferenceHistoryEntry {
  importId: string;
  previousQuantity: number;
  newQuantity: number;
  updatedAt: string; // ISO string
  updatedBy: string;
  fileName: string;
  columnHeader: string;
}

export interface MadridStockItem {
  id: AirbagModel; // Matches AirbagModel reference ('BCB', 'CRAFTER', 'CADDY', 'KUGA LHD', 'KUGA RHD', 'TETOUAN', 'SK216', 'VW217')
  reference: AirbagModel;
  packagedQuantity: number; // Current physical stock in Madrid (= baselineQuantity + net post-baseline movements)
  baselineQuantity?: number; // Original physical quantity from the latest Excel snapshot import
  baselineSnapshotId?: string; // ID of the MadridImportSnapshot that established the current baseline
  baselineTimestamp?: string; // ISO string when the current physical baseline was established
  postBaselineReceiptsSum?: number; // Sum of confirmed truck receipts since baselineSnapshotId
  postBaselineDeliveriesSum?: number; // Sum of confirmed customer deliveries since baselineSnapshotId
  lastUpdated: string; // ISO string
  updatedBy: string;
  sourceFileName?: string;
  sourceColumnHeader?: string;
  snapshotHash?: string;
  history?: MadridReferenceHistoryEntry[];
}

export interface MadridImportSnapshot {
  id: string;
  importedAt: string; // ISO string
  importedBy: string;
  importedById: string;
  fileName: string;
  sheetName: string;
  columnHeader: string;
  snapshotHash: string;
  totalPackagedQuantity: number;
  quantities: Record<AirbagModel, number>;
  previousQuantities: Record<AirbagModel, number>;
  unmatchedRows?: string[];
  missingReferences?: AirbagModel[];
  emptyCells?: AirbagModel[];
  reconciledMovementIds?: string[]; // Movements superseded/reconciled when this physical snapshot established a new baseline
}

// ==========================================
// PHASE 1: DIGITAL ELOY PLANNING, CATALOG & RECONCILIATION TYPES
// ==========================================

export type DeliveryWorkflowType = 'SPAIN_TRANSFER' | 'MOROCCO_DOMESTIC';

export interface CatalogReference {
  id: string; // e.g., 'BCB', 'CRAFTER', 'TETOUAN', 'X87-4625578', 'VW110'
  code: string; // Project/Part code in ELOY.xlsx (e.g., 'BCB-FRA', 'XJX-MARR', '243775', '246404', 'X87-4625578', 'VW110')
  programPrefix?: string; // Col A prefix in ELOY.xlsx (e.g., 'INDIA SK216', 'INDIA vw271', 'REPUESTO X87', 'NUEVA')
  displayName: string; // Display name in UI
  activeModelId?: AirbagModel; // Populated for the 8 active AIRBAG_MODELS; undefined for inactive catalog-only items
  isActive: boolean; // true for the 8 active references, false for REPUESTO X87 and NUEVA / VW110
  workflowType: DeliveryWorkflowType; // 'MOROCCO_DOMESTIC' for TETOUAN, 'SPAIN_TRANSFER' for Spain references
  leadTimeWeeks: number; // 1 for Spain references (dispatch W-1), 0 for TETOUAN (same-week domestic, configurable)
  packagingSize: number; // Standard box/pallet multiple
  preservedExcelStock?: {
    madridOct2?: number;
    tangerOct12?: number;
    camionOct6?: number;
    madridOct7?: number;
    combinedOct12?: number;
    lastImportedAt?: string;
    sourceFileName?: string;
  };
  updatedAt: string;
  updatedBy: string;
}

export type DemandFulfillmentStatus = 'pending' | 'partial' | 'delivered';

export interface WeeklyCustomerDemand {
  id: string; // Deterministic ID: `${year}_W${weekNumber}_${modelId}` (e.g., '2026_W43_CRAFTER' or '2027_W01_CRAFTER')
  year: number; // e.g., 2026, 2027
  weekNumber: number; // 1..53 (e.g., 41..52, 1..52)
  weekLabel: string; // e.g., 'W41', 'W52', 'W01'
  weekKey?: string; // e.g., '2026-W52', '2027-W01'
  modelId: AirbagModel;
  workflowType: DeliveryWorkflowType; // 'SPAIN_TRANSFER' | 'MOROCCO_DOMESTIC'
  leadTimeWeeks: number; // 1 for Spain, 0 (configurable) for TETOUAN
  plannedTangerDispatchYear?: number; // e.g., 2026 when 2027-W01 Spain demand dispatches in 2026-W52
  plannedTangerDispatchWeek: number; // weekNumber - leadTimeWeeks (with year-boundary rollover W01 -> W52)
  plannedTangerDispatchWeekLabel: string; // e.g., 'W42', 'W52', 'W01'
  plannedTangerDispatchYearWeekKey?: string; // e.g., '2026-W52'
  plannedTangerDispatchDate?: string; // Optional truck departure date (e.g., '2026-10-17' from Row 15 note)
  customerRequiredQty: number; // Planned customer demand from ELOY.xlsx or manual entry
  deliveredQty: number; // Confirmed actual customer delivery quantity (NEVER auto-populated from planned demand)
  pendingQty: number; // max(0, customerRequiredQty - deliveredQty) — reserved for planning until delivered
  fulfillmentStatus: DemandFulfillmentStatus; // 'pending' | 'partial' | 'delivered'
  excelCellHighlight?: 'green_covered' | 'red_priority' | 'cyan_crafter' | 'normal'; // Preserves visual indicators from ELOY.xlsx
  sourceSnapshotHash?: string; // Prevents duplicate re-imports of identical Excel demand
  notes?: string;
  updatedAt: string;
  updatedBy: string;
}

export type SpainTruckStatus = 'planned' | 'dispatched' | 'in_transit' | 'received_in_madrid' | 'cancelled';

export interface SpainTruckShipmentItem {
  modelId: AirbagModel;
  plannedQty: number; // Planned quantity to load on truck
  dispatchedQty: number; // Confirmed quantity dispatched from Tanger
  receivedQty?: number; // Confirmed quantity received in Madrid
  targetCustomerWeek?: string; // e.g., 'W43', 'W01'
  linkedTangerDeliveryIds?: string[]; // Links to existing Tanger `deliveries` records (prevents double Tanger stock deduction)
}

export interface SpainTruckShipment {
  id: string; // e.g., 'TRUCK_2026_W42_OCT17' or 'HIST_CAMION_6_OCT'
  truckCode: string; // e.g., 'CAMION 6 OCT', 'CAMION 17 OCT (W42)'
  status: SpainTruckStatus;
  dispatchYear?: number; // e.g., 2026
  dispatchWeekNumber: number; // e.g., 42, 52
  dispatchWeekLabel: string; // e.g., 'W42', 'W52'
  targetCustomerYear?: number; // e.g., 2027 (when W52 truck serves 2027-W01)
  targetCustomerWeekNumber: number; // e.g., 43 (dispatchWeekNumber + 1, or 1 across year boundary)
  targetCustomerWeekLabel: string; // e.g., 'W43', 'W01'
  plannedDispatchDate: string; // YYYY-MM-DD (e.g., '2026-10-17')
  actualDispatchDate?: string; // YYYY-MM-DD
  receivedInMadridAt?: string; // ISO timestamp when confirmed in Madrid
  receivedInMadridBy?: string;
  items: SpainTruckShipmentItem[];
  totalPlannedQty: number;
  totalDispatchedQty: number;
  totalReceivedQty: number;
  linkedTangerDeliveryIds: string[]; // Flat list of linked Tanger DeliveryEntry IDs (enforces 1-to-1 link lock)
  madridReceiptMovementIds?: string[]; // Populated once received in Madrid (blocks duplicate receipt)
  reconciledBySnapshotId?: string; // Set if a subsequent physical Madrid Excel snapshot supersedes this truck receipt
  isHistoricalExcelRecord?: boolean; // True for CAMION 6 OCT imported from ELOY.xlsx for audit visibility
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export type MadridStockMovementType =
  | 'BASELINE_SNAPSHOT_IMPORT'
  | 'PHYSICAL_STOCK_CORRECTION'
  | 'TRUCK_RECEIPT_IN_MADRID'
  | 'CUSTOMER_DELIVERY_FROM_MADRID';

export interface MadridStockMovement {
  id: string;
  idempotencyKey: string; // Unique key preventing duplicate execution
  modelId: AirbagModel;
  movementType: MadridStockMovementType;
  quantityDelta: number; // +qty for receipt, -qty for delivery, difference for correction/baseline
  receivedFromTangerQty?: number; // Populated for TRUCK_RECEIPT_IN_MADRID
  deliveredToCustomerQty?: number; // Populated for CUSTOMER_DELIVERY_FROM_MADRID
  previousQuantity?: number; // Populated for PHYSICAL_STOCK_CORRECTION & BASELINE_SNAPSHOT_IMPORT
  correctedQuantity?: number; // Populated for PHYSICAL_STOCK_CORRECTION & BASELINE_SNAPSHOT_IMPORT
  difference?: number; // correctedQuantity - previousQuantity
  reason?: string; // Reason for physical stock correction
  customerInfo?: string; // Optional customer information for Madrid customer deliveries
  physicalStockBefore: number;
  physicalStockAfter: number; // Resulting Madrid balance
  baselineSnapshotId: string; // The baseline snapshot or correction ID active when this movement occurred
  reconciledBySnapshotId?: string; // Populated when a newer physical Excel snapshot or physical correction supersedes this movement
  isAppliedToCurrentBaseline: boolean; // True if active on top of current baseline; false once absorbed into a newer baseline
  relatedShipmentId?: string;
  relatedCustomerDeliveryId?: string;
  relatedDemandId?: string;
  effectiveDate: string; // YYYY-MM-DD
  createdAt: string; // ISO string
  createdBy: string;
  notes?: string;
}

export type WeeklyDeliveryStatus = 'Pending' | 'Partial' | 'Delivered';

export interface WeeklyProductionPlanEntry {
  id: string; // Deterministic ID: `${year}_W${String(weekNumber).padStart(2, '0')}_${modelId}`
  modelId: AirbagModel;
  reference: AirbagModel;
  year: number;
  weekNumber: number; // 1..53
  weekLabel: string; // e.g., 'W41', 'W52', 'W01'
  weekKey: string; // e.g., '2026-W41'
  destination: 'Spain (Madrid)' | 'Morocco (Domestic)';
  workflowType: DeliveryWorkflowType; // 'SPAIN_TRANSFER' | 'MOROCCO_DOMESTIC'
  customerRequiredQty: number;
  plannedProductionQty: number;
  plannedTangerToMadridQty: number; // Always 0 for TETOUAN
  deliveredQty: number;
  pendingQty: number;
  status: WeeklyDeliveryStatus;
  notes?: string;
  updatedAt: string;
  updatedBy: string;
}

export interface ConfirmedCustomerDelivery {
  id: string;
  idempotencyKey: string; // `${demandId}__${deliveryDate}__${invoiceOrRef}`
  demandId: string; // Links to WeeklyCustomerDemand.id (e.g., '2026_W41_CRAFTER')
  year: number;
  weekNumber: number;
  weekLabel: string; // e.g., 'W41'
  modelId: AirbagModel;
  workflowType: DeliveryWorkflowType; // 'SPAIN_TRANSFER' (deducts Madrid stock) | 'MOROCCO_DOMESTIC' (links Tanger delivery)
  deliveredQuantity: number;
  deliveryDate: string; // YYYY-MM-DD
  invoiceOrRef: string; // Invoice number or delivery note reference
  deductedFromMadridStock: boolean; // True for post-baseline Spain deliveries; false if historical pre-baseline W41 confirmation or Morocco domestic
  madridMovementId?: string; // Linked MadridStockMovement ID if deducted from Madrid stock
  linkedTangerDeliveryId?: string; // Linked Tanger DeliveryEntry ID for TETOUAN domestic deliveries
  confirmedBy: string;
  confirmedAt: string; // ISO string
  notes?: string;
}

// ==========================================
// PHASE 1 PLANNING & SHORTAGE ENGINE OUTPUT TYPES
// ==========================================

export interface WeeklyReferencePlanCell {
  year: number;
  weekNumber: number;
  weekLabel: string; // e.g., 'W41', 'W52', 'W01'
  weekKey?: string; // e.g., '2026-W52', '2027-W01'
  modelId: AirbagModel;
  workflowType: DeliveryWorkflowType;
  leadTimeWeeks: number;
  plannedTangerDispatchYear?: number;
  plannedTangerDispatchWeek: number;
  plannedTangerDispatchWeekLabel: string;
  plannedTangerDispatchYearWeekKey?: string;

  // 1. Customer Demand Breakdown (Planned vs. Actual Confirmed vs. Reserved Pending)
  plannedCustomerDemand: number;
  confirmedCustomerDelivered: number;
  reservedPendingDemand: number; // max(0, plannedCustomerDemand - confirmedCustomerDelivered)

  // 2. Madrid Stock Projection (Spain references only; 0 for TETOUAN)
  uncommittedMadridEnteringWeek: number; // Available uncommitted Madrid stock at start of this week
  madridStockCoveredQty: number; // How much of reservedPendingDemand is covered by uncommitted Madrid stock
  uncommittedMadridLeavingWeek: number; // Remaining uncommitted Madrid stock after reserving this week's pending demand
  netSpainShortageForWeek: number; // Quantity that Madrid cannot cover and must arrive from Tanger (dispatched in W - 1)

  // 3. Tanger Dispatch & Production Requirement (Attributed to plannedTangerDispatchWeek = W - leadTimeWeeks)
  requiredTangerDispatchInDispatchWeek: number; // Quantity Tanger must dispatch in W-1 (Spain) or W (TETOUAN)
  plannedTruckLoadQty?: number; // Proposal-only truck load (status === 'planned') — does NOT alter physical or in-transit stock
  plannedTruckDispatchedQty: number; // Actual dispatched/in-transit truck quantity arriving for this target week
  uncommittedTangerCoverageQty: number; // How much of requiredTangerDispatch is covered by uncommitted Tanger stock
  netTangerProductionShortage: number; // Quantity Tanger must still produce before dispatch week

  // Visual status
  coverageStatus: 'no_demand' | 'delivered' | 'covered_in_madrid' | 'covered_in_tanger' | 'production_shortage';
}

export interface ReferencePlanningSummary {
  modelId: AirbagModel;
  workflowType: DeliveryWorkflowType;
  leadTimeWeeks: number;

  // Physical vs. Reserved vs. Uncommitted Inventory
  physicalTangerStock: number;
  physicalMadridStock: number;
  inTransitToMadridStock: number;
  physicalCombinedStock: number; // physicalTangerStock + physicalMadridStock (with inTransit tracked separately)

  totalPlannedDemandAllWeeks: number;
  totalConfirmedDeliveredAllWeeks: number;
  totalReservedPendingDemandAllWeeks: number;

  // Immediate Uncommitted Stock after reserving prior/current pending commitments
  uncommittedMadridAfterW41: number;
  uncommittedTangerInitial: number;

  weeklyCells: Record<number, WeeklyReferencePlanCell>; // Keyed by weekNumber (e.g., 41..52)
  weeklyCellsByKey?: Record<string, WeeklyReferencePlanCell>; // Keyed by `${year}-W${padStart(weekNumber, 2, '0')}` for multi-year timelines
}

export interface TangerWeeklyDispatchPlan {
  dispatchYear?: number;
  dispatchWeekNumber: number;
  dispatchWeekLabel: string; // e.g., 'W42', 'W52', 'W01'
  dispatchWeekKey?: string; // e.g., '2026-W52', '2027-W01'
  targetSpainDeliveryYear?: number;
  targetSpainDeliveryWeekNumber: number; // e.g., 43, or 1 when dispatchWeekNumber is 52
  targetSpainDeliveryWeekLabel: string; // e.g., 'W43', 'W01'
  targetSpainDeliveryWeekKey?: string; // e.g., '2027-W01'
  spainTruckItems: Array<{
    modelId: AirbagModel;
    targetSpainWeekLabel: string;
    targetSpainWeekKey?: string;
    spainCustomerDemand: number;
    coveredByMadridStock: number;
    requiredOnTangerTruck: number;
    coveredByTangerStock: number;
    netTangerProductionShortage: number;
  }>;
  domesticItems: Array<{
    modelId: AirbagModel;
    domesticWeekLabel: string;
    domesticWeekKey?: string;
    domesticCustomerDemand: number;
    coveredByTangerStock: number;
    netTangerProductionShortage: number;
  }>;
  totalSpainTruckPiecesRequired: number;
  totalDomesticPiecesRequired: number;
  totalTangerProductionShortagePieces: number;
}




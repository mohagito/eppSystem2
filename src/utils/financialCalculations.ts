import { 
  RollEntry, 
  RollMaterial, 
  FinishedPiecePrice, 
  RollProductionItem, 
  MaterialFamily, 
  ExpectedYieldConfig,
  AirbagModel
} from '../types';
import { MATERIAL_PRICING } from '../components/RollsModule';

/**
 * Standard factory piece price configuration baseline.
 * Prices specified per Laser system industrial specification:
 * - HUESKER 22:
 *   - BCB-FRA = €0.5984 / piece
 *   - TETOUAN / XJX-MARR = €0.5945 / piece
 * - HUESKER 82:
 *   - CRAFTER = €0.2729 / piece
 *   - CADDY = €0.4035 / piece (STOPPED - preserved for historical calculations)
 * - INDIA / DELCOTEX:
 *   - SK216 = €0.7500 / piece
 *   - VW217 = €0.7500 / piece
 * - KUGA:
 *   - KUGA LHD = €1.1100 / piece
 *   - KUGA RHD = €1.1100 / piece
 */
export const DEFAULT_PIECE_PRICES: FinishedPiecePrice[] = [
  {
    id: 'BCB-FRA',
    reference: 'BCB-FRA',
    material: 'Yellow Huesker',
    materialFamily: 'HUESKER 22',
    pricePerPiece: 0.5984,
    isActive: true
  },
  {
    id: 'TETOUAN-XJX-MARR',
    reference: 'TETOUAN / XJX-MARR',
    material: 'Yellow Huesker',
    materialFamily: 'HUESKER 22',
    pricePerPiece: 0.5945,
    isActive: true
  },
  {
    id: 'CRAFTER',
    reference: 'CRAFTER',
    material: 'White Huesker',
    materialFamily: 'HUESKER 82',
    pricePerPiece: 0.2729,
    isActive: true
  },
  {
    id: 'CADDY',
    reference: 'CADDY',
    material: 'White Huesker',
    materialFamily: 'HUESKER 82',
    pricePerPiece: 0.4035,
    isActive: false // STOPPED: Available in historical records, not active for new production
  },
  {
    id: 'SK216',
    reference: 'SK216',
    material: 'Delcotex India',
    materialFamily: 'INDIA / DELCOTEX',
    pricePerPiece: 0.7500,
    isActive: true
  },
  {
    id: 'VW217',
    reference: 'VW217',
    material: 'Delcotex India',
    materialFamily: 'INDIA / DELCOTEX',
    pricePerPiece: 0.7500,
    isActive: true
  },
  {
    id: 'KUGA-LHD',
    reference: 'KUGA LHD',
    material: 'Kuga',
    materialFamily: 'KUGA',
    pricePerPiece: 1.1100,
    isActive: true
  },
  {
    id: 'KUGA-RHD',
    reference: 'KUGA RHD',
    material: 'Kuga',
    materialFamily: 'KUGA',
    pricePerPiece: 1.1100,
    isActive: true
  }
];

/**
 * Baseline expected yield configuration per roll type (Expected pieces per roll)
 * Manager can customize anytime.
 */
export const DEFAULT_EXPECTED_YIELDS: ExpectedYieldConfig[] = [
  {
    id: 'BCB-FRA',
    reference: 'BCB-FRA',
    material: 'Yellow Huesker',
    materialFamily: 'HUESKER 22',
    expectedPieces: 250
  },
  {
    id: 'TETOUAN-XJX-MARR',
    reference: 'TETOUAN / XJX-MARR',
    material: 'Yellow Huesker',
    materialFamily: 'HUESKER 22',
    expectedPieces: 250
  },
  {
    id: 'CRAFTER',
    reference: 'CRAFTER',
    material: 'White Huesker',
    materialFamily: 'HUESKER 82',
    expectedPieces: 1800
  },
  {
    id: 'CADDY',
    reference: 'CADDY',
    material: 'White Huesker',
    materialFamily: 'HUESKER 82',
    expectedPieces: 1000
  },
  {
    id: 'SK216',
    reference: 'SK216',
    material: 'Delcotex India',
    materialFamily: 'INDIA / DELCOTEX',
    expectedPieces: 350
  },
  {
    id: 'VW217',
    reference: 'VW217',
    material: 'Delcotex India',
    materialFamily: 'INDIA / DELCOTEX',
    expectedPieces: 350
  },
  {
    id: 'KUGA-LHD',
    reference: 'KUGA LHD',
    material: 'Kuga',
    materialFamily: 'KUGA',
    expectedPieces: 180
  },
  {
    id: 'KUGA-RHD',
    reference: 'KUGA RHD',
    material: 'Kuga',
    materialFamily: 'KUGA',
    expectedPieces: 180
  }
];

export interface MaterialFamilyRelationship {
  family: MaterialFamily;
  materialName: RollMaterial;
  references: string[];
  activeReferences: string[];
}

export const MATERIAL_FAMILY_RELATIONSHIPS: Record<RollMaterial, MaterialFamilyRelationship> = {
  'Yellow Huesker': {
    family: 'HUESKER 22',
    materialName: 'Yellow Huesker',
    references: ['BCB-FRA', 'TETOUAN / XJX-MARR'],
    activeReferences: ['BCB-FRA', 'TETOUAN / XJX-MARR']
  },
  'White Huesker': {
    family: 'HUESKER 82',
    materialName: 'White Huesker',
    references: ['CRAFTER', 'CADDY'],
    activeReferences: ['CRAFTER'] // CADDY is STOPPED
  },
  'Delcotex India': {
    family: 'INDIA / DELCOTEX',
    materialName: 'Delcotex India',
    references: ['SK216', 'VW217'],
    activeReferences: ['SK216', 'VW217']
  },
  'Kuga': {
    family: 'KUGA',
    materialName: 'Kuga',
    references: ['KUGA LHD', 'KUGA RHD'],
    activeReferences: ['KUGA LHD', 'KUGA RHD']
  }
};

/**
 * Normalizes material name to the canonical RollMaterial enum
 */
export function normalizeRollMaterial(name: string): RollMaterial {
  const lower = (name || '').toLowerCase();
  if (lower.includes('yellow') || lower.includes('h22') || lower.includes('huesker 22')) {
    return 'Yellow Huesker';
  }
  if (lower.includes('white') || lower.includes('h82') || lower.includes('huesker 82')) {
    return 'White Huesker';
  }
  if (lower.includes('kuga') || lower.includes('sage')) {
    return 'Kuga';
  }
  if (lower.includes('delcotex') || lower.includes('india')) {
    return 'Delcotex India';
  }
  return 'White Huesker';
}

/**
 * Maps any roll to its exact material family
 */
export function getMaterialFamily(material: RollMaterial): MaterialFamily {
  return MATERIAL_FAMILY_RELATIONSHIPS[material]?.family || 'HUESKER 82';
}

/**
 * Calculates REAL cost of a specific physical roll based on:
 * - Its actual physical length (meters)
 * - Its real fabric specifications (width and area where applicable)
 * - The official factory pricing schedule
 */
export function calculateRealRollCost(roll: RollEntry): {
  cost: number;
  length: number;
  formula: string;
  material: RollMaterial;
  family: MaterialFamily;
} {
  const material = normalizeRollMaterial(roll.materialName);
  const family = getMaterialFamily(material);

  // Determine actual physical length
  let length = roll.metersTotal ?? roll.originalLength;
  if (length === undefined || length === null || isNaN(length) || length <= 0) {
    // Default standard length if unrecorded
    length = material === 'Kuga' ? 50 : material === 'Delcotex India' ? 90 : 100;
  }

  const p = MATERIAL_PRICING[material];
  if (!p) {
    return {
      cost: 0,
      length,
      formula: 'No pricing schema found',
      material,
      family
    };
  }

  let cost: number;
  let formula: string;

  if (p.unit === '€/m²' && p.width) {
    // Area based (Huesker 22: 1.75m * length * 21.10 €/m²; Huesker 82: 1.60m * length * 6.77 €/m²)
    cost = p.width * length * p.unitPrice;
    formula = `${length}m × ${p.width.toFixed(2)}m × €${p.unitPrice.toFixed(2)}/m²`;
  } else {
    // Linear meters based (Delcotex India: length * 17.95 €/ml; Kuga: length * 15.43 €/ml)
    cost = length * p.unitPrice;
    formula = `${length}m × €${p.unitPrice.toFixed(2)}/ml`;
  }

  // Rounded to 2 decimals for precision accounting
  cost = Math.round(cost * 100) / 100;

  return {
    cost,
    length,
    formula,
    material,
    family
  };
}

/**
 * Calculates roll profitability based on produced references and locked piece prices
 */
export function calculateRollProfit(
  rollCost: number,
  items: { reference: string; pieces: number; pricePerPiece: number }[]
): {
  itemsWithValues: RollProductionItem[];
  totalPieces: number;
  totalProductionValue: number;
  grossProfit: number;
  profitPercentage: number;
} {
  let totalPieces = 0;
  let totalProductionValue = 0;

  const itemsWithValues: RollProductionItem[] = items.map((item) => {
    const pieces = Number(item.pieces) || 0;
    const price = Number(item.pricePerPiece) || 0;
    const val = Math.round(pieces * price * 100) / 100;
    totalPieces += pieces;
    totalProductionValue += val;
    return {
      reference: item.reference,
      pieces,
      pricePerPiece: price,
      productionValue: val
    };
  });

  totalProductionValue = Math.round(totalProductionValue * 100) / 100;
  const grossProfit = Math.round((totalProductionValue - rollCost) * 100) / 100;
  const profitPercentage = rollCost > 0 
    ? Math.round((grossProfit / rollCost) * 10000) / 100 
    : 0;

  return {
    itemsWithValues,
    totalPieces,
    totalProductionValue,
    grossProfit,
    profitPercentage
  };
}

/**
 * Formatting helpers for clean, minimal financial presentation
 */
export function formatEuroCurrency(amount: number, minimumFractionDigits: number = 2): string {
  if (isNaN(amount) || amount === undefined || amount === null) return '€0.00';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits,
    maximumFractionDigits: minimumFractionDigits
  }).format(amount);
}

export function formatEuroPrice(amount: number): string {
  if (isNaN(amount) || amount === undefined || amount === null) return '€0.0000';
  return `€${amount.toFixed(4)}`;
}

export function formatProfitPercent(percent: number): string {
  if (isNaN(percent) || percent === undefined || percent === null) return '0.0%';
  const prefix = percent > 0 ? '+' : '';
  return `${prefix}${percent.toFixed(1)}%`;
}

/**
 * Normalizes Roll Status into canonical 3 statuses: NEW, IN PRODUCTION, FINISHED
 */
export type CanonicalRollStatus = 'NEW' | 'IN PRODUCTION' | 'FINISHED';

export function normalizeRollStatus(status: any): CanonicalRollStatus {
  if (!status) return 'NEW';
  const s = String(status).toUpperCase().trim();
  if (s === 'FINISHED' || s === 'CONSUMED') return 'FINISHED';
  if (s === 'IN PRODUCTION' || s === 'ACTIVE') return 'IN PRODUCTION';
  return 'NEW';
}

/**
 * Maps Finished Reference to AirbagModel for piece stock traceability
 */
export function referenceToAirbagModel(ref: string): AirbagModel {
  const clean = (ref || '').toUpperCase().trim();
  if (clean.includes('BCB')) return 'BCB';
  if (clean.includes('TETOUAN') || clean.includes('XJX')) return 'TETOUAN';
  if (clean.includes('CRAFTER')) return 'CRAFTER';
  if (clean.includes('CADDY')) return 'CADDY';
  if (clean.includes('SK216')) return 'SK216';
  if (clean.includes('VW217')) return 'VW217';
  if (clean.includes('KUGA') && clean.includes('LHD')) return 'KUGA LHD';
  if (clean.includes('KUGA') && clean.includes('RHD')) return 'KUGA RHD';
  return 'BCB';
}

/**
 * Maps AirbagModel to primary Finished Reference
 */
export function airbagModelToReference(model: AirbagModel): string {
  switch (model) {
    case 'BCB': return 'BCB-FRA';
    case 'TETOUAN': return 'TETOUAN / XJX-MARR';
    case 'CRAFTER': return 'CRAFTER';
    case 'CADDY': return 'CADDY';
    case 'SK216': return 'SK216';
    case 'VW217': return 'VW217';
    case 'KUGA LHD': return 'KUGA LHD';
    case 'KUGA RHD': return 'KUGA RHD';
    default: return model;
  }
}

/**
 * Returns default active reference for a material
 */
export function getDefaultReferenceForMaterial(material: RollMaterial): string {
  const rel = MATERIAL_FAMILY_RELATIONSHIPS[material];
  if (rel && rel.activeReferences.length > 0) {
    return rel.activeReferences[0];
  }
  return 'BCB-FRA';
}

/**
 * Gets expected yield for a reference from configuration or defaults
 */
export function getExpectedYieldForReference(
  ref: string,
  customYields?: ExpectedYieldConfig[]
): number {
  if (customYields && customYields.length > 0) {
    const found = customYields.find(y => y.reference === ref || y.id === ref);
    if (found && found.expectedPieces > 0) return found.expectedPieces;
  }
  const defaultFound = DEFAULT_EXPECTED_YIELDS.find(y => y.reference === ref || y.id === ref);
  return defaultFound ? defaultFound.expectedPieces : 250;
}

/**
 * Gets active piece price for a reference
 */
export function getPiecePriceForReference(
  ref: string,
  customPrices?: FinishedPiecePrice[]
): number {
  if (customPrices && customPrices.length > 0) {
    const found = customPrices.find(p => p.reference === ref || p.id === ref);
    if (found && found.pricePerPiece > 0) return found.pricePerPiece;
  }
  const defaultFound = DEFAULT_PIECE_PRICES.find(p => p.reference === ref || p.id === ref);
  return defaultFound ? defaultFound.pricePerPiece : 0.5984;
}

/**
 * Comprehensive automatic calculation of roll production and financials:
 * ROLL → EXPECTED PIECES → PRODUCTION → PIECE STOCK → ROLL COMPLETION → FINANCIAL RESULT
 * 
 * Rules:
 * - When roll is OPEN (unopened warehouse reserve), values are at zero (not started yet).
 * - When roll is opened (IN PRODUCTION), calculate actual roll cost and track pieces produced (e.g. BCB and TETOUAN for Huesker 22).
 * - When roll is marked FINISHED, finalize gross profit and profit %.
 */
export function calculateRollProductionMetrics(
  roll: RollEntry,
  customYields?: ExpectedYieldConfig[],
  customPrices?: FinishedPiecePrice[]
) {
  const status = normalizeRollStatus(roll.status);
  const isStarted = status === 'IN PRODUCTION' || status === 'FINISHED';
  const material = normalizeRollMaterial(roll.materialName);
  const costInfo = calculateRealRollCost(roll);
  const actualLength = costInfo.length;

  // If roll is not opened yet (NEW / Unopened), all production and financial metrics start at 0
  if (!isStarted) {
    return {
      material,
      referenceId: roll.referenceId || 'Not Selected',
      actualLength,
      rollCost: 0,
      expectedPieces: 0,
      producedPieces: 0,
      remainingPieces: 0,
      pricePerPiece: 0,
      productionValue: 0,
      grossProfit: 0,
      profitPercent: 0,
      status: 'NEW' as const,
      records: []
    };
  }

  const referenceId = roll.referenceId || getDefaultReferenceForMaterial(material);
  const rollCost = roll.rollCost !== undefined && roll.rollCost > 0 ? roll.rollCost : costInfo.cost;
  const expectedPieces = roll.expectedPieces !== undefined && roll.expectedPieces > 0
    ? roll.expectedPieces
    : getExpectedYieldForReference(referenceId, customYields);

  // Compute total produced pieces and production value from production records
  const records = roll.productionRecords || [];
  let producedPieces = 0;
  let productionValue = 0;

  if (records.length > 0) {
    records.forEach((r) => {
      const q = Number(r.quantity) || 0;
      const refPrice = getPiecePriceForReference(r.referenceId || referenceId, customPrices);
      producedPieces += q;
      productionValue += q * refPrice;
    });
  } else {
    producedPieces = Number(roll.producedPieces) || 0;
    const lockedPrice = roll.pricePerPiece !== undefined && roll.pricePerPiece > 0
      ? roll.pricePerPiece
      : getPiecePriceForReference(referenceId, customPrices);
    productionValue = producedPieces * lockedPrice;
  }

  productionValue = Math.round(productionValue * 100) / 100;
  const remainingPieces = Math.max(0, expectedPieces - producedPieces);
  const pricePerPiece = roll.pricePerPiece !== undefined && roll.pricePerPiece > 0
    ? roll.pricePerPiece
    : getPiecePriceForReference(referenceId, customPrices);

  const grossProfit = Math.round((productionValue - rollCost) * 100) / 100;
  const profitPercent = rollCost > 0
    ? Math.round((grossProfit / rollCost) * 10000) / 100
    : 0;

  return {
    material,
    referenceId,
    actualLength,
    rollCost,
    expectedPieces,
    producedPieces,
    remainingPieces,
    pricePerPiece,
    productionValue,
    grossProfit,
    profitPercent,
    status,
    records
  };
}

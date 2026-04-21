export interface MaterialTransportRate {
  id: string;
  standardMaterialId: string;
  routeType: 'to_kosovo' | 'from_kosovo_to_dk' | 'other';
  fromLocation: string;
  toLocation: string;
  costModel: 'per_unit' | 'per_shipment';
  unitCost: number;
  currency: string;
  validFrom: Date;
  validTo?: Date;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectMaterialTransport {
  id: string;
  projectMaterialId: string;
  routeType: 'to_kosovo' | 'from_kosovo_to_dk' | 'other';
  fromLocation: string;
  toLocation: string;
  // Expected transport (V1)
  expectedCostModel: 'per_unit' | 'per_shipment';
  expectedUnitCost: number;
  currency: string;
  expectedNote?: string;
  // Actual transport (V2-ready)
  actualCostModel?: 'per_unit' | 'per_shipment';
  actualUnitCost?: number;
  actualNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const ROUTE_TYPES = {
  to_kosovo: 'Til Kosovo',
  from_kosovo_to_dk: 'Fra Kosovo til DK',
  other: 'Anden rute'
} as const;

export const COST_MODELS = {
  per_unit: 'Pr. enhed',
  per_shipment: 'Pr. forsendelse'
} as const;
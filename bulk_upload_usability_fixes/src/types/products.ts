export interface ProjectProduct {
  id: string;
  projectId: string;
  name: string;
  productType: 'curtain' | 'installation' | 'furniture' | 'other';
  unit: string;
  quantity: number;
  description?: string;
  notes?: string;
  status: 'active' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectProductMaterialLine {
  id: string;
  projectProductId: string;
  projectMaterialId: string;
  // Produktdel
  lineTitle: string;
  lineDescription?: string;
  // Beregning
  calcEnabled: boolean;
  calcLengthM?: number;
  calcWidthM?: number;
  calcCount?: number;
  // Mængder
  baseQty: number;
  wastePct: number;
  qty: number;
  // Pris
  unit: string;
  unitCostOverride?: number;
  note?: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectProductLaborLine {
  id: string;
  projectProductId: string;
  laborType: 'production' | 'dk_installation' | 'other';
  title: string;
  qty: number;
  unit: string;
  unitCost: number;
  note?: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectProductTransportLine {
  id: string;
  projectProductId: string;
  title: string;
  qty: number;
  unit: string;
  unitCost: number;
  note?: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectProductOtherCostLine {
  id: string;
  projectProductId: string;
  title: string;
  qty: number;
  unit: string;
  unitCost: number;
  note?: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export const PRODUCT_TYPES = {
  curtain: 'Gardin',
  installation: 'Installation',
  furniture: 'Møbel',
  other: 'Andet'
} as const;

export const LABOR_TYPES = {
  production: 'Produktion',
  dk_installation: 'Montage i DK',
  other: 'Andet'
} as const;

export const WASTE_PRESETS = [0, 2, 5, 10] as const;

export interface ProductCostCalculation {
  materialCosts: {
    materialCost: number;
    transportCost: number;
    total: number;
  };
  laborCosts: {
    production: number;
    dkInstallation: number;
    other: number;
    total: number;
  };
  transportCosts: {
    total: number;
  };
  otherCosts: {
    total: number;
  };
  grandTotal: number;
}
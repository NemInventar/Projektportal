-- Opret prissnapshot tabel hvis den ikke eksisterer
CREATE TABLE IF NOT EXISTS standard_material_price_snapshots_2026_01_19_15_00 (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id UUID NOT NULL REFERENCES standard_materials_2026_01_15_06_45(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES standard_suppliers_2026_01_15_06_45(id) ON DELETE SET NULL,
  price DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'DKK',
  price_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Opret indeks for bedre performance
CREATE INDEX IF NOT EXISTS idx_price_snapshots_material_id ON standard_material_price_snapshots_2026_01_19_15_00(material_id);
CREATE INDEX IF NOT EXISTS idx_price_snapshots_supplier_id ON standard_material_price_snapshots_2026_01_19_15_00(supplier_id);
CREATE INDEX IF NOT EXISTS idx_price_snapshots_date ON standard_material_price_snapshots_2026_01_19_15_00(price_date);
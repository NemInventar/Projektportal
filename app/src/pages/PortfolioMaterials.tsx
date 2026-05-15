import { useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { usePortfolioMaterials } from '@/contexts/PortfolioMaterialsContext';
import { useStandardSuppliers } from '@/contexts/StandardSuppliersContext';
import PortfolioFilters, { PortfolioFiltersState } from '@/components/portfolio/PortfolioFilters';
import PortfolioTable from '@/components/portfolio/PortfolioTable';

export default function PortfolioMaterials() {
  const { materials, loading, error } = usePortfolioMaterials();
  const { suppliers: standardSuppliers } = useStandardSuppliers();

  const [filters, setFilters] = useState<PortfolioFiltersState>({
    search: '',
    supplierId: '',
    category: '',
    leadTimeBand: 'all',
  });

  const supplierMap = useMemo(() => {
    const m = new Map<string, string>();
    standardSuppliers.forEach(s => m.set(s.id, s.name));
    return m;
  }, [standardSuppliers]);

  const supplierOptions = useMemo(() => {
    const ids = new Set<string>();
    materials.forEach(m => { if (m.primarySupplierId) ids.add(m.primarySupplierId); });
    return Array.from(ids).map(id => ({ id, name: supplierMap.get(id) ?? '(ukendt)' })).sort((a, b) => a.name.localeCompare(b.name));
  }, [materials, supplierMap]);

  const categoryOptions = useMemo(() => {
    const s = new Set<string>();
    materials.forEach(m => { if (m.category) s.add(m.category); });
    return Array.from(s).sort();
  }, [materials]);

  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return materials.filter(m => {
      if (search) {
        const supplierName = m.primarySupplierId ? (supplierMap.get(m.primarySupplierId) ?? '').toLowerCase() : '';
        const hay = [m.materialName, m.category ?? '', supplierName].join(' ').toLowerCase();
        if (!hay.includes(search)) return false;
      }
      if (filters.supplierId && m.primarySupplierId !== filters.supplierId) return false;
      if (filters.category && m.category !== filters.category) return false;
      if (filters.leadTimeBand !== 'all') {
        const lt = m.leadTimeDays;
        if (filters.leadTimeBand === 'unknown' && lt != null) return false;
        if (filters.leadTimeBand === 'lt7' && (lt == null || lt >= 7)) return false;
        if (filters.leadTimeBand === '7-14' && (lt == null || lt < 7 || lt > 14)) return false;
        if (filters.leadTimeBand === 'gt14' && (lt == null || lt <= 14)) return false;
      }
      return true;
    });
  }, [materials, filters, supplierMap]);

  return (
    <Layout>
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-3xl font-bold">Produktionsportefølje – Materialer</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading
              ? 'Indlæser…'
              : error
                ? `Fejl: ${error}`
                : `${filtered.filter(m => m.qtyMissing > 0).length} materialer mangler bestilling`}
          </p>
        </div>

        {!loading && !error && (
          <Card>
            <CardContent className="pt-4">
              <PortfolioFilters
                state={filters}
                onChange={setFilters}
                suppliers={supplierOptions}
                categories={categoryOptions}
              />
            </CardContent>
          </Card>
        )}

        {!loading && !error && materials.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <p className="text-base font-medium mb-2">Ingen materialer i porteføljen endnu</p>
              <p className="text-sm">
                Materialer dukker op her når et projekt har materialer linket til et standard-materiale
                og er i en aktiv fase (ikke Tabt, Fravalgt, Arkiv eller Garanti).
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && !error && materials.length > 0 && (
          <PortfolioTable materials={filtered} />
        )}
      </div>
    </Layout>
  );
}

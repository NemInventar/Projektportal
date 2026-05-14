import Layout from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { usePortfolioMaterials } from '@/contexts/PortfolioMaterialsContext';

export default function PortfolioMaterials() {
  const { materials, loading, error } = usePortfolioMaterials();

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
                : `${materials.filter(m => m.qtyMissing > 0).length} materialer mangler bestilling`}
          </p>
        </div>

        {!loading && !error && materials.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <p className="text-base font-medium mb-2">Ingen materialer i porteføljen endnu</p>
              <p className="text-sm">
                Materialer dukker op her når de er fuldt godkendt (production + sustainability)
                på et projekt der ikke er Tabt, Fravalgt, Arkiv eller Garanti.
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && !error && materials.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                {/* Placeholder — tabel kommer i Task 5 */}
                {materials.length} materialer fundet. Tabel implementeres næste step.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}

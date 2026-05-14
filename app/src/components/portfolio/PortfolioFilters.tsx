import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';

export interface PortfolioFiltersState {
  search: string;
  supplierId: string;
  category: string;
  leadTimeBand: 'all' | 'lt7' | '7-14' | 'gt14' | 'unknown';
}

interface Props {
  state: PortfolioFiltersState;
  onChange: (state: PortfolioFiltersState) => void;
  suppliers: { id: string; name: string }[];
  categories: string[];
}

export default function PortfolioFilters({ state, onChange, suppliers, categories }: Props) {
  const update = (patch: Partial<PortfolioFiltersState>) => onChange({ ...state, ...patch });

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Søg på materiale, kategori, leverandør…"
          value={state.search}
          onChange={e => update({ search: e.target.value })}
          className="pl-10"
        />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Select value={state.supplierId || 'all'} onValueChange={v => update({ supplierId: v === 'all' ? '' : v })}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Leverandør" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle leverandører</SelectItem>
            {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={state.category || 'all'} onValueChange={v => update({ category: v === 'all' ? '' : v })}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Kategori" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle kategorier</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={state.leadTimeBand} onValueChange={v => update({ leadTimeBand: v as PortfolioFiltersState['leadTimeBand'] })}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Lead time" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle lead times</SelectItem>
            <SelectItem value="lt7">&lt; 7 dage</SelectItem>
            <SelectItem value="7-14">7–14 dage</SelectItem>
            <SelectItem value="gt14">&gt; 14 dage</SelectItem>
            <SelectItem value="unknown">Ukendt</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

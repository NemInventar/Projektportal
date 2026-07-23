/**
 * ProductProcurementStatus — indkøbsstatus rullet op pr. produkt, på tværs af projekter.
 *
 * Adskilt fra BOM.tsx (som er pr. materiale, ét projekt ad gangen). Her ser man i stedet:
 * "har vi købt alt ind til at kunne lave dette produkt?" — grupperet efter produkt, med et
 * projekt-filter (default: alle aktive projekter).
 *
 * Data kommer fra v_product_procurement_status, som selv afleder status fra de samme
 * purchase_order_lines/project_materials man allerede vinger af i BOM — ingen dobbelt-registrering.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from '@/contexts/ProjectContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Package, CheckCircle2, Clock, AlertTriangle, RefreshCw, Search, HelpCircle,
} from 'lucide-react';

interface ProductProcurementRow {
  project_product_id: string;
  project_id: string;
  project_number: string | null;
  project_name: string | null;
  product_name: string;
  quantity: number;
  product_type: string | null;
  total_materials: number;
  ordered_materials: number;
  delivered_materials: number;
  pending_materials: number;
  pct_procured: number;
  status: 'fully_procured' | 'partially_procured' | 'not_procured' | 'no_materials_linked';
}

const STATUS_LABEL: Record<ProductProcurementRow['status'], string> = {
  fully_procured: 'Fuldt Procureret',
  partially_procured: 'Delvist Procureret',
  not_procured: 'Ikke Procureret',
  no_materials_linked: 'Ingen Materialer Koblet',
};

const ProductProcurementStatus: React.FC = () => {
  const navigate = useNavigate();
  const { projects, setActiveProject } = useProject();

  const [rows, setRows] = useState<ProductProcurementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const loadData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('v_product_procurement_status')
      .select('*')
      .order('project_number', { ascending: true });

    if (!error && data) {
      setRows(data as unknown as ProductProcurementRow[]);
    } else if (error) {
      console.error('Error loading product procurement status:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredRows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter(r => {
      if (projectFilter !== 'all' && r.project_id !== projectFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (s.length > 0) {
        const hay = [r.product_name, r.project_name, r.project_number].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [rows, projectFilter, statusFilter, search]);

  const summary = useMemo(() => {
    return {
      total: rows.length,
      fully: rows.filter(r => r.status === 'fully_procured').length,
      partially: rows.filter(r => r.status === 'partially_procured').length,
      notProcured: rows.filter(r => r.status === 'not_procured').length,
      noMaterials: rows.filter(r => r.status === 'no_materials_linked').length,
    };
  }, [rows]);

  const getStatusBadge = (status: ProductProcurementRow['status']) => {
    switch (status) {
      case 'fully_procured':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />{STATUS_LABEL[status]}</Badge>;
      case 'partially_procured':
        return <Badge variant="default" className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />{STATUS_LABEL[status]}</Badge>;
      case 'not_procured':
        return <Badge variant="destructive" className="bg-red-100 text-red-800"><AlertTriangle className="h-3 w-3 mr-1" />{STATUS_LABEL[status]}</Badge>;
      case 'no_materials_linked':
        return <Badge variant="outline" className="bg-gray-100 text-gray-700"><HelpCircle className="h-3 w-3 mr-1" />{STATUS_LABEL[status]}</Badge>;
    }
  };

  const getProgressBarColor = (status: ProductProcurementRow['status']) => {
    switch (status) {
      case 'fully_procured': return 'bg-green-500';
      case 'partially_procured': return 'bg-yellow-500';
      case 'not_procured': return 'bg-red-300';
      case 'no_materials_linked': return 'bg-gray-300';
    }
  };

  const handleShowMaterials = (row: ProductProcurementRow) => {
    const project = projects.find(p => p.id === row.project_id);
    if (project) setActiveProject(project);
    navigate(`/project/products/${row.project_product_id}`);
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Package className="h-7 w-7" />
              Produkt-indkøbsstatus
            </h1>
            <p className="text-muted-foreground mt-1">
              Materiale-indkøbsstatus pr. produkt, på tværs af projekter
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Alle projekter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle projekter</SelectItem>
                {projects
                  .filter(p => p.phase !== 'Arkiv' && p.phase !== 'Tabt' && p.phase !== 'Fravalgt')
                  .map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.projectNumber ? `${p.projectNumber} — ${p.name}` : p.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={loadData} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Opdatér
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Produkter i alt</span>
                <Package className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold mt-1">{summary.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Fuldt Procureret</span>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
              <div className="text-2xl font-bold mt-1 text-green-700">{summary.fully}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Delvist Procureret</span>
                <Clock className="h-4 w-4 text-yellow-600" />
              </div>
              <div className="text-2xl font-bold mt-1 text-yellow-700">{summary.partially}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Ikke Procureret</span>
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
              <div className="text-2xl font-bold mt-1 text-red-700">{summary.notProcured}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Ingen Materialer</span>
                <HelpCircle className="h-4 w-4 text-gray-500" />
              </div>
              <div className="text-2xl font-bold mt-1 text-gray-600">{summary.noMaterials}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Søg produkt eller projekt..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Alle statusser" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle statusser</SelectItem>
                  <SelectItem value="fully_procured">Fuldt Procureret</SelectItem>
                  <SelectItem value="partially_procured">Delvist Procureret</SelectItem>
                  <SelectItem value="not_procured">Ikke Procureret</SelectItem>
                  <SelectItem value="no_materials_linked">Ingen Materialer Koblet</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Produkt-procurement Status ({filteredRows.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Indlæser...</div>
            ) : filteredRows.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Ingen produkter matcher de valgte filtre</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Projekt</TableHead>
                      <TableHead>Produkt</TableHead>
                      <TableHead>Antal</TableHead>
                      <TableHead>Materialer</TableHead>
                      <TableHead className="w-48">Indkøbs-fremgang</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Handlinger</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map(row => (
                      <TableRow key={row.project_product_id}>
                        <TableCell className="text-sm">
                          <div className="font-medium">{row.project_number || '-'}</div>
                          <div className="text-muted-foreground">{row.project_name}</div>
                        </TableCell>
                        <TableCell className="font-medium">{row.product_name}</TableCell>
                        <TableCell>{row.quantity}</TableCell>
                        <TableCell className="text-sm">
                          {row.total_materials === 0 ? (
                            <span className="text-muted-foreground">Ingen materialer koblet</span>
                          ) : (
                            <>
                              <span className="text-green-700">{row.ordered_materials} bestilt</span>
                              {', '}
                              <span className="text-red-700">{row.pending_materials} afventer</span>
                              {' '}<span className="text-muted-foreground">af {row.total_materials} i alt</span>
                            </>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                              <div
                                className={`h-2.5 rounded-full ${getProgressBarColor(row.status)}`}
                                style={{ width: `${row.total_materials === 0 ? 0 : row.pct_procured}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {row.total_materials === 0 ? '-' : `${row.pct_procured}%`}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(row.status)}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => handleShowMaterials(row)}>
                            Vis materialer
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ProductProcurementStatus;

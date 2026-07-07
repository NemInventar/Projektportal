import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Plus, Factory, ChevronDown, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/contexts/ProjectContext';

type ProductionStatus = 'planned' | 'in_production' | 'shipped' | 'delivered';

interface ProductionOrder {
  id: string;
  projectId: string;
  orderNumber: string;
  title: string;
  description?: string;
  quantity: number;
  destination?: string;
  status: ProductionStatus;
  plannedDate?: Date;
  shippedDate?: Date;
  deliveredDate?: Date;
  notes?: string;
  createdAt: Date;
}

const TABLE = 'project_production_orders_2026_06_29';

const STATUS_LABELS: Record<ProductionStatus, string> = {
  planned: 'Planlagt',
  in_production: 'I produktion',
  shipped: 'Afsendt',
  delivered: 'Leveret',
};

const STATUS_COLORS: Record<ProductionStatus, string> = {
  planned: 'bg-gray-100 text-gray-800',
  in_production: 'bg-blue-100 text-blue-800',
  shipped: 'bg-orange-100 text-orange-800',
  delivered: 'bg-green-100 text-green-800',
};

const STATUS_HEADING_COLORS: Record<ProductionStatus, string> = {
  planned: 'text-gray-700',
  in_production: 'text-blue-700',
  shipped: 'text-orange-700',
  delivered: 'text-green-700',
};

const STATUSES: ProductionStatus[] = ['planned', 'in_production', 'shipped', 'delivered'];

const DESTINATIONS = ['Kosovo', 'Lokal', 'Andet'];

const emptyForm = {
  title: '',
  description: '',
  quantity: 1,
  destination: 'Kosovo',
  status: 'planned' as ProductionStatus,
  plannedDate: '',
  shippedDate: '',
  deliveredDate: '',
  notes: '',
};

const ProjectProduction = () => {
  const { toast } = useToast();
  const { activeProject } = useProject();

  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableExists, setTableExists] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState(emptyForm);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<ProductionOrder | null>(null);
  const [editFormData, setEditFormData] = useState(emptyForm);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);

  const [expandedSections, setExpandedSections] = useState<Record<ProductionStatus, boolean>>(() => {
    try {
      const saved = localStorage.getItem('ni_production_expanded');
      return saved ? JSON.parse(saved) : { planned: true, in_production: true, shipped: true, delivered: false };
    } catch {
      return { planned: true, in_production: true, shipped: true, delivered: false };
    }
  });

  const toggleSection = (status: ProductionStatus) => {
    setExpandedSections(prev => {
      const next = { ...prev, [status]: !prev[status] };
      localStorage.setItem('ni_production_expanded', JSON.stringify(next));
      return next;
    });
  };

  const grouped = STATUSES.reduce((acc, s) => {
    acc[s] = orders.filter(o => o.status === s);
    return acc;
  }, {} as Record<ProductionStatus, ProductionOrder[]>);

  const loadOrders = async () => {
    if (!activeProject) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from(TABLE as any)
        .select('*')
        .eq('project_id', activeProject.id)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.message?.includes('does not exist') || (error as any).code === '42P01') {
          setTableExists(false);
          return;
        }
        throw error;
      }

      setTableExists(true);
      setOrders((data ?? []).map((r: any) => ({
        id: r.id,
        projectId: r.project_id,
        orderNumber: r.order_number,
        title: r.title,
        description: r.description ?? undefined,
        quantity: parseFloat(r.quantity) || 1,
        destination: r.destination ?? undefined,
        status: r.status as ProductionStatus,
        plannedDate: r.planned_date ? new Date(r.planned_date) : undefined,
        shippedDate: r.shipped_date ? new Date(r.shipped_date) : undefined,
        deliveredDate: r.delivered_date ? new Date(r.delivered_date) : undefined,
        notes: r.notes ?? undefined,
        createdAt: new Date(r.created_at),
      })));
    } catch (err) {
      console.error('Error loading production orders:', err);
      toast({ title: 'Fejl', description: 'Kunne ikke indlæse produktionsordrer', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeProject) loadOrders();
  }, [activeProject]);

  const generateOrderNumber = () => {
    const year = new Date().getFullYear();
    return `PROD-${year}-${String(orders.length + 1).padStart(3, '0')}`;
  };

  const handleCreate = async () => {
    if (!activeProject || !formData.title) {
      toast({ title: 'Fejl', description: 'Titel er påkrævet', variant: 'destructive' });
      return;
    }
    try {
      const { error } = await supabase.from(TABLE as any).insert({
        project_id: activeProject.id,
        order_number: generateOrderNumber(),
        title: formData.title,
        description: formData.description || null,
        quantity: formData.quantity,
        destination: formData.destination || null,
        status: formData.status,
        planned_date: formData.plannedDate || null,
        shipped_date: formData.shippedDate || null,
        delivered_date: formData.deliveredDate || null,
        notes: formData.notes || null,
      });
      if (error) throw error;
      toast({ title: 'Produktionsordre oprettet' });
      setShowCreateModal(false);
      setFormData(emptyForm);
      loadOrders();
    } catch (err) {
      console.error(err);
      toast({ title: 'Fejl', description: 'Kunne ikke oprette produktionsordre', variant: 'destructive' });
    }
  };

  const handleEditOpen = (order: ProductionOrder) => {
    setEditingOrder(order);
    setEditFormData({
      title: order.title,
      description: order.description ?? '',
      quantity: order.quantity,
      destination: order.destination ?? 'Kosovo',
      status: order.status,
      plannedDate: order.plannedDate ? order.plannedDate.toISOString().split('T')[0] : '',
      shippedDate: order.shippedDate ? order.shippedDate.toISOString().split('T')[0] : '',
      deliveredDate: order.deliveredDate ? order.deliveredDate.toISOString().split('T')[0] : '',
      notes: order.notes ?? '',
    });
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    if (!editingOrder || !editFormData.title) {
      toast({ title: 'Fejl', description: 'Titel er påkrævet', variant: 'destructive' });
      return;
    }
    try {
      const { error } = await supabase.from(TABLE as any).update({
        title: editFormData.title,
        description: editFormData.description || null,
        quantity: editFormData.quantity,
        destination: editFormData.destination || null,
        status: editFormData.status,
        planned_date: editFormData.plannedDate || null,
        shipped_date: editFormData.shippedDate || null,
        delivered_date: editFormData.deliveredDate || null,
        notes: editFormData.notes || null,
        updated_at: new Date().toISOString(),
      }).eq('id', editingOrder.id);
      if (error) throw error;
      toast({ title: 'Ordre opdateret' });
      setShowEditModal(false);
      setEditingOrder(null);
      loadOrders();
    } catch (err) {
      console.error(err);
      toast({ title: 'Fejl', description: 'Kunne ikke opdatere ordre', variant: 'destructive' });
    }
  };

  const handleDeleteConfirm = (id: string) => {
    setOrderToDelete(id);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!orderToDelete) return;
    setShowDeleteConfirm(false);
    try {
      const { error } = await supabase.from(TABLE as any).delete().eq('id', orderToDelete);
      if (error) throw error;
      toast({ title: 'Ordre slettet' });
      loadOrders();
    } catch (err) {
      console.error(err);
      toast({ title: 'Fejl', description: 'Kunne ikke slette ordre', variant: 'destructive' });
    } finally {
      setOrderToDelete(null);
    }
  };

  const fmt = (d?: Date) => d ? d.toLocaleDateString('da-DK') : '—';

  const renderTable = (items: ProductionOrder[]) => {
    if (items.length === 0) {
      return <div className="text-center py-4 text-muted-foreground text-sm">Ingen ordrer i denne kategori</div>;
    }
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ordrenr.</TableHead>
            <TableHead>Titel</TableHead>
            <TableHead className="text-right">Antal</TableHead>
            <TableHead>Destination</TableHead>
            <TableHead>Planlagt dato</TableHead>
            <TableHead>Afsendt</TableHead>
            <TableHead>Leveret</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24">Handlinger</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(order => (
            <TableRow key={order.id} className="hover:bg-muted/50">
              <TableCell className="font-mono text-sm">{order.orderNumber}</TableCell>
              <TableCell className="font-medium">
                {order.title}
                {order.description && (
                  <p className="text-xs text-muted-foreground font-normal">{order.description}</p>
                )}
              </TableCell>
              <TableCell className="text-right">{order.quantity}</TableCell>
              <TableCell>{order.destination ?? '—'}</TableCell>
              <TableCell>{fmt(order.plannedDate)}</TableCell>
              <TableCell>{fmt(order.shippedDate)}</TableCell>
              <TableCell>{fmt(order.deliveredDate)}</TableCell>
              <TableCell>
                <Badge className={STATUS_COLORS[order.status]}>
                  {STATUS_LABELS[order.status]}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleEditOpen(order)} title="Rediger">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDeleteConfirm(order.id)} title="Slet">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  if (!activeProject) {
    return (
      <Layout>
        <div className="p-6 text-center">
          <h2 className="text-2xl font-bold mb-4">Vælg et projekt</h2>
          <p className="text-muted-foreground">Du skal vælge et projekt for at se produktionsordrer.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Produktion</h1>
            <p className="text-muted-foreground">Projekt: {activeProject.name}</p>
          </div>
          {tableExists && (
            <Button onClick={() => { setFormData(emptyForm); setShowCreateModal(true); }} className="gap-2">
              <Plus className="h-4 w-4" />
              Opret produktionsordre
            </Button>
          )}
        </div>

        {!tableExists ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8 text-muted-foreground space-y-3">
                <Factory className="h-12 w-12 mx-auto text-muted-foreground" />
                <h3 className="text-lg font-semibold text-foreground">Database-tabel mangler</h3>
                <p className="text-sm max-w-md mx-auto">
                  Produktions-modulet kræver en ny tabel i Supabase. Kør SQL-migrationen nedenfor for at aktivere det.
                </p>
                <pre className="text-left text-xs bg-muted rounded p-4 max-w-2xl mx-auto overflow-x-auto whitespace-pre-wrap">
{`CREATE TABLE project_production_orders_2026_06_29 (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid NOT NULL,
  order_number   text NOT NULL,
  title          text NOT NULL,
  description    text,
  quantity       numeric NOT NULL DEFAULT 1,
  destination    text,
  status         text NOT NULL DEFAULT 'planned',
  planned_date   date,
  shipped_date   date,
  delivered_date date,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);`}
                </pre>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Produktionsoversigt</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Indlæser produktionsordrer...</div>
              ) : orders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Factory className="h-12 w-12 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Ingen produktionsordrer endnu</h3>
                  <p>Opret den første ordre for at komme i gang</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {STATUSES.map(status => (
                    <div key={status}>
                      <div
                        className="flex justify-between items-center mb-4 cursor-pointer hover:bg-gray-50 p-2 rounded"
                        onClick={() => toggleSection(status)}
                      >
                        <div className="flex items-center gap-2">
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${expandedSections[status] ? 'rotate-0' : '-rotate-90'}`}
                          />
                          <h3 className={`text-lg font-semibold ${STATUS_HEADING_COLORS[status]}`}>
                            {STATUS_LABELS[status]}
                          </h3>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {grouped[status].length} {grouped[status].length === 1 ? 'ordre' : 'ordrer'}
                        </span>
                      </div>
                      {expandedSections[status] && renderTable(grouped[status])}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Create modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Opret produktionsordre</DialogTitle>
              <DialogDescription>Udfyld oplysningerne for den nye ordre.</DialogDescription>
            </DialogHeader>
            <OrderForm data={formData} onChange={setFormData} />
            <div className="flex gap-2 pt-2">
              <div className="flex-1" />
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>Annullér</Button>
              <Button onClick={handleCreate}>Opret ordre</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit modal */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Rediger produktionsordre</DialogTitle>
              <DialogDescription>Opdater oplysningerne for ordren.</DialogDescription>
            </DialogHeader>
            <OrderForm data={editFormData} onChange={setEditFormData} />
            <div className="flex gap-2 pt-2">
              <div className="flex-1" />
              <Button variant="outline" onClick={() => setShowEditModal(false)}>Annullér</Button>
              <Button onClick={handleUpdate}>Gem ændringer</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete confirm */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Slet produktionsordre</DialogTitle>
            </DialogHeader>
            <p className="py-4">Er du sikker på, at du vil slette denne ordre? Handlingen kan ikke fortrydes.</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setShowDeleteConfirm(false); setOrderToDelete(null); }}>
                Annullér
              </Button>
              <Button variant="destructive" onClick={handleDelete}>Slet permanent</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

type FormData = typeof emptyForm;

const OrderForm = ({ data, onChange }: { data: FormData; onChange: (d: FormData) => void }) => {
  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...data, [field]: field === 'quantity' ? parseFloat(e.target.value) || 1 : e.target.value });

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="prod-title">Titel *</Label>
        <Input id="prod-title" value={data.title} onChange={set('title')} placeholder="Fx Bænke R2.04" />
      </div>
      <div>
        <Label htmlFor="prod-desc">Beskrivelse</Label>
        <Textarea id="prod-desc" value={data.description} onChange={set('description')} placeholder="Valgfri detaljer" rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="prod-qty">Antal *</Label>
          <Input id="prod-qty" type="number" min={1} value={data.quantity} onChange={set('quantity')} />
        </div>
        <div>
          <Label htmlFor="prod-dest">Destination</Label>
          <Select value={data.destination} onValueChange={v => onChange({ ...data, destination: v })}>
            <SelectTrigger id="prod-dest">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DESTINATIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="prod-status">Status</Label>
        <Select value={data.status} onValueChange={v => onChange({ ...data, status: v as ProductionStatus })}>
          <SelectTrigger id="prod-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="prod-planned">Planlagt dato</Label>
          <Input id="prod-planned" type="date" value={data.plannedDate} onChange={set('plannedDate')} />
        </div>
        <div>
          <Label htmlFor="prod-shipped">Afsendt</Label>
          <Input id="prod-shipped" type="date" value={data.shippedDate} onChange={set('shippedDate')} />
        </div>
        <div>
          <Label htmlFor="prod-delivered">Leveret</Label>
          <Input id="prod-delivered" type="date" value={data.deliveredDate} onChange={set('deliveredDate')} />
        </div>
      </div>
      <div>
        <Label htmlFor="prod-notes">Noter</Label>
        <Textarea id="prod-notes" value={data.notes} onChange={set('notes')} placeholder="Fx rum-koder, leveringsinstruktioner" rows={2} />
      </div>
    </div>
  );
};

export default ProjectProduction;

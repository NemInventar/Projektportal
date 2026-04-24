import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useStandardSuppliers, StandardSupplier } from '@/contexts/StandardSuppliersContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Edit, FileText, Inbox, Mail, Phone, MapPin, Building } from 'lucide-react';

interface QuoteRow {
  id: string;
  rfq_id: string;
  status: string;
  received_at: string | null;
  valid_until: string | null;
  currency: string;
  lead_time_days: number | null;
  total_price: number | null;
  notes: string | null;
  rfq: {
    id: string;
    title: string;
    status: string;
    project_id: string;
    project: { id: string; name: string; project_number: string | null } | null;
  } | null;
}

interface RfqInviteRow {
  id: string;
  rfq_id: string;
  invite_status: string;
  invited_at: string | null;
  reminded_at: string | null;
  contact_person: string | null;
  contact_email: string | null;
  rfq: {
    id: string;
    title: string;
    status: string;
    deadline: string | null;
    project_id: string;
    project: { id: string; name: string; project_number: string | null } | null;
  } | null;
}

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('da-DK') : '-';

const formatMoney = (amount: number | null, currency: string) => {
  if (amount == null) return '-';
  return `${amount.toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`;
};

const quoteStatusColor = (status: string) => {
  switch (status) {
    case 'selected': return 'bg-green-100 text-green-800 border-green-200';
    case 'received': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'declined': return 'bg-gray-100 text-gray-700 border-gray-200';
    case 'expired': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'lost': return 'bg-gray-100 text-gray-700 border-gray-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const inviteStatusColor = (status: string) => {
  switch (status) {
    case 'responded': return 'bg-green-100 text-green-800 border-green-200';
    case 'invited': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'reminded': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'declined': return 'bg-gray-100 text-gray-700 border-gray-200';
    case 'no_response': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const StandardSupplierDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { suppliers, loading: suppliersLoading } = useStandardSuppliers();

  const supplier: StandardSupplier | undefined = useMemo(
    () => suppliers.find((s) => s.id === id),
    [suppliers, id],
  );

  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [invites, setInvites] = useState<RfqInviteRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [quotesRes, invitesRes] = await Promise.all([
        supabase
          .from('project_quotes_2026_04_23_10_00')
          .select(
            `id, rfq_id, status, received_at, valid_until, currency, lead_time_days, total_price, notes,
             rfq:project_rfqs_2026_04_23_10_00!inner(
               id, title, status, project_id,
               project:projects_2026_01_15_06_45(id, name, project_number)
             )`,
          )
          .eq('supplier_id', id)
          .order('received_at', { ascending: false, nullsFirst: false }),
        supabase
          .from('project_rfq_suppliers_2026_04_23_10_00')
          .select(
            `id, rfq_id, invite_status, invited_at, reminded_at, contact_person, contact_email,
             rfq:project_rfqs_2026_04_23_10_00!inner(
               id, title, status, deadline, project_id,
               project:projects_2026_01_15_06_45(id, name, project_number)
             )`,
          )
          .eq('supplier_id', id)
          .order('invited_at', { ascending: false, nullsFirst: false }),
      ]);

      if (cancelled) return;

      if (!quotesRes.error && quotesRes.data) {
        setQuotes(quotesRes.data as unknown as QuoteRow[]);
      }
      if (!invitesRes.error && invitesRes.data) {
        setInvites(invitesRes.data as unknown as RfqInviteRow[]);
      }
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (suppliersLoading) {
    return (
      <Layout>
        <div className="p-6">Indlæser leverandør…</div>
      </Layout>
    );
  }

  if (!supplier) {
    return (
      <Layout>
        <div className="p-6 space-y-4">
          <Button variant="ghost" onClick={() => navigate('/standard/suppliers')} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Tilbage til leverandører
          </Button>
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Leverandør ikke fundet.</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const quoteIdsForRfq = new Set(quotes.map((q) => q.rfq_id));

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header + back */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/standard/suppliers')}
            className="gap-2 mb-2"
          >
            <ArrowLeft className="h-4 w-4" /> Tilbage til leverandører
          </Button>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-foreground">{supplier.name}</h1>
              <p className="text-muted-foreground mt-1">
                {supplier.cvr ? `CVR ${supplier.cvr}` : 'Ingen CVR registreret'}
                {' · '}
                <Badge
                  className={
                    supplier.status === 'Aktiv'
                      ? 'bg-green-100 text-green-800 border-green-200'
                      : 'bg-gray-100 text-gray-800 border-gray-200'
                  }
                >
                  {supplier.status}
                </Badge>
              </p>
            </div>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() =>
                navigate(`/standard/suppliers?edit=${supplier.id}`)
              }
            >
              <Edit className="h-4 w-4" /> Rediger
            </Button>
          </div>
        </div>

        {/* Stamdata */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                Kontakt
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <div>{supplier.contactPerson || <span className="text-muted-foreground">—</span>}</div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-3 w-3" /> {supplier.email || '—'}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-3 w-3" /> {supplier.phone || '—'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Adresse
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <div>{supplier.address || <span className="text-muted-foreground">—</span>}</div>
              <div>
                {[supplier.postalCode, supplier.city].filter(Boolean).join(' ') || '—'}
              </div>
              <div className="text-muted-foreground">{supplier.country}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Aktivitet</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <div>
                <span className="text-muted-foreground">Tilbud modtaget: </span>
                <span className="font-semibold">{quotes.length}</span>
              </div>
              <div>
                <span className="text-muted-foreground">RFQ'er inviteret: </span>
                <span className="font-semibold">{invites.length}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Valgt i: </span>
                <span className="font-semibold">
                  {quotes.filter((q) => q.status === 'selected').length}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Noter */}
        {supplier.notes && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Noter</CardTitle>
            </CardHeader>
            <CardContent className="text-sm whitespace-pre-wrap">{supplier.notes}</CardContent>
          </Card>
        )}

        {/* Tilbuds-historik */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Tilbud modtaget ({quotes.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 text-muted-foreground">Indlæser tilbud…</div>
            ) : quotes.length === 0 ? (
              <div className="p-6 text-muted-foreground text-center">
                Ingen tilbud registreret fra denne leverandør endnu.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Modtaget</TableHead>
                    <TableHead>Projekt</TableHead>
                    <TableHead>RFQ</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Lead time</TableHead>
                    <TableHead>Gyldig til</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotes.map((q) => (
                    <TableRow
                      key={q.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() =>
                        q.rfq && navigate(`/purchasing/rfq/${q.rfq.id}`)
                      }
                    >
                      <TableCell>{formatDate(q.received_at)}</TableCell>
                      <TableCell className="text-sm">
                        {q.rfq?.project
                          ? `${q.rfq.project.project_number ? q.rfq.project.project_number + ' · ' : ''}${q.rfq.project.name}`
                          : '-'}
                      </TableCell>
                      <TableCell className="text-sm">{q.rfq?.title || '-'}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMoney(q.total_price, q.currency)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {q.lead_time_days != null ? `${q.lead_time_days} dg` : '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(q.valid_until)}
                      </TableCell>
                      <TableCell>
                        <Badge className={quoteStatusColor(q.status)}>{q.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* RFQ'er inviteret */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              RFQ'er inviteret til ({invites.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 text-muted-foreground">Indlæser RFQ'er…</div>
            ) : invites.length === 0 ? (
              <div className="p-6 text-muted-foreground text-center">
                Leverandøren er ikke inviteret til nogen RFQ'er.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Inviteret</TableHead>
                    <TableHead>Projekt</TableHead>
                    <TableHead>RFQ</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Invite</TableHead>
                    <TableHead>Tilbud givet?</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invites.map((inv) => (
                    <TableRow
                      key={inv.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => inv.rfq && navigate(`/purchasing/rfq/${inv.rfq.id}`)}
                    >
                      <TableCell>{formatDate(inv.invited_at)}</TableCell>
                      <TableCell className="text-sm">
                        {inv.rfq?.project
                          ? `${inv.rfq.project.project_number ? inv.rfq.project.project_number + ' · ' : ''}${inv.rfq.project.name}`
                          : '-'}
                      </TableCell>
                      <TableCell className="text-sm">{inv.rfq?.title || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(inv.rfq?.deadline ?? null)}
                      </TableCell>
                      <TableCell>
                        <Badge className={inviteStatusColor(inv.invite_status)}>
                          {inv.invite_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {quoteIdsForRfq.has(inv.rfq_id) ? (
                          <span className="text-green-700 text-sm">Ja</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">Nej</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default StandardSupplierDetail;

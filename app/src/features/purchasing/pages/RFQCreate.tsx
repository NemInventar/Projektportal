/**
 * RFQCreate — 3-step wizard til oprettelse af ny prisforespørgsel.
 *
 * Steps (lokal state, ikke URL-separeret):
 *   1) Header:     titel (required), beskrivelse, deadline, leveringsvindue,
 *                  betalingsvilkår, budget_hint_total, currency, interne noter.
 *   2) Linjer:     mindst 1 linje required. Editable tabel (RFQLinesTable).
 *   3) Leverandører: mindst 1 leverandør required. SupplierPickerDialog +
 *                  inline liste over valgte.
 *
 * Submit (på step 3):
 *   - createRfq({...header}) → id
 *   - BATCH addRfqLine() for hver draft-linje
 *   - BATCH inviteSupplier() for hver valgt leverandør
 *   - updateRfqStatus(id, 'sent')
 *   - Navigér til detail-siden.
 *
 * Hvis brugeren trykker "Gem kladde" i step 1 eller 2 → gem det vi har og
 * lad RFQ'en blive som `draft`. V1: vi implementerer kun "Opret og send"-flow
 * hele vejen igennem — at sætte status til `sent` er dog ikke at sende mail
 * (V2 sender via Outlook MCP). Her bruger vi bare `draft` som startstatus
 * og lader brugeren sætte den til `sent` senere via detail-siden.
 */
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Loader2, Package, Save, Trash2, UserPlus } from 'lucide-react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/contexts/ProjectContext';
import { useStandardSuppliers } from '@/contexts/StandardSuppliersContext';

import { usePurchasing } from '../PurchasingContext';
import { RFQLinesTable, type DraftLine } from '../components/RFQLinesTable';
import {
  SupplierPickerDialog,
  type PickedSupplier,
} from '../components/SupplierPickerDialog';
import {
  ProjectMaterialsPickerDialog,
  type PickedProjectMaterial,
} from '../components/ProjectMaterialsPickerDialog';

// Helper: generér en lokal id (til DraftLine.localId).
function localId(): string {
  return `draft-${Math.random().toString(36).slice(2, 11)}`;
}

type Step = 1 | 2 | 3;

export const RFQCreate: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeProject } = useProject();
  const { suppliers } = useStandardSuppliers();
  const { createRfq, addRfqLine, inviteSupplier } = usePurchasing();

  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);

  // Step 1 — header
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [firstDelivery, setFirstDelivery] = useState('');
  const [lastDelivery, setLastDelivery] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [budgetHint, setBudgetHint] = useState('');
  const [currency, setCurrency] = useState('DKK');
  const [notes, setNotes] = useState('');

  // Step 2 — linjer
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [materialsPickerOpen, setMaterialsPickerOpen] = useState(false);
  const addEmptyLine = () => {
    setLines((prev) => [
      ...prev,
      {
        localId: localId(),
        name: '',
        qty: 1,
        unit: 'stk',
      },
    ]);
  };

  const handleAddProjectMaterials = (picked: PickedProjectMaterial[]) => {
    if (picked.length === 0) return;
    setLines((prev) => [
      ...prev,
      ...picked.map((p) => ({
        localId: localId(),
        project_material_id: p.project_material_id,
        name: p.name,
        qty: p.qty,
        unit: p.unit,
      })),
    ]);
  };

  const pickedProjectMaterialIds = useMemo(
    () =>
      lines
        .map((l) => l.project_material_id)
        .filter((id): id is string => !!id),
    [lines],
  );

  // Step 3 — leverandører
  const [picked, setPicked] = useState<PickedSupplier[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const supplierNames = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of suppliers) m[s.id] = s.name;
    return m;
  }, [suppliers]);

  // --- Step gating ---
  const canGoStep2 = title.trim().length > 0;
  const canGoStep3 =
    lines.length > 0 &&
    lines.every(
      (l) =>
        l.name.trim().length > 0 && l.qty > 0 && l.unit.trim().length > 0,
    );
  const canSave = canGoStep2 && canGoStep3 && picked.length > 0;

  const handleSave = async () => {
    if (!activeProject) {
      toast({
        title: 'Intet aktivt projekt',
        description: 'Vælg et projekt før du opretter RFQ.',
        variant: 'destructive',
      });
      return;
    }
    if (!canSave) return;

    setSaving(true);
    try {
      // 1) Opret hoved-RFQ
      const rfq = await createRfq({
        title: title.trim(),
        description: description.trim() || null,
        deadline: deadline || null,
        first_delivery_date: firstDelivery || null,
        last_delivery_date: lastDelivery || null,
        payment_terms: paymentTerms || null,
        budget_hint_total: budgetHint ? parseFloat(budgetHint) : null,
        currency,
        notes: notes || null,
      });

      // 2) Tilføj linjer (sekventielt så line_no bliver deterministisk).
      for (const l of lines) {
        await addRfqLine(rfq.id, {
          project_material_id: l.project_material_id ?? null,
          name: l.name.trim(),
          description: l.description ?? null,
          qty: l.qty,
          unit: l.unit.trim(),
          spec: l.spec ?? null,
          budget_hint_total: l.budget_hint_total ?? null,
          notes: l.notes ?? null,
        });
      }

      // 3) Invitér leverandører
      for (const p of picked) {
        await inviteSupplier(
          rfq.id,
          p.supplier_id,
          p.contact_email,
          p.contact_person,
        );
      }

      toast({
        title: 'Prisforespørgsel oprettet',
        description: `${lines.length} linjer · ${picked.length} leverandører`,
      });
      navigate(`/purchasing/rfq/${rfq.id}`);
    } catch (err) {
      console.error('[RFQCreate] submit fejlede:', err);
      toast({
        title: 'Kunne ikke oprette',
        description: err instanceof Error ? err.message : 'Ukendt fejl',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!activeProject) {
    return (
      <Layout>
        <div className="p-6 text-center py-16">
          <h2 className="text-2xl font-bold mb-2">Vælg et projekt</h2>
          <p className="text-muted-foreground">
            Du skal vælge et projekt før du kan oprette en prisforespørgsel.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/purchasing')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" /> Tilbage
          </Button>
          <h1 className="text-2xl font-bold">Ny prisforespørgsel</h1>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {([1, 2, 3] as const).map((s) => {
            const label =
              s === 1 ? 'Overskrift' : s === 2 ? 'Linjer' : 'Leverandører';
            const isActive = step === s;
            const isDone = step > s;
            return (
              <React.Fragment key={s}>
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded border text-sm ${
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary'
                      : isDone
                      ? 'bg-green-50 text-green-800 border-green-200'
                      : 'bg-white text-muted-foreground'
                  }`}
                >
                  <span className="font-mono text-xs">{s}.</span> {label}
                </div>
                {s < 3 && <div className="flex-none text-muted-foreground">→</div>}
              </React.Fragment>
            );
          })}
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <Card className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Titel *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder='Fx "Plader + beslag til R2.15"'
                  autoFocus
                />
              </div>
              <div className="md:col-span-2">
                <Label>Beskrivelse</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Kontekst som sendes til leverandører..."
                  rows={3}
                />
              </div>
              <div>
                <Label>Frist for svar</Label>
                <Input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
              <div>
                <Label>Valuta</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DKK">DKK</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="SEK">SEK</SelectItem>
                    <SelectItem value="NOK">NOK</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Første leveringsdato</Label>
                <Input
                  type="date"
                  value={firstDelivery}
                  onChange={(e) => setFirstDelivery(e.target.value)}
                />
              </div>
              <div>
                <Label>Sidste leveringsdato</Label>
                <Input
                  type="date"
                  value={lastDelivery}
                  onChange={(e) => setLastDelivery(e.target.value)}
                />
              </div>
              <div>
                <Label>Betalingsvilkår</Label>
                <Input
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="fx 30 dage netto"
                />
              </div>
              <div>
                <Label>Budget hint (total, kr.)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={budgetHint}
                  onChange={(e) => setBudgetHint(e.target.value)}
                  placeholder="Internt — deles ikke"
                />
              </div>
              <div className="md:col-span-2">
                <Label>Interne noter</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Noter til os selv..."
                  rows={2}
                />
              </div>
            </div>
          </Card>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <Card className="p-5 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold">Linjer på prisforespørgsel</h3>
                <p className="text-xs text-muted-foreground">
                  Tilføj mindst én linje. Hver linje skal have navn, antal og enhed.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setMaterialsPickerOpen(true)}
                className="gap-2"
              >
                <Package className="h-4 w-4" /> Tilføj fra projekt-materialer
              </Button>
            </div>
            <RFQLinesTable
              mode="edit"
              lines={lines}
              onChange={setLines}
              onAddEmpty={addEmptyLine}
            />
            <ProjectMaterialsPickerDialog
              open={materialsPickerOpen}
              onOpenChange={setMaterialsPickerOpen}
              alreadyPickedIds={pickedProjectMaterialIds}
              onConfirm={handleAddProjectMaterials}
            />
          </Card>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <Card className="p-5 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold">Leverandører</h3>
                <p className="text-xs text-muted-foreground">
                  Vælg mindst én leverandør der skal have forespørgslen.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPickerOpen(true)}
                className="gap-2"
              >
                <UserPlus className="h-4 w-4" /> Tilføj leverandører
              </Button>
            </div>

            {picked.length === 0 ? (
              <div className="text-center py-10 border rounded text-sm text-muted-foreground">
                Ingen leverandører valgt endnu.
              </div>
            ) : (
              <ul className="divide-y border rounded">
                {picked.map((p) => (
                  <li
                    key={p.supplier_id}
                    className="flex items-center gap-3 p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">
                        {supplierNames[p.supplier_id] ?? 'Leverandør'}
                      </div>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                        <Input
                          value={p.contact_person ?? ''}
                          onChange={(e) =>
                            setPicked((prev) =>
                              prev.map((x) =>
                                x.supplier_id === p.supplier_id
                                  ? { ...x, contact_person: e.target.value || null }
                                  : x,
                              ),
                            )
                          }
                          placeholder="Kontaktperson"
                          className="h-7 text-xs w-48 mt-1"
                        />
                        <Input
                          value={p.contact_email ?? ''}
                          onChange={(e) =>
                            setPicked((prev) =>
                              prev.map((x) =>
                                x.supplier_id === p.supplier_id
                                  ? { ...x, contact_email: e.target.value || null }
                                  : x,
                              ),
                            )
                          }
                          placeholder="Email"
                          className="h-7 text-xs w-64 mt-1"
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setPicked((prev) =>
                          prev.filter((x) => x.supplier_id !== p.supplier_id),
                        )
                      }
                      className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <SupplierPickerDialog
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              alreadyPickedIds={picked.map((p) => p.supplier_id)}
              onConfirm={(newOnes) =>
                setPicked((prev) => [...prev, ...newOnes])
              }
            />
          </Card>
        )}

        {/* Navigation */}
        <div className="flex justify-between items-center pt-2">
          <Button
            variant="outline"
            onClick={() => {
              if (step === 1) navigate('/purchasing');
              else setStep((s) => (s - 1) as Step);
            }}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {step === 1 ? 'Annullér' : 'Tilbage'}
          </Button>

          {step < 3 ? (
            <Button
              onClick={() => {
                if (step === 1 && !canGoStep2) {
                  toast({
                    title: 'Titel mangler',
                    description: 'Titel er påkrævet for at gå videre.',
                    variant: 'destructive',
                  });
                  return;
                }
                if (step === 2 && !canGoStep3) {
                  toast({
                    title: 'Linjer mangler',
                    description:
                      'Tilføj mindst én linje med navn, antal og enhed.',
                    variant: 'destructive',
                  });
                  return;
                }
                setStep((s) => (s + 1) as Step);
              }}
              className="gap-2"
            >
              Næste <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={!canSave || saving} className="gap-2">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Gem som kladde
            </Button>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default RFQCreate;

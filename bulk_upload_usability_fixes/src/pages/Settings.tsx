import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { useCompanySettings, CompanySettingsInput } from '@/contexts/CompanySettingsContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings as SettingsIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Settings: React.FC = () => {
  const { settings, loading, update } = useCompanySettings();
  const { toast } = useToast();

  // Lokal form-state — save-on-blur for at undgå spam
  const [form, setForm] = useState<Partial<CompanySettingsInput>>({});

  useEffect(() => {
    if (settings) {
      setForm({
        companyName: settings.companyName ?? '',
        cvr: settings.cvr ?? '',
        addressLine1: settings.addressLine1 ?? '',
        addressLine2: settings.addressLine2 ?? '',
        addressZip: settings.addressZip ?? '',
        addressCity: settings.addressCity ?? '',
        phone: settings.phone ?? '',
        email: settings.email ?? '',
        bankName: settings.bankName ?? '',
        bankRegNo: settings.bankRegNo ?? '',
        bankAccountNo: settings.bankAccountNo ?? '',
        bankIban: settings.bankIban ?? '',
        bankBic: settings.bankBic ?? '',
        defaultPaymentTerms: settings.defaultPaymentTerms ?? '',
        defaultDeliveryPeriod: settings.defaultDeliveryPeriod ?? '',
        defaultReservations: settings.defaultReservations ?? '',
        defaultValidityDays: settings.defaultValidityDays ?? 30,
        defaultRecipientProfile: settings.defaultRecipientProfile ?? 'mixed',
      });
    }
  }, [settings]);

  const setField = <K extends keyof CompanySettingsInput>(key: K, value: CompanySettingsInput[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const saveField = async <K extends keyof CompanySettingsInput>(key: K) => {
    if (!settings) {
      // Ingen row endnu — gem hele formen så vi opretter
      try {
        await update(form);
        toast({ title: 'Indstillinger oprettet' });
      } catch (err) {
        console.error(err);
        toast({ title: 'Fejl', description: 'Kunne ikke gemme', variant: 'destructive' });
      }
      return;
    }
    const newVal = form[key];
    const currentVal = (settings as any)[key];
    if (newVal === currentVal) return;
    try {
      await update({ [key]: newVal } as Partial<CompanySettingsInput>);
      // Toast er tavst for ikke at spamme — kun ved fejl
    } catch (err) {
      console.error(err);
      toast({ title: 'Fejl', description: `Kunne ikke gemme ${String(key)}`, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-6 text-muted-foreground">Indlæser indstillinger…</div>
      </Layout>
    );
  }

  if (!settings) {
    return (
      <Layout>
        <div className="p-6 max-w-2xl space-y-4">
          <div className="flex items-center gap-3">
            <SettingsIcon className="h-6 w-6" />
            <h1 className="text-3xl font-bold">Indstillinger</h1>
          </div>
          <Card>
            <CardContent className="p-6 space-y-3">
              <p className="text-sm text-muted-foreground">
                Tabellen <code>company_settings_2026_05_03</code> er ikke oprettet endnu.
                Kør migrationen <code>add_company_settings_2026_05_03.sql</code> i Supabase Dashboard
                (SQL Editor → paste og run), så fyldes den med firma-info og standard-tekster automatisk.
              </p>
              <p className="text-xs text-muted-foreground">
                Når den er kørt, refresh denne side.
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <SettingsIcon className="h-6 w-6" />
          <div>
            <h1 className="text-3xl font-bold">Indstillinger</h1>
            <p className="text-sm text-muted-foreground">Firma-info og standard-værdier på tilbud. Gemmer automatisk når du klikker væk fra et felt.</p>
          </div>
        </div>

        {/* Firma */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Firma</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="companyName">Firmanavn</Label>
              <Input
                id="companyName"
                value={form.companyName ?? ''}
                onChange={(e) => setField('companyName', e.target.value)}
                onBlur={() => saveField('companyName')}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cvr">CVR</Label>
              <Input
                id="cvr"
                value={form.cvr ?? ''}
                onChange={(e) => setField('cvr', e.target.value)}
                onBlur={() => saveField('cvr')}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                value={form.phone ?? ''}
                onChange={(e) => setField('phone', e.target.value)}
                onBlur={() => saveField('phone')}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email ?? ''}
                onChange={(e) => setField('email', e.target.value)}
                onBlur={() => saveField('email')}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="addressLine1">Adresse linje 1</Label>
              <Input
                id="addressLine1"
                value={form.addressLine1 ?? ''}
                onChange={(e) => setField('addressLine1', e.target.value)}
                onBlur={() => saveField('addressLine1')}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="addressLine2">Adresse linje 2</Label>
              <Input
                id="addressLine2"
                value={form.addressLine2 ?? ''}
                onChange={(e) => setField('addressLine2', e.target.value)}
                onBlur={() => saveField('addressLine2')}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="addressZip">Postnr.</Label>
              <Input
                id="addressZip"
                value={form.addressZip ?? ''}
                onChange={(e) => setField('addressZip', e.target.value)}
                onBlur={() => saveField('addressZip')}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="addressCity">By</Label>
              <Input
                id="addressCity"
                value={form.addressCity ?? ''}
                onChange={(e) => setField('addressCity', e.target.value)}
                onBlur={() => saveField('addressCity')}
              />
            </div>
          </CardContent>
        </Card>

        {/* Bank */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Bank</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="bankName">Bank</Label>
              <Input id="bankName" value={form.bankName ?? ''} onChange={(e) => setField('bankName', e.target.value)} onBlur={() => saveField('bankName')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bankRegNo">Reg.nr.</Label>
              <Input id="bankRegNo" value={form.bankRegNo ?? ''} onChange={(e) => setField('bankRegNo', e.target.value)} onBlur={() => saveField('bankRegNo')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bankAccountNo">Kontonr.</Label>
              <Input id="bankAccountNo" value={form.bankAccountNo ?? ''} onChange={(e) => setField('bankAccountNo', e.target.value)} onBlur={() => saveField('bankAccountNo')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bankIban">IBAN</Label>
              <Input id="bankIban" value={form.bankIban ?? ''} onChange={(e) => setField('bankIban', e.target.value)} onBlur={() => saveField('bankIban')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bankBic">BIC / SWIFT</Label>
              <Input id="bankBic" value={form.bankBic ?? ''} onChange={(e) => setField('bankBic', e.target.value)} onBlur={() => saveField('bankBic')} />
            </div>
          </CardContent>
        </Card>

        {/* Tilbuds-defaults */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Standard på tilbud</CardTitle>
            <p className="text-sm text-muted-foreground">
              Disse værdier trækkes live af alle ulåste tilbud der ikke har et override på feltet.
            </p>
            <div className="mt-2 text-xs bg-amber-50 border border-amber-200 rounded p-3 text-amber-900">
              <strong>Bemærk:</strong> Ændringer her opdaterer alle ulåste tilbud uden override
              øjeblikkeligt. Låste tilbud og tilbud med override påvirkes ikke.
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="defaultPaymentTerms">Betalingsbetingelser</Label>
              <Input
                id="defaultPaymentTerms"
                value={form.defaultPaymentTerms ?? ''}
                onChange={(e) => setField('defaultPaymentTerms', e.target.value)}
                onBlur={() => saveField('defaultPaymentTerms')}
                placeholder="Fx Netto 14 dage fra fakturadato"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="defaultValidityDays">Tilbudsgyldighed (dage)</Label>
              <Input
                id="defaultValidityDays"
                type="number"
                min={1}
                max={365}
                value={form.defaultValidityDays ?? 30}
                onChange={(e) => setField('defaultValidityDays', parseInt(e.target.value) || 30)}
                onBlur={() => saveField('defaultValidityDays')}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="defaultRecipientProfile">Modtager-profil (default)</Label>
              <Select
                value={form.defaultRecipientProfile ?? 'mixed'}
                onValueChange={(v) => { setField('defaultRecipientProfile', v); setTimeout(() => saveField('defaultRecipientProfile'), 0); }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="architect">Arkitekt</SelectItem>
                  <SelectItem value="contractor">Hovedentreprenør</SelectItem>
                  <SelectItem value="enduser">Slutkunde</SelectItem>
                  <SelectItem value="mixed">Blandet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="defaultDeliveryPeriod">Standard leveringsbetingelser</Label>
              <Textarea
                id="defaultDeliveryPeriod"
                rows={5}
                value={form.defaultDeliveryPeriod ?? ''}
                onChange={(e) => setField('defaultDeliveryPeriod', e.target.value)}
                onBlur={() => saveField('defaultDeliveryPeriod')}
                placeholder="Fx leveringstid + reference-rabat"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="defaultReservations">Standard forbehold</Label>
              <Textarea
                id="defaultReservations"
                rows={6}
                value={form.defaultReservations ?? ''}
                onChange={(e) => setField('defaultReservations', e.target.value)}
                onBlur={() => saveField('defaultReservations')}
                placeholder="Fx prisregulering, ordreforudsætninger, ændringer i mål osv."
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Settings;

// KOPI af app/src/config/company.ts
// Skal holdes synkroniseret med GUI-versionen.
// Hvis du ændrer her, opdater også GUI-versionen.

// TODO (V2): Flyt til Supabase settings-tabel så firmainfo kan redigeres i UI
// uden kodeændring. For V1 holder vi det som en hardkodet config.

export const COMPANY_INFO = {
  name: 'Nem Inventar ApS',
  cvr: '45085473',
  address: {
    line1: 'Mågevej 73, st. tv.',
    line2: '',
    zip: '2400',
    city: 'København NV',
  },
  // Tilbuddenes sidefod: tilbud@ og hovednummeret (Milot 27-10-2026) — ikke en persons mail og mobil.
  // Hovednummeret står også i neminventar-astro src/lib/contact.ts og company_settings.
  phone: '+45 42 42 26 84',
  email: 'tilbud@neminventar.dk',
  bank: {
    name: 'Merkur Andelskasse',
    regNo: '8401',
    accountNo: '0005478559',
    iban: 'DK7384010005478559',
    bic: 'MEKUDK21',
  },
  defaultPaymentTerms: 'Netto 14 dage fra fakturadato',
  defaultQuoteValidityDays: 30,
} as const;

// Tilbudsgivere (snapshot på quote når et tilbud oprettes/sendes).
// V1: hardkodet liste. V2: flyt til employees-tabel.
export const EMPLOYEES = [
  {
    name: 'Joachim Skovbogaard',
    email: 'js@neminventar.dk',
    phone: '+45 20 54 14 88',
  },
] as const;

export const formatCompanyAddress = (): string =>
  [COMPANY_INFO.address.line1, COMPANY_INFO.address.line2, `${COMPANY_INFO.address.zip} ${COMPANY_INFO.address.city}`]
    .filter((s) => s && s.trim().length > 0)
    .join(', ');

export const formatCompanyBankLine = (): string =>
  `Bank: ${COMPANY_INFO.bank.name} · Reg ${COMPANY_INFO.bank.regNo} · Konto ${COMPANY_INFO.bank.accountNo}`;

export const findEmployeeByEmail = (email: string | null | undefined) =>
  email ? EMPLOYEES.find(e => e.email.toLowerCase() === email.toLowerCase()) : undefined;

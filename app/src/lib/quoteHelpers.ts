/**
 * Delte helpers til tilbuds-UI (status-farver, formatering, relative datoer).
 * Centraliseret for at undgå duplikeret logik i ProjectQuotes, AllQuotes,
 * Dashboard og ProjectQuoteDetail.
 */

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'archived';

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: 'Kladde',
  sent: 'Sendt',
  accepted: 'Accepteret',
  rejected: 'Afvist',
  archived: 'Arkiveret',
};

export function statusLabel(status: string | null | undefined): string {
  if (!status) return '-';
  return QUOTE_STATUS_LABEL[status as QuoteStatus] ?? status;
}

export function statusColorClasses(status: string | null | undefined): string {
  switch (status) {
    case 'draft':    return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'sent':     return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'accepted': return 'bg-green-100 text-green-800 border-green-200';
    case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
    case 'archived': return 'bg-gray-100 text-gray-600 border-gray-200';
    default:         return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

/** Format amount in DKK with Danish locale, 0 decimals. */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount)) return '-';
  return new Intl.NumberFormat('da-DK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' kr.';
}

/** Antal hele dage mellem to datoer (positivt hvis future > past). */
export function daysBetween(fromIso: string | null | undefined, toIso: string | null | undefined): number | null {
  if (!fromIso || !toIso) return null;
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  if (isNaN(from) || isNaN(to)) return null;
  return Math.floor((to - from) / (1000 * 60 * 60 * 24));
}

/** Relativ dansk tekst for "sendt for X tid siden". */
export function relativeDanish(iso: string | null | undefined): string {
  if (!iso) return '-';
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  if (isNaN(then) || diffMs < 0) return '-';

  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hrs = Math.floor(min / 60);
  const days = Math.floor(hrs / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (sec < 60) return 'lige nu';
  if (min < 60) return `for ${min} min. siden`;
  if (hrs < 24) return `for ${hrs} t. siden`;
  if (days === 1) return 'i går';
  if (days < 7) return `for ${days} dage siden`;
  if (weeks === 1) return 'for 1 uge siden';
  if (weeks < 5) return `for ${weeks} uger siden`;
  if (months === 1) return 'for 1 måned siden';
  if (months < 12) return `for ${months} mdr. siden`;
  return `for ${Math.floor(days / 365)} år siden`;
}

/** Format en dato (ISO el. YYYY-MM-DD) til dansk format. */
export function formatDateDanish(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('da-DK');
}

/** Er valid_until udløbet? */
export function isValidityExpired(validUntil: string | null | undefined): boolean {
  if (!validUntil) return false;
  const until = new Date(validUntil);
  until.setHours(23, 59, 59, 999); // udløber ved slutningen af dagen
  return until.getTime() < Date.now();
}

import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageSquare, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Feedback-knap til ERP'et — samme model som dashboards'ne
 * (00_Faelles/feedback/feedback-widget.js): skriver til tabellen
 * dashboard_feedback via edge function `dashboard-feedback`, triage på
 * 00_Faelles/feedback/feedback.html under source = "erp".
 *
 * Skift ALDRIG `SOURCE` bagefter — det splitter feedback-historikken.
 */
const FEEDBACK_FN = 'https://guhbrpektblabndqttgp.supabase.co/functions/v1/dashboard-feedback';
const SOURCE = 'erp';

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'idea', label: '💡 Idé' },
  { value: 'bug', label: '🐞 Fejl' },
  { value: 'change', label: '✏️ Ændringsforslag' },
  { value: 'question', label: '❓ Spørgsmål' },
];

const FeedbackWidget: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('idea');
  const [message, setMessage] = useState('');
  const [implementNow, setImplementNow] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const author = user?.email ?? 'ukendt@neminventar.dk';
  // Hash-routeren: location.pathname er selve ERP-siden (fx /project/quotes/<id>)
  const pageRef = `${window.location.origin}${window.location.pathname}#${location.pathname}${location.search}`;

  const reset = () => {
    setMessage('');
    setImplementNow(false);
    setStatus(null);
  };

  const send = async () => {
    const msg = message.trim();
    if (!msg) {
      setStatus({ kind: 'err', text: 'Skriv en besked først.' });
      return;
    }
    setSending(true);
    setStatus(null);
    try {
      const r = await fetch(FEEDBACK_FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author,
          source: SOURCE,
          message: msg,
          category,
          page_ref: pageRef,
          implement_now: implementNow,
          context: { route: location.pathname, app: 'projektportal' },
        }),
      });
      const d = await r.json();
      if (d.ok) {
        setStatus({
          kind: 'ok',
          text: d.queued ? '⚡ Sat i gang — du får besked på Slack ✓' : 'Tak — logget ✓',
        });
        setMessage('');
        setImplementNow(false);
        setTimeout(() => {
          setOpen(false);
          setStatus(null);
        }, d.queued ? 2200 : 1200);
      } else {
        setStatus({ kind: 'err', text: `Fejl: ${d.error || r.status}` });
      }
    } catch {
      setStatus({ kind: 'err', text: 'Netværksfejl — prøv igen.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (open) reset();
          setOpen(!open);
        }}
        className="fixed bottom-4 right-4 z-[9000] flex items-center gap-2 rounded-full bg-[#234f3d] px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg transition hover:brightness-110 print:hidden"
        title="Feedback på denne side"
      >
        <MessageSquare className="h-4 w-4" />
        Feedback
      </button>

      {open && (
        <div className="fixed bottom-16 right-4 z-[9001] w-[340px] rounded-xl border bg-background p-3 text-[13px] shadow-2xl print:hidden">
          <div className="mb-2 flex items-start justify-between">
            <div>
              <div className="font-semibold">Feedback på denne side</div>
              <div className="text-[11px] text-muted-foreground">
                {author} · {location.pathname}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                reset();
                setOpen(false);
              }}
              className="rounded p-1 text-muted-foreground hover:bg-muted"
              aria-label="Luk"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="mb-2 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Hvad skal rettes/ændres/tilføjes? Skriv løst — Claude samler op."
            rows={4}
            className="mb-2"
            autoFocus
          />

          <label className="mb-2 flex cursor-pointer items-start gap-2 rounded-md border border-amber-400 bg-amber-50 p-2 text-[12px] dark:bg-amber-950/30">
            <Checkbox
              checked={implementNow}
              onCheckedChange={(v) => setImplementNow(v === true)}
              className="mt-0.5"
            />
            <span>
              <b className="block">⚡ Implementér nu</b>
              <span className="text-[11px] leading-snug text-amber-900/80 dark:text-amber-200/80">
                Claude retter det med det samme i stedet for at lægge det i backlog, og skriver på
                Slack når det er klart — eller hvis noget blokerede. Refresh siden bagefter.
              </span>
            </span>
          </label>

          <div className="flex gap-2">
            <Button onClick={send} disabled={sending} className="flex-1 bg-[#234f3d] hover:bg-[#2d6650]">
              {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                reset();
                setOpen(false);
              }}
            >
              Luk
            </Button>
          </div>

          {status && (
            <div
              className={`mt-2 font-semibold ${
                status.kind === 'ok' ? 'text-green-700' : 'text-red-700'
              }`}
            >
              {status.text}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default FeedbackWidget;

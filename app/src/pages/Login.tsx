import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase, loginFejlFraUrl } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Supabase sender Microsoft-fejl retur som ?error_code=…&error_description=…
function oversaetLoginFejl(f: { kode: string; tekst: string } | null): string {
  if (!f) return "";
  if (f.kode === "bad_oauth_state") return "Login'et tog for lang tid. Prøv igen.";
  if (f.kode === "access_denied") return "Login'et hos Microsoft blev afbrudt. Prøv igen.";
  if (/Nem Inventar/i.test(f.tekst)) return f.tekst; // fra vagten hook_foer_ny_bruger
  return "Microsoft-login'et lykkedes ikke" + (f.tekst ? `: ${f.tekst}` : ".");
}

function MicrosoftLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

export default function Login() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(() => oversaetLoginFejl(loginFejlFraUrl));
  const [submitting, setSubmitting] = useState(false);
  const [visKode, setVisKode] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const handleMicrosoft = async () => {
    setError("");
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: { scopes: "email", redirectTo: window.location.origin + window.location.pathname },
    });
    if (error) {
      setError(error.message);
      setSubmitting(false);
    }
    // Ellers sender browseren videre til Microsoft.
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setSubmitting(false);
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-lg border bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-xl font-semibold text-gray-900">Nem Inventar</h1>
        <Button type="button" className="w-full gap-2" onClick={handleMicrosoft} disabled={submitting}>
          <MicrosoftLogo />
          Log ind med Microsoft
        </Button>
        <p className="mt-2 text-xs text-gray-500">Brug din @neminventar.dk-konto.</p>
        {error && !visKode && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {!visKode ? (
          <button
            type="button"
            className="mt-6 text-sm text-gray-500 underline underline-offset-2 hover:text-gray-700"
            onClick={() => setVisKode(true)}
          >
            Log ind med adgangskode i stedet
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4 border-t pt-6">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Adgangskode</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" variant="outline" className="w-full" disabled={submitting}>
              {submitting ? "Logger ind..." : "Log ind"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

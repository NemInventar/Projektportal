import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MIN_LAENGDE = 10;

// Første login med en midlertidig adgangskode: brugeren vælger sin egen, før resten af ERP'et åbner.
export default function VaelgAdgangskode() {
  const { user, loading, skalSkifteAdgangskode } = useAuth();
  const [password, setPassword] = useState("");
  const [gentag, setGentag] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!skalSkifteAdgangskode) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < MIN_LAENGDE) return setError(`Adgangskoden skal være mindst ${MIN_LAENGDE} tegn.`);
    if (password !== gentag) return setError("De to adgangskoder er ikke ens.");
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password, data: { skal_skifte_adgangskode: false } });
    if (error) setError(error.message);
    setSubmitting(false);
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-lg border bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-xl font-semibold text-gray-900">Vælg din egen adgangskode</h1>
        <p className="mb-6 text-sm text-gray-600">
          Du er logget ind som {user.email} med en midlertidig adgangskode. Vælg din egen, før du går videre.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="password">Ny adgangskode</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gentag">Gentag adgangskoden</Label>
            <Input
              id="gentag"
              type="password"
              autoComplete="new-password"
              value={gentag}
              onChange={(e) => setGentag(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Gemmer..." : "Gem og fortsæt"}
          </Button>
        </form>
      </div>
    </div>
  );
}

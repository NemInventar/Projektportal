import { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  // Sat af en administrator sammen med en midlertidig adgangskode — brugeren skal vælge sin egen ved første login.
  skalSkifteAdgangskode: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      // Efter Microsoft-login står ?code=… (eller ?error=…) i adressen. Supabase har brugt den nu.
      if (window.location.search) {
        window.history.replaceState(null, "", window.location.pathname + window.location.hash);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // Logger man ind med Microsoft, er der ingen ERP-kode at skifte.
  const harMicrosoft = user?.identities?.some((i) => i.provider === "azure") ?? false;
  const skalSkifteAdgangskode = user?.user_metadata?.skal_skifte_adgangskode === true && !harMicrosoft;

  return (
    <AuthContext.Provider value={{ user, loading, skalSkifteAdgangskode, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

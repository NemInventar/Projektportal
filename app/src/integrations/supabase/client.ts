import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://guhbrpektblabndqttgp.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1aGJycGVrdGJsYWJuZHF0dGdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MzgyOTEsImV4cCI6MjA4NDAxNDI5MX0.k2VbP5r3vCCJOsgefavapMFchC1fBerqoUKGDpe0E-M'

// Fejl fra et Microsoft-login, der kom retur i adresselinjen (?error=…). Læses, FØR AuthContext
// rydder adresselinjen, så login-siden kan vise den.
export const loginFejlFraUrl: { kode: string; tekst: string } | null = (() => {
  if (typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search);
  const kode = q.get('error_code') || q.get('error');
  if (!kode) return null;
  return { kode, tekst: q.get('error_description') || '' };
})();

// PKCE: Microsoft-login'et kommer tilbage med ?code= i adressen. Det implicitte flow ville lægge
// nøglen i #-delen, og den bruger HashRouter selv.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { flowType: 'pkce' },
});

// Import the supabase client like this:
// For React:
// import { supabase } from "@/integrations/supabase/client";
// For React Native:
// import { supabase } from "@/src/integrations/supabase/client";

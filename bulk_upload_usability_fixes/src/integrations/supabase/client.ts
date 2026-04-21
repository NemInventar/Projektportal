import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://guhbrpektblabndqttgp.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1aGJycGVrdGJsYWJuZHF0dGdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MzgyOTEsImV4cCI6MjA4NDAxNDI5MX0.k2VbP5r3vCCJOsgefavapMFchC1fBerqoUKGDpe0E-M'

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Import the supabase client like this:
// For React:
// import { supabase } from "@/integrations/supabase/client";
// For React Native:
// import { supabase } from "@/src/integrations/supabase/client";

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for Supabase tables
export interface Prompt {
  id: string;
  name: string;
  content: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      prompts: {
        Row: Prompt;
        Insert: Omit<Prompt, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Prompt, 'id' | 'created_at' | 'updated_at'>>;
      };
    };
  };
}

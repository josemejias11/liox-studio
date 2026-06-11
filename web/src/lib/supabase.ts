import { createClient } from '@supabase/supabase-js';

// These should be configured in your .env / Vercel environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Supabase URL or Service Key is missing. RAG functionality will fail.');
}

// We use the service role key here because we are calling this from the backend
// to bypass Row Level Security (RLS) when querying or inserting vector embeddings.
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

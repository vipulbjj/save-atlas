import { createClient } from '@supabase/supabase-js';

// Default user ID for single-user mode (pre-auth)
export const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

let _client = null;

export function getSupabase() {
  if (_client) return _client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing Supabase env vars. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local and to Vercel project settings.'
    );
  }

  _client = createClient(supabaseUrl, supabaseKey);
  return _client;
}


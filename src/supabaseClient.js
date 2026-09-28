import { createClient } from '@supabase/supabase-js';

// Vercel 환경 변수를 참조하도록 변경하거나, 올바른 주소(ian...)로 직접 지정합니다.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ianilyiumkvkowcnuawt.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhbmlseWl1bWt2a293Y251YXd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3OTg5MjIsImV4cCI6MjEwMzM3NDkyMn0.1AZFoSC4_LHUkTo2flmGN7vPYB8MgEICaDohbn3fPg0';

// PKCE: 웹은 ?code= 를 자동 교환, 네이티브 앱은 딥링크로 받은 code 를 직접 교환 (src/lib/auth.js)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true
  }
});

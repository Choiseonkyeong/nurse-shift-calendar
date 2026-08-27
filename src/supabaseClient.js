import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lanllylumkvkowcnuawt.supabase.co';
// Legacy 탭에서 복사한 eyJ... 로 시작하는 anon key
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; 

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

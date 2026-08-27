import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lanllylumkvkowcnuawt.supabase.co';
const supabaseAnonKey = 'sb_publishable_n96aYfBdNsSLtQ_wbAJe2g_VVVAcWVW';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

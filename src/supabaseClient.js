import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ianlilyiumkvkowcnuawt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_n96aYfBdNsSLtQ_wbAJe2g_VVVAcWVW';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

import { createClient } from '@supabase/supabase-javascript';

const SUPABASE_URL = 'https://ianlilyiumkvkowcnuawt.supabase.co';
// Supabase Dashboard -> Project Settings -> API 에서 복사한 anon public 키를 넣어주세요.
const SUPABASE_ANON_KEY = 'sb_publishable_n96aYfBdNsSLtQ_wbAJe2g_VVVAcWVW';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

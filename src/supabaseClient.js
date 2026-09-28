// Supabase 클라이언트는 용량이 커서(앱 첫 화면 코드의 약 70%) 처음 필요할 때 불러온다.
// 화면은 기기에 저장된 근무로 먼저 그리고, 서버 동기화는 그 뒤에 진행.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ianilyiumkvkowcnuawt.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhbmlseWl1bWt2a293Y251YXd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3OTg5MjIsImV4cCI6MjEwMzM3NDkyMn0.1AZFoSC4_LHUkTo2flmGN7vPYB8MgEICaDohbn3fPg0';

let clientPromise = null;

export function getSupabase() {
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js')
      .then(({ createClient }) => createClient(supabaseUrl, supabaseAnonKey))
      .catch((err) => {
        clientPromise = null; // 오프라인 등으로 실패하면 다음에 다시 시도
        throw err;
      });
  }
  return clientPromise;
}

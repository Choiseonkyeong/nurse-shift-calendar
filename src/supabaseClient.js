import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lanllylumkvkowcnuawt.supabase.co';
// Legacy 탭에서 복사한 eyJ... 로 시작하는 anon key
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhbmlseWl1bWt2a293Y251YXd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3OTg5MjIsImV4cCI6MjEwMzM3NDkyMn0.1AZFoSC4_LHUkTo2flmGN7vPYB8MgEICaDohbn3fPg0'; 

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

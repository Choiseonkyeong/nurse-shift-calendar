import { createClient } from '@supabase/supabase-js';

// 프로젝트 ID(seuamhutmdcjyacxuqyt) 반영
const supabaseUrl = 'https://seuamhutmdcjyacxuqyt.supabase.co';

// 해당 프로젝트 대시보드(Project Settings > API)에서 복사한 anon public key를 넣어주세요.
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhbmlseWl1bWt2a293Y251YXd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3OTg5MjIsImV4cCI6MjEwMzM3NDkyMn0.1AZFoSC4_LHUkTo2flmGN7vPYB8MgEICaDohbn3fPg0'; 

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

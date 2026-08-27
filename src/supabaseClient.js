import { createClient } from '@supabase/supabase-js';

// Choiseonkyeong's Project 대시보드에서 복사한 URL 및 Anon Key
const supabaseUrl = 'https://seuamhutmdcjyacxuqyt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhbmlseWl1bWt2a293Y251YXd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3OTg5MjIsImV4cCI6MjEwMzM3NDkyMn0.1AZFoSC4_LHUkTo2flmGN7vPYB8MgEICaDohbn3fPg0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);



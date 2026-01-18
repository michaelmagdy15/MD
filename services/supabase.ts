
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://muqwqcplviysitxdjels.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cXdxY3Bsdml5c2l0eGRqZWxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NTc1MDYsImV4cCI6MjA4NDMzMzUwNn0.9s5tsxfD2uhe76jkDLj7XWFgpNlyVCBmkiL5KID_Kxw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Ajustar a URL caso o usuário tenha colado com /rest/v1/ no final
const baseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '');

export const supabase = createClient(baseUrl, supabaseAnonKey);

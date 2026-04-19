import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Verify JWT token
export async function verifySupabaseJWT(token: string) {
  const { data, error } = await supabase.auth.getUser(token);
  
  if (error || !data.user) {
    throw new Error('Invalid token');
  }

  return data.user;
}

// Get tenant from user
export async function getUserTenant(userId: string) {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', userId)  // Corrigido: buscar por id, não userId
    .single();

  if (error) {
    throw new Error('Tenant not found');
  }

  return data;
}

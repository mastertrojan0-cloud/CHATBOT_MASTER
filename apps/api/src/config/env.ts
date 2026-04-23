const required = [
  'DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_JWT_SECRET',
  'JWT_SECRET',
];

required.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
});

const hasSupabaseServiceKey = Boolean(
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

if (!hasSupabaseServiceKey) {
  throw new Error('Missing required env var: SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)');
}

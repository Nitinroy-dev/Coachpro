const { Client } = require('pg')

const connectionString = process.env.DB_URL || 
  `postgresql://postgres.lkgszgodtnfboprjfvak:postgres@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`

const sql = `
CREATE TABLE IF NOT EXISTS trial_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS and insert policy for authenticated users
ALTER TABLE trial_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trial_history_authenticated" ON trial_history;
CREATE POLICY "trial_history_authenticated" ON trial_history FOR ALL USING (true);
`

async function main() {
  console.log('=== Creating trial_history table ===')
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
  try {
    await client.connect()
    console.log('Connected!')
    await client.query(sql)
    console.log('Table created successfully!')
  } catch (err) {
    console.error('Error:', err.message)
  } finally {
    await client.end()
  }
}

main()

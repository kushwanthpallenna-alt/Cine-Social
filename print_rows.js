const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local manually
const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
  if (match) {
    const key = match[1].trim();
    let val = match[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.substring(1, val.length - 1);
    }
    env[key] = val;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseSecret = env.SUPABASE_SECRET_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, supabaseSecret);

async function run() {
  const tables = ['watchlist', 'ratings', 'reviews'];
  for (const t of tables) {
    const { data, error } = await supabaseAdmin.from(t).select('*');
    console.log(`Table: ${t}`, data);
  }
}

run();

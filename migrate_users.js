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

const oldId = '104405891544993405274';
const newId = 'f853e370-5359-7441-1a7d-0855dd3b68cb';

async function run() {
  console.log("Migrating tables to use UUID...");
  
  // 1. Migrate watchlist
  const { data: wlData, error: wlError } = await supabaseAdmin
    .from('watchlist')
    .update({ user_id: newId })
    .eq('user_id', oldId);
  console.log("Migrated watchlist:", { error: wlError });
  
  // 2. Migrate ratings
  const { data: ratData, error: ratError } = await supabaseAdmin
    .from('ratings')
    .update({ user_id: newId })
    .eq('user_id', oldId);
  console.log("Migrated ratings:", { error: ratError });
  
  // 3. Migrate reviews
  const { data: revData, error: revError } = await supabaseAdmin
    .from('reviews')
    .update({ user_id: newId })
    .eq('user_id', oldId);
  console.log("Migrated reviews:", { error: revError });
  
  console.log("Migration complete!");
}

run();

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

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
const supabaseSecret = env.SUPABASE_SECRET_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, supabaseSecret);

async function checkTables() {
  console.log("Checking if review_likes table is accessible...");
  const likesRes = await supabaseAdmin.from('review_likes').select('id').limit(1);
  console.log("review_likes check:", likesRes.error ? likesRes.error.message : "Accessible!");

  console.log("Checking if review_replies table is accessible...");
  const repliesRes = await supabaseAdmin.from('review_replies').select('id').limit(1);
  console.log("review_replies check:", repliesRes.error ? repliesRes.error.message : "Accessible!");
}

checkTables();

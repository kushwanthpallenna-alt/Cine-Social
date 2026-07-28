const fs = require('fs');

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

async function run() {
  const res = await fetch(`${supabaseUrl}/rest/v1/`, {
    headers: {
      'apikey': supabaseSecret,
      'Authorization': `Bearer ${supabaseSecret}`
    }
  });
  const data = await res.json();
  
  console.log("All API Paths:");
  console.log(Object.keys(data.paths));
}

run();

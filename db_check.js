const fs = require('fs');
const crypto = require('crypto');
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

function toUUID(id) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) {
    return id.toLowerCase();
  }
  const hash = crypto.createHash("md5").update(id).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20)}`;
}

async function run() {
  const rawId = '104405891544993405274';
  const uuid = toUUID(rawId);
  console.log(`Raw ID: ${rawId} -> UUID: ${uuid}`);

  console.log("Testing insert into profiles with both id and user_id set to UUID...");
  const { data: profileData, error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: uuid,
      user_id: uuid,
      avatar_url: 'https://example.com/avatar.png',
      updated_at: new Date().toISOString()
    });
  console.log("Profiles upsert result:", { profileData, profileError });
}

run();

const { Client } = require('pg');

const regions = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-south-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'eu-central-1',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'sa-east-1',
  'ca-central-1'
];

async function checkRegion(region) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  const client = new Client({
    host: host,
    port: 6543,
    database: 'postgres',
    user: 'postgres.ptxivkwizlmonwpwjbek',
    password: 'wrongpassword',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 3000
  });
  
  try {
    await client.connect();
    console.log(`Region ${region}: CONNECTED (somehow with wrong password?!)`);
    await client.end();
    return true;
  } catch (e) {
    if (e.message.includes('password authentication failed')) {
      console.log(`Region ${region}: FOUND (password authentication failed)`);
      return true;
    } else if (e.message.includes('not found') || e.message.includes('tenant')) {
      // tenant not found
      return false;
    } else {
      console.log(`Region ${region}: Other error: ${e.message}`);
      return false;
    }
  }
}

async function run() {
  console.log("Searching for correct region...");
  for (const r of regions) {
    const found = await checkRegion(r);
    if (found) {
      console.log(`Correct region is: ${r}`);
      break;
    }
  }
}

run();

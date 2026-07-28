const { Client } = require('pg');

const regions = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ap-northeast-1', 'ap-northeast-2', 'ap-south-1',
  'ap-southeast-1', 'ap-southeast-2', 'eu-central-1',
  'eu-west-1', 'eu-west-2', 'eu-west-3', 'sa-east-1',
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
    console.log(`Region ${region}: CONNECTED`);
    await client.end();
  } catch (e) {
    console.log(`Region ${region}: ${e.message}`);
  }
}

async function run() {
  console.log("Probing regions...");
  for (const r of regions) {
    await checkRegion(r);
  }
}

run();

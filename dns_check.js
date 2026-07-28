const dns = require('dns');

function resolve(host) {
  return new Promise((resolve) => {
    dns.lookup(host, (err, address, family) => {
      if (err) {
        resolve(`Failed to resolve ${host}: ${err.message}`);
      } else {
        resolve(`Resolved ${host} to ${address} (family: IPv${family})`);
      }
    });
  });
}

async function run() {
  console.log(await resolve('db.ptxivkwizlmonwpwjbek.supabase.co'));
  console.log(await resolve('ptxivkwizlmonwpwjbek.supabase.co'));
  console.log(await resolve('aws-0-us-east-1.pooler.supabase.com'));
}

run();

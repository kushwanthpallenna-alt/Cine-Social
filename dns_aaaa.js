const dns = require('dns');

function resolveAAAA(host) {
  return new Promise((resolve) => {
    dns.resolve6(host, (err, addresses) => {
      if (err) {
        resolve(`Failed to resolve AAAA for ${host}: ${err.message}`);
      } else {
        resolve(`Resolved AAAA for ${host} to: ${addresses.join(', ')}`);
      }
    });
  });
}

async function run() {
  console.log(await resolveAAAA('db.ptxivkwizlmonwpwjbek.supabase.co'));
  console.log(await resolveAAAA('ptxivkwizlmonwpwjbek.supabase.co'));
}

run();

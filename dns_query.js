async function run() {
  const domains = [
    'db.ptxivkwizlmonwpwjbek.supabase.co',
    'ptxivkwizlmonwpwjbek.supabase.co'
  ];
  
  for (const domain of domains) {
    console.log(`\nDomain: ${domain}`);
    // Query Google DNS over HTTPS
    for (const type of ['A', 'AAAA', 'CNAME']) {
      try {
        const res = await fetch(`https://dns.google/resolve?name=${domain}&type=${type}`);
        const data = await res.json();
        console.log(`  Type ${type}:`, JSON.stringify(data.Answer || data.Authority || data, null, 2));
      } catch (e) {
        console.log(`  Type ${type} failed:`, e.message);
      }
    }
  }
}

run();

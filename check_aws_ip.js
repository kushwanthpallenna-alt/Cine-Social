function expandIPv6(ip) {
  let parts = ip.split('::');
  if (parts.length > 2) throw new Error("Invalid IPv6");
  
  let left = parts[0] ? parts[0].split(':') : [];
  let right = parts[1] ? parts[1].split(':') : [];
  
  let midCount = 8 - (left.length + right.length);
  let mid = Array(midCount).fill('0000');
  
  let all = [...left.map(x => x.padStart(4, '0')), ...mid, ...right.map(x => x.padStart(4, '0'))];
  return all.join('');
}

function ipv6ToBigInt(ip) {
  const hex = expandIPv6(ip);
  return BigInt('0x' + hex);
}

function matchIp(ipStr, prefixStr) {
  const [prefixIp, cidrStr] = prefixStr.split('/');
  const cidr = parseInt(cidrStr, 10);
  
  const ipBig = ipv6ToBigInt(ipStr);
  const prefixBig = ipv6ToBigInt(prefixIp);
  
  const mask = ((1n << 128n) - 1n) ^ ((1n << BigInt(128 - cidr)) - 1n);
  return (ipBig & mask) === (prefixBig & mask);
}

async function run() {
  const targetIp = '2406:da18:167b:f901:a519:16e5:9033:2f6e';
  
  console.log("Fetching AWS IP ranges...");
  const res = await fetch('https://ip-ranges.amazonaws.com/ip-ranges.json');
  const data = await res.json();
  
  console.log("Searching for matching IPv6 prefix...");
  let found = null;
  for (const prefix of data.ipv6_prefixes) {
    try {
      if (matchIp(targetIp, prefix.ipv6_prefix)) {
        console.log(`Match found: Prefix=${prefix.ipv6_prefix}, Region=${prefix.region}, Service=${prefix.service}`);
        found = prefix;
      }
    } catch (e) {
      // console.error(e);
    }
  }
  
  if (!found) {
    console.log("No match found in AWS IP ranges.");
  }
}

run();

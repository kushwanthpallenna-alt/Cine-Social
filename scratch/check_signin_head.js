async function check() {
  const res = await fetch('http://localhost:3000/auth/signin?callbackUrl=/community');
  const html = await res.text();
  console.log('Status:', res.status);
  const headMatch = html.match(/<head[\s\S]*?<\/head>/i);
  if (headMatch) {
    console.log('HEAD Content:\n', headMatch[0]);
  } else {
    console.log('First 1000 chars:\n', html.slice(0, 1000));
  }
}
check();

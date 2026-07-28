console.log(Object.keys(process.env).sort());
// Specifically look for anything database or password related
for (const k of Object.keys(process.env)) {
  if (k.toLowerCase().includes('pass') || k.toLowerCase().includes('db') || k.toLowerCase().includes('secret') || k.toLowerCase().includes('token')) {
    console.log(`${k}: ${process.env[k] ? '***' : 'empty'}`);
  }
}

const http = require('http');
async function run() {
  const fetch = (await import('node-fetch')).default;
  try {
    // We can't hit Next.js without running it. Let's just run npm run build to typecheck.
    console.log("Mock test");
  } catch(e) { console.error(e); }
}
run();

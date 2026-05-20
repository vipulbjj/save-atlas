const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function run() {
  try {
    const env = fs.readFileSync('.env.local', 'utf-8');
    const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
    const serviceKeyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);

    if (!urlMatch || !serviceKeyMatch) {
      console.error("Missing env variables in .env.local");
      return;
    }

    const supabaseUrl = urlMatch[1].trim();
    const supabaseKey = serviceKeyMatch[1].trim();

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Get user
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('email', 'vbajaj56@gmail.com');
    
    if (!users || users.length === 0) {
      console.log("No user found");
      return;
    }
    const userId = users[0].id;

    // Test a standard text query without expansion
    const term1 = "decor";
    const { data: res1, error: err1 } = await supabase
      .from('saves')
      .select('id, caption')
      .eq('user_id', userId)
      .textSearch('caption', term1, { type: 'websearch', config: 'english' });

    if (err1) {
      console.error("Error with term1:", err1);
    } else {
      console.log(`Search for "${term1}" returned ${res1.length} results.`);
      if (res1.length > 0) {
        console.log("Sample match:", res1[0].caption.slice(0, 100));
      }
    }

    // Test with expandQuery style (OR separated)
    const term2 = "minimalist OR contemporary OR sleek OR clean OR new OR villa";
    const { data: res2, error: err2 } = await supabase
      .from('saves')
      .select('id, caption')
      .eq('user_id', userId)
      .textSearch('caption', term2, { type: 'websearch', config: 'english' });

    if (err2) {
      console.error("Error with term2:", err2);
    } else {
      console.log(`Search for "${term2}" returned ${res2.length} results.`);
    }

  } catch (e) {
    console.error("Exception:", e);
  }
}

run();

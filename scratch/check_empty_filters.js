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

    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('email', 'vbajaj56@gmail.com');
    
    const userId = users[0].id;

    // Check home-design saves
    const { data: saves, error } = await supabase
      .from('saves')
      .select('id, caption, ai_category, ai_subcategory, media_type')
      .eq('user_id', userId)
      .eq('ai_category', 'home-design');
    
    if (error) throw error;
    console.log("Total home-design saves in DB:", saves.length);

    const subCounts = {};
    saves.forEach(s => {
      const sub = s.ai_subcategory || 'NULL';
      subCounts[sub] = (subCounts[sub] || 0) + 1;
    });

    console.log("Subcategory counts for home-design:", subCounts);
    console.log("Sample home-design saves:", saves.slice(0, 5));

  } catch (e) {
    console.error("Error:", e);
  }
}

run();

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

    // 1. Get total count
    const { count: totalCount, error: totalErr } = await supabase
      .from('saves')
      .select('*', { count: 'exact', head: true });
    
    if (totalErr) throw totalErr;
    console.log("Total Saves in DB:", totalCount);

    // 2. Get distinct media types
    const { data: mediaTypes, error: mediaErr } = await supabase
      .from('saves')
      .select('media_type');
    
    if (mediaErr) throw mediaErr;

    const mediaCounts = {};
    mediaTypes.forEach(r => {
      const type = r.media_type || 'NULL';
      mediaCounts[type] = (mediaCounts[type] || 0) + 1;
    });
    console.log("Media type counts in DB:", mediaCounts);

    // 3. Get distinct categories
    const { data: categories, error: catErr } = await supabase
      .from('saves')
      .select('ai_category');
    
    if (catErr) throw catErr;

    const catCounts = {};
    categories.forEach(r => {
      const cat = r.ai_category || 'NULL';
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });
    console.log("AI category counts in DB:", catCounts);

    // 4. Sample some saves
    const { data: sample, error: sampleErr } = await supabase
      .from('saves')
      .select('id, instagram_id, media_type, permalink, ai_category, ai_subcategory')
      .limit(10);
    
    if (sampleErr) throw sampleErr;
    console.log("Sample saves:", sample);

  } catch (e) {
    console.error("Error inspecting database:", e);
  }
}

run();

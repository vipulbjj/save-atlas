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

    // Get user id
    const { data: users, error: userErr } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', 'vbajaj56@gmail.com');
    
    if (userErr) throw userErr;
    if (!users || users.length === 0) {
      console.log("No user found with email vbajaj56@gmail.com");
      return;
    }

    const userId = users[0].id;
    console.log("Found User ID:", userId, "for vbajaj56@gmail.com");

    // 1. Total Saves for this user
    const { count: total, error: countErr } = await supabase
      .from('saves')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    if (countErr) throw countErr;
    console.log("User Total Saves:", total);

    // 2. Photos count (media_type = 'IMAGE')
    const { count: photos, error: photoErr } = await supabase
      .from('saves')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('media_type', 'IMAGE');
    
    if (photoErr) throw photoErr;
    console.log("User Photos Count (media_type=IMAGE):", photos);

    // 3. Videos count (media_type = 'VIDEO')
    const { count: videos, error: videoErr } = await supabase
      .from('saves')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('media_type', 'VIDEO');
    
    if (videoErr) throw videoErr;
    console.log("User Videos Count (media_type=VIDEO):", videos);

    // 4. Any other media types?
    const { data: allUserSaves, error: savesErr } = await supabase
      .from('saves')
      .select('media_type')
      .eq('user_id', userId);
    
    if (savesErr) throw savesErr;
    
    const mediaCounts = {};
    (allUserSaves || []).forEach(r => {
      const type = r.media_type || 'NULL';
      mediaCounts[type] = (mediaCounts[type] || 0) + 1;
    });
    console.log("User Media Type distribution:", mediaCounts);

    // 5. Category distribution for this user
    const { data: userCats, error: userCatErr } = await supabase
      .from('saves')
      .select('ai_category')
      .eq('user_id', userId);
    
    if (userCatErr) throw userCatErr;
    
    const catCounts = {};
    (userCats || []).forEach(r => {
      const cat = r.ai_category || 'NULL';
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });
    console.log("User Category distribution:", catCounts);

  } catch (e) {
    console.error("Error:", e);
  }
}

run();

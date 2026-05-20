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
    
    if (!users || users.length === 0) {
      console.log("No user found");
      return;
    }
    const userId = users[0].id;

    // Get some sample permalinks
    const { data: saves, error } = await supabase
      .from('saves')
      .select('id, permalink, caption, media_type')
      .eq('user_id', userId);
    
    if (error) throw error;

    console.log("Total saves:", saves.length);
    const permalinks = saves.map(s => s.permalink || "");
    
    const stats = {
      hasReel: 0,
      hasTv: 0,
      hasP: 0,
      other: 0
    };

    permalinks.forEach(p => {
      if (p.includes('/reel/')) stats.hasReel++;
      else if (p.includes('/tv/')) stats.hasTv++;
      else if (p.includes('/p/')) stats.hasP++;
      else stats.other++;
    });

    console.log("Permalink analysis:", stats);

    // Let's look at captions for video hashtags or words
    let videoHashtagsCount = 0;
    const videoMatches = [];
    saves.forEach(s => {
      const cap = (s.caption || "").toLowerCase();
      if (cap.includes('#reel') || cap.includes('#video') || cap.includes('reelsinstagram') || cap.includes('explorepage')) {
        videoHashtagsCount++;
        videoMatches.push({ id: s.id, caption: s.caption.slice(0, 100), permalink: s.permalink });
      }
    });

    console.log("Saves with video-like hashtags:", videoHashtagsCount);
    console.log("Sample video-like saves:", videoMatches.slice(0, 5));

  } catch (e) {
    console.error("Error:", e);
  }
}

run();

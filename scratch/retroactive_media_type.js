const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const VIDEO_INDICATORS = [
  '#reel',
  '#video',
  'reelsinstagram',
  'reelvideo',
  '#shorts',
  'reelsindia',
  'sound on',
  '🔊',
  '🎥',
  '🎬',
  '▶️',
  'reels.instagram',
  '#trendingreels',
  '#reels',
  '#shortcode',
  'explorepage'
];

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
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('email', 'vbajaj56@gmail.com');
    
    if (!users || users.length === 0) {
      console.log("No user found");
      return;
    }
    const userId = users[0].id;

    // Fetch in pages of 1000 to bypass any single-query limits
    let allSaves = [];
    let page = 0;
    const PAGE_SIZE = 1000;
    let hasMore = true;

    while (hasMore) {
      const start = page * PAGE_SIZE;
      const end = start + PAGE_SIZE - 1;
      
      const { data: chunk, error } = await supabase
        .from('saves')
        .select('id, caption, media_type')
        .eq('user_id', userId)
        .range(start, end);
      
      if (error) throw error;
      
      if (!chunk || chunk.length === 0) {
        hasMore = false;
      } else {
        allSaves = allSaves.concat(chunk);
        if (chunk.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          page++;
        }
      }
    }

    console.log(`Analyzing all ${allSaves.length} saves for vbajaj56@gmail.com...`);

    const toUpdate = [];
    allSaves.forEach(s => {
      const caption = (s.caption || "").toLowerCase();
      
      const isVideo = VIDEO_INDICATORS.some(ind => caption.includes(ind));
      
      if (isVideo && s.media_type !== 'VIDEO') {
        toUpdate.push(s.id);
      }
    });

    console.log(`Found ${toUpdate.length} saves that should be VIDEO instead of IMAGE.`);

    if (toUpdate.length === 0) {
      console.log("All media types are already correctly classified.");
      return;
    }

    // Perform updates in chunks
    const CHUNK_SIZE = 100;
    let updatedCount = 0;
    
    for (let i = 0; i < toUpdate.length; i += CHUNK_SIZE) {
      const chunk = toUpdate.slice(i, i + CHUNK_SIZE);
      const { error: updateErr } = await supabase
        .from('saves')
        .update({ media_type: 'VIDEO' })
        .in('id', chunk);

      if (updateErr) {
        console.error("Failed to update chunk:", updateErr);
        throw updateErr;
      }
      updatedCount += chunk.length;
      console.log(`Updated ${updatedCount}/${toUpdate.length} saves...`);
    }

    console.log("Retroactive media type migration completed successfully!");

  } catch (e) {
    console.error("Error during migration:", e);
  }
}

run();

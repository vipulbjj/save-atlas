import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

function fixEncoding(str) {
  if (!str) return str;
  try {
    const bytes = new Uint8Array(str.split('').map((c) => c.charCodeAt(0)));
    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    return str;
  }
}

function inferCategory(caption, hashtags) {
  const text = `${caption || ''} ${(hashtags || []).join(' ')}`.toLowerCase();
  if (text.match(/ai|claude|gpt|ai|code|python|repo|efficient|logic|tech/)) return 'tech-ai';
  if (text.match(/startup|yc|founder|marketing|brand|budget|startup|founder|yc|paul graham/)) return 'business';
  if (text.match(/love|relationship|maa|life|secrets|perspective|child|family|mindset|growth/)) return 'lifestyle';
  if (text.match(/travel|trip|road trip|vacation|staycation|stay|dividends|eiffel|visit/)) return 'travel';
  if (text.match(/home|interior|living|bedroom|kitchen|sofa|furniture|decor|room|villa|facade|architect/)) return 'home-design';
  return 'other';
}

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;

    // Ensure the user exists in public.users to satisfy the foreign key constraint
    await supabase.from('users').upsert({
      id: userId,
      email: user.email,
    }, { onConflict: 'id' });
    
    // Fetch records that haven't been fixed yet
    const { data: saves, error } = await supabase
      .from('saves')
      .select('*')
      .eq('user_id', userId)
      .eq('ai_processed', false)
      .limit(200);

    if (error) throw error;

    let fixedCount = 0;
    
    for (const save of saves) {
      try {
        const fixedCaption = fixEncoding(save.caption);
        const hashtags = (save.hashtags || []).map(h => fixEncoding(h));
        const category = inferCategory(fixedCaption, hashtags);
        
        const { error: updateError } = await supabase
          .from('saves')
          .update({
            caption: fixedCaption,
            hashtags: hashtags,
            ai_category: category,
            ai_processed: true
          })
          .eq('id', save.id);
          
        if (!updateError) fixedCount++;
      } catch (e) {
        console.error(`Failed to fix save ${save.id}:`, e);
      }
    }

    return NextResponse.json({ ok: true, fixed: fixedCount, remaining: true });

  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

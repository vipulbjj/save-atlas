import { NextResponse } from 'next/server';
import { getSupabase, DEFAULT_USER_ID } from '@/lib/supabase';

export async function POST(request) {
  try {
    const { id, likes, ai_category } = await request.json();
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('saves')
      .update({ likes, ai_category })
      .eq('id', id)
      .eq('user_id', DEFAULT_USER_ID)
      .select();

    if (error) throw error;
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

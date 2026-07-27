import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    debs_url:     process.env.DEBS_SUPABASE_URL     ? 'SET' : 'MISSING',
    debs_key:     process.env.DEBS_SUPABASE_KEY     ? 'SET' : 'MISSING',
    norbake_url:  process.env.NORBAKE_SUPABASE_URL  ? 'SET' : 'MISSING',
    norbake_key:  process.env.NORBAKE_SUPABASE_KEY  ? 'SET' : 'MISSING',
    stods_url:    process.env.STODS_SUPABASE_URL    ? 'SET' : 'MISSING',
    stods_key:    process.env.STODS_SUPABASE_KEY    ? 'SET' : 'MISSING',
  })
}
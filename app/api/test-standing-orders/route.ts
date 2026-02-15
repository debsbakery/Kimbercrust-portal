import { NextResponse } from 'next/server';
import { triggerStandingOrderGeneration } from '@/lib/cron/ar-scheduler';

export async function GET() {
  try {
    const result = await triggerStandingOrderGeneration();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
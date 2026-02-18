export const dynamic = 'force-dynamic'

// /app/api/cron/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  // Import scheduler to ensure it's running
  await import('@/lib/cron/ar-scheduler');
  
  return NextResponse.json({ 
    message: 'Cron scheduler initialized',
    timestamp: new Date().toISOString()
  });
}

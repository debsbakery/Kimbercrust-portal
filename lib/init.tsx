// Add to your root layout or create an initialization file
import { startArScheduler } from '@/lib/cron/ar-scheduler'

// Only run in server environment and not in build
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
  startArScheduler()
}
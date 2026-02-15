export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startARScheduler } = await import('./lib/cron/ar-scheduler')
    startARScheduler()
  }
}
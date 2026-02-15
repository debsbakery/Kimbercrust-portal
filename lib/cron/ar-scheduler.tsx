import cron from 'node-cron';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

let isSchedulerRunning = false;

/**
 * Start all cron jobs
 */
export function startARScheduler() {
  if (isSchedulerRunning) {
    console.log('⚠️ Scheduler already running, skipping initialization');
    return;
  }

  console.log('\n🚀 Starting AR & Standing Order Scheduler...');
  
  /**
   * Daily Standing Order Generation
   * Runs at 12:01 AM every day
   */
  cron.schedule('1 0 * * *', async () => {
    const timestamp = new Date().toISOString();
    console.log(`\n🔄 [${timestamp}] Running daily standing order generation...`);
    
    try {
      const response = await fetch(`${APP_URL}/api/standing-orders/generate`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'AR-Scheduler/1.0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log(`✅ Standing Order Generation Complete: ${result.ordersCreated} orders created`);
      
      if (result.errors && result.errors.length > 0) {
        console.error('⚠️ Errors during generation:', JSON.stringify(result.errors, null, 2));
      }
    } catch (error: any) {
      console.error(`❌ Failed to generate standing orders:`, error.message);
    }
  });

  /**
   * Weekly Overdue Invoice Reminders
   * Runs every Monday at 9:00 AM
   */
  cron.schedule('0 9 * * 1', async () => {
    const timestamp = new Date().toISOString();
    console.log(`\n📧 [${timestamp}] Sending weekly overdue reminders...`);
    
    try {
      const response = await fetch(`${APP_URL}/api/ar/reminders`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'AR-Scheduler/1.0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log(`✅ Sent ${result.emailsSent || 0} overdue reminder emails`);
    } catch (error: any) {
      console.error(`❌ Failed to send overdue reminders:`, error.message);
    }
  });

  /**
   * Monthly Statement Generation
   * Runs on the 1st of every month at 10:00 AM
   */
  cron.schedule('0 10 1 * *', async () => {
    const timestamp = new Date().toISOString();
    console.log(`\n📊 [${timestamp}] Generating monthly statements...`);
    
    try {
      const response = await fetch(`${APP_URL}/api/ar/statements/send-all`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'AR-Scheduler/1.0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log(`✅ Sent ${result.statementsSent || 0} monthly statements`);
    } catch (error: any) {
      console.error(`❌ Failed to send monthly statements:`, error.message);
    }
  });

  /**
   * Daily AR Aging Update
   * Runs at 1:00 AM every day
   */
  cron.schedule('0 1 * * *', async () => {
    const timestamp = new Date().toISOString();
    console.log(`\n🔄 [${timestamp}] Updating AR aging report...`);
    
    try {
      const response = await fetch(`${APP_URL}/api/ar/aging/update`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'AR-Scheduler/1.0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log(`✅ AR aging updated successfully`);
    } catch (error: any) {
      console.error(`❌ Failed to update AR aging:`, error.message);
    }
  });

  isSchedulerRunning = true;
  
  const initTime = new Date().toISOString();
  console.log(`\n✅ [${initTime}] AR & Standing Order Scheduler Initialized`);
  console.log('📅 Scheduled Jobs:');
  console.log('  - Daily Standing Orders: 12:01 AM (1 0 * * *)');
  console.log('  - Daily AR Aging Update: 1:00 AM (0 1 * * *)');
  console.log('  - Weekly Overdue Reminders: Monday 9:00 AM (0 9 * * 1)');
  console.log('  - Monthly Statements: 1st of month 10:00 AM (0 10 1 * *)');
  console.log('─────────────────────────────────────────────────────\n');
}

/**
 * Manual trigger for testing (optional)
 */
export async function triggerStandingOrderGeneration() {
  try {
    const response = await fetch(`${APP_URL}/api/standing-orders/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    return await response.json();
  } catch (error: any) {
    console.error('Failed to trigger standing order generation:', error);
    throw error;
  }
}
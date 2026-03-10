export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}) {
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Email send failed:', error);
      return { success: false, error };
    }

    const result = await response.json();
    console.log('✅ Email sent successfully:', result);
    return { success: true, result };
    
  } catch (error) {
    console.error('❌ Email send exception:', error);
    return { success: false, error };
  }
}

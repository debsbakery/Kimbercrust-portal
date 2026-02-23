import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  try {
    console.log('📧 Sending email:', {
      to,
      subject: subject.substring(0, 50),
      htmlLength: html.length,
    });

    const { data, error } = await resend.emails.send({
      from: 'orders@debsbakery.store',
      to,
      subject,
      html,
    });

    if (error) {
      console.error('❌ Resend API error:', error);
      throw error;
    }

    console.log('✅ Email sent successfully:', {
      to,
      emailId: data?.id,
    });

    return { success: true, emailId: data?.id };
  } catch (error: any) {
    console.error('❌ Email sending failed:', error);
    throw error;
  }
}
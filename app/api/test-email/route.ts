export const dynamic = 'force-dynamic'

import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET() {
  try {
    console.log("🔵 Testing Resend email API...");
    console.log("🔵 API Key configured:", !!process.env.RESEND_API_KEY);
    console.log("🔵 Bakery email:", process.env.BAKERY_EMAIL);
    
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ 
        error: "RESEND_API_KEY not found in environment" 
      }, { status: 500 });
    }
    
    const testEmail = process.env.BAKERY_EMAIL || "debs_bakery@outlook.com";
    
    console.log(`🔵 Sending test email to: ${testEmail}`);
    
    const result = await resend.emails.send({
      from: "Deb's Bakery <onboarding@resend.dev>",
      to: testEmail,
      subject: "🍞 Test Email - Your Bread Portal is Working!",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
        </head>
        <body style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #8B4513 0%, #D2691E 100%); padding: 30px; border-radius: 10px; text-align: center;">
            <h1 style="color: white; font-size: 32px; margin: 0;">🍞</h1>
            <h2 style="color: white; margin: 10px 0;">Email System Working!</h2>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 10px; margin-top: 20px;">
            <h3>✅ Success!</h3>
            <p>If you're reading this email, your Resend integration is working correctly!</p>
            
            <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Test Details:</strong></p>
              <ul>
                <li>Sent at: ${new Date().toLocaleString()}</li>
                <li>From: Deb's Bakery</li>
                <li>Using: onboarding@resend.dev</li>
              </ul>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              Note: This email might be in your spam folder. If so, mark it as "Not Spam" to ensure order confirmations arrive in your inbox.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    console.log("✅ Email sent successfully!");
    console.log("✅ Result:", result);

    return NextResponse.json({ 
      success: true, 
      message: "Email sent! Check your inbox (and spam folder).",
      emailId: result.data?.id,
      sentTo: testEmail
    });

  } catch (error: any) {
    console.error("🔴 Email sending failed:", error);
    
    return NextResponse.json({ 
      error: error.message,
      details: error
    }, { status: 500 });
  }
}

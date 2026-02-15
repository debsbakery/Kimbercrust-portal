// app/api/ar/statements/send-all/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST() {
  try {
    console.log('📧 Generating monthly statements...')

    // Get all customers with a balance or recent transactions
    const { data: customers, error: custError } = await supabase
      .from('customers')
      .select('*')

    if (custError) throw custError

    let sent = 0
    const errors: string[] = []
    const statementDate = new Date().toISOString().split('T')[0]

    // Get first day of previous month for statement period
    const now = new Date()
    const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
    const periodStart = firstOfLastMonth.toISOString().split('T')[0]
    const periodEnd = lastOfLastMonth.toISOString().split('T')[0]

    for (const customer of customers || []) {
      try {
        if (!customer.email) continue

        // Get transactions for statement period
        const { data: transactions } = await supabase
          .from('ar_transactions')
          .select('*')
          .eq('customer_id', customer.id)
          .gte('created_at', periodStart)
          .lte('created_at', periodEnd + 'T23:59:59')
          .order('created_at', { ascending: true })

        const balance = parseFloat(customer.balance || '0')

        // Skip if no transactions and no balance
        if ((!transactions || transactions.length === 0) && balance === 0) {
          continue
        }

        // Build transaction table rows
        const txRows = (transactions || [])
          .map((tx) => {
            const date = new Date(tx.created_at)
            const dateStr = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`
            const isDebit = tx.type === 'invoice' || tx.type === 'charge' || tx.type === 'late_fee'
            return `
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${dateStr}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${tx.description || tx.type}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">
                  ${isDebit ? '$' + parseFloat(tx.amount).toFixed(2) : ''}
                </td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">
                  ${!isDebit ? '$' + parseFloat(tx.amount).toFixed(2) : ''}
                </td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">
                  $${parseFloat(tx.balance_after || '0').toFixed(2)}
                </td>
              </tr>
            `
          })
          .join('')

        // Get aging data
        const { data: aging } = await supabase
          .from('ar_aging')
          .select('*')
          .eq('customer_id', customer.id)
          .maybeSingle()

        const agingSection = aging
          ? `
          <div style="background: #f0f0f0; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Aging Summary</h3>
            <table style="width: 100%;">
              <tr>
                <td>Current</td>
                <td>1-30 Days</td>
                <td>31-60 Days</td>
                <td>61-90 Days</td>
                <td>90+ Days</td>
                <td><strong>Total</strong></td>
              </tr>
              <tr style="font-weight: bold;">
                <td>$${parseFloat(aging.current).toFixed(2)}</td>
                <td>$${parseFloat(aging.days_1_30).toFixed(2)}</td>
                <td>$${parseFloat(aging.days_31_60).toFixed(2)}</td>
                <td>$${parseFloat(aging.days_61_90).toFixed(2)}</td>
                <td style="color: ${parseFloat(aging.days_over_90) > 0 ? '#CE1126' : 'inherit'};">
                  $${parseFloat(aging.days_over_90).toFixed(2)}
                </td>
                <td style="color: #CE1126;">$${parseFloat(aging.total_due).toFixed(2)}</td>
              </tr>
            </table>
          </div>
          `
          : ''

        // Send statement email
        const { error: emailError } = await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL!,
          to: customer.email,
          subject: `Monthly Statement — ${firstOfLastMonth.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })} — Balance: $${balance.toFixed(2)}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
              <div style="background-color: #CE1126; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">Deb's Bakery</h1>
                <p style="margin: 5px 0 0 0;">Monthly Statement</p>
              </div>
              
              <div style="padding: 30px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
                  <div>
                    <strong>${customer.business_name || customer.contact_name || 'Customer'}</strong><br/>
                    ${customer.address || ''}<br/>
                    ${customer.abn ? 'ABN: ' + customer.abn : ''}
                  </div>
                  <div style="text-align: right;">
                    <strong>Statement Date:</strong> ${statementDate}<br/>
                    <strong>Period:</strong> ${periodStart} to ${periodEnd}<br/>
                    <strong>Payment Terms:</strong> ${customer.payment_terms || 30} days
                  </div>
                </div>

                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                  <thead>
                    <tr style="background: #006A4E; color: white;">
                      <th style="padding: 10px; text-align: left;">Date</th>
                      <th style="padding: 10px; text-align: left;">Description</th>
                      <th style="padding: 10px; text-align: right;">Charges</th>
                      <th style="padding: 10px; text-align: right;">Payments</th>
                      <th style="padding: 10px; text-align: right;">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${txRows || '<tr><td colspan="5" style="padding: 20px; text-align: center;">No transactions this period</td></tr>'}
                  </tbody>
                </table>

                ${agingSection}

                <div style="background: #CE1126; color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                  <h2 style="margin: 0;">Balance Due: $${balance.toFixed(2)}</h2>
                </div>

                <p>If you have any questions about this statement, please contact us:</p>
                <ul>
                  <li>📧 ${process.env.BAKERY_EMAIL}</li>
                  <li>📞 ${process.env.BAKERY_PHONE}</li>
                </ul>

                <p><strong>Deb's Bakery</strong><br/>
                ${process.env.BAKERY_ADDRESS}<br/>
                ABN: ${process.env.BAKERY_ABN}</p>
              </div>
            </div>
          `,
        })

        if (emailError) {
          errors.push(`${customer.business_name}: ${emailError.message}`)
          continue
        }

        // Log email + update statement date
        await supabase.from('ar_emails').insert({
          customer_id: customer.id,
          type: 'statement',
          subject: `Monthly Statement — Balance: $${balance.toFixed(2)}`,
          status: 'sent',
        })

        await supabase
          .from('customers')
          .update({ last_statement_date: statementDate })
          .eq('id', customer.id)

        sent++
        console.log(`  📧 Statement sent to ${customer.business_name} — $${balance.toFixed(2)}`)
      } catch (err: any) {
        errors.push(`${customer.id}: ${err.message}`)
      }
    }

    console.log(`✅ Sent ${sent} statements`)

    return NextResponse.json({
      success: true,
      sent,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    console.error('❌ Statement generation error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
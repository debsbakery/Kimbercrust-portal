// app/admin/ar/ar-actions.tsx
"use client"

import { useState, useEffect } from "react"
import { 
  RefreshCw, 
  Send, 
  FileText, 
  DollarSign, 
  Loader2, 
  Edit, 
  Plus,
  CheckCircle 
} from "lucide-react"

interface Customer {
  id: string
  email: string
  business_name: string | null
  balance: string
  aging: {
    current: string
    days_1_30: string
    days_31_60: string
    days_61_90: string
    days_over_90: string
    total_due: string
  } | null
}

interface UnpaidInvoice {
  id: string
  invoice_id: string
  amount: string
  amount_paid: string
  balance_remaining: string
  due_date: string
  description: string
  percent_paid: number
}

// Helper function
function calculateUnappliedCredits(customer: Customer) {
  const balance = parseFloat(customer.balance || "0")
  const agingTotal = customer.aging ? parseFloat(customer.aging.total_due || "0") : 0
  const unapplied = agingTotal - balance
  return unapplied > 0 ? unapplied : 0
}

export default function ARActions({ customers }: { customers: Customer[] }) {
  const [loading, setLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [showPayment, setShowPayment] = useState(false)
  const [showAdjustment, setShowAdjustment] = useState(false)
  const [paymentData, setPaymentData] = useState({
    customer_id: "",
    amount: "",
    description: "",
    apply_to_invoice_id: "",
  })
  const [adjustmentData, setAdjustmentData] = useState({
    customer_id: "",
    type: "credit" as "credit" | "charge",
    amount: "",
    description: "",
  })
  const [unpaidInvoices, setUnpaidInvoices] = useState<UnpaidInvoice[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)

  // Fetch unpaid invoices when customer selected for payment
  useEffect(() => {
    if (paymentData.customer_id) {
      fetchUnpaidInvoices(paymentData.customer_id)
    } else {
      setUnpaidInvoices([])
    }
  }, [paymentData.customer_id])

  const fetchUnpaidInvoices = async (customerId: string) => {
    setLoadingInvoices(true)
    try {
      const res = await fetch(`/api/ar/unpaid-invoices?customer_id=${customerId}`)
      const data = await res.json()
      if (data.success) {
        setUnpaidInvoices(data.invoices || [])
      }
    } catch (err) {
      console.error("Error fetching invoices:", err)
    } finally {
      setLoadingInvoices(false)
    }
  }

  const runAction = async (action: string, url: string) => {
    setLoading(action)
    setMessage(null)
    try {
      const res = await fetch(url, { method: "POST" })
      const data = await res.json()
      if (data.success) {
        setMessage(`✅ ${action} completed successfully!`)
        setTimeout(() => window.location.reload(), 1500)
      } else {
        setMessage(`❌ ${action} failed: ${data.error}`)
      }
    } catch (err: any) {
      setMessage(`❌ ${action} error: ${err.message}`)
    } finally {
      setLoading(null)
    }
  }

  const recordPayment = async () => {
    if (!paymentData.customer_id || !paymentData.amount) {
      setMessage("❌ Select a customer and enter an amount")
      return
    }

    setLoading("payment")
    setMessage(null)

    try {
      const res = await fetch("/api/ar/record-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: paymentData.customer_id,
          amount: parseFloat(paymentData.amount),
          description: paymentData.description || `Payment received - ${new Date().toLocaleDateString("en-AU")}`,
          apply_to_invoice_id: paymentData.apply_to_invoice_id || null,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setMessage(
          `✅ Payment of $${parseFloat(paymentData.amount).toFixed(2)} recorded. ` +
          `New balance: $${data.newBalance.toFixed(2)}`
        )
        setPaymentData({ customer_id: "", amount: "", description: "", apply_to_invoice_id: "" })
        setShowPayment(false)
        setTimeout(() => window.location.reload(), 2000)
      } else {
        setMessage(`❌ Payment failed: ${data.error}`)
      }
    } catch (err: any) {
      setMessage(`❌ Payment error: ${err.message}`)
    } finally {
      setLoading(null)
    }
  }

  const recordAdjustment = async () => {
    if (!adjustmentData.customer_id || !adjustmentData.amount) {
      setMessage("❌ Select a customer and enter an amount")
      return
    }

    setLoading("adjustment")
    setMessage(null)

    try {
      const res = await fetch("/api/ar/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: adjustmentData.customer_id,
          type: adjustmentData.type,
          amount: parseFloat(adjustmentData.amount),
          description: adjustmentData.description || 
            `${adjustmentData.type === "credit" ? "Credit" : "Charge"} adjustment - ${new Date().toLocaleDateString("en-AU")}`,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setMessage(
          `✅ ${adjustmentData.type === "credit" ? "Credit" : "Charge"} of $${parseFloat(adjustmentData.amount).toFixed(2)} recorded. ` +
          `New balance: $${data.newBalance.toFixed(2)}`
        )
        setAdjustmentData({ customer_id: "", type: "credit", amount: "", description: "" })
        setShowAdjustment(false)
        setTimeout(() => window.location.reload(), 2000)
      } else {
        setMessage(`❌ Adjustment failed: ${data.error}`)
      }
    } catch (err: any) {
      setMessage(`❌ Adjustment error: ${err.message}`)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="w-full">
      {/* Action Buttons */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => runAction("Update Aging", "/api/ar/aging/update")}
          disabled={loading !== null}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-white hover:opacity-90 shadow-md disabled:opacity-50"
          style={{ backgroundColor: "#006A4E" }}
        >
          {loading === "Update Aging" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Update Aging
        </button>

        <button
          onClick={() => runAction("Send Reminders", "/api/ar/reminders")}
          disabled={loading !== null}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-white hover:opacity-90 shadow-md disabled:opacity-50"
          style={{ backgroundColor: "#CE1126" }}
        >
          {loading === "Send Reminders" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Send Reminders
        </button>

        <button
          onClick={() => runAction("Send Statements", "/api/ar/statements/send-all")}
          disabled={loading !== null}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-white hover:opacity-90 shadow-md disabled:opacity-50"
          style={{ backgroundColor: "#333" }}
        >
          {loading === "Send Statements" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          Send Statements
        </button>

        <button
          onClick={() => setShowPayment(!showPayment)}
          className="flex items-center gap-2 px-4 py-2 rounded-md border-2 font-medium hover:bg-green-50"
          style={{ borderColor: "#006A4E", color: "#006A4E" }}
        >
          <DollarSign className="h-4 w-4" />
          Record Payment
        </button>

        <button
          onClick={() => setShowAdjustment(!showAdjustment)}
          className="flex items-center gap-2 px-4 py-2 rounded-md border-2 font-medium hover:bg-blue-50"
          style={{ borderColor: "#0066CC", color: "#0066CC" }}
        >
          <Edit className="h-4 w-4" />
          Adjust Invoice
        </button>

        <button
          onClick={async () => {
            if (!confirm('Apply all unapplied credits to oldest invoices?')) return
            
            setLoading("apply-credits")
            setMessage(null)
            
            try {
              let totalApplied = 0
              
              for (const customer of customers) {
                const unapplied = calculateUnappliedCredits(customer)
                if (unapplied > 0.01) {
                  const res = await fetch("/api/ar/apply-credits", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ customer_id: customer.id }),
                  })
                  const data = await res.json()
                  if (data.success) {
                    totalApplied += data.applied || 0
                  }
                }
              }
              
              setMessage(`✅ Applied $${totalApplied.toFixed(2)} in unapplied credits`)
              setTimeout(() => window.location.reload(), 2000)
            } catch (err: any) {
              setMessage(`❌ Error: ${err.message}`)
            } finally {
              setLoading(null)
            }
          }}
          disabled={loading !== null}
          className="flex items-center gap-2 px-4 py-2 rounded-md border-2 font-medium hover:bg-purple-50 disabled:opacity-50"
          style={{ borderColor: "#9333EA", color: "#9333EA" }}
        >
          {loading === "apply-credits" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="h-4 w-4" />
          )}
          Apply Unapplied Credits
        </button>
      </div>

      {/* Status Message */}
      {message && (
        <div
          className={`mt-3 p-3 rounded-md text-sm ${
            message.startsWith("✅")
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message}
        </div>
      )}

      {/* Payment Form */}
      {showPayment && (
        <div className="mt-4 bg-white border-2 rounded-lg p-6 shadow-lg" style={{ borderColor: "#006A4E" }}>
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5" style={{ color: "#006A4E" }} />
            Record Payment
          </h3>

          <div className="grid gap-4">
            {/* Customer Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer *
              </label>
              <select
                value={paymentData.customer_id}
                onChange={(e) =>
                  setPaymentData({ ...paymentData, customer_id: e.target.value, apply_to_invoice_id: "" })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Select customer...</option>
                {customers
                  .sort((a, b) => (a.business_name || a.email).localeCompare(b.business_name || b.email))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.business_name || c.email} — Balance: ${parseFloat(c.balance).toFixed(2)}
                    </option>
                  ))}
              </select>
            </div>

            {/* Apply to Specific Invoice */}
            {paymentData.customer_id && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Apply to Invoice (Optional - for part payments)
                </label>
                {loadingInvoices ? (
                  <div className="text-sm text-gray-500">Loading invoices...</div>
                ) : unpaidInvoices.length === 0 ? (
                  <div className="text-sm text-gray-500">No unpaid invoices found</div>
                ) : (
                  <select
                    value={paymentData.apply_to_invoice_id}
                    onChange={(e) =>
                      setPaymentData({ ...paymentData, apply_to_invoice_id: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">General payment (not specific invoice)</option>
                    {unpaidInvoices.map((inv) => {
  const balanceRemaining = parseFloat(inv.balance_remaining)
  const totalAmount = parseFloat(inv.amount)
  const percentPaid = inv.percent_paid || 0

  return (
    <option key={inv.id} value={inv.invoice_id}>
      {inv.description} — 
      {balanceRemaining < totalAmount ? (
        ` ${percentPaid}% paid, $${balanceRemaining.toFixed(2)} owing`
      ) : (
        ` $${totalAmount.toFixed(2)}`
      )}
      {inv.due_date && ` (Due: ${new Date(inv.due_date).toLocaleDateString("en-AU")})`}
    </option>
  )
})}
                  </select>
                )}
              </div>
            )}

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Amount *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={paymentData.amount}
                onChange={(e) =>
                  setPaymentData({ ...paymentData, amount: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {paymentData.apply_to_invoice_id && unpaidInvoices.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  💡 Enter partial amount for part payment, or full amount to mark invoice paid
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method / Notes
              </label>
              <input
                type="text"
                placeholder="e.g. EFT, Cash, Cheque #1234"
                value={paymentData.description}
                onChange={(e) =>
                  setPaymentData({ ...paymentData, description: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={recordPayment}
              disabled={loading === "payment"}
              className="flex items-center gap-2 px-6 py-2 rounded-md text-white hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "#006A4E" }}
            >
              {loading === "payment" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <DollarSign className="h-4 w-4" />
              )}
              Record Payment
            </button>

            <button
              onClick={() => {
                setShowPayment(false)
                setPaymentData({ customer_id: "", amount: "", description: "", apply_to_invoice_id: "" })
              }}
              className="px-6 py-2 rounded-md border border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Adjustment Form */}
      {showAdjustment && (
        <div className="mt-4 bg-white border-2 rounded-lg p-6 shadow-lg" style={{ borderColor: "#0066CC" }}>
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Edit className="h-5 w-5" style={{ color: "#0066CC" }} />
            Adjust Invoice / Account Balance
          </h3>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer *
              </label>
              <select
                value={adjustmentData.customer_id}
                onChange={(e) =>
                  setAdjustmentData({ ...adjustmentData, customer_id: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select customer...</option>
                {customers
                  .sort((a, b) => (a.business_name || a.email).localeCompare(b.business_name || b.email))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.business_name || c.email} — Balance: ${parseFloat(c.balance).toFixed(2)}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adjustment Type *
              </label>
              <select
                value={adjustmentData.type}
                onChange={(e) =>
                  setAdjustmentData({ ...adjustmentData, type: e.target.value as "credit" | "charge" })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="credit">Credit (reduce balance)</option>
                <option value="charge">Charge (increase balance)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={adjustmentData.amount}
                onChange={(e) =>
                  setAdjustmentData({ ...adjustmentData, amount: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason / Description *
              </label>
              <input
                type="text"
                placeholder="e.g. Short supply - 2 loaves"
                value={adjustmentData.description}
                onChange={(e) =>
                  setAdjustmentData({ ...adjustmentData, description: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={recordAdjustment}
              disabled={loading === "adjustment"}
              className="flex items-center gap-2 px-6 py-2 rounded-md text-white hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "#0066CC" }}
            >
              {loading === "adjustment" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Edit className="h-4 w-4" />
              )}
              Record Adjustment
            </button>

            <button
              onClick={() => {
                setShowAdjustment(false)
                setAdjustmentData({ customer_id: "", type: "credit", amount: "", description: "" })
              }}
              className="px-6 py-2 rounded-md border border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-md text-sm text-blue-800">
            <strong>Note:</strong> Use "Credit" when you need to reduce a customer's balance 
            (e.g., short supply, damaged goods, discounts). Use "Charge" to add fees or corrections.
          </div>
        </div>
      )}
    </div>
  )
}
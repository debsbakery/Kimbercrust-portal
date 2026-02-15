import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkAdmin } from "@/lib/auth";
import { ArrowLeft, AlertTriangle, DollarSign } from "lucide-react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ARActions from "./ar-actions";

// ===========================
// Server-side Data Fetching
// ===========================


    // ✅ Admin email whitelist - add your email here
    const adminEmails = [
      'debs_bakery@outlook.com',
      
      // Add more admin emails as needed
    ];

    // Check if user's email is in the admin list
    const isAdmin = adminEmails.includes(user.email?.toLowerCase() || '');
    
    console.log(`${isAdmin ? '✅' : '❌'} Admin check: ${isAdmin} (${user.email})`);
    
    return isAdmin;
  } catch (error: any) {
    console.error('❌ Unexpected error in checkAdmin:', error);
    return false;
  }
}

async function getARData() {
  const supabase = await createClient();

  // Fetch customers with aging data
  const { data: customers } = await supabase
    .from("customers")
    .select(
      `
      *,
      aging:ar_aging(*)
    `
    )
    .order("business_name");

  // Fetch recent transactions
  const { data: recentTx } = await supabase
    .from("ar_transactions")
    .select(
      `
      *,
      customers(business_name, email)
    `
    )
    .order("created_at", { ascending: false })
    .limit(20);

  // Fetch email log
  const { data: emailLog } = await supabase
    .from("ar_emails")
    .select(
      `
      *,
      customers(business_name, email)
    `
    )
    .order("sent_at", { ascending: false })
    .limit(10);

  // Calculate stats
  const totalAR = customers?.reduce(
    (sum, c) => sum + parseFloat(c.balance || "0"),
    0
  ) || 0;

  const totalOverdue =
    customers?.reduce((sum, c) => {
      const aging = c.aging?.[0];
      return (
        sum +
        parseFloat(aging?.days_1_30 || "0") +
        parseFloat(aging?.days_31_60 || "0") +
        parseFloat(aging?.days_61_90 || "0") +
        parseFloat(aging?.days_over_90 || "0")
      );
    }, 0) || 0;

  const customersOverdue =
    customers?.filter((c) => {
      const aging = c.aging?.[0];
      return (
        parseFloat(aging?.days_1_30 || "0") > 0 ||
        parseFloat(aging?.days_31_60 || "0") > 0 ||
        parseFloat(aging?.days_61_90 || "0") > 0 ||
        parseFloat(aging?.days_over_90 || "0") > 0
      );
    }).length || 0;

  return {
    customers: customers || [],
    recentTx: recentTx || [],
    emailLog: emailLog || [],
    stats: {
      totalAR,
      totalOverdue,
      customersOverdue,
    },
  };
}

// ===========================
// Helper Functions
// ===========================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(amount);
}

function formatDateSafe(dateString: string | null): string {
  if (!dateString) return "—";
  try {
    return new Date(dateString).toLocaleDateString("en-AU");
  } catch {
    return "—";
  }
}

// ===========================
// Main Component (Server)
// ===========================

export default async function ARDashboardPage() {
  const isAdmin = await checkAdmin();
  if (!isAdmin) redirect("/");

  const { customers, recentTx, emailLog, stats } = await getARData();

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <a
          href="/admin"
          className="flex items-center gap-1 text-sm mb-4 hover:opacity-80"
          style={{ color: "#CE1126" }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Admin
        </a>
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">Accounts Receivable</h1>
            <p className="text-gray-600">
              Manage customer balances, payments, and aging
            </p>
          </div>
          <ARActions customers={customers} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <div
          className="bg-white rounded-lg shadow-md p-6 border-l-4"
          style={{ borderColor: "#006A4E" }}
        >
          <p className="text-sm text-gray-600">Total Receivable</p>
          <p className="text-3xl font-bold" style={{ color: "#006A4E" }}>
            {formatCurrency(stats.totalAR)}
          </p>
        </div>
        <div
          className="bg-white rounded-lg shadow-md p-6 border-l-4"
          style={{ borderColor: "#CE1126" }}
        >
          <p className="text-sm text-gray-600">Total Overdue</p>
          <p className="text-3xl font-bold" style={{ color: "#CE1126" }}>
            {formatCurrency(stats.totalOverdue)}
          </p>
        </div>
        <div
          className="bg-white rounded-lg shadow-md p-6 border-l-4"
          style={{ borderColor: "#FFD700" }}
        >
          <p className="text-sm text-gray-600">Customers Overdue</p>
          <p className="text-3xl font-bold">
            {stats.customersOverdue} / {customers.length}
          </p>
        </div>
      </div>

      {/* Aging Table */}
      <div className="bg-white rounded-lg shadow-md mb-8">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" style={{ color: "#CE1126" }} />
            Customer Aging Report
          </h2>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">1-30 Days</TableHead>
                <TableHead className="text-right">31-60 Days</TableHead>
                <TableHead className="text-right">61-90 Days</TableHead>
                <TableHead className="text-right">90+ Days</TableHead>
                <TableHead className="text-right">Total Due</TableHead>
                <TableHead className="text-right">Net Balance</TableHead>
                <TableHead className="text-right">Credit Limit</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.filter((c) => parseFloat(c.balance || "0") !== 0 || c.aging?.[0])
                .length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="text-center py-8 text-gray-500"
                  >
                    No outstanding balances
                  </TableCell>
                </TableRow>
              ) : (
                customers
                  .filter((c) => parseFloat(c.balance || "0") !== 0 || c.aging?.[0])
                  .sort(
                    (a, b) =>
                      parseFloat(b.balance || "0") - parseFloat(a.balance || "0")
                  )
                  .map((customer) => {
                    const aging = customer.aging?.[0];
                    const over90 = parseFloat(aging?.days_over_90 || "0");
                    const balance = parseFloat(customer.balance || "0");
                    const creditLimit = customer.credit_limit
                      ? parseFloat(customer.credit_limit)
                      : null;
                    const overLimit =
                      creditLimit !== null && balance > creditLimit;

                    return (
                      <TableRow
                        key={customer.id}
                        className={
                          over90 > 0
                            ? "bg-red-50"
                            : overLimit
                            ? "bg-yellow-50"
                            : ""
                        }
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {customer.business_name || "—"}
                            </p>
                            <p className="text-xs text-gray-500">
                              {customer.email}
                            </p>
                            <p className="text-xs text-gray-400">
                              {customer.payment_terms} day terms
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(parseFloat(aging?.current || "0"))}
                        </TableCell>
                        <TableCell className="text-right text-yellow-700 font-medium">
                          {formatCurrency(parseFloat(aging?.days_1_30 || "0"))}
                        </TableCell>
                        <TableCell className="text-right text-orange-700 font-medium">
                          {formatCurrency(parseFloat(aging?.days_31_60 || "0"))}
                        </TableCell>
                        <TableCell className="text-right text-red-600 font-medium">
                          {formatCurrency(parseFloat(aging?.days_61_90 || "0"))}
                        </TableCell>
                        <TableCell
                          className="text-right font-bold"
                          style={{
                            color: over90 > 0 ? "#CE1126" : "inherit",
                          }}
                        >
                          {formatCurrency(over90)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-lg">
                          {formatCurrency(
                            parseFloat(
                              aging?.total_due || customer.balance || "0"
                            )
                          )}
                        </TableCell>
                        <TableCell
                          className="text-right font-bold text-lg"
                          style={{ color: "#CE1126" }}
                        >
                          {formatCurrency(parseFloat(customer.balance || "0"))}
                        </TableCell>
                        <TableCell className="text-right">
                          {creditLimit !== null ? (
                            <span
                              className={
                                overLimit ? "text-red-600 font-bold" : ""
                              }
                            >
                              {formatCurrency(creditLimit)}
                              {overLimit && " ⚠️"}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/admin/ar/ledger/${customer.id}`}
                            className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md text-white hover:opacity-90"
                            style={{ backgroundColor: "#006A4E" }}
                          >
                            📊 Ledger
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-lg shadow-md mb-8">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <DollarSign className="h-5 w-5" style={{ color: "#006A4E" }} />
            Recent Transactions
          </h2>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Balance After</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentTx.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-8 text-gray-500"
                  >
                    No transactions yet
                  </TableCell>
                </TableRow>
              ) : (
                recentTx.map((tx) => {
                  const isDebit = ["invoice", "charge", "late_fee"].includes(
                    tx.type
                  );
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm">
                        {formatDateSafe(tx.created_at)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {(tx.customers as any)?.business_name || "—"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            isDebit
                              ? "bg-red-100 text-red-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {tx.type}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">
                        {tx.description || "—"}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          isDebit ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        {isDebit ? "" : "-"}
                        {formatCurrency(parseFloat(tx.amount))}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {tx.balance_after !== null
                          ? formatCurrency(parseFloat(tx.balance_after))
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDateSafe(tx.due_date)}
                      </TableCell>
                      <TableCell>
                        {tx.paid_date ? (
                          <span className="text-green-600 text-sm">
                            ✅ {formatDateSafe(tx.paid_date)}
                          </span>
                        ) : isDebit ? (
                          <span className="text-yellow-600 text-sm">
                            ⏳ Unpaid
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Email Log */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold">📧 Email Log</h2>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emailLog.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-8 text-gray-500"
                  >
                    No emails sent yet
                  </TableCell>
                </TableRow>
              ) : (
                emailLog.map((email) => (
                  <TableRow key={email.id}>
                    <TableCell className="text-sm">
                      {formatDateSafe(email.sent_at)}
                    </TableCell>
                    <TableCell>
                      {(email.customers as any)?.business_name || "—"}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800">
                        {email.type}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{email.subject}</TableCell>
                    <TableCell>
                      <span
                        className={`text-sm ${
                          email.status === "sent"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {email.status === "sent"
                          ? "✅ Sent"
                          : "❌ " + email.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
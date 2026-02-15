import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function TestAuthPage() {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  // Get customer record
  let customer = null;
  if (user) {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("id", user.id)
      .single();
    customer = data;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">🔍 Authentication Test</h1>

      <div className="bg-white rounded-lg shadow p-6 mb-4">
        <h2 className="text-xl font-semibold mb-4">User Session</h2>
        {userError ? (
          <div className="bg-red-50 p-4 rounded">
            <p className="text-red-700">❌ Error: {userError.message}</p>
          </div>
        ) : user ? (
          <div className="space-y-2">
            <p className="text-green-600 font-semibold">✅ Authenticated</p>
            <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
              {JSON.stringify(user, null, 2)}
            </pre>
          </div>
        ) : (
          <p className="text-yellow-600">⚠️ No user session found</p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Customer Record</h2>
        {customer ? (
          <div className="space-y-2">
            <p className="text-green-600 font-semibold">✅ Customer Found</p>
            <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
              {JSON.stringify(customer, null, 2)}
            </pre>
            <div className="mt-4 p-4 bg-blue-50 rounded">
  <p className="font-semibold">Admin Status:</p>
  <p className={
    ['debs_bakery@outlook.com'].includes(customer.email?.toLowerCase() || '')
      ? 'text-green-600' 
      : 'text-red-600'
  }>
    {['debs_bakery@outlook.com'].includes(customer.email?.toLowerCase() || '')
      ? '✅ IS ADMIN (email in whitelist)' 
      : '❌ NOT ADMIN (email not in whitelist)'}
  </p>
  <p className="text-sm text-gray-600 mt-2">
    Current email: <code className="bg-gray-200 px-1 rounded">{customer.email}</code>
  </p>
</div>
          </div>
        ) : (
          <p className="text-yellow-600">⚠️ No customer record found</p>
        )}
      </div>

      <div className="mt-6 flex gap-4">
        <a
          href="/admin"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          ← Back to Admin
        </a>
        <a
          href="/admin/ar"
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Try AR Dashboard →
        </a>
      </div>
    </div>
  );
}
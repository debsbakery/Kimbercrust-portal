import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-red-50">
      <div className="text-center space-y-8 p-8">
        {/* Logo/Title */}
        <div>
          <h1 className="text-6xl font-bold mb-2" style={{ color: "#006A4E" }}>
            Deb's Bakery
          </h1>
          <p className="text-xl text-gray-600">
            Wholesale Bread & Bakery Products
          </p>
        </div>

        {/* Navigation Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            href="/shop"
            className="px-8 py-4 rounded-lg text-white font-semibold text-lg shadow-lg hover:shadow-xl transition-shadow w-64"
            style={{ backgroundColor: "#006A4E" }}
          >
            🛒 Browse Products
          </Link>
          <Link
            href="/portal"
            className="px-8 py-4 rounded-lg text-white font-semibold text-lg shadow-lg hover:shadow-xl transition-shadow w-64"
            style={{ backgroundColor: "#CE1126" }}
          >
            👤 Customer Portal
          </Link>
          <Link
            href="/admin"
            className="px-8 py-4 rounded-lg border-2 font-semibold text-lg shadow-lg hover:shadow-xl transition-shadow w-64"
            style={{ borderColor: "#006A4E", color: "#006A4E" }}
          >
            🔐 Admin Login
          </Link>
        </div>

        {/* Info */}
        <div className="text-sm text-gray-500 mt-8">
          <p>Fresh daily deliveries • Online ordering • Flexible standing orders</p>
        </div>
      </div>
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, ArrowRight, Package, FileDown } from "lucide-react";

export default function OrderSuccessPage() {
  const searchParams = useSearchParams();
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      setOrderId(id);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #E6F5F0 0%, #FEE7E9 100%)' }}>
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-8 text-center">
        {/* Success Icon */}
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#E6F5F0' }}>
          <CheckCircle className="h-12 w-12" style={{ color: '#006A4E' }} />
        </div>

        <h1 className="text-2xl font-bold mb-4" style={{ color: '#000000' }}>Order Submitted!</h1>

        {/* Order Number */}
        {orderId && (
          <div className="bg-gray-100 p-4 rounded-lg mb-4">
            <p className="text-sm text-gray-600 mb-1">Order Number</p>
            <p className="text-2xl font-bold font-mono">#{orderId.slice(0, 8).toUpperCase()}</p>
          </div>
        )}

        {/* Confirmation Message */}
        <p className="text-gray-600 mb-6">
          Thank you for your order! We have sent a confirmation email with all
          the details. Our team will start preparing your order soon.
        </p>

        {/* Download Invoice Button */}
        {orderId && (
          <div className="mb-4">
            <a
              href={`/api/invoice/${orderId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-md text-white font-medium hover:opacity-90 transition-opacity shadow-md"
              style={{ backgroundColor: '#006A4E' }}
            >
              <FileDown className="h-5 w-5" />
              Download Invoice
            </a>
          </div>
        )}

        {/* Info Box */}
        <div className="p-4 rounded-lg border mb-6" style={{ backgroundColor: '#FEE7E9', borderColor: '#CE1126' }}>
          <Package className="h-5 w-5 mx-auto mb-2" style={{ color: '#CE1126' }} />
          <p className="text-sm" style={{ color: '#CE1126' }}>
            You will receive updates about your order status via email.
          </p>
        </div>

        {/* Continue Shopping Button */}
        <Link href="/catalog">
          <button className="w-full text-white px-6 py-3 rounded-md hover:opacity-90 font-medium flex items-center justify-center gap-2 transition-opacity shadow-md" style={{ backgroundColor: '#CE1126' }}>
            Continue Shopping
            <ArrowRight className="h-4 w-4" />
          </button>
        </Link>
      </div>
    </div>
  );
}
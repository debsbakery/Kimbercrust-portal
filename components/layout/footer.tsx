export function Footer() {
  return (
    <footer className="border-t bg-stone-50">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-bold text-2xl mb-4 bg-gradient-to-r from-amber-700 to-amber-900 bg-clip-text text-transparent">
              Brans
            </h3>
            <p className="text-sm text-gray-600">
              Premium wholesale bread for your business. Fresh, quality, reliable.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Contact</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>📧 orders@brans.com.au</li>
              <li>📞 (04) 1234-5678</li>
              <li>📍 Melbourne, Australia</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Delivery Hours</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>Monday - Friday</li>
              <li>Early morning delivery</li>
              <li>Order 48hrs in advance</li>
            </ul>
          </div>
        </div>
        
        <div className="mt-8 pt-8 border-t text-center text-sm text-gray-600">
          © {new Date().getFullYear()} Brans. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
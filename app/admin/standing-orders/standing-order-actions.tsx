'use client';

import { useState } from 'react';

export default function StandingOrderActions() {
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setResult(null);

    try {
      const response = await fetch('/api/standing-orders/generate', {
        method: 'POST',
      });

      const data = await response.json();
      setResult(data);
    } catch (error: any) {
      setResult({ error: error.message });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {generating ? '🔄 Generating...' : '🚀 Generate Orders Now'}
      </button>

      {result && (
        <div className={`mt-4 p-4 rounded-md ${result.error ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
          {result.error ? (
            <p className="text-red-700 font-semibold">❌ {result.error}</p>
          ) : (
            <>
              <p className="text-green-700 font-semibold">
                ✅ {result.message}
              </p>
              {result.ordersCreated > 0 && (
                <p className="text-sm text-gray-700 mt-2">
                  Created {result.ordersCreated} order(s)
                </p>
              )}
              {result.errors && result.errors.length > 0 && (
                <div className="mt-3 text-sm">
                  <p className="font-semibold text-orange-700">⚠️ Some errors occurred:</p>
                  <ul className="mt-1 space-y-1 text-orange-600">
                    {result.errors.map((err: any, idx: number) => (
                      <li key={idx}>• {err.customer}: {err.error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
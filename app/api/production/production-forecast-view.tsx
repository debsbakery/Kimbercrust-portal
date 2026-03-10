'use client';

import { useState, useEffect } from 'react';
import { Calendar, TrendingUp, AlertCircle, Eye, EyeOff } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ForecastDay {
  date: string;
  dayOfWeek: string;
  products: Record<string, any>;
  totalOrders: number;
  totalItems: number;
  confirmedOrders: number;
  standingOrderProjections: number;
  historicalProjections: number;
  customers: string[];
}

interface ProductSummary {
  product_id: string;
  product_number: number;
  product_name: string;
  unit: string;
  category: string;
  total_quantity: number;
  confirmed_quantity: number;
  standing_order_quantity: number;
  historical_quantity: number;
  days_ordered: number;
  avg_daily: number;
}

export default function ProductionForecastView() {
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [productSummary, setProductSummary] = useState<ProductSummary[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [includeHistorical, setIncludeHistorical] = useState(true);

  useEffect(() => {
    fetchForecast();
  }, [days, startDate, includeHistorical]);

  const fetchForecast = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/production/forecast?startDate=${startDate}&days=${days}&includeHistorical=${includeHistorical}`
      );
      const data = await response.json();

      setForecast(data.forecast || []);
      setProductSummary(data.productSummary || []);
      setStats(data.stats || {});
    } catch (error) {
      console.error('Failed to fetch forecast:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Generating forecast...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Forecast Period
            </label>
            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value={7}>Next 7 Days</option>
              <option value={14}>Next 14 Days</option>
              <option value={30}>Next 30 Days</option>
            </select>
          </div>

          <div className="flex items-center gap-3 px-4 py-2 border border-gray-300 rounded-md">
            <input
              type="checkbox"
              id="includeHistorical"
              checked={includeHistorical}
              onChange={(e) => setIncludeHistorical(e.target.checked)}
              className="h-4 w-4 text-blue-600"
            />
            <label htmlFor="includeHistorical" className="text-sm font-medium text-gray-700 cursor-pointer">
              {includeHistorical ? <Eye className="inline h-4 w-4 mr-1" /> : <EyeOff className="inline h-4 w-4 mr-1" />}
              Include Historical Patterns
            </label>
          </div>

          <button
            onClick={fetchForecast}
            className="px-6 py-2 text-white rounded-md hover:opacity-90"
            style={{ backgroundColor: '#ffffff' }}
          >
            🔄 Refresh
          </button>
        </div>

        {includeHistorical && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
            ℹ️ <strong>Historical forecasting enabled:</strong> System will predict orders for customers based on their ordering patterns from the last 4 weeks.
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4" style={{ borderColor: '#ffffff' }}>
          <p className="text-sm text-gray-600">Confirmed Orders</p>
          <p className="text-3xl font-bold" style={{ color: '#ffffff' }}>
            {stats.totalConfirmedOrders}
          </p>
          <p className="text-xs text-gray-500 mt-1">Actual orders placed</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4" style={{ borderColor: '#0066CC' }}>
          <p className="text-sm text-gray-600">Standing Orders</p>
          <p className="text-3xl font-bold" style={{ color: '#0066CC' }}>
            {stats.totalStandingOrderProjections}
          </p>
          <p className="text-xs text-gray-500 mt-1">Recurring customers</p>
        </div>

        {includeHistorical && (
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4" style={{ borderColor: '#FFD700' }}>
            <p className="text-sm text-gray-600">Historical Forecast</p>
            <p className="text-3xl font-bold" style={{ color: '#FF8C00' }}>
              {stats.totalHistoricalProjections}
            </p>
            <p className="text-xs text-gray-500 mt-1">Based on patterns</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4" style={{ borderColor: '#8B000' }}>
          <p className="text-sm text-gray-600">Total Products</p>
          <p className="text-3xl font-bold" style={{ color: '#8B000' }}>
            {stats.totalProducts}
          </p>
          <p className="text-xs text-gray-500 mt-1">Unique items</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4" style={{ borderColor: '#9333EA' }}>
          <p className="text-sm text-gray-600">Forecast Days</p>
          <p className="text-3xl font-bold" style={{ color: '#9333EA' }}>
            {stats.totalDays}
          </p>
          <p className="text-xs text-gray-500 mt-1">Planning period</p>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <h3 className="font-semibold mb-3 text-sm">Forecast Legend:</h3>
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="bg-green-100 text-green-800 px-2 py-1 rounded font-semibold">Confirmed</span>
            <span className="text-gray-600">Actual orders placed</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-blue-200 text-blue-900 px-2 py-1 rounded border border-blue-300">Standing Order</span>
            <span className="text-gray-600">Recurring weekly orders</span>
          </div>
          {includeHistorical && (
            <div className="flex items-center gap-2">
              <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded border border-orange-300">Historical</span>
              <span className="text-gray-600">Predicted from past orders</span>
            </div>
          )}
        </div>
      </div>

      {/* Daily Forecast */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5" style={{ color: '#ffffff' }} />
            Daily Production Forecast
          </h2>
        </div>
        <div className="overflow-x-auto">
          {forecast.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No orders or forecasts in the selected period
            </div>
          ) : (
            forecast.map((day) => {
              const hasConfirmed = day.confirmedOrders > 0;
              const hasStanding = day.standingOrderProjections > 0;
              const hasHistorical = day.historicalProjections > 0;
              
              let bgColor = 'bg-gray-50';
              if (hasConfirmed) bgColor = 'bg-green-50';
              else if (hasStanding) bgColor = 'bg-blue-50';
              else if (hasHistorical) bgColor = 'bg-orange-50';

              return (
                <div key={day.date} className="border-b last:border-b-0">
                  <div className={`p-4 ${bgColor}`}>
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-bold text-lg">
                          {day.dayOfWeek} - {formatDate(day.date)}
                        </h3>
                        <div className="flex gap-3 mt-1 text-sm">
                          {day.confirmedOrders > 0 && (
                            <span className="font-semibold text-green-700">
                              ✅ {day.confirmedOrders} confirmed
                            </span>
                          )}
                          {day.standingOrderProjections > 0 && (
                            <span className="font-semibold text-blue-700">
                              🔄 {day.standingOrderProjections} standing
                            </span>
                          )}
                          {day.historicalProjections > 0 && (
                            <span className="font-semibold text-orange-700">
                              📊 {day.historicalProjections} historical
                            </span>
                          )}
                          <span className="text-gray-600">
                            • {day.totalItems} items total
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead>Forecast Breakdown</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.values(day.products)
                          .sort((a: any, b: any) => a.product_number - b.product_number)
                          .map((product: any) => (
                            <TableRow key={product.product_id}>
                              <TableCell className="font-mono text-sm">
                                #{product.product_number}
                              </TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{product.product_name}</p>
                                  <p className="text-xs text-gray-500">{product.category}</p>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="font-bold text-lg">
                                  {product.quantity}
                                </span>
                                <span className="text-sm text-gray-500 ml-1">
                                  {product.unit}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2 text-xs flex-wrap">
                                  {product.sources.manual > 0 && (
                                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded font-semibold">
                                      Manual: {product.sources.manual}
                                    </span>
                                  )}
                                  {product.sources.standing_order_confirmed > 0 && (
                                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded font-semibold">
                                      Standing (Confirmed): {product.sources.standing_order_confirmed}
                                    </span>
                                  )}
                                  {product.sources.standing_order_projected > 0 && (
                                    <span className="bg-blue-200 text-blue-900 px-2 py-1 rounded border border-blue-300">
                                      Standing: {product.sources.standing_order_projected}
                                    </span>
                                  )}
                                  {product.sources.historical_projected > 0 && (
                                    <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded border border-orange-300">
                                      Historical: {product.sources.historical_projected}
                                    </span>
                                  )}
                                  {product.sources.online > 0 && (
                                    <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
                                      Online: {product.sources.online}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Product Summary */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp className="h-5 w-5" style={{ color: '#8B000' }} />
            Product Summary ({productSummary.length} products)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Total Qty</TableHead>
                <TableHead className="text-right">Confirmed</TableHead>
                <TableHead className="text-right">Standing</TableHead>
                {includeHistorical && (
                  <TableHead className="text-right">Historical</TableHead>
                )}
                <TableHead className="text-right">Days</TableHead>
                <TableHead className="text-right">Avg/Day</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productSummary.map((product) => (
                <TableRow key={product.product_id}>
                  <TableCell className="font-mono text-sm">
                    #{product.product_number}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{product.product_name}</p>
                      <p className="text-xs text-gray-500">{product.category}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {product.total_quantity} {product.unit}
                  </TableCell>
                  <TableCell className="text-right text-green-700 font-semibold">
                    {product.confirmed_quantity}
                  </TableCell>
                  <TableCell className="text-right text-blue-700">
                    {product.standing_order_quantity}
                  </TableCell>
                  {includeHistorical && (
                    <TableCell className="text-right text-orange-700">
                      {product.historical_quantity}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    {product.days_ordered} / {days}
                  </TableCell>
                  <TableCell className="text-right">
                    {product.avg_daily.toFixed(1)} {product.unit}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
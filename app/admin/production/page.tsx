export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { checkAdmin } from "@/lib/auth";
import { ArrowLeft, Package } from "lucide-react";
import ProductionSheetLauncher from "./production-sheet-launcher";
import ProductionForecastToggle from "./production-forecast-toggle";

export default async function ProductionDashboardPage() {
  const isAdmin = await checkAdmin();
  if (!isAdmin) redirect("/");

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <a
          href="/admin"
          className="flex items-center gap-1 text-sm mb-4 hover:opacity-80"
          style={{ color: "#8B000" }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Admin
        </a>
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Package className="h-8 w-8" style={{ color: "#1a1a1a" }} />
              Production
            </h1>
            <p className="text-gray-600">
              Print production sheets for baking
            </p>
          </div>
        </div>
      </div>

      <ProductionSheetLauncher inline />

      <ProductionForecastToggle />

    </div>
  );
}

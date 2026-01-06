import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type PositionRow = {
  symbol: string;
  quantity: number;
  avg_cost: number;
  market_price: number;
};

export default async function CommandCenterPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {}, // no-op on server
      },
    }
  );

  const { data: rows, error } = await supabase
    .from("positions")
    .select("symbol, quantity, avg_cost, market_price");

  if (error) {
    return (
      <div className="text-red-400">
        Failed to load positions: {error.message}
      </div>
    );
  }

  const grouped = new Map<
    string,
    {
      quantity: number;
      costBasis: number;
      marketValue: number;
    }
  >();

  (rows as PositionRow[] | null)?.forEach((p) => {
    const cost = p.quantity * p.avg_cost;
    const value = p.quantity * p.market_price;

    if (!grouped.has(p.symbol)) {
      grouped.set(p.symbol, {
        quantity: 0,
        costBasis: 0,
        marketValue: 0,
      });
    }

    const g = grouped.get(p.symbol)!;
    g.quantity += p.quantity;
    g.costBasis += cost;
    g.marketValue += value;
  });

  const data = Array.from(grouped.entries())
    .map(([symbol, g]) => ({
      symbol,
      quantity: g.quantity,
      costBasis: g.costBasis,
      marketValue: g.marketValue,
      pnl: g.marketValue - g.costBasis,
    }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  const totalCostBasis = data.reduce((s, r) => s + r.costBasis, 0);
  const totalMarketValue = data.reduce((s, r) => s + r.marketValue, 0);
  const totalPnl = totalMarketValue - totalCostBasis;

  const fmtMoney = (n: number) =>
    n.toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Command Center</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Live positions • read-only (Phase 1)
        </p>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Symbols" value={data.length.toString()} />
        <StatCard label="Cost Basis" value={`$${fmtMoney(totalCostBasis)}`} />
        <StatCard
          label="Market Value"
          value={`$${fmtMoney(totalMarketValue)}`}
        />
        <StatCard
          label="Unrealized P&L"
          value={`${totalPnl >= 0 ? "+" : "-"}$${fmtMoney(Math.abs(totalPnl))}`}
          valueClass={totalPnl >= 0 ? "text-green-400" : "text-red-400"}
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-800/50 text-zinc-300">
            <tr>
              <th className="px-4 py-3 text-left">Symbol</th>
              <th className="px-4 py-3 text-right">Quantity</th>
              <th className="px-4 py-3 text-right">Cost Basis</th>
              <th className="px-4 py-3 text-right">Market Value</th>
              <th className="px-4 py-3 text-right">Unrealized P&amp;L</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-800">
            {data.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-zinc-400"
                >
                  No positions yet
                </td>
              </tr>
            )}

            {data.map((row) => (
              <tr key={row.symbol}>
                <td className="px-4 py-3 font-medium">{row.symbol}</td>

                <td className="px-4 py-3 text-right">
                  {row.quantity.toLocaleString()}
                </td>

                <td className="px-4 py-3 text-right">
                  ${fmtMoney(row.costBasis)}
                </td>

                <td className="px-4 py-3 text-right">
                  ${fmtMoney(row.marketValue)}
                </td>

                <td
                  className={`px-4 py-3 text-right font-medium ${
                    row.pnl >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {row.pnl >= 0 ? "+" : "-"}$
                  {fmtMoney(Math.abs(row.pnl))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
      <p className="text-sm text-zinc-400 mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${valueClass ?? ""}`}>{value}</p>
    </div>
  );
}

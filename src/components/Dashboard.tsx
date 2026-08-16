import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TrendingUp, TrendingDown, Wallet, PieChart, Activity, Newspaper,
  LogOut, RefreshCw, ArrowUpRight, ArrowDownRight, Clock,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Stock, Profile, Holding, Transaction, MarketEvent, PortfolioPoint } from "@/lib/supabase";
import { useMarketTick } from "@/lib/hooks";
import PortfolioChart from "@/components/PortfolioChart";
import TradeModal from "@/components/TradeModal";

interface Props {
  userId: string;
  email?: string;
  onSignOut: () => void;
}

type Tab = "market" | "portfolio" | "history";

export default function Dashboard({ userId, email, onSignOut }: Props) {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [history, setHistory] = useState<PortfolioPoint[]>([]);
  const [tab, setTab] = useState<Tab>("market");
  const [tradeStock, setTradeStock] = useState<Stock | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const { lastTick } = useMarketTick(25000);

  const loadAll = useCallback(async () => {
    const [s, p, h, t, e, hist] = await Promise.all([
      supabase.from("stocks").select("*").order("ticker"),
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("holdings").select("*, stock:stocks(*)").eq("user_id", userId),
      supabase.from("transactions").select("*, stock:stocks(*)").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
      supabase.from("market_events").select("*, stock:stocks(ticker,name)").order("fired_at", { ascending: false }).limit(20),
      supabase.from("portfolio_history").select("id, recorded_at, cash, holdings_value, total").eq("user_id", userId).order("recorded_at", { ascending: true }).limit(120),
    ]);
    setStocks((s.data as Stock[]) || []);
    setProfile((p.data as Profile) || null);
    setHoldings((h.data as Holding[]) || []);
    setTransactions((t.data as Transaction[]) || []);
    setEvents((e.data as MarketEvent[]) || []);
    setHistory((hist.data as PortfolioPoint[]) || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // refresh whenever a market tick completes
  useEffect(() => { if (lastTick) loadAll(); }, [lastTick, loadAll]);

  const stockMap = useMemo(() => {
    const m = new Map<string, Stock>();
    stocks.forEach((s) => m.set(s.id, s));
    return m;
  }, [stocks]);

  const holdingsValue = useMemo(
    () => holdings.reduce((sum, h) => sum + (stockMap.get(h.stock_id)?.current_price ?? 0) * h.quantity, 0),
    [holdings, stockMap]
  );
  const totalValue = (profile?.cash ?? 0) + holdingsValue;
  const pnl = totalValue - (profile?.starting_cash ?? 10000);
  const pnlPct = ((pnl / (profile?.starting_cash ?? 10000)) * 100);

  const ownedQty = (stockId: string) => holdings.find((h) => h.stock_id === stockId)?.quantity ?? 0;

  const flashToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-400 to-sky-500 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-slate-950" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="font-bold tracking-tight leading-none">TradeQuest</h1>
              <p className="text-[10px] text-slate-500 leading-none mt-0.5">{email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
              <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              Market live
            </div>
            <button onClick={onSignOut} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition">
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Total portfolio value"
            value={`$${totalValue.toFixed(2)}`}
            icon={<PieChart className="w-4 h-4" />}
            accent="default"
          />
          <StatCard
            label="Virtual cash"
            value={`$${(profile?.cash ?? 0).toFixed(2)}`}
            icon={<Wallet className="w-4 h-4" />}
            accent="default"
          />
          <StatCard
            label="Holdings value"
            value={`$${holdingsValue.toFixed(2)}`}
            icon={<TrendingUp className="w-4 h-4" />}
            accent="default"
          />
          <StatCard
            label="Profit / loss"
            value={`${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`}
            sub={`${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%`}
            icon={pnl >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            accent={pnl >= 0 ? "up" : "down"}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart */}
          <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-semibold">Portfolio performance</h2>
                <p className="text-xs text-slate-500">Total value over time vs. $10,000 starting cash</p>
              </div>
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${pnl >= 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"}`}>
                {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
              </span>
            </div>
            <PortfolioChart points={history} startingCash={profile?.starting_cash ?? 10000} />
          </div>

          {/* Market events feed */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Newspaper className="w-4 h-4 text-sky-400" />
              <h2 className="font-semibold">Market feed</h2>
            </div>
            <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
              {events.length === 0 && (
                <p className="text-sm text-slate-500 py-4 text-center">Waiting for the first market event…</p>
              )}
              {events.map((ev) => (
                <div key={ev.id} className="border-l-2 pl-3 py-1" style={{
                  borderColor: ev.impact === "positive" ? "#34d399" : ev.impact === "negative" ? "#fb7185" : "#64748b",
                }}>
                  <p className="text-sm text-slate-200 leading-snug">{ev.headline}</p>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                    <span className="font-medium text-slate-400">{ev.stock?.ticker ?? "MARKET"}</span>
                    <span className={ev.impact === "positive" ? "text-emerald-400" : ev.impact === "negative" ? "text-rose-400" : "text-slate-400"}>
                      {ev.magnitude_pct >= 0 ? "+" : ""}{ev.magnitude_pct.toFixed(2)}%
                    </span>
                    <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{timeAgo(ev.fired_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-slate-900/60 border border-slate-800 rounded-xl w-full sm:w-auto sm:inline-flex">
          {(["market", "portfolio", "history"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition capitalize ${
                tab === t ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t === "market" ? "Market" : t === "portfolio" ? "My holdings" : "Trade history"}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "market" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {stocks.map((s) => {
              const change = s.previous_close ? ((s.current_price - s.previous_close) / s.previous_close) * 100 : 0;
              const dayUp = change >= 0;
              const sinceBase = ((s.current_price - s.base_price) / s.base_price) * 100;
              return (
                <button
                  key={s.id}
                  onClick={() => setTradeStock(s)}
                  className="text-left bg-slate-900/60 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition group hover:bg-slate-900"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-100">{s.ticker}</span>
                    <span className="text-[10px] uppercase tracking-wide text-slate-500 bg-slate-800/60 px-1.5 py-0.5 rounded">{s.sector}</span>
                  </div>
                  <p className="text-xs text-slate-400 truncate mb-3">{s.name}</p>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-lg font-bold text-slate-100">${s.current_price.toFixed(2)}</p>
                      <p className={`text-xs font-medium ${dayUp ? "text-emerald-400" : "text-rose-400"}`}>
                        {dayUp ? "+" : ""}{change.toFixed(2)}%
                      </p>
                    </div>
                    <div className={`text-[10px] px-1.5 py-0.5 rounded ${sinceBase >= 0 ? "text-emerald-400/80" : "text-rose-400/80"}`}>
                      {sinceBase >= 0 ? "+" : ""}{sinceBase.toFixed(1)}% all-time
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {tab === "portfolio" && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
            {holdings.length === 0 ? (
              <p className="text-sm text-slate-500 py-12 text-center">You don't own any shares yet. Head to the Market tab to make your first trade.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 uppercase tracking-wide border-b border-slate-800">
                  <tr>
                    <th className="text-left font-medium px-4 py-3">Stock</th>
                    <th className="text-right font-medium px-4 py-3">Shares</th>
                    <th className="text-right font-medium px-4 py-3">Avg. cost</th>
                    <th className="text-right font-medium px-4 py-3">Price</th>
                    <th className="text-right font-medium px-4 py-3">Value</th>
                    <th className="text-right font-medium px-4 py-3">P/L</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h) => {
                    const s = stockMap.get(h.stock_id);
                    if (!s) return null;
                    const value = s.current_price * h.quantity;
                    const cost = h.avg_cost * h.quantity;
                    const pl = value - cost;
                    const plPct = cost > 0 ? (pl / cost) * 100 : 0;
                    return (
                      <tr key={h.id} className="border-b border-slate-800/60 last:border-0">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-100">{s.ticker}</div>
                          <div className="text-xs text-slate-500">{s.name}</div>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-300">{h.quantity.toFixed(4)}</td>
                        <td className="px-4 py-3 text-right text-slate-300">${h.avg_cost.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-slate-300">${s.current_price.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-100">${value.toFixed(2)}</td>
                        <td className={`px-4 py-3 text-right font-medium ${pl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {pl >= 0 ? "+" : ""}${pl.toFixed(2)}
                          <span className="block text-xs font-normal opacity-80">{plPct >= 0 ? "+" : ""}{plPct.toFixed(2)}%</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => setTradeStock(s)} className="text-xs text-emerald-400 hover:text-emerald-300 font-medium">Trade</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === "history" && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
            {transactions.length === 0 ? (
              <p className="text-sm text-slate-500 py-12 text-center">No trades yet. Your buy and sell activity will show up here.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 uppercase tracking-wide border-b border-slate-800">
                  <tr>
                    <th className="text-left font-medium px-4 py-3">When</th>
                    <th className="text-left font-medium px-4 py-3">Action</th>
                    <th className="text-left font-medium px-4 py-3">Stock</th>
                    <th className="text-right font-medium px-4 py-3">Shares</th>
                    <th className="text-right font-medium px-4 py-3">Price</th>
                    <th className="text-right font-medium px-4 py-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id} className="border-b border-slate-800/60 last:border-0">
                      <td className="px-4 py-3 text-slate-400 text-xs">{new Date(t.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${t.action === "buy" ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"}`}>
                          {t.action.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-200 font-medium">{t.stock?.ticker}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{t.quantity.toFixed(4)}</td>
                      <td className="px-4 py-3 text-right text-slate-300">${t.price.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-100">${t.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>

      {tradeStock && profile && (
        <TradeModal
          stock={tradeStock}
          cash={profile.cash}
          ownedQty={ownedQty(tradeStock.id)}
          onClose={() => setTradeStock(null)}
          onDone={() => {
            setTradeStock(null);
            loadAll();
            flashToast("Trade completed");
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-slate-950 text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg animate-in">
          {toast}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label, value, sub, icon, accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent: "default" | "up" | "down";
}) {
  const accentColor =
    accent === "up" ? "text-emerald-400" : accent === "down" ? "text-rose-400" : "text-slate-300";
  const iconBg =
    accent === "up" ? "bg-emerald-500/15 text-emerald-400"
    : accent === "down" ? "bg-rose-500/15 text-rose-400"
    : "bg-slate-800 text-slate-300";
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400">{label}</span>
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconBg}`}>{icon}</span>
      </div>
      <p className={`text-xl font-bold ${accentColor}`}>{value}</p>
      {sub && <p className={`text-xs ${accentColor} opacity-80 mt-0.5`}>{sub}</p>}
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

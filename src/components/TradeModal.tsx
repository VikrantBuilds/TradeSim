import { useState } from "react";
import { X, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import type { Stock } from "@/lib/supabase";
import { executeTrade } from "@/lib/trade";

interface Props {
  stock: Stock;
  cash: number;
  ownedQty: number;
  onClose: () => void;
  onDone: () => void;
}

export default function TradeModal({ stock, cash, ownedQty, onClose, onDone }: Props) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [qty, setQty] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const price = stock.current_price;
  const n = parseFloat(qty) || 0;
  const total = Math.round(n * price * 100) / 100;
  const maxBuy = Math.floor((cash / price) * 10000) / 10000;
  const change = stock.previous_close ? ((price - stock.previous_close) / stock.previous_close) * 100 : 0;
  const up = change >= 0;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await executeTrade(side, stock.id, n, price);
    setBusy(false);
    if (!res.ok) {
      setError(res.error || "Trade failed.");
      return;
    }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-sm text-emerald-400">
              {stock.ticker.slice(0, 2)}
            </div>
            <div>
              <h3 className="font-semibold text-slate-100">{stock.ticker}</h3>
              <p className="text-xs text-slate-400">{stock.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-slate-400">Current price</p>
              <p className="text-2xl font-bold text-slate-100">${price.toFixed(2)}</p>
            </div>
            <div className={`flex items-center gap-1 text-sm font-medium ${up ? "text-emerald-400" : "text-rose-400"}`}>
              {up ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {up ? "+" : ""}{change.toFixed(2)}%
            </div>
          </div>

          <div className="flex gap-1 p-1 bg-slate-800/60 rounded-lg">
            <button
              onClick={() => { setSide("buy"); setError(null); }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition ${side === "buy" ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-slate-200"}`}
            >
              Buy
            </button>
            <button
              onClick={() => { setSide("sell"); setError(null); }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition ${side === "sell" ? "bg-rose-500 text-slate-950" : "text-slate-400 hover:text-slate-200"}`}
            >
              Sell
            </button>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">Quantity (shares)</label>
            <input
              type="number"
              min="0"
              step="0.0001"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 transition"
              placeholder="0"
            />
            <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
              <span>{side === "buy" ? "Available cash" : "You own"}: <span className="text-slate-300">{side === "buy" ? `$${cash.toFixed(2)}` : `${ownedQty.toFixed(4)} sh`}</span></span>
              <button
                type="button"
                onClick={() => setQty(String(side === "buy" ? Math.floor(maxBuy * 100) / 100 : Math.floor(ownedQty * 100) / 100))}
                className="text-emerald-400 hover:text-emerald-300 font-medium"
              >
                Max
              </button>
            </div>
          </div>

          <div className="bg-slate-800/40 rounded-lg p-3 flex items-center justify-between">
            <span className="text-sm text-slate-400">Estimated total</span>
            <span className="text-lg font-bold text-slate-100">${total.toFixed(2)}</span>
          </div>

          {error && (
            <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            onClick={submit}
            disabled={busy || n <= 0}
            className={`w-full font-semibold rounded-lg py-2.5 text-sm transition flex items-center justify-center gap-2 disabled:opacity-50 ${
              side === "buy" ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950" : "bg-rose-500 hover:bg-rose-400 text-slate-950"
            }`}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : `${side === "buy" ? "Buy" : "Sell"} ${n > 0 ? n + " " + stock.ticker : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

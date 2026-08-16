import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface StockRow {
  id: string;
  ticker: string;
  name: string;
  current_price: number;
}

interface EventTemplate {
  impact: "positive" | "negative" | "neutral";
  minPct: number;
  maxPct: number;
  templates: string[];
}

const POSITIVE_EVENTS: EventTemplate = {
  impact: "positive",
  minPct: 2,
  maxPct: 12,
  templates: [
    "{name} reports strong quarterly earnings, beating expectations.",
    "{name} announces a breakthrough product launch.",
    "{name} signs a major new partnership deal.",
    "{name} wins a large government contract.",
    "{name} raises its full-year revenue guidance.",
    "{name} completes a successful acquisition, expanding market reach.",
    "{name} sees record customer growth this quarter.",
    "{name} announces a stock buyback program.",
  ],
};

const NEGATIVE_EVENTS: EventTemplate = {
  impact: "negative",
  minPct: -12,
  maxPct: -2,
  templates: [
    "{name} faces a class-action lawsuit over product safety.",
    "{name} misses earnings expectations, shares slide.",
    "{name} recalls a flagship product due to defects.",
    "{name} loses a key executive unexpectedly.",
    "{name} hit by a major supply chain disruption.",
    "{name} warns of slowing demand in its largest market.",
    "{name} faces increased regulatory scrutiny.",
    "{name} reports a data breach affecting customers.",
  ],
};

const NEUTRAL_EVENTS: EventTemplate = {
  impact: "neutral",
  minPct: -2,
  maxPct: 2,
  templates: [
    "{name} announces a routine leadership reshuffle.",
    "{name} files updated disclosures with regulators.",
    "{name} hosts its annual investor day.",
    "{name} comments on broader industry trends.",
  ],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fillTemplate(tpl: string, name: string): string {
  return tpl.replace(/\{name\}/g, name);
}

function magnitudePct(tpl: EventTemplate): number {
  const span = tpl.maxPct - tpl.minPct;
  return Math.round((tpl.minPct + Math.random() * span) * 100) / 100;
}

function newPrice(oldPrice: number, pct: number): number {
  const next = oldPrice * (1 + pct / 100);
  // Floor at $0.50 so a stock never goes to zero / negative.
  return Math.max(0.5, Math.round(next * 100) / 100);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Load all stocks
    const { data: stocks, error: stockErr } = await supabase
      .from("stocks")
      .select("id, ticker, name, current_price");
    if (stockErr) throw stockErr;
    if (!stocks || stocks.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "no stocks seeded yet" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Roll: ~60% chance one event fires per tick; ~30% two; ~10% zero.
    const roll = Math.random();
    const eventCount = roll < 0.1 ? 0 : roll < 0.4 ? 2 : 1;

    const updates: {
      stock: StockRow;
      template: EventTemplate;
      pct: number;
      next: number;
      headline: string;
    }[] = [];

    for (let i = 0; i < eventCount; i++) {
      const stock = pick(stocks);
      // Pick impact bucket: 50% positive, 40% negative, 10% neutral.
      const bucketRoll = Math.random();
      const template =
        bucketRoll < 0.5
          ? POSITIVE_EVENTS
          : bucketRoll < 0.9
          ? NEGATIVE_EVENTS
          : NEUTRAL_EVENTS;
      const pct = magnitudePct(template);
      const next = newPrice(Number(stock.current_price), pct);
      updates.push({
        stock,
        template,
        pct,
        next,
        headline: fillTemplate(pick(template.templates), stock.name),
      });
    }

    // Apply price updates + log events
    for (const u of updates) {
      const { error: upErr } = await supabase
        .from("stocks")
        .update({
          current_price: u.next,
          previous_close: Number(u.stock.current_price),
          updated_at: new Date().toISOString(),
        })
        .eq("id", u.stock.id);
      if (upErr) throw upErr;

      const { error: evErr } = await supabase
        .from("market_events")
        .insert({
          stock_id: u.stock.id,
          headline: u.headline,
          impact: u.template.impact,
          magnitude_pct: u.pct,
          old_price: Number(u.stock.current_price),
          new_price: u.next,
        });
      if (evErr) throw evErr;
    }

    // Snapshot every user's portfolio value for the chart
    const { data: profiles, error: profErr } = await supabase
      .from("profiles")
      .select("id, cash");
    if (profErr) throw profErr;

    if (profiles && profiles.length > 0) {
      const { data: allHoldings, error: holdErr } = await supabase
        .from("holdings")
        .select("user_id, stock_id, quantity");
      if (holdErr) throw holdErr;

      const priceMap = new Map<string, number>();
      for (const s of stocks) priceMap.set(s.id, Number(s.current_price));
      for (const u of updates) priceMap.set(u.stock.id, u.next);

      const rows = [];
      for (const p of profiles) {
        const cash = Number(p.cash);
        let holdingsValue = 0;
        if (allHoldings) {
          for (const h of allHoldings) {
            if (h.user_id === p.id) {
              const px = priceMap.get(h.stock_id) ?? 0;
              holdingsValue += px * Number(h.quantity);
            }
          }
        }
        const total = cash + holdingsValue;
        rows.push({
          user_id: p.id,
          cash,
          holdings_value: Math.round(holdingsValue * 100) / 100,
          total: Math.round(total * 100) / 100,
        });
      }
      if (rows.length > 0) {
        const { error: histErr } = await supabase
          .from("portfolio_history")
          .insert(rows);
        if (histErr) throw histErr;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, events: updates.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

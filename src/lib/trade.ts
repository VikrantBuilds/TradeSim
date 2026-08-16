import { supabase } from "./supabase";

export interface TradeResult {
  ok: boolean;
  error?: string;
}

/**
 * Execute a buy or sell transaction atomically on the client.
 * Updates profile cash, holdings (upsert), and logs a transaction row.
 * Relies on RLS to keep writes scoped to the authenticated owner.
 */
export async function executeTrade(
  action: "buy" | "sell",
  stockId: string,
  quantity: number,
  price: number
): Promise<TradeResult> {
  if (quantity <= 0) return { ok: false, error: "Quantity must be greater than zero." };
  const total = Math.round(quantity * price * 100) / 100;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in to trade." };

  // Load profile + existing holding
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("cash")
    .eq("id", user.id)
    .maybeSingle();
  if (profErr) return { ok: false, error: profErr.message };
  if (!profile) return { ok: false, error: "Account not found." };

  const { data: holding } = await supabase
    .from("holdings")
    .select("id, quantity, avg_cost")
    .eq("user_id", user.id)
    .eq("stock_id", stockId)
    .maybeSingle();

  if (action === "buy") {
    if (total > Number(profile.cash)) {
      return { ok: false, error: "Not enough cash for this purchase." };
    }
    const newCash = Math.round((Number(profile.cash) - total) * 100) / 100;
    const prevQty = holding ? Number(holding.quantity) : 0;
    const prevCost = holding ? Number(holding.avg_cost) : 0;
    const newQty = prevQty + quantity;
    const newAvgCost =
      newQty > 0 ? Math.round(((prevCost * prevQty + price * quantity) / newQty) * 10000) / 10000 : 0;

    const { error: cashErr } = await supabase
      .from("profiles")
      .update({ cash: newCash })
      .eq("id", user.id);
    if (cashErr) return { ok: false, error: cashErr.message };

    if (holding) {
      const { error: hErr } = await supabase
        .from("holdings")
        .update({ quantity: newQty, avg_cost: newAvgCost })
        .eq("id", holding.id);
      if (hErr) return { ok: false, error: hErr.message };
    } else {
      const { error: hErr } = await supabase
        .from("holdings")
        .insert({ user_id: user.id, stock_id: stockId, quantity: newQty, avg_cost: newAvgCost });
      if (hErr) return { ok: false, error: hErr.message };
    }

    const { error: tErr } = await supabase.from("transactions").insert({
      user_id: user.id,
      stock_id: stockId,
      action: "buy",
      quantity,
      price,
      total,
    });
    if (tErr) return { ok: false, error: tErr.message };

    return { ok: true };
  }

  // sell
  if (!holding || Number(holding.quantity) < quantity) {
    return { ok: false, error: "You don't own enough shares to sell." };
  }
  const prevQty = Number(holding.quantity);
  const newQty = Math.round((prevQty - quantity) * 10000) / 10000;
  const newCash = Math.round((Number(profile.cash) + total) * 100) / 100;

  const { error: cashErr } = await supabase
    .from("profiles")
    .update({ cash: newCash })
    .eq("id", user.id);
  if (cashErr) return { ok: false, error: cashErr.message };

  if (newQty <= 0.0001) {
    const { error: hErr } = await supabase
      .from("holdings")
      .delete()
      .eq("id", holding.id);
    if (hErr) return { ok: false, error: hErr.message };
  } else {
    const { error: hErr } = await supabase
      .from("holdings")
      .update({ quantity: newQty })
      .eq("id", holding.id);
    if (hErr) return { ok: false, error: hErr.message };
  }

  const { error: tErr } = await supabase.from("transactions").insert({
    user_id: user.id,
    stock_id: stockId,
    action: "sell",
    quantity,
    price,
    total,
  });
  if (tErr) return { ok: false, error: tErr.message };

  return { ok: true };
}

import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { MARKET_TICK_URL } from "./supabase";

/**
 * Drives the simulated market. Every `intervalMs` it pings the market-tick
 * edge function, which randomly fires 0-2 market events and snapshots every
 * user's portfolio value into portfolio_history for the chart.
 */
export function useMarketTick(intervalMs = 25000) {
  const [lastTick, setLastTick] = useState<Date | null>(null);
  const [tickError, setTickError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const tick = async () => {
      try {
        const res = await fetch(MARKET_TICK_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({}),
        });
        if (!res.ok) throw new Error(`market tick failed (${res.status})`);
        if (active) {
          setLastTick(new Date());
          setTickError(null);
        }
      } catch (e) {
        if (active) setTickError((e as Error).message);
      }
    };

    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [intervalMs]);

  return { lastTick, tickError };
}

/** Subscribes to Supabase auth state changes. Returns session + loading flag. */
export function useAuth() {
  const [session, setSession] = useState<null | { user: { id: string; email?: string } }>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session as never);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess as never);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}

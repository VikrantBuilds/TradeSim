import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export const MARKET_TICK_URL = `${url}/functions/v1/market-tick`;

export interface Stock {
  id: string;
  ticker: string;
  name: string;
  sector: string;
  current_price: number;
  previous_close: number;
  base_price: number;
  updated_at: string;
}

export interface Profile {
  id: string;
  cash: number;
  starting_cash: number;
  created_at: string;
}

export interface Holding {
  id: string;
  user_id: string;
  stock_id: string;
  quantity: number;
  avg_cost: number;
  stock?: Stock;
}

export interface Transaction {
  id: string;
  user_id: string;
  stock_id: string;
  action: "buy" | "sell";
  quantity: number;
  price: number;
  total: number;
  created_at: string;
  stock?: Stock;
}

export interface MarketEvent {
  id: string;
  stock_id: string | null;
  headline: string;
  impact: "positive" | "negative" | "neutral";
  magnitude_pct: number;
  old_price: number;
  new_price: number;
  fired_at: string;
  stock?: Pick<Stock, "ticker" | "name">;
}

export interface PortfolioPoint {
  id: string;
  recorded_at: string;
  cash: number;
  holdings_value: number;
  total: number;
}

/*
# Stock Trading Simulator — initial schema

## Overview
Creates a multi-user educational stock trading simulator. Each student signs up,
receives $10,000 virtual cash, and can buy/sell shares of 10 simulated companies.
Market events fire periodically and move stock prices, updating portfolio value.

## New Tables
1. `stocks` — shared market catalog (readable by all signed-in users; prices updated by edge function).
2. `profiles` — per-user cash balance ($10,000 default); created on signup via trigger.
3. `holdings` — current open positions per user per stock.
4. `transactions` — audit log of every buy/sell.
5. `portfolio_history` — per-user time series of total portfolio value (chart).
6. `market_events` — log of events that fired and the price changes they caused.

## Security / RLS
- Owner-scoped tables (profiles, holdings, transactions, portfolio_history): TO authenticated,
  ownership via auth.uid() = user_id. Owner columns default to auth.uid().
- stocks + market_events: readable by all authenticated (shared market data). Writes only
  via service role / edge functions — no anon/authenticated write policies.

## Notes
1. Trigger `handle_new_user` auto-creates a profile on signup so students start with $10,000.
2. holdings.quantity uses 4 decimals to support fractional shares.
*/

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- stocks (shared market catalog)
CREATE TABLE IF NOT EXISTS stocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker text UNIQUE NOT NULL,
  name text NOT NULL,
  sector text NOT NULL DEFAULT 'General',
  current_price numeric(12,2) NOT NULL DEFAULT 0,
  previous_close numeric(12,2) NOT NULL DEFAULT 0,
  base_price numeric(12,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE stocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authed_read_stocks" ON stocks;
CREATE POLICY "authed_read_stocks" ON stocks FOR SELECT
  TO authenticated USING (true);

-- profiles (per-user cash)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cash numeric(14,2) NOT NULL DEFAULT 10000,
  starting_cash numeric(14,2) NOT NULL DEFAULT 10000,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- holdings
CREATE TABLE IF NOT EXISTS holdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  stock_id uuid NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
  quantity numeric(12,4) NOT NULL DEFAULT 0,
  avg_cost numeric(12,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, stock_id)
);
ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_holdings" ON holdings;
CREATE POLICY "select_own_holdings" ON holdings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_holdings" ON holdings;
CREATE POLICY "insert_own_holdings" ON holdings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_holdings" ON holdings;
CREATE POLICY "update_own_holdings" ON holdings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_holdings" ON holdings;
CREATE POLICY "delete_own_holdings" ON holdings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- transactions
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  stock_id uuid NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('buy','sell')),
  quantity numeric(12,4) NOT NULL,
  price numeric(12,2) NOT NULL,
  total numeric(14,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_transactions" ON transactions;
CREATE POLICY "select_own_transactions" ON transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_transactions" ON transactions;
CREATE POLICY "insert_own_transactions" ON transactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_transactions" ON transactions;
CREATE POLICY "update_own_transactions" ON transactions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_transactions" ON transactions;
CREATE POLICY "delete_own_transactions" ON transactions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- portfolio_history
CREATE TABLE IF NOT EXISTS portfolio_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  cash numeric(14,2) NOT NULL,
  holdings_value numeric(14,2) NOT NULL,
  total numeric(14,2) NOT NULL
);
ALTER TABLE portfolio_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_history" ON portfolio_history;
CREATE POLICY "select_own_history" ON portfolio_history FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_history" ON portfolio_history;
CREATE POLICY "insert_own_history" ON portfolio_history FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_history" ON portfolio_history;
CREATE POLICY "update_own_history" ON portfolio_history FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_history" ON portfolio_history;
CREATE POLICY "delete_own_history" ON portfolio_history FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- market_events
CREATE TABLE IF NOT EXISTS market_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id uuid REFERENCES stocks(id) ON DELETE CASCADE,
  headline text NOT NULL,
  impact text NOT NULL CHECK (impact IN ('positive','negative','neutral')),
  magnitude_pct numeric(6,2) NOT NULL,
  old_price numeric(12,2) NOT NULL,
  new_price numeric(12,2) NOT NULL,
  fired_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE market_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authed_read_market_events" ON market_events;
CREATE POLICY "authed_read_market_events" ON market_events FOR SELECT
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_holdings_user ON holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_history_user ON portfolio_history(user_id);
CREATE INDEX IF NOT EXISTS idx_market_events_fired ON market_events(fired_at DESC);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon, authenticated;

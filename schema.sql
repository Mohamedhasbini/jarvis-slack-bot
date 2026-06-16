-- Jarvis Inference API — Supabase Schema
-- Run this in the Supabase SQL editor to set up all tables and functions.

-- Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR UNIQUE NOT NULL,
    password_hash VARCHAR NOT NULL,
    name VARCHAR,
    balance DECIMAL(12, 6) DEFAULT 5.000000,  -- $5 free trial
    tier VARCHAR NOT NULL DEFAULT 'free',       -- free | pro | enterprise
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- API Keys
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key VARCHAR UNIQUE NOT NULL,
    key_preview VARCHAR NOT NULL,              -- e.g. "sk-jarvis-abc123...ef90"
    name VARCHAR NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used TIMESTAMPTZ
);

-- Usage logs (immutable append-only billing record)
CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    api_key_id UUID REFERENCES api_keys(id),
    model VARCHAR NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cost DECIMAL(12, 8) NOT NULL DEFAULT 0,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast usage queries
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_timestamp ON usage_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);

-- RLS: users can only see their own rows
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- Server-side service key bypasses RLS; the app uses SUPABASE_SERVICE_KEY
-- so policies below are for safety if using the anon key from the frontend.

CREATE POLICY "users: own row" ON users FOR ALL USING (auth.uid() = id);
CREATE POLICY "api_keys: own rows" ON api_keys FOR ALL USING (
    user_id = (SELECT id FROM users WHERE auth.uid() = id LIMIT 1)
);
CREATE POLICY "usage_logs: own rows" ON usage_logs FOR SELECT USING (
    user_id = (SELECT id FROM users WHERE auth.uid() = id LIMIT 1)
);

-- Stored procedures for atomic balance operations
CREATE OR REPLACE FUNCTION deduct_balance(user_id_param UUID, amount_param DECIMAL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE users
    SET balance = balance - amount_param, updated_at = NOW()
    WHERE id = user_id_param;
END;
$$;

CREATE OR REPLACE FUNCTION add_balance(user_id_param UUID, amount_param DECIMAL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE users
    SET balance = balance + amount_param, updated_at = NOW()
    WHERE id = user_id_param;
END;
$$;

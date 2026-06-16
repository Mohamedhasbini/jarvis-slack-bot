-- Jarvis Inference API — Supabase Schema (complete, run once in SQL editor)
-- Re-running is safe — all statements use IF NOT EXISTS / OR REPLACE.

-- ─── TABLES ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                       VARCHAR UNIQUE NOT NULL,
    password_hash               VARCHAR NOT NULL,
    name                        VARCHAR,
    balance                     DECIMAL(12, 6) NOT NULL DEFAULT 5.000000,  -- $5 free trial
    tier                        VARCHAR NOT NULL DEFAULT 'free',             -- free | pro | enterprise
    -- Email verification
    is_email_verified           BOOLEAN NOT NULL DEFAULT FALSE,
    email_verification_token    VARCHAR,
    email_verification_expires  TIMESTAMPTZ,
    -- Password reset
    password_reset_token        VARCHAR,
    password_reset_expires      TIMESTAMPTZ,
    -- Security
    signup_ip                   VARCHAR,
    failed_login_attempts       INTEGER NOT NULL DEFAULT 0,
    locked_until                TIMESTAMPTZ,
    -- Timestamps
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_keys (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key         VARCHAR UNIQUE NOT NULL,
    key_preview VARCHAR NOT NULL,
    name        VARCHAR NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS usage_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id),
    api_key_id    UUID REFERENCES api_keys(id) ON DELETE SET NULL,
    model         VARCHAR NOT NULL,
    input_tokens  INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cost          DECIMAL(12, 8) NOT NULL DEFAULT 0,
    timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── INDEXES ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_email                    ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_verification_token       ON users(email_verification_token) WHERE email_verification_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_reset_token              ON users(password_reset_token)     WHERE password_reset_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_key                   ON api_keys(key);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id               ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id             ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_timestamp           ON usage_logs(timestamp DESC);

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────────────────────
-- The app uses SUPABASE_SERVICE_KEY which bypasses RLS.
-- These policies protect data if the anon/user key is ever exposed.

ALTER TABLE users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys   ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users: own row"       ON users;
DROP POLICY IF EXISTS "api_keys: own rows"   ON api_keys;
DROP POLICY IF EXISTS "usage_logs: own rows" ON usage_logs;

CREATE POLICY "users: own row"       ON users      FOR ALL     USING (auth.uid() = id);
CREATE POLICY "api_keys: own rows"   ON api_keys   FOR ALL     USING (user_id = auth.uid());
CREATE POLICY "usage_logs: own rows" ON usage_logs FOR SELECT  USING (user_id = auth.uid());

-- ─── STORED PROCEDURES (atomic balance ops) ─────────────────────────────────

CREATE OR REPLACE FUNCTION deduct_balance(user_id_param UUID, amount_param DECIMAL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE users
    SET balance    = GREATEST(0, balance - amount_param),
        updated_at = NOW()
    WHERE id = user_id_param;
END;
$$;

CREATE OR REPLACE FUNCTION add_balance(user_id_param UUID, amount_param DECIMAL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE users
    SET balance    = balance + amount_param,
        updated_at = NOW()
    WHERE id = user_id_param;
END;
$$;

-- ─── MIGRATION: apply to existing tables if you've already run an older schema ─

DO $$ BEGIN
    -- Add columns only if they don't exist (safe to re-run)
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_email_verified          BOOLEAN     NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token   VARCHAR;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token       VARCHAR;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires     TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_ip                  VARCHAR;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts      INTEGER     NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until               TIMESTAMPTZ;
    ALTER TABLE usage_logs ADD COLUMN IF NOT EXISTS api_key_id            UUID REFERENCES api_keys(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Migration skipped (likely already applied): %', SQLERRM;
END $$;

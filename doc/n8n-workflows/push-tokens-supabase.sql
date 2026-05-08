-- Create push_tokens table in Supabase
-- Run this in Supabase SQL Editor before importing n8n workflows

CREATE TABLE IF NOT EXISTS push_tokens (
  user_id  VARCHAR(255) PRIMARY KEY,
  push_token TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- RLS: allow anon to insert/update (needed by register-token webhook)
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon upsert push_tokens"
  ON push_tokens
  FOR ALL
  USING (true)
  WITH CHECK (true);

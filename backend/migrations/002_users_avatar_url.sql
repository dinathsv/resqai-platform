-- ResQAI — Add the nullable profile avatar URL to users.
--
-- This migration is intentionally additive. Existing users retain their data
-- and receive NULL until an avatar is set.
ALTER TABLE users
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

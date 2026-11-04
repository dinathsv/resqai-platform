-- Active: 1781257077461@@127.0.0.1@3306
-- A hazard report can explicitly state that nobody is currently affected.
-- Keep existing counts and allow zero without changing historical migrations.
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.help_requests
  DROP CONSTRAINT IF EXISTS help_requests_affected_people_check,
  ADD CONSTRAINT help_requests_affected_people_check CHECK (affected_people BETWEEN 0 AND 100000);

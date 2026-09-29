-- ============================================================================
-- ResQAI — Alerts System Tables
-- ============================================================================

-- Required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Utility function for auto-updating timestamps
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Alerts issued by administrators for disaster events
CREATE TABLE IF NOT EXISTS alerts (
    alert_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    disaster_type    VARCHAR(100)    NOT NULL,
    severity         INT             NOT NULL CHECK (severity BETWEEN 1 AND 5),
    district         VARCHAR(100),
    zone_description TEXT,
    work_plan        JSONB           NOT NULL DEFAULT '[]',
    is_active        BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_active    ON alerts (is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_alerts_district  ON alerts (district);
CREATE INDEX IF NOT EXISTS idx_alerts_severity  ON alerts (severity DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_created   ON alerts (created_at DESC);

-- Track which users have acknowledged which alerts
CREATE TABLE IF NOT EXISTS alert_acknowledgements (
    alert_id         UUID            NOT NULL REFERENCES alerts (alert_id) ON DELETE CASCADE,
    user_id          UUID            NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
    acknowledged_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    PRIMARY KEY (alert_id, user_id)
);

-- Auto-update trigger for alerts.updated_at
DROP TRIGGER IF EXISTS trg_alerts_updated_at ON alerts;
CREATE TRIGGER trg_alerts_updated_at
    BEFORE UPDATE ON alerts
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

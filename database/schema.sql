-- ============================================================================
-- ResQAI — AI-Powered Disaster Relief Platform for Sri Lanka
-- PostgreSQL + PostGIS Schema
-- ============================================================================

-- ── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── ENUM Types ──────────────────────────────────────────────────────────────

-- Language preferences for Sri Lanka's trilingual population
CREATE TYPE language_pref AS ENUM ('si', 'ta', 'en');

-- Categories of emergencies handled by the platform
CREATE TYPE emergency_type AS ENUM (
    'flood',
    'landslide',
    'tsunami',
    'earthquake',
    'fire',
    'medical',
    'search_and_rescue',
    'infrastructure_damage',
    'hazardous_material',
    'other'
);

-- Lifecycle status of a help request
CREATE TYPE request_status AS ENUM (
    'pending',
    'ai_processing',
    'verified',
    'dispatched',
    'in_progress',
    'resolved',
    'cancelled'
);


-- ============================================================================
-- 1. USERS
-- ============================================================================
CREATE TABLE users (
    user_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name       VARCHAR(150)    NOT NULL,
    email           VARCHAR(255)    NOT NULL UNIQUE,
    phone_number    VARCHAR(20),
    password_hash   VARCHAR(255)    NOT NULL,
    language_pref   language_pref   NOT NULL DEFAULT 'en',
    gps_location    GEOMETRY(POINT, 4326),
    is_verified     BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- B-tree indexes for common lookups
CREATE INDEX idx_users_email        ON users (email);
CREATE INDEX idx_users_phone        ON users (phone_number);

-- Spatial index for proximity queries
CREATE INDEX idx_users_gps          ON users USING GIST (gps_location);


-- ============================================================================
-- 2. GUEST SESSIONS
-- ============================================================================
CREATE TABLE guest_sessions (
    session_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nic_number      VARCHAR(12)     NOT NULL,           -- Old 9-digit or new 12-digit NIC
    nic_verified    BOOLEAN         NOT NULL DEFAULT FALSE,
    nic_format_valid BOOLEAN        NOT NULL DEFAULT FALSE,
    temp_token      VARCHAR(512)    NOT NULL UNIQUE,
    gps_location    GEOMETRY(POINT, 4326),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ     NOT NULL,
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_guest_nic          ON guest_sessions (nic_number);
CREATE INDEX idx_guest_token        ON guest_sessions (temp_token);
CREATE INDEX idx_guest_expires      ON guest_sessions (expires_at);
CREATE INDEX idx_guest_gps          ON guest_sessions USING GIST (gps_location);


-- ============================================================================
-- 3. ADMINISTRATORS
-- ============================================================================
CREATE TABLE administrators (
    admin_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name       VARCHAR(150)    NOT NULL,
    email           VARCHAR(255)    NOT NULL UNIQUE,
    agency          VARCHAR(150),                       -- e.g. DMC, NBRO, SL Red Cross
    district        VARCHAR(100),                       -- e.g. Colombo, Galle, Ratnapura
    password_hash   VARCHAR(255)    NOT NULL,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_email        ON administrators (email);
CREATE INDEX idx_admin_district     ON administrators (district);
CREATE INDEX idx_admin_agency       ON administrators (agency);


-- ============================================================================
-- 4. HELP REQUESTS
-- ============================================================================
CREATE TABLE help_requests (
    request_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Exactly one of these must be set (enforced by CHECK below)
    user_id         UUID            REFERENCES users (user_id)
                                        ON DELETE CASCADE,
    guest_session_id UUID           REFERENCES guest_sessions (session_id)
                                        ON DELETE CASCADE,

    original_message TEXT           NOT NULL,
    emergency_type  emergency_type  NOT NULL,
    urgency_level   INT             NOT NULL DEFAULT 3
                                        CHECK (urgency_level BETWEEN 1 AND 5),
    gps_location    GEOMETRY(POINT, 4326),
    status          request_status  NOT NULL DEFAULT 'pending',
    ai_summary      TEXT,
    is_guest_request BOOLEAN        NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Ensure every request is linked to exactly one requester type
    CONSTRAINT chk_requester_type CHECK (
        (user_id IS NOT NULL AND guest_session_id IS NULL AND is_guest_request = FALSE)
        OR
        (user_id IS NULL AND guest_session_id IS NOT NULL AND is_guest_request = TRUE)
    )
);

CREATE INDEX idx_hr_user            ON help_requests (user_id);
CREATE INDEX idx_hr_guest           ON help_requests (guest_session_id);
CREATE INDEX idx_hr_status          ON help_requests (status);
CREATE INDEX idx_hr_emergency       ON help_requests (emergency_type);
CREATE INDEX idx_hr_urgency         ON help_requests (urgency_level DESC);
CREATE INDEX idx_hr_created         ON help_requests (created_at DESC);
CREATE INDEX idx_hr_gps             ON help_requests USING GIST (gps_location);


-- ============================================================================
-- 5. HOSPITALS
-- ============================================================================
CREATE TABLE hospitals (
    hospital_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255)    NOT NULL,
    phone           VARCHAR(20),
    gps_location    GEOMETRY(POINT, 4326) NOT NULL,
    specialization  VARCHAR(255),                       -- e.g. General, Teaching, Base
    has_cardiac_icu BOOLEAN         NOT NULL DEFAULT FALSE,
    has_trauma_unit BOOLEAN         NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hosp_name          ON hospitals (name);
CREATE INDEX idx_hosp_active        ON hospitals (is_active) WHERE is_active = TRUE;
CREATE INDEX idx_hosp_gps           ON hospitals USING GIST (gps_location);


-- ============================================================================
-- 6. NIC DATABASE
-- ============================================================================
CREATE TABLE nic_database (
    nic_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nic_number      VARCHAR(12)     NOT NULL UNIQUE,    -- Old or new format
    is_valid        BOOLEAN         NOT NULL DEFAULT TRUE,
    district        VARCHAR(100),
    registered_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nic_number         ON nic_database (nic_number);
CREATE INDEX idx_nic_district       ON nic_database (district);


-- ============================================================================
-- TRIGGER: Auto-update `updated_at` on any row modification
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to every table that has an updated_at column
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_guest_sessions_updated_at
    BEFORE UPDATE ON guest_sessions
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_administrators_updated_at
    BEFORE UPDATE ON administrators
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_help_requests_updated_at
    BEFORE UPDATE ON help_requests
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_hospitals_updated_at
    BEFORE UPDATE ON hospitals
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_nic_database_updated_at
    BEFORE UPDATE ON nic_database
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- ============================================================================
-- FUNCTION: get_nearest_hospitals(lat, lng, limit_count)
-- Returns the nearest active hospitals sorted by distance (metres).
-- Uses PostGIS ST_Distance on geography casts for accurate Earth-surface
-- distance rather than planar/degree-based approximations.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_nearest_hospitals(
    lat         FLOAT,
    lng         FLOAT,
    limit_count INT DEFAULT 5
)
RETURNS TABLE (
    hospital_id     UUID,
    name            VARCHAR(255),
    phone           VARCHAR(20),
    specialization  VARCHAR(255),
    has_cardiac_icu BOOLEAN,
    has_trauma_unit BOOLEAN,
    latitude        FLOAT,
    longitude       FLOAT,
    distance_metres FLOAT
)
AS $$
BEGIN
    RETURN QUERY
    SELECT
        h.hospital_id,
        h.name,
        h.phone,
        h.specialization,
        h.has_cardiac_icu,
        h.has_trauma_unit,
        ST_Y(h.gps_location)::FLOAT           AS latitude,
        ST_X(h.gps_location)::FLOAT           AS longitude,
        ST_Distance(
            h.gps_location::geography,
            ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
        )::FLOAT                               AS distance_metres
    FROM hospitals h
    WHERE h.is_active = TRUE
    ORDER BY
        h.gps_location <-> ST_SetSRID(ST_MakePoint(lng, lat), 4326)
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;


-- ============================================================================
-- Sample usage:
--   SELECT * FROM get_nearest_hospitals(6.9271, 79.8612, 5);
--   → Returns 5 nearest active hospitals to Colombo city centre
-- ============================================================================

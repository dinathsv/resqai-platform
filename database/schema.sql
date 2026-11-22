CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


CREATE TYPE language_pref AS ENUM ('si', 'ta', 'en');

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
    'other',
    'donation',
    'help_rescue'
);

CREATE TYPE request_status AS ENUM (
    'pending',
    'ai_processing',
    'verified',
    'dispatched',
    'in_progress',
    'resolved',
    'cancelled'
);


CREATE TABLE users (
    user_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name       VARCHAR(150)    NOT NULL,
    email           VARCHAR(255)    NOT NULL UNIQUE,
    phone_number    VARCHAR(20)    NOT NULL,
    password_hash   VARCHAR(255)    NOT NULL,
    language_pref   language_pref   NOT NULL DEFAULT 'en',
    gps_location    GEOMETRY(POINT, 4326),
    is_verified     BOOLEAN         NOT NULL DEFAULT FALSE,
    avatar_url      TEXT,
    user_type       VARCHAR(50) DEFAULT 'Citizen',
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email        ON users (email);
CREATE INDEX idx_users_phone        ON users (phone_number);

CREATE INDEX idx_users_gps          ON users USING GIST (gps_location);


CREATE TABLE guest_sessions (
    session_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nic_number      VARCHAR(12)     NOT NULL,
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


CREATE TABLE administrators (
    admin_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name       VARCHAR(150)    NOT NULL,
    email           VARCHAR(255)    NOT NULL UNIQUE,
    agency          VARCHAR(150),
    district        VARCHAR(100),
    password_hash   VARCHAR(255)    NOT NULL,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_email        ON administrators (email);
CREATE INDEX idx_admin_district     ON administrators (district);
CREATE INDEX idx_admin_agency       ON administrators (agency);


CREATE TABLE help_requests (
    request_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

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

    CONSTRAINT chk_requester_type CHECK (
        (user_id IS NOT NULL AND guest_session_id IS NULL AND is_guest_request = FALSE)
        OR
        (user_id IS NULL AND guest_session_id IS NOT NULL AND is_guest_request = TRUE)
        OR
        (user_id IS NULL AND guest_session_id IS NULL AND is_guest_request = TRUE)
    )
);

CREATE INDEX idx_hr_user            ON help_requests (user_id);
CREATE INDEX idx_hr_guest           ON help_requests (guest_session_id);
CREATE INDEX idx_hr_status          ON help_requests (status);
CREATE INDEX idx_hr_emergency       ON help_requests (emergency_type);
CREATE INDEX idx_hr_urgency         ON help_requests (urgency_level DESC);
CREATE INDEX idx_hr_created         ON help_requests (created_at DESC);
CREATE INDEX idx_hr_gps             ON help_requests USING GIST (gps_location);


CREATE TABLE hospitals (
    hospital_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255)    NOT NULL,
    phone           VARCHAR(20),
    gps_location    GEOMETRY(POINT, 4326) NOT NULL,
    specialization  VARCHAR(255),
    has_cardiac_icu BOOLEAN         NOT NULL DEFAULT FALSE,
    has_trauma_unit BOOLEAN         NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hosp_name          ON hospitals (name);
CREATE INDEX idx_hosp_active        ON hospitals (is_active) WHERE is_active = TRUE;
CREATE INDEX idx_hosp_gps           ON hospitals USING GIST (gps_location);


CREATE TABLE nic_database (
    nic_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nic_number      VARCHAR(12)     NOT NULL UNIQUE,
    is_valid        BOOLEAN         NOT NULL DEFAULT TRUE,
    district        VARCHAR(100),
    registered_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nic_number         ON nic_database (nic_number);
CREATE INDEX idx_nic_district       ON nic_database (district);



CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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





CREATE TYPE mission_status AS ENUM (
    'planning',
    'active',
    'paused',
    'completed',
    'cancelled'
);

CREATE TYPE assignment_status AS ENUM (
    'pending',
    'accepted',
    'active',
    'completed',
    'withdrawn'
);

CREATE TYPE donation_status AS ENUM (
    'pending',
    'completed',
    'failed',
    'refunded'
);

CREATE TYPE alert_status AS ENUM (
    'active',
    'expired',
    'cancelled'
);


CREATE TABLE relief_missions (
    mission_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id        UUID            NOT NULL
                                        REFERENCES administrators (admin_id)
                                        ON DELETE CASCADE,
    title           VARCHAR(255)    NOT NULL,
    description     TEXT,
    target_zone     GEOMETRY,
    district        VARCHAR(100),
    target          NUMERIC(12,2) NOT NULL DEFAULT 0,
    status          mission_status  NOT NULL DEFAULT 'planning',
    funds_collected DECIMAL(12,2)   NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mission_admin       ON relief_missions (admin_id);
CREATE INDEX idx_mission_status      ON relief_missions (status);
CREATE INDEX idx_mission_zone        ON relief_missions USING GIST (target_zone);

CREATE TRIGGER trg_relief_missions_updated_at
    BEFORE UPDATE ON relief_missions
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


CREATE TABLE donations (
    donation_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_id        UUID            NOT NULL
                                        REFERENCES users (user_id)
                                        ON DELETE CASCADE,
    mission_id      UUID            REFERENCES relief_missions (mission_id)
                                        ON DELETE SET NULL,
    amount          DECIMAL(12,2)   NOT NULL CHECK (amount > 0),
    status          donation_status NOT NULL DEFAULT 'pending',
    transaction_ref VARCHAR(255),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_donation_donor      ON donations (donor_id);
CREATE INDEX idx_donation_mission    ON donations (mission_id);
CREATE INDEX idx_donation_status     ON donations (status);

CREATE TRIGGER trg_donations_updated_at
    BEFORE UPDATE ON donations
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


CREATE TABLE volunteer_assignments (
    assignment_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID            NOT NULL
                                        REFERENCES users (user_id)
                                        ON DELETE CASCADE,
    mission_id      UUID            NOT NULL
                                        REFERENCES relief_missions (mission_id)
                                        ON DELETE CASCADE,
    status          assignment_status NOT NULL DEFAULT 'pending',
    assigned_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    hours_logged    INT             NOT NULL DEFAULT 0
                                        CHECK (hours_logged >= 0),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_va_user             ON volunteer_assignments (user_id);
CREATE INDEX idx_va_mission          ON volunteer_assignments (mission_id);
CREATE INDEX idx_va_status           ON volunteer_assignments (status);

CREATE TRIGGER trg_volunteer_assignments_updated_at
    BEFORE UPDATE ON volunteer_assignments
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


CREATE TABLE emergency_alerts (
    alert_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id        UUID            NOT NULL
                                        REFERENCES administrators (admin_id)
                                        ON DELETE CASCADE,
    disaster_type   emergency_type  NOT NULL,
    severity        INT             NOT NULL DEFAULT 3
                                        CHECK (severity BETWEEN 1 AND 5),
    affected_zone   GEOMETRY(POLYGON, 4326),
    work_plan       TEXT,
    status          alert_status    NOT NULL DEFAULT 'active',
    delivered_count INT             NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ea_admin            ON emergency_alerts (admin_id);
CREATE INDEX idx_ea_status           ON emergency_alerts (status);
CREATE INDEX idx_ea_severity         ON emergency_alerts (severity DESC);
CREATE INDEX idx_ea_zone             ON emergency_alerts USING GIST (affected_zone);

CREATE TRIGGER trg_emergency_alerts_updated_at
    BEFORE UPDATE ON emergency_alerts
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


CREATE TABLE agency_chat_messages (
    message_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id       UUID            NOT NULL
                                        REFERENCES administrators (admin_id)
                                        ON DELETE CASCADE,
    channel_id      INT,
    message_text    TEXT            NOT NULL,
    alert_id        UUID            REFERENCES emergency_alerts (alert_id)
                                        ON DELETE SET NULL,
    sent_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_acm_sender          ON agency_chat_messages (sender_id);
CREATE INDEX idx_acm_channel         ON agency_chat_messages (channel_id);
CREATE INDEX idx_acm_alert           ON agency_chat_messages (alert_id);
CREATE INDEX idx_acm_sent            ON agency_chat_messages (sent_at DESC);


CREATE TABLE ratings (
    rating_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rater_id        UUID            NOT NULL
                                        REFERENCES users (user_id)
                                        ON DELETE CASCADE,
    rated_user_id   UUID            NOT NULL
                                        REFERENCES users (user_id)
                                        ON DELETE CASCADE,
    request_id      UUID            REFERENCES help_requests (request_id)
                                        ON DELETE SET NULL,
    score           INT             NOT NULL CHECK (score BETWEEN 1 AND 5),
    comment         TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_rating_per_request UNIQUE (rater_id, rated_user_id, request_id)
);

CREATE INDEX idx_rating_rater        ON ratings (rater_id);
CREATE INDEX idx_rating_rated        ON ratings (rated_user_id);
CREATE INDEX idx_rating_request      ON ratings (request_id);


CREATE TABLE audit_logs (
    log_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID            REFERENCES users (user_id)
                                        ON DELETE SET NULL,
    admin_id        UUID            REFERENCES administrators (admin_id)
                                        ON DELETE SET NULL,
    action          VARCHAR(100)    NOT NULL,
    entity_type     VARCHAR(100),
    entity_id       UUID,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user          ON audit_logs (user_id);
CREATE INDEX idx_audit_admin         ON audit_logs (admin_id);
CREATE INDEX idx_audit_action        ON audit_logs (action);
CREATE INDEX idx_audit_entity        ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_created       ON audit_logs (created_at DESC);

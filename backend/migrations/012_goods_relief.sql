-- Apply after 011. Existing monetary history is retained, never reclassified as goods.
SET LOCAL lock_timeout = '5s';
CREATE TABLE IF NOT EXISTS mission_needs (
    need_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id uuid NOT NULL REFERENCES relief_missions(mission_id),
    item_name varchar(120) NOT NULL,
    unit varchar(40) NOT NULL,
    required_quantity numeric(12,2) NOT NULL CHECK(required_quantity > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_mission_need_item UNIQUE(mission_id,item_name,unit)
);
ALTER TABLE donations ADD COLUMN IF NOT EXISTS need_id uuid REFERENCES mission_needs(need_id);
ALTER TABLE donations ADD COLUMN IF NOT EXISTS quantity numeric(12,2);
ALTER TABLE donations ADD COLUMN IF NOT EXISTS received_quantity numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS dispatched_quantity numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS delivered_quantity numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS item_condition varchar(20);
ALTER TABLE donations ADD COLUMN IF NOT EXISTS availability_note text;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS client_pledge_id uuid;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS goods_status varchar(30);
-- The original amount > 0 constraint prevents zero-valued goods pledges.
-- Keep legacy money records intact; only goods rows may have amount=0.
ALTER TABLE donations DROP CONSTRAINT IF EXISTS donations_amount_check;
ALTER TABLE donations ADD CONSTRAINT donations_amount_check CHECK ((need_id IS NULL AND amount > 0) OR (need_id IS NOT NULL AND amount = 0));
ALTER TABLE donations ADD CONSTRAINT ck_goods_quantities CHECK (need_id IS NULL OR (quantity IS NOT NULL AND quantity > 0 AND received_quantity >= 0 AND dispatched_quantity >= 0 AND delivered_quantity >= 0 AND delivered_quantity <= dispatched_quantity AND dispatched_quantity <= received_quantity AND received_quantity <= quantity));
ALTER TABLE donations ADD CONSTRAINT ck_goods_status CHECK (need_id IS NULL OR (goods_status IS NOT NULL AND goods_status IN ('pledged','received','dispatched','partially_delivered','delivered','cancelled')));
ALTER TABLE donations ADD CONSTRAINT ck_goods_condition CHECK (need_id IS NULL OR (item_condition IS NOT NULL AND item_condition IN ('new','good')));
CREATE UNIQUE INDEX IF NOT EXISTS uq_goods_client_pledge ON donations(client_pledge_id) WHERE client_pledge_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_goods_need ON donations(need_id);
CREATE TABLE IF NOT EXISTS goods_deliveries (
    delivery_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    donation_id uuid NOT NULL REFERENCES donations(donation_id),
    recipient_id uuid NOT NULL REFERENCES users(user_id),
    quantity numeric(12,2) NOT NULL CHECK(quantity > 0),
    status varchar(30) NOT NULL DEFAULT 'dispatched' CHECK(status IN ('dispatched','delivered','disputed','returned')),
    dispatched_by uuid REFERENCES administrators(admin_id),
    dispatch_note text NOT NULL,
    dispute_reason text,
    review_reason text,
    reviewed_by uuid REFERENCES administrators(admin_id),
    created_at timestamptz NOT NULL DEFAULT now(),
    confirmed_at timestamptz,
    reviewed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_goods_delivery_recipient ON goods_deliveries(recipient_id,created_at DESC);
CREATE TABLE IF NOT EXISTS goods_events (
    event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type varchar(40) NOT NULL,
    need_id uuid REFERENCES mission_needs(need_id),
    donation_id uuid REFERENCES donations(donation_id),
    delivery_id uuid REFERENCES goods_deliveries(delivery_id),
    actor_user_id uuid REFERENCES users(user_id),
    actor_admin_id uuid REFERENCES administrators(admin_id),
    quantity numeric(12,2),
    reason text NOT NULL,
    operation_id uuid UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_goods_events_need ON goods_events(need_id,created_at DESC);

ALTER TABLE volunteer_assignments ADD COLUMN IF NOT EXISTS completion_requested_at timestamptz;
ALTER TABLE volunteer_assignments ADD COLUMN IF NOT EXISTS completion_note text;
ALTER TABLE volunteer_assignments ADD COLUMN IF NOT EXISTS recipient_confirmed_at timestamptz;
ALTER TABLE volunteer_assignments ADD COLUMN IF NOT EXISTS completion_review_reason text;
ALTER TABLE volunteer_assignments ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES administrators(admin_id);
ALTER TABLE volunteer_assignments ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- Migration 001 — Wallet close, late-expense approval, notifications
--
-- Fully ADDITIVE and idempotent: only CREATE TABLE IF NOT EXISTS and
-- INSERT ... ON CONFLICT DO NOTHING. Safe to run against production —
-- it never touches existing rows. Apply with:
--   psql "$DATABASE_URL" -f scripts/migrations/001-wallet-close.sql

-- Late expenses submitted after the wallet was closed, awaiting admin review.
CREATE TABLE IF NOT EXISTS wallet_pending_expenses (
    id              SERIAL PRIMARY KEY,
    paid_by         INT            NOT NULL,
    amount          DECIMAL(10,2)  NOT NULL,
    currency        VARCHAR(3)     NOT NULL DEFAULT 'EUR',
    description     TEXT           NOT NULL,
    category        VARCHAR(50)    NOT NULL DEFAULT 'other',
    expense_date    TIMESTAMP      NOT NULL,
    split_type      VARCHAR(20)    NOT NULL DEFAULT 'both',
    split_user_ids  TEXT           NOT NULL DEFAULT '[]',  -- JSON array of user ids
    requested_by    INT            DEFAULT NULL,
    note            TEXT           DEFAULT NULL,
    status          VARCHAR(20)    NOT NULL DEFAULT 'pending', -- pending | approved | rejected
    review_note     TEXT           DEFAULT NULL,
    reviewed_by     INT            DEFAULT NULL,
    reviewed_at     TIMESTAMP      DEFAULT NULL,
    approved_expense_id INT        DEFAULT NULL,
    created_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pending_paid_by FOREIGN KEY (paid_by) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_pending_requested_by FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_pending_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_pending_expense FOREIGN KEY (approved_expense_id) REFERENCES wallet_expenses(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_pending_status ON wallet_pending_expenses(status);
CREATE INDEX IF NOT EXISTS idx_pending_requested_by ON wallet_pending_expenses(requested_by);

-- Lightweight in-app notifications. user_id NULL = broadcast to everyone.
CREATE TABLE IF NOT EXISTS notifications (
    id          SERIAL PRIMARY KEY,
    user_id     INT          DEFAULT NULL,  -- NULL = broadcast
    type        VARCHAR(40)  NOT NULL,
    title       VARCHAR(200) NOT NULL,
    body        TEXT         DEFAULT NULL,
    link        VARCHAR(200) DEFAULT NULL,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    read_at     TIMESTAMP    DEFAULT NULL,
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);

-- Tracks which broadcast notifications each user has dismissed/read
-- (broadcast rows have no per-user read_at, so reads are recorded here).
CREATE TABLE IF NOT EXISTS notification_reads (
    notification_id INT       NOT NULL,
    user_id         INT       NOT NULL,
    read_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (notification_id, user_id),
    CONSTRAINT fk_nr_notification FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
    CONSTRAINT fk_nr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Default wallet status (open). Does not overwrite an existing value.
INSERT INTO settings (setting_key, setting_value)
VALUES ('wallet_status', 'open')
ON CONFLICT (setting_key) DO NOTHING;

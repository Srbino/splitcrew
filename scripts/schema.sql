-- CrewSplit – PostgreSQL schema

-- Application settings
CREATE TABLE IF NOT EXISTS settings (
    setting_key   VARCHAR(100) NOT NULL PRIMARY KEY,
    setting_value TEXT
);

-- Boats (dynamic — admin can create as many as needed)
CREATE TABLE IF NOT EXISTS boats (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL DEFAULT 'Boat',
    emoji       VARCHAR(10)  NOT NULL DEFAULT '⛵',
    color       VARCHAR(20)  NOT NULL DEFAULT 'blue',
    description TEXT
);

-- Migration: add emoji/color columns if upgrading from older schema
-- ALTER TABLE boats ADD COLUMN IF NOT EXISTS emoji VARCHAR(10) NOT NULL DEFAULT '⛵';
-- ALTER TABLE boats ADD COLUMN IF NOT EXISTS color VARCHAR(20) NOT NULL DEFAULT 'blue';

-- Users (crew members)
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    phone         VARCHAR(50)  DEFAULT NULL,
    email         VARCHAR(150) DEFAULT NULL,
    avatar        TEXT         DEFAULT NULL,
    password_hash VARCHAR(200) DEFAULT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'crew',
    boat_id       INT          NOT NULL DEFAULT 1,
    CONSTRAINT fk_users_boat FOREIGN KEY (boat_id) REFERENCES boats(id)
);

-- Migration: add columns if upgrading from older schema
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(200) DEFAULT NULL;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'crew';

-- Wallet expenses
CREATE TABLE IF NOT EXISTS wallet_expenses (
    id            SERIAL PRIMARY KEY,
    paid_by       INT            NOT NULL,
    amount        DECIMAL(10,2)  NOT NULL,
    currency      VARCHAR(3)     NOT NULL DEFAULT 'EUR',
    amount_eur    DECIMAL(10,2)  NOT NULL,
    exchange_rate DECIMAL(10,4)  DEFAULT NULL,
    description   TEXT           NOT NULL,
    category      VARCHAR(50)    NOT NULL DEFAULT 'other',
    expense_date  TIMESTAMP      NOT NULL,
    split_type    VARCHAR(20)    NOT NULL DEFAULT 'both',
    photo         VARCHAR(200)   DEFAULT NULL,
    created_by    INT            DEFAULT NULL,
    created_at    TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_expenses_paid_by FOREIGN KEY (paid_by) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_expenses_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by ON wallet_expenses(paid_by);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON wallet_expenses(expense_date);

-- Expense splits per person
CREATE TABLE IF NOT EXISTS wallet_expense_splits (
    id         SERIAL PRIMARY KEY,
    expense_id INT            NOT NULL,
    user_id    INT            NOT NULL,
    amount_eur DECIMAL(10,2)  NOT NULL,
    CONSTRAINT fk_splits_expense FOREIGN KEY (expense_id) REFERENCES wallet_expenses(id) ON DELETE CASCADE,
    CONSTRAINT fk_splits_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_splits_expense ON wallet_expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_splits_user ON wallet_expense_splits(user_id);

-- Expense audit log
CREATE TABLE IF NOT EXISTS wallet_audit_log (
    id          SERIAL PRIMARY KEY,
    expense_id  INT          NOT NULL,
    changed_by  INT          DEFAULT NULL,
    change_type VARCHAR(20)  NOT NULL,
    old_values  TEXT         DEFAULT NULL,
    new_values  TEXT         DEFAULT NULL,
    changed_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_expense FOREIGN KEY (expense_id) REFERENCES wallet_expenses(id) ON DELETE CASCADE,
    CONSTRAINT fk_audit_changed_by FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_expense ON wallet_audit_log(expense_id);

-- Marked settlements
CREATE TABLE IF NOT EXISTS wallet_settled (
    id           SERIAL PRIMARY KEY,
    from_user_id INT       NOT NULL,
    to_user_id   INT       NOT NULL,
    settled_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    settled_by   INT       DEFAULT NULL,
    UNIQUE (from_user_id, to_user_id),
    CONSTRAINT fk_settled_from FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_settled_to FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_settled_by FOREIGN KEY (settled_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Settlement audit log (tracks who settled/unsettled and when)
CREATE TABLE IF NOT EXISTS settlement_audit_log (
    id             SERIAL PRIMARY KEY,
    from_user_id   INT          NOT NULL,
    to_user_id     INT          NOT NULL,
    action         VARCHAR(20)  NOT NULL,
    performed_by   INT          DEFAULT NULL,
    performer_role VARCHAR(20)  DEFAULT NULL,
    created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sa_from FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_sa_to FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_sa_performer FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_settlement_audit_time ON settlement_audit_log(created_at DESC);

-- Shopping list
CREATE TABLE IF NOT EXISTS shopping_items (
    id          SERIAL PRIMARY KEY,
    boat_id     INT            NOT NULL,
    category    VARCHAR(50)    NOT NULL DEFAULT 'other',
    item_name   VARCHAR(200)   NOT NULL,
    quantity    VARCHAR(100)   DEFAULT NULL,
    assigned_to INT            DEFAULT NULL,
    price       DECIMAL(10,2)  DEFAULT NULL,
    currency    VARCHAR(3)     NOT NULL DEFAULT 'EUR',
    note        TEXT           DEFAULT NULL,
    is_bought   BOOLEAN        NOT NULL DEFAULT FALSE,
    bought_by   INT            DEFAULT NULL,
    created_by  INT            DEFAULT NULL,
    created_at  TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_shopping_boat FOREIGN KEY (boat_id) REFERENCES boats(id),
    CONSTRAINT fk_shopping_assigned FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_shopping_bought_by FOREIGN KEY (bought_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_shopping_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_shopping_boat ON shopping_items(boat_id);

-- Sailing logbook
CREATE TABLE IF NOT EXISTS logbook (
    id               SERIAL PRIMARY KEY,
    boat_id          INT            NOT NULL,
    date             DATE           NOT NULL,
    location_from    VARCHAR(200)   NOT NULL DEFAULT '',
    location_to      VARCHAR(200)   NOT NULL DEFAULT '',
    nautical_miles   DECIMAL(6,1)   NOT NULL DEFAULT 0,
    departure_time   TIME           DEFAULT NULL,
    arrival_time     TIME           DEFAULT NULL,
    skipper_user_id  INT            DEFAULT NULL,
    note             TEXT           DEFAULT NULL,
    created_by       INT            DEFAULT NULL,
    created_at       TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_logbook_boat FOREIGN KEY (boat_id) REFERENCES boats(id),
    CONSTRAINT fk_logbook_skipper FOREIGN KEY (skipper_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_logbook_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_logbook_boat_date ON logbook(boat_id, date);

-- Meal plan
CREATE TABLE IF NOT EXISTS menu_plan (
    id               SERIAL PRIMARY KEY,
    boat_id          INT         NOT NULL,
    date             DATE        NOT NULL,
    meal_type        VARCHAR(20) NOT NULL DEFAULT 'lunch',
    cook_user_id     INT         DEFAULT NULL,
    meal_description TEXT        DEFAULT NULL,
    note             TEXT        DEFAULT NULL,
    created_by       INT         DEFAULT NULL,
    created_at       TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (boat_id, date, meal_type),
    CONSTRAINT fk_menu_boat FOREIGN KEY (boat_id) REFERENCES boats(id),
    CONSTRAINT fk_menu_cook FOREIGN KEY (cook_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_menu_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Cars
CREATE TABLE IF NOT EXISTS cars (
    id             SERIAL PRIMARY KEY,
    driver_user_id INT          NOT NULL,
    car_name       VARCHAR(100) DEFAULT NULL,
    seats          INT          NOT NULL DEFAULT 5,
    note           TEXT         DEFAULT NULL,
    created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cars_driver FOREIGN KEY (driver_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Car passengers
CREATE TABLE IF NOT EXISTS car_passengers (
    id       SERIAL PRIMARY KEY,
    car_id   INT NOT NULL,
    user_id  INT NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_carpax_car FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE,
    CONSTRAINT fk_carpax_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_carpax_car ON car_passengers(car_id);

-- Itinerary
CREATE TABLE IF NOT EXISTS itinerary (
    id            SERIAL PRIMARY KEY,
    day_number    INT          NOT NULL DEFAULT 0,
    date          DATE         DEFAULT NULL,
    title         VARCHAR(200) NOT NULL,
    description   TEXT         DEFAULT NULL,
    location_from VARCHAR(100) DEFAULT NULL,
    location_to   VARCHAR(100) DEFAULT NULL,
    type          VARCHAR(20)  NOT NULL DEFAULT 'sailing',
    sort_order    INT          NOT NULL DEFAULT 0
);

-- Daily exchange rates (historical archive)
CREATE TABLE IF NOT EXISTS exchange_rates_daily (
    id            SERIAL PRIMARY KEY,
    rate_date     DATE         NOT NULL,
    base_currency VARCHAR(3)   NOT NULL DEFAULT 'EUR',
    rates         TEXT         NOT NULL,   -- JSON: { "CZK": 25.21, "USD": 1.08, ... }
    fetched_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (rate_date, base_currency)
);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_date ON exchange_rates_daily(rate_date, base_currency);

-- Checklist (packing list — scoped: personal, boat, or trip-wide)
CREATE TABLE IF NOT EXISTS checklist (
    id          SERIAL PRIMARY KEY,
    category    VARCHAR(50)  NOT NULL DEFAULT 'recommended',
    item_name   VARCHAR(200) NOT NULL,
    description TEXT         DEFAULT NULL,
    scope       VARCHAR(20)  NOT NULL DEFAULT 'trip',
    user_id     INT          DEFAULT NULL,
    boat_id     INT          DEFAULT NULL,
    sort_order  INT          NOT NULL DEFAULT 0,
    CONSTRAINT fk_checklist_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_checklist_boat FOREIGN KEY (boat_id) REFERENCES boats(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_checklist_scope ON checklist(scope);

-- Migration: add scope columns if upgrading
-- ALTER TABLE checklist ADD COLUMN IF NOT EXISTS scope VARCHAR(20) NOT NULL DEFAULT 'trip';
-- ALTER TABLE checklist ADD COLUMN IF NOT EXISTS user_id INT DEFAULT NULL;
-- ALTER TABLE checklist ADD COLUMN IF NOT EXISTS boat_id INT DEFAULT NULL;

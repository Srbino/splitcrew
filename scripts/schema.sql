-- CrewSplit – PostgreSQL schema

-- Application settings
CREATE TABLE IF NOT EXISTS settings (
    setting_key   VARCHAR(100) NOT NULL PRIMARY KEY,
    setting_value TEXT
);

-- Boats (typically 2)
CREATE TABLE IF NOT EXISTS boats (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL DEFAULT 'Boat',
    description TEXT
);

-- Users (crew members)
CREATE TABLE IF NOT EXISTS users (
    id      SERIAL PRIMARY KEY,
    name    VARCHAR(100) NOT NULL,
    phone   VARCHAR(50)  DEFAULT NULL,
    email   VARCHAR(150) DEFAULT NULL,
    avatar  VARCHAR(200) DEFAULT NULL,
    boat_id INT          NOT NULL DEFAULT 1
);

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
    created_at    TIMESTAMP      DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by ON wallet_expenses(paid_by);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON wallet_expenses(expense_date);

-- Expense splits per person
CREATE TABLE IF NOT EXISTS wallet_expense_splits (
    id         SERIAL PRIMARY KEY,
    expense_id INT            NOT NULL,
    user_id    INT            NOT NULL,
    amount_eur DECIMAL(10,2)  NOT NULL
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
    changed_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_expense ON wallet_audit_log(expense_id);

-- Marked settlements
CREATE TABLE IF NOT EXISTS wallet_settled (
    id           SERIAL PRIMARY KEY,
    from_user_id INT       NOT NULL,
    to_user_id   INT       NOT NULL,
    settled_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    settled_by   INT       DEFAULT NULL,
    UNIQUE (from_user_id, to_user_id)
);

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
    created_at  TIMESTAMP      DEFAULT CURRENT_TIMESTAMP
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
    created_at       TIMESTAMP      DEFAULT CURRENT_TIMESTAMP
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
    UNIQUE (boat_id, date, meal_type)
);

-- Cars
CREATE TABLE IF NOT EXISTS cars (
    id             SERIAL PRIMARY KEY,
    driver_user_id INT          NOT NULL,
    car_name       VARCHAR(100) DEFAULT NULL,
    seats          INT          NOT NULL DEFAULT 5,
    note           TEXT         DEFAULT NULL,
    created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- Car passengers
CREATE TABLE IF NOT EXISTS car_passengers (
    id       SERIAL PRIMARY KEY,
    car_id   INT NOT NULL,
    user_id  INT NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

-- Checklist (packing list)
CREATE TABLE IF NOT EXISTS checklist (
    id          SERIAL PRIMARY KEY,
    category    VARCHAR(50)  NOT NULL DEFAULT 'recommended',
    item_name   VARCHAR(200) NOT NULL,
    description TEXT         DEFAULT NULL,
    sort_order  INT          NOT NULL DEFAULT 0
);

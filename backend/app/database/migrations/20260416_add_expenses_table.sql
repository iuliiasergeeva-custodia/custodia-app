-- ==============================
-- EXPENSES TABLE
-- ==============================
-- Tracks Custodia project expenses with multi-currency support.
-- SAR is pegged to USD at 3.75; amount_usd is stored for easy queries.

CREATE TABLE IF NOT EXISTS expenses (
    id                    SERIAL PRIMARY KEY,

    -- When
    date                  DATE NOT NULL DEFAULT CURRENT_DATE,

    -- What
    description           TEXT NOT NULL,
    vendor                VARCHAR(200),
    category              VARCHAR(50) NOT NULL,

    -- Who & How
    paid_by               VARCHAR(20) NOT NULL
                            CHECK (paid_by IN ('Julia', 'Gilberto', 'Other')),
    paid_by_other         VARCHAR(100),   -- free text when paid_by = 'Other'
    fund                  VARCHAR(20) NOT NULL
                            CHECK (fund IN ('personal', 'KAUST', 'other')),

    -- Amount & Currency
    amount                NUMERIC(12,2) NOT NULL,
    currency              VARCHAR(10) NOT NULL DEFAULT 'USD',
    exchange_rate_to_usd  NUMERIC(12,6) NOT NULL DEFAULT 1.0,
    amount_usd            NUMERIC(12,2) NOT NULL,   -- amount * exchange_rate_to_usd, stored

    -- Statuses
    item_status           VARCHAR(20)
                            CHECK (item_status IN ('ordered', 'shipped', 'received')),
    reimbursement_status  VARCHAR(20)
                            CHECK (reimbursement_status IN ('submitted', 'approved', 'received')),

    -- Notes
    comment               TEXT,

    -- Meta
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date   ON expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_fund   ON expenses(fund);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by ON expenses(paid_by);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- Sequence backing human-readable order codes (PED-XXX), used by nextOrderCode() in src/store.ts
CREATE SEQUENCE IF NOT EXISTS order_code_seq START 1;

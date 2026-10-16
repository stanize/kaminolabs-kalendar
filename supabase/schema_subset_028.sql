-- schema_subset_028.sql
-- client-identity-for-invoicing (pdf-invoicing.md) — a Spanish factura's
-- "DATOS DEL CLIENTE" block legally needs the client's name, DNI and
-- domicilio. Adds dni/address to kalendar_clients (the permanent client
-- record, editable from Clientes > client detail or inline in the invoice
-- confirm modal) and client_dni/client_address to kalendar_invoices (the
-- frozen-at-generation snapshot, same as every other invoice field).
--
-- Unlike schema_001.sql's from-scratch client_dni/client_address (NOT
-- NULL there), these are added NULLABLE here since the live table already
-- has invoice rows with no such data — the app coalesces a null/missing
-- value to "" when reading an older row. Going forward every NEW invoice
-- always gets real values (enforced in the app, not the DB), per the
-- "mandatory if missing" rule in the confirm modal.
--
-- Touches only kalendar_clients and kalendar_invoices. Safe to run again.

alter table public.kalendar_clients
  add column if not exists dni text,
  add column if not exists address text;

alter table public.kalendar_invoices
  add column if not exists client_dni text,
  add column if not exists client_address text;

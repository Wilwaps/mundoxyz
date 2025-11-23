BEGIN;

-- Seed base store for Divorare04 if it does not exist
INSERT INTO stores (slug, name, description)
VALUES (
  'divorare04',
  'Divorare 04',
  'Tienda Divorare 04 integrada al ecosistema de Mundo XYZ.'
)
ON CONFLICT (slug) DO NOTHING;

COMMIT;

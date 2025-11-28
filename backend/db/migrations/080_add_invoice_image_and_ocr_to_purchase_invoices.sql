-- Add image/OCR fields to purchase_invoices for inventory invoices

BEGIN;

ALTER TABLE purchase_invoices
  ADD COLUMN IF NOT EXISTS invoice_image_url TEXT,
  ADD COLUMN IF NOT EXISTS invoice_ocr_data JSONB,
  ADD COLUMN IF NOT EXISTS invoice_ocr_status VARCHAR(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS invoice_ocr_error TEXT;

COMMIT;

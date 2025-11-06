/**
 * Migration 036: Add reservation columns to raffle_numbers
 * 
 * Purpose: Enable temporary number reservation to prevent double sales
 * 
 * What it does:
 * - Adds reserved_by column (user who reserved the number)
 * - Adds reserved_until column (expiration timestamp)
 * - Creates index for efficient cleanup of expired reservations
 * 
 * Impact:
 * - Users can reserve numbers for 5 minutes while completing purchase
 * - Prevents multiple users from buying the same number
 * - Automatic cleanup of expired reservations via cron job
 */

-- Add reserved_by column (references users table)
ALTER TABLE raffle_numbers 
ADD COLUMN IF NOT EXISTS reserved_by INTEGER REFERENCES users(id);

-- Add reserved_until column (timestamp for reservation expiration)
ALTER TABLE raffle_numbers 
ADD COLUMN IF NOT EXISTS reserved_until TIMESTAMP WITH TIME ZONE;

-- Create index for efficient cleanup of expired reservations
CREATE INDEX IF NOT EXISTS idx_raffle_numbers_reserved 
ON raffle_numbers(reserved_until) 
WHERE reserved_until IS NOT NULL;

-- Add comment to document the feature
COMMENT ON COLUMN raffle_numbers.reserved_by IS 'User ID who temporarily reserved this number (NULL if not reserved)';
COMMENT ON COLUMN raffle_numbers.reserved_until IS 'Timestamp when the reservation expires (NULL if not reserved)';

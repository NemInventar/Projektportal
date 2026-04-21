-- Check the constraint for price_status column
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname LIKE '%price_status_check%';
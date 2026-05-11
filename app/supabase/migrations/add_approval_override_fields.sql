-- Add approval override fields to purchase_order_lines table
ALTER TABLE public.purchase_order_lines_2026_01_15_06_45 
ADD COLUMN IF NOT EXISTS approval_override BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS approval_override_reason TEXT,
ADD COLUMN IF NOT EXISTS approval_override_by TEXT,
ADD COLUMN IF NOT EXISTS approval_override_at TIMESTAMP WITH TIME ZONE;

-- Add comment to document the purpose
COMMENT ON COLUMN public.purchase_order_lines_2026_01_15_06_45.approval_override IS 'Allows ordering materials without full approvals for testing purposes';
COMMENT ON COLUMN public.purchase_order_lines_2026_01_15_06_45.approval_override_reason IS 'Required reason when approval override is used';
COMMENT ON COLUMN public.purchase_order_lines_2026_01_15_06_45.approval_override_by IS 'User who applied the approval override';
COMMENT ON COLUMN public.purchase_order_lines_2026_01_15_06_45.approval_override_at IS 'Timestamp when approval override was applied';
-- Auto-generate reference numbers for expense records
-- Format: EXP-YYYY-NNNN (e.g., EXP-2026-0001, EXP-2026-0002)

-- Create a sequence for expense reference numbers
CREATE SEQUENCE IF NOT EXISTS expense_reference_seq START 1;

-- Function to generate unique expense reference number
CREATE OR REPLACE FUNCTION generate_expense_reference()
RETURNS VARCHAR(200) AS $$
DECLARE
  v_year VARCHAR(4);
  v_seq_num INTEGER;
  v_reference VARCHAR(200);
  v_exists BOOLEAN;
BEGIN
  -- Get current year from entry_date if available, otherwise use current year
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  -- Loop until we find a unique reference
  LOOP
    -- Get next sequence number
    v_seq_num := nextval('expense_reference_seq');
    
    -- Format: EXP-YYYY-NNNN (e.g., EXP-2026-0001)
    v_reference := 'EXP-' || v_year || '-' || LPAD(v_seq_num::TEXT, 4, '0');
    
    -- Check if this reference already exists
    SELECT EXISTS(SELECT 1 FROM expense_records WHERE reference = v_reference) INTO v_exists;
    
    -- If it doesn't exist, we can use it
    IF NOT v_exists THEN
      EXIT;
    END IF;
  END LOOP;
  
  RETURN v_reference;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to auto-generate reference on INSERT
CREATE OR REPLACE FUNCTION auto_generate_expense_reference()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate if reference is NULL or empty
  IF NEW.reference IS NULL OR NEW.reference = '' THEN
    NEW.reference := generate_expense_reference();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS expense_reference_trigger ON expense_records;
CREATE TRIGGER expense_reference_trigger
  BEFORE INSERT ON expense_records
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_expense_reference();

-- Update existing records that don't have a reference
UPDATE expense_records
SET reference = generate_expense_reference()
WHERE reference IS NULL OR reference = '';

-- Reset sequence to start from the highest existing number + 1
SELECT setval('expense_reference_seq', 
  COALESCE(
    (SELECT MAX(CAST(SUBSTRING(reference FROM 'EXP-\\d{4}-(\\d+)') AS INTEGER))
     FROM expense_records 
     WHERE reference ~ 'EXP-\\d{4}-\\d{4}'),
    0
  ) + 1,
  false
);

COMMENT ON FUNCTION generate_expense_reference() IS 'Generates unique expense reference numbers in format EXP-YYYY-NNNN';
COMMENT ON FUNCTION auto_generate_expense_reference() IS 'Trigger function to automatically assign reference numbers to new expense records';

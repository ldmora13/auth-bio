-- Add CC document type while keeping DNI for backwards compatibility
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'DocumentType'
          AND e.enumlabel = 'CC'
    ) THEN
        ALTER TYPE "DocumentType" ADD VALUE 'CC';
    END IF;
END
$$;

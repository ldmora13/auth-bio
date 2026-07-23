-- Allow audit logs for anonymous verification attempts
ALTER TABLE "AuditLog" ALTER COLUMN "userId" DROP NOT NULL;

-- Allow CLIENT users created from backoffice without local password.
ALTER TABLE "User"
ALTER COLUMN "password" DROP NOT NULL;

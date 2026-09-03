ALTER TABLE "User"
  ADD COLUMN "biometricEnrollmentMaxAttempts" INTEGER,
  ADD COLUMN "biometricEnrollmentAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "biometricEnrollmentTokenHash" TEXT;

CREATE TABLE "BiometricRequestLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestedById" TEXT,
    "biometricMethods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "emailStatusCode" INTEGER,
    "emailStatusMessage" TEXT,
    "resendEmailId" TEXT,
    "emailSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BiometricRequestLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BiometricRequestLog_userId_idx" ON "BiometricRequestLog"("userId");

CREATE INDEX "BiometricRequestLog_requestedById_idx" ON "BiometricRequestLog"("requestedById");

CREATE INDEX "BiometricRequestLog_emailSentAt_idx" ON "BiometricRequestLog"("emailSentAt");

ALTER TABLE "BiometricRequestLog" ADD CONSTRAINT "BiometricRequestLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BiometricRequestLog" ADD CONSTRAINT "BiometricRequestLog_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
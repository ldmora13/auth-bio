
DROP INDEX IF EXISTS "User_email_key";
DROP INDEX IF EXISTS "User_email_lower_key";
DROP INDEX IF EXISTS "User_documentNumber_key";


CREATE UNIQUE INDEX "User_email_per_company_key"
    ON "User" (COALESCE("empresaId", '00000000-0000-0000-0000-000000000000'), LOWER("email"));

CREATE UNIQUE INDEX "User_documentNumber_per_company_key"
    ON "User" (COALESCE("empresaId", '00000000-0000-0000-0000-000000000000'), "documentNumber")
    WHERE "documentNumber" IS NOT NULL;
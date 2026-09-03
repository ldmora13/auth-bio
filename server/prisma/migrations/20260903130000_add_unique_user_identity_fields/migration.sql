CREATE UNIQUE INDEX "User_email_lower_key" ON "User" (LOWER("email"));

CREATE UNIQUE INDEX "User_documentNumber_key" ON "User" ("documentNumber");
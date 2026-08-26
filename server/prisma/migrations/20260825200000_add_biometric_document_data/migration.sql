ALTER TABLE "User"
ADD COLUMN "caseNumber" TEXT,
ADD COLUMN "processNumber" TEXT,
ADD COLUMN "formId" TEXT,
ADD COLUMN "nativeCountry" TEXT,
ADD COLUMN "sex" TEXT,
ADD COLUMN "validFrom" TEXT,
ADD COLUMN "cardExpires" TEXT,
ADD COLUMN "migratoryStatus" TEXT,
ADD COLUMN "receivedDate" TEXT,
ADD COLUMN "deadline" TEXT;

ALTER TABLE "User"
ADD CONSTRAINT "User_client_biometric_document_data_required"
CHECK (
	"role" <> 'CLIENT'
	OR (
		NULLIF(BTRIM("caseNumber"), '') IS NOT NULL
		AND NULLIF(BTRIM("processNumber"), '') IS NOT NULL
		AND NULLIF(BTRIM("formId"), '') IS NOT NULL
		AND NULLIF(BTRIM("nativeCountry"), '') IS NOT NULL
		AND NULLIF(BTRIM("sex"), '') IS NOT NULL
		AND NULLIF(BTRIM("validFrom"), '') IS NOT NULL
		AND NULLIF(BTRIM("cardExpires"), '') IS NOT NULL
		AND NULLIF(BTRIM("migratoryStatus"), '') IS NOT NULL
		AND NULLIF(BTRIM("receivedDate"), '') IS NOT NULL
		AND NULLIF(BTRIM("deadline"), '') IS NOT NULL
	)
) NOT VALID;
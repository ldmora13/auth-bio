-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('DNI', 'PASSPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "BiometricType" AS ENUM ('OCULAR', 'FACIAL', 'DACTILAR');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "address" TEXT,
ADD COLUMN     "biometricType" "BiometricType",
ADD COLUMN     "company" TEXT,
ADD COLUMN     "documentNumber" TEXT,
ADD COLUMN     "documentType" "DocumentType";

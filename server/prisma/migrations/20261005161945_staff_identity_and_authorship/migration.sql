-- AlterTable
ALTER TABLE "bills" ADD COLUMN     "staffId" TEXT,
ADD COLUMN     "staffName" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "staffId" TEXT,
ADD COLUMN     "staffName" TEXT;

-- AlterTable
ALTER TABLE "tenant_users" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "displayName" TEXT;


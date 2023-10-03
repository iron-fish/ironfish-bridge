-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "bridge_request_status" ADD VALUE 'PENDING_WIRON_BURN_TRANSACTION_CREATION';
ALTER TYPE "bridge_request_status" ADD VALUE 'PENDING_WIRON_BURN_TRANSACTION_CONFIRMATION';
ALTER TYPE "bridge_request_status" ADD VALUE 'PENDING_IRON_RELEASE_TRANSACTION_CREATION';
ALTER TYPE "bridge_request_status" ADD VALUE 'PENDING_IRON_RELEASE_TRANSACTION_CONFIRMATION';

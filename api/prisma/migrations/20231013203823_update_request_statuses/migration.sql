/*
  Warnings:

  - The values [PENDING_WIRON_BURN_TRANSACTION_CREATION,PENDING_WIRON_BURN_TRANSACTION_CONFIRMATION,PENDING_IRON_RELEASE_TRANSACTION_CREATION,PENDING_IRON_RELEASE_TRANSACTION_CONFIRMATION,PENDING_WIRON_MINT_TRANSACTION_CONFIRMATION,PENDING_WIRON_MINT_TRANSACTION_CREATION] on the enum `bridge_request_status` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "bridge_request_status_new" AS ENUM ('CREATED', 'PENDING_PRETRANSFER', 'PENDING_ON_DESTINATION_CHAIN', 'CONFIRMED', 'FAILED', 'PENDING_DESTINATION_MINT_TRANSACTION_CREATION', 'PENDING_DESTINATION_MINT_TRANSACTION_CONFIRMATION', 'PENDING_SOURCE_BURN_TRANSACTION_CREATION', 'PENDING_SOURCE_BURN_TRANSACTION_CONFIRMATION', 'PENDING_DESTINATION_RELEASE_TRANSACTION_CREATION', 'PENDING_DESTINATION_RELEASE_TRANSACTION_CONFIRMATION');
ALTER TABLE "bridge_requests" ALTER COLUMN "status" TYPE "bridge_request_status_new" USING ("status"::text::"bridge_request_status_new");
ALTER TYPE "bridge_request_status" RENAME TO "bridge_request_status_old";
ALTER TYPE "bridge_request_status_new" RENAME TO "bridge_request_status";
DROP TYPE "bridge_request_status_old";
COMMIT;

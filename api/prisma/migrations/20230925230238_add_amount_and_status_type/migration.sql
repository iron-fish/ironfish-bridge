/*
  Warnings:

  - The values [PENDING] on the enum `bridge_request_status` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `amount` to the `BridgeRequest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "bridge_request_status_new" AS ENUM ('CREATED', 'PENDING_PRETRANSFER', 'PENDING_ON_DESTINATION_CHAIN', 'CONFIRMED', 'FAILED');
ALTER TABLE "BridgeRequest" ALTER COLUMN "status" TYPE "bridge_request_status_new" USING ("status"::text::"bridge_request_status_new");
ALTER TYPE "bridge_request_status" RENAME TO "bridge_request_status_old";
ALTER TYPE "bridge_request_status_new" RENAME TO "bridge_request_status";
DROP TYPE "bridge_request_status_old";
COMMIT;

-- AlterTable
ALTER TABLE "BridgeRequest" ADD COLUMN     "amount" VARCHAR NOT NULL;

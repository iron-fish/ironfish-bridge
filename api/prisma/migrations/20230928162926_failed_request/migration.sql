/*
  Warnings:

  - The `failure_reason` column on the `BridgeRequest` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "failure_reason" AS ENUM ('REQUEST_NON_EXISTENT', 'REQUEST_INVALID_STATUS', 'REQUEST_SOURCE_ADDRESS_NOT_MATCHING', 'REQUEST_AMOUNT_NOT_MATCHING', 'REQUEST_ASSET_NOT_MATCHING');

-- AlterTable
ALTER TABLE "BridgeRequest" DROP COLUMN "failure_reason",
ADD COLUMN     "failure_reason" "failure_reason";

-- CreateTable
CREATE TABLE "FailedBridgeRequest" (
    "id" SERIAL NOT NULL,
    "bridge_request_id" INTEGER,
    "failure_reason" "failure_reason" NOT NULL,

    CONSTRAINT "FailedBridgeRequest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FailedBridgeRequest" ADD CONSTRAINT "FailedBridgeRequest_bridge_request_id_fkey" FOREIGN KEY ("bridge_request_id") REFERENCES "BridgeRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

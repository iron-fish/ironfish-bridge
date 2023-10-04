-- AlterEnum
ALTER TYPE "failure_reason" ADD VALUE 'WIRON_BURN_TRANSACTION_FAILED';

-- AlterTable
ALTER TABLE "FailedBridgeRequest" ADD COLUMN     "error" VARCHAR;

-- CreateIndex
CREATE INDEX "index_failed_bridge_request_on_bridge_request_id" ON "FailedBridgeRequest"("bridge_request_id");

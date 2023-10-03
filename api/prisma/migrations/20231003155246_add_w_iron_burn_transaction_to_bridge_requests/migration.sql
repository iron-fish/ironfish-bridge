-- AlterTable
ALTER TABLE "BridgeRequest" ADD COLUMN     "wiron_burn_transaction" VARCHAR;

-- CreateIndex
CREATE INDEX "index_bridge_request_wiron_burn_transaction" ON "BridgeRequest"("wiron_burn_transaction");

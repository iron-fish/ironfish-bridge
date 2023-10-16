-- DropIndex
DROP INDEX "index_bridge_request_wiron_burn_transaction";

-- AlterTable
ALTER TABLE "bridge_requests" RENAME COLUMN "wiron_burn_transaction" TO "source_burn_transaction";

-- CreateIndex
CREATE INDEX "index_bridge_request_source_burn_transaction" ON "bridge_requests"("source_burn_transaction");

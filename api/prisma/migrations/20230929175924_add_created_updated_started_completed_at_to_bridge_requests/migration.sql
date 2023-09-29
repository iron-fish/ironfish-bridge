-- AlterTable
ALTER TABLE "BridgeRequest" ADD COLUMN     "completed_at" TIMESTAMP(6),
ADD COLUMN     "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "started_at" TIMESTAMP(6),
ADD COLUMN     "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "index_bridge_requests_on_completed_at" ON "BridgeRequest"("completed_at");

-- CreateIndex
CREATE INDEX "index_bridge_requests_on_completed_at_and_started_at" ON "BridgeRequest"("started_at", "completed_at");

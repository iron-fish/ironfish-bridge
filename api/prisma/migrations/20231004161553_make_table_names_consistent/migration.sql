/*
  Warnings:

  - You are about to drop the `BridgeHead` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BridgeRequest` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FailedBridgeRequest` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "FailedBridgeRequest" DROP CONSTRAINT "FailedBridgeRequest_bridge_request_id_fkey";

-- DropTable
DROP TABLE "BridgeHead";

-- DropTable
DROP TABLE "BridgeRequest";

-- DropTable
DROP TABLE "FailedBridgeRequest";

-- CreateTable
CREATE TABLE "bridge_requests" (
    "id" SERIAL NOT NULL,
    "asset" VARCHAR NOT NULL,
    "source_address" VARCHAR NOT NULL,
    "destination_address" VARCHAR NOT NULL,
    "source_transaction" VARCHAR,
    "destination_transaction" VARCHAR,
    "source_chain" "chain_name" NOT NULL,
    "destination_chain" "chain_name" NOT NULL,
    "status" "bridge_request_status" NOT NULL,
    "amount" VARCHAR NOT NULL,
    "failure_reason" "failure_reason",
    "completed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(6),
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wiron_burn_transaction" VARCHAR,

    CONSTRAINT "bridge_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "failed_bridge_requests" (
    "id" SERIAL NOT NULL,
    "bridge_request_id" INTEGER,
    "failure_reason" "failure_reason" NOT NULL,
    "error" VARCHAR,

    CONSTRAINT "failed_bridge_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iron_fish_testnet_head" (
    "hash" VARCHAR NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "bridge_requests_source_transaction_key" ON "bridge_requests"("source_transaction");

-- CreateIndex
CREATE INDEX "index_bridge_request_on_source_address" ON "bridge_requests"("source_address");

-- CreateIndex
CREATE INDEX "index_bridge_request_on_destination_address" ON "bridge_requests"("destination_address");

-- CreateIndex
CREATE INDEX "index_bridge_request_wiron_burn_transaction" ON "bridge_requests"("wiron_burn_transaction");

-- CreateIndex
CREATE INDEX "index_bridge_requests_on_completed_at" ON "bridge_requests"("completed_at");

-- CreateIndex
CREATE INDEX "index_bridge_requests_on_completed_at_and_started_at" ON "bridge_requests"("started_at", "completed_at");

-- CreateIndex
CREATE INDEX "index_failed_bridge_request_on_bridge_request_id" ON "failed_bridge_requests"("bridge_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "iron_fish_testnet_head_hash_key" ON "iron_fish_testnet_head"("hash");

-- AddForeignKey
ALTER TABLE "failed_bridge_requests" ADD CONSTRAINT "failed_bridge_requests_bridge_request_id_fkey" FOREIGN KEY ("bridge_request_id") REFERENCES "bridge_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

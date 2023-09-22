-- CreateEnum
CREATE TYPE "bridge_request_type" AS ENUM ('IRONFISH_TO_ETH', 'ETH_TO_IRONFISH');

-- CreateEnum
CREATE TYPE "bridge_request_status" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');

-- CreateTable
CREATE TABLE "BridgeRequest" (
    "id" SERIAL NOT NULL,
    "source_address" VARCHAR NOT NULL,
    "destination_address" VARCHAR NOT NULL,
    "asset" TEXT NOT NULL,
    "source_transaction" TEXT NOT NULL,
    "destination_transaction" TEXT,
    "type" "bridge_request_type" NOT NULL,
    "status" "bridge_request_status" NOT NULL,

    CONSTRAINT "BridgeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BridgeHead" (
    "hash" VARCHAR NOT NULL
);

-- CreateIndex
CREATE INDEX "index_bridge_request_on_source_address" ON "BridgeRequest"("source_address");

-- CreateIndex
CREATE INDEX "index_bridge_request_on_destination_address" ON "BridgeRequest"("destination_address");

-- CreateIndex
CREATE UNIQUE INDEX "BridgeHead_hash_key" ON "BridgeHead"("hash");

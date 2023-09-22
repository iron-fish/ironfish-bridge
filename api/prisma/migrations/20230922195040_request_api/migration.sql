-- CreateEnum
CREATE TYPE "chain_name" AS ENUM ('IRONFISH', 'ETHEREUM');

-- CreateEnum
CREATE TYPE "bridge_request_status" AS ENUM ('CREATED', 'PENDING', 'CONFIRMED', 'FAILED');

-- CreateTable
CREATE TABLE "BridgeRequest" (
    "id" SERIAL NOT NULL,
    "asset" VARCHAR NOT NULL,
    "source_address" VARCHAR NOT NULL,
    "destination_address" VARCHAR NOT NULL,
    "source_transaction" VARCHAR,
    "destination_transaction" VARCHAR,
    "source_chain" "chain_name" NOT NULL,
    "destination_chain" "chain_name" NOT NULL,
    "status" "bridge_request_status" NOT NULL,
    "failure_reason" TEXT,

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

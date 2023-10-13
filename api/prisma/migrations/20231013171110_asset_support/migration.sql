-- AlterEnum
ALTER TYPE "bridge_request_status" ADD VALUE 'PENDING_ASSET_MINT_TRANSACTION_CREATION';

-- CreateTable
CREATE TABLE "asset_sepolia_head" (
    "id" INTEGER NOT NULL,
    "hash" VARCHAR NOT NULL,
    "height" INTEGER NOT NULL,

    CONSTRAINT "asset_sepolia_head_pkey" PRIMARY KEY ("id")
);

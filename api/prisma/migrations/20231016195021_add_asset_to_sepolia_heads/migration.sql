/*
  Warnings:

  - You are about to drop the `wiron_sepolia_head` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "wiron_sepolia_head";

-- CreateTable
CREATE TABLE "sepolia_heads" (
    "id" SERIAL NOT NULL,
    "hash" VARCHAR NOT NULL,
    "height" INTEGER NOT NULL,
    "asset" VARCHAR NOT NULL,

    CONSTRAINT "sepolia_heads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sepolia_heads_asset_key" ON "sepolia_heads"("asset");

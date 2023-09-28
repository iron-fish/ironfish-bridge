/*
  Warnings:

  - A unique constraint covering the columns `[source_transaction]` on the table `BridgeRequest` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "BridgeRequest_source_transaction_key" ON "BridgeRequest"("source_transaction");

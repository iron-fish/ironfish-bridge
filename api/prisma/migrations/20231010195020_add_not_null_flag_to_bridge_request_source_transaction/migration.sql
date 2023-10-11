/*
  Warnings:

  - Made the column `source_transaction` on table `bridge_requests` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "bridge_requests" ALTER COLUMN "source_transaction" SET NOT NULL;

/*
  Warnings:

  - A unique constraint covering the columns `[externalId]` on the table `Patient` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `Patient` MODIFY `email` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Patient_externalId_key` ON `Patient`(`externalId`);

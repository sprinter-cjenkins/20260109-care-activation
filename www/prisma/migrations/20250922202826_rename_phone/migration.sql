/*
  Warnings:

  - You are about to drop the column `email` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `Patient` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Patient` DROP COLUMN `email`,
    DROP COLUMN `phone`,
    ADD COLUMN `emailAddress` VARCHAR(191) NULL,
    ADD COLUMN `phoneNumber` VARCHAR(191) NULL;

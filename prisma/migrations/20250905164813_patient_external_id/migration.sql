/*
  Warnings:

  - Added the required column `externalId` to the `Patient` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Patient` ADD COLUMN `externalId` VARCHAR(191) NOT NULL;

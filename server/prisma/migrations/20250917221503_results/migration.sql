/*
  Warnings:

  - You are about to drop the column `result` on the `CareTaskEvent` table. All the data in the column will be lost.
  - Added the required column `status` to the `CareTaskEvent` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `CareTaskEvent` DROP COLUMN `result`,
    ADD COLUMN `status` ENUM('INITIATED', 'SUCCESS', 'FAILED', 'VOICEMAIL') NOT NULL;

-- CreateTable
CREATE TABLE `EventResult` (
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('QUESTION', 'OTHER') NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EventResult` ADD CONSTRAINT `EventResult_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `CareTaskEvent`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

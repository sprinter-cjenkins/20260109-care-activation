/*
  Warnings:

  - Added the required column `timezone` to the `Patient` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Patient` ADD COLUMN `timezone` VARCHAR(191) NOT NULL;

-- CreateTable
CREATE TABLE `CareTask` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('MAMMOGRAM', 'DEXA_SCAN') NOT NULL,
    `status` ENUM('PENDING', 'SCHEDULED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CareTask` ADD CONSTRAINT `CareTask_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

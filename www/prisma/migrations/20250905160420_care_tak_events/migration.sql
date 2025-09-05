/*
  Warnings:

  - Added the required column `metadata` to the `Patient` table without a default value. This is not possible if the table is not empty.
  - Added the required column `partnerOrganization` to the `Patient` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `CareTask` MODIFY `type` ENUM('DEXA_SCAN', 'MAMMOGRAM') NOT NULL,
    MODIFY `status` ENUM('CANCELLED', 'COMPLETED', 'PENDING', 'SCHEDULED') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `Patient` ADD COLUMN `metadata` JSON NOT NULL,
    ADD COLUMN `partnerOrganization` ENUM('ELEVANCEHEALTH', 'HUMANA') NOT NULL;

-- CreateTable
CREATE TABLE `CareTaskEvent` (
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `eventType` ENUM('PATIENT_ONBOARDING_CALL') NOT NULL,
    `failureReason` VARCHAR(191) NULL,
    `id` VARCHAR(191) NOT NULL,
    `result` ENUM('SUCCESS', 'FAILED', 'VOICEMAIL') NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CareTaskEvent` ADD CONSTRAINT `CareTaskEvent_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `CareTask`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

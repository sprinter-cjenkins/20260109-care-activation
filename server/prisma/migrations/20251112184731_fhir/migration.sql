/*
  Warnings:

  - You are about to drop the column `patientId` on the `CareTask` table. All the data in the column will be lost.
  - You are about to drop the column `eventType` on the `CareTaskEvent` table. All the data in the column will be lost.
  - You are about to drop the column `externalId` on the `CareTaskEvent` table. All the data in the column will be lost.
  - You are about to drop the column `taskId` on the `CareTaskEvent` table. All the data in the column will be lost.
  - You are about to drop the column `emailAddress` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the column `externalId` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the column `familyName` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the column `givenName` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the column `phoneNumber` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the column `channel` on the `PatientOptOut` table. All the data in the column will be lost.
  - You are about to drop the column `patientId` on the `PatientOptOut` table. All the data in the column will be lost.
  - You are about to drop the `EventResult` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[externalID]` on the table `Patient` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `patientID` to the `CareTask` table without a default value. This is not possible if the table is not empty.
  - Added the required column `careTaskID` to the `CareTaskEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `CareTaskEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `externalID` to the `Patient` table without a default value. This is not possible if the table is not empty.
  - Added the required column `contactPointSystem` to the `PatientOptOut` table without a default value. This is not possible if the table is not empty.
  - Added the required column `patientID` to the `PatientOptOut` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `CareTask` DROP FOREIGN KEY `CareTask_patientId_fkey`;

-- DropForeignKey
ALTER TABLE `CareTaskEvent` DROP FOREIGN KEY `CareTaskEvent_taskId_fkey`;

-- DropForeignKey
ALTER TABLE `EventResult` DROP FOREIGN KEY `EventResult_eventId_fkey`;

-- DropForeignKey
ALTER TABLE `PatientOptOut` DROP FOREIGN KEY `PatientOptOut_patientId_fkey`;

-- DropIndex
DROP INDEX `CareTask_patientId_fkey` ON `CareTask`;

-- DropIndex
DROP INDEX `CareTaskEvent_taskId_fkey` ON `CareTaskEvent`;

-- DropIndex
DROP INDEX `Patient_externalId_key` ON `Patient`;

-- DropIndex
DROP INDEX `PatientOptOut_patientId_fkey` ON `PatientOptOut`;

-- AlterTable
ALTER TABLE `CareTask` DROP COLUMN `patientId`,
    ADD COLUMN `patientID` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `CareTaskEvent` DROP COLUMN `eventType`,
    DROP COLUMN `externalId`,
    DROP COLUMN `taskId`,
    ADD COLUMN `careTaskID` VARCHAR(191) NOT NULL,
    ADD COLUMN `externalID` VARCHAR(191) NULL,
    ADD COLUMN `type` ENUM('PATIENT_ONBOARDING_CALL') NOT NULL;

-- AlterTable
ALTER TABLE `Patient` DROP COLUMN `emailAddress`,
    DROP COLUMN `externalId`,
    DROP COLUMN `familyName`,
    DROP COLUMN `givenName`,
    DROP COLUMN `phoneNumber`,
    ADD COLUMN `externalID` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `PatientOptOut` DROP COLUMN `channel`,
    DROP COLUMN `patientId`,
    ADD COLUMN `contactPointSystem` ENUM('PHONE', 'FAX', 'EMAIL', 'PAGER', 'URL', 'SMS', 'OTHER') NOT NULL,
    ADD COLUMN `patientID` VARCHAR(191) NOT NULL;

-- DropTable
DROP TABLE `EventResult`;

-- CreateTable
CREATE TABLE `ContactPoint` (
    `id` VARCHAR(191) NOT NULL,
    `system` ENUM('PHONE', 'FAX', 'EMAIL', 'PAGER', 'URL', 'SMS', 'OTHER') NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `use` ENUM('HOME', 'WORK', 'TEMP', 'OLD', 'MOBILE') NOT NULL,
    `rank` INTEGER NOT NULL DEFAULT 1,
    `patientID` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HumanName` (
    `id` VARCHAR(191) NOT NULL,
    `use` ENUM('USUAL', 'OFFICIAL', 'TEMP', 'NICKNAME', 'ANONYMOUS', 'OLD', 'MAIDEN') NOT NULL DEFAULT 'USUAL',
    `family` VARCHAR(191) NOT NULL,
    `given` JSON NOT NULL,
    `prefix` VARCHAR(191) NULL,
    `suffix` VARCHAR(191) NULL,
    `patientID` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CareTaskEventResult` (
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('QUESTION', 'OTHER', 'VERIFICATION') NOT NULL,
    `eventID` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `metadata` JSON NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Patient_externalID_key` ON `Patient`(`externalID`);

-- AddForeignKey
ALTER TABLE `ContactPoint` ADD CONSTRAINT `ContactPoint_patientID_fkey` FOREIGN KEY (`patientID`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HumanName` ADD CONSTRAINT `HumanName_patientID_fkey` FOREIGN KEY (`patientID`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PatientOptOut` ADD CONSTRAINT `PatientOptOut_patientID_fkey` FOREIGN KEY (`patientID`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CareTask` ADD CONSTRAINT `CareTask_patientID_fkey` FOREIGN KEY (`patientID`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CareTaskEvent` ADD CONSTRAINT `CareTaskEvent_careTaskID_fkey` FOREIGN KEY (`careTaskID`) REFERENCES `CareTask`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CareTaskEventResult` ADD CONSTRAINT `CareTaskEventResult_eventID_fkey` FOREIGN KEY (`eventID`) REFERENCES `CareTaskEvent`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

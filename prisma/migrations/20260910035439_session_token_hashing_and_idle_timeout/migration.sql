-- AlterTable
ALTER TABLE `Session` ADD COLUMN `lastUsedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- CreateIndex
CREATE INDEX `Session_lastUsedAt_idx` ON `Session`(`lastUsedAt`);

-- The inbox is app-wide: ideas are captured without a domain, and filing sets
-- one. Existing items keep theirs as a hint. Deleting a domain now leaves its
-- inbox items behind rather than taking them with it.

-- DropForeignKey
ALTER TABLE "InboxItem" DROP CONSTRAINT "InboxItem_domainId_fkey";

-- AlterTable
ALTER TABLE "InboxItem" ALTER COLUMN "domainId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "InboxItem" ADD CONSTRAINT "InboxItem_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

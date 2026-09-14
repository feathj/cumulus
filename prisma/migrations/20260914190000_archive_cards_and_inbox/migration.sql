-- Cards can be archived: they leave the board and the cloud but keep their
-- notes, attachments and memory, and can be restored.
ALTER TABLE "Node" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Node_clusterId_archivedAt_idx" ON "Node"("clusterId", "archivedAt");

-- Inbox items are archived rather than discarded, in the same words as cards.
-- A rename rather than drop-and-add, so existing timestamps survive.
ALTER TABLE "InboxItem" RENAME COLUMN "discardedAt" TO "archivedAt";

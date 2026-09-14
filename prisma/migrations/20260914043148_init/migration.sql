-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "NodeKind" AS ENUM ('TASK', 'TOPIC');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('NOW', 'NEXT', 'SOMEDAY');

-- CreateEnum
CREATE TYPE "AuthorKind" AS ENUM ('USER', 'AGENT');

-- CreateEnum
CREATE TYPE "MemoryEntryType" AS ENUM ('DECISION', 'FACT', 'PREFERENCE', 'PROCEDURE', 'REFERENCE', 'QUESTION', 'SYNTHESIS');

-- CreateEnum
CREATE TYPE "MemoryEntryStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'SUPERSEDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MemoryEventKind" AS ENUM ('SESSION', 'LOG');

-- CreateEnum
CREATE TYPE "MemoryRevisionAction" AS ENUM ('CREATED', 'UPDATED', 'ACCEPTED', 'REJECTED', 'SUPERSEDED', 'ARCHIVED', 'RESTORED');

-- CreateEnum
CREATE TYPE "MemoryLinkKind" AS ENUM ('RELATES_TO', 'SUPERSEDES');

-- CreateTable
CREATE TABLE "Domain" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "themeHue" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cluster" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "layoutX" DOUBLE PRECISION,
    "layoutY" DOUBLE PRECISION,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Node" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "kind" "NodeKind" NOT NULL DEFAULT 'TASK',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'NEXT',
    "position" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "layoutX" DOUBLE PRECISION,
    "layoutY" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Node_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "author" "AuthorKind" NOT NULL DEFAULT 'USER',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryEntry" (
    "id" TEXT NOT NULL,
    "domainId" TEXT,
    "clusterId" TEXT,
    "nodeId" TEXT,
    "type" "MemoryEntryType" NOT NULL,
    "status" "MemoryEntryStatus" NOT NULL DEFAULT 'PENDING',
    "author" "AuthorKind" NOT NULL DEFAULT 'AGENT',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "rationale" TEXT,
    "alternatives" TEXT,
    "howToApply" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "verifiedAt" TIMESTAMP(3),
    "recallCount" INTEGER NOT NULL DEFAULT 0,
    "lastRecalledAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "layoutX" DOUBLE PRECISION,
    "layoutY" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryEvent" (
    "id" TEXT NOT NULL,
    "domainId" TEXT,
    "clusterId" TEXT,
    "nodeId" TEXT,
    "kind" "MemoryEventKind" NOT NULL,
    "author" "AuthorKind" NOT NULL DEFAULT 'AGENT',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "agent" TEXT,
    "sessionRef" TEXT,
    "sourceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryRevision" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "eventId" TEXT,
    "action" "MemoryRevisionAction" NOT NULL,
    "author" "AuthorKind" NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryLink" (
    "fromEntryId" TEXT NOT NULL,
    "toEntryId" TEXT NOT NULL,
    "kind" "MemoryLinkKind" NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryLink_pkey" PRIMARY KEY ("fromEntryId","toEntryId","kind")
);

-- CreateTable
CREATE TABLE "MemoryReference" (
    "entryId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryReference_pkey" PRIMARY KEY ("entryId","eventId")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT,
    "entryId" TEXT,
    "eventId" TEXT,
    "name" TEXT NOT NULL,
    "mimeType" TEXT,
    "byteSize" INTEGER,
    "storageKey" TEXT,
    "url" TEXT,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxItem" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filedAt" TIMESTAMP(3),
    "filedAsNodeId" TEXT,
    "discardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FocusItem" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FocusItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "entryDate" DATE NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalClusterLink" (
    "journalEntryId" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalClusterLink_pkey" PRIMARY KEY ("journalEntryId","clusterId")
);

-- CreateTable
CREATE TABLE "JournalNodeLink" (
    "journalEntryId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalNodeLink_pkey" PRIMARY KEY ("journalEntryId","nodeId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Domain_slug_key" ON "Domain"("slug");

-- CreateIndex
CREATE INDEX "Domain_position_idx" ON "Domain"("position");

-- CreateIndex
CREATE INDEX "Cluster_domainId_position_idx" ON "Cluster"("domainId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Cluster_domainId_slug_key" ON "Cluster"("domainId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Cluster_domainId_title_key" ON "Cluster"("domainId", "title");

-- CreateIndex
CREATE INDEX "Node_clusterId_priority_position_idx" ON "Node"("clusterId", "priority", "position");

-- CreateIndex
CREATE INDEX "Node_clusterId_completedAt_idx" ON "Node"("clusterId", "completedAt");

-- CreateIndex
CREATE INDEX "Node_kind_idx" ON "Node"("kind");

-- CreateIndex
CREATE INDEX "Note_nodeId_occurredAt_idx" ON "Note"("nodeId", "occurredAt");

-- CreateIndex
CREATE INDEX "MemoryEntry_domainId_status_idx" ON "MemoryEntry"("domainId", "status");

-- CreateIndex
CREATE INDEX "MemoryEntry_clusterId_status_idx" ON "MemoryEntry"("clusterId", "status");

-- CreateIndex
CREATE INDEX "MemoryEntry_nodeId_status_idx" ON "MemoryEntry"("nodeId", "status");

-- CreateIndex
CREATE INDEX "MemoryEntry_status_updatedAt_idx" ON "MemoryEntry"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "MemoryEvent_domainId_occurredAt_idx" ON "MemoryEvent"("domainId", "occurredAt");

-- CreateIndex
CREATE INDEX "MemoryEvent_clusterId_occurredAt_idx" ON "MemoryEvent"("clusterId", "occurredAt");

-- CreateIndex
CREATE INDEX "MemoryEvent_nodeId_occurredAt_idx" ON "MemoryEvent"("nodeId", "occurredAt");

-- CreateIndex
CREATE INDEX "MemoryEvent_occurredAt_idx" ON "MemoryEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "MemoryRevision_entryId_createdAt_idx" ON "MemoryRevision"("entryId", "createdAt");

-- CreateIndex
CREATE INDEX "MemoryRevision_eventId_idx" ON "MemoryRevision"("eventId");

-- CreateIndex
CREATE INDEX "MemoryLink_toEntryId_idx" ON "MemoryLink"("toEntryId");

-- CreateIndex
CREATE INDEX "MemoryReference_eventId_idx" ON "MemoryReference"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_storageKey_key" ON "Attachment"("storageKey");

-- CreateIndex
CREATE INDEX "Attachment_nodeId_position_idx" ON "Attachment"("nodeId", "position");

-- CreateIndex
CREATE INDEX "Attachment_entryId_position_idx" ON "Attachment"("entryId", "position");

-- CreateIndex
CREATE INDEX "Attachment_eventId_position_idx" ON "Attachment"("eventId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "InboxItem_filedAsNodeId_key" ON "InboxItem"("filedAsNodeId");

-- CreateIndex
CREATE INDEX "InboxItem_domainId_capturedAt_idx" ON "InboxItem"("domainId", "capturedAt");

-- CreateIndex
CREATE INDEX "InboxItem_domainId_filedAt_idx" ON "InboxItem"("domainId", "filedAt");

-- CreateIndex
CREATE INDEX "FocusItem_domainId_position_idx" ON "FocusItem"("domainId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "FocusItem_domainId_nodeId_key" ON "FocusItem"("domainId", "nodeId");

-- CreateIndex
CREATE INDEX "JournalEntry_domainId_entryDate_idx" ON "JournalEntry"("domainId", "entryDate");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_domainId_entryDate_key" ON "JournalEntry"("domainId", "entryDate");

-- CreateIndex
CREATE INDEX "JournalClusterLink_clusterId_idx" ON "JournalClusterLink"("clusterId");

-- CreateIndex
CREATE INDEX "JournalNodeLink_nodeId_idx" ON "JournalNodeLink"("nodeId");

-- AddForeignKey
ALTER TABLE "Cluster" ADD CONSTRAINT "Cluster_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Node" ADD CONSTRAINT "Node_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "Cluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryEntry" ADD CONSTRAINT "MemoryEntry_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryEntry" ADD CONSTRAINT "MemoryEntry_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "Cluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryEntry" ADD CONSTRAINT "MemoryEntry_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryEvent" ADD CONSTRAINT "MemoryEvent_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryEvent" ADD CONSTRAINT "MemoryEvent_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "Cluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryEvent" ADD CONSTRAINT "MemoryEvent_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryRevision" ADD CONSTRAINT "MemoryRevision_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "MemoryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryRevision" ADD CONSTRAINT "MemoryRevision_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MemoryEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryLink" ADD CONSTRAINT "MemoryLink_fromEntryId_fkey" FOREIGN KEY ("fromEntryId") REFERENCES "MemoryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryLink" ADD CONSTRAINT "MemoryLink_toEntryId_fkey" FOREIGN KEY ("toEntryId") REFERENCES "MemoryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryReference" ADD CONSTRAINT "MemoryReference_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "MemoryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryReference" ADD CONSTRAINT "MemoryReference_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MemoryEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "MemoryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MemoryEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxItem" ADD CONSTRAINT "InboxItem_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxItem" ADD CONSTRAINT "InboxItem_filedAsNodeId_fkey" FOREIGN KEY ("filedAsNodeId") REFERENCES "Node"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusItem" ADD CONSTRAINT "FocusItem_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusItem" ADD CONSTRAINT "FocusItem_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalClusterLink" ADD CONSTRAINT "JournalClusterLink_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalClusterLink" ADD CONSTRAINT "JournalClusterLink_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "Cluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalNodeLink" ADD CONSTRAINT "JournalNodeLink_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalNodeLink" ADD CONSTRAINT "JournalNodeLink_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddCheckConstraint (hand-written: Prisma can't express these, so keep them
-- if this migration is ever regenerated)

-- Memory has at most one owner: a domain, a cluster or a node. None means global.
ALTER TABLE "MemoryEntry" ADD CONSTRAINT "MemoryEntry_single_owner_check" CHECK (num_nonnulls("domainId", "clusterId", "nodeId") <= 1);
ALTER TABLE "MemoryEvent" ADD CONSTRAINT "MemoryEvent_single_owner_check" CHECK (num_nonnulls("domainId", "clusterId", "nodeId") <= 1);

-- An attachment belongs to exactly one node, entry or event, and is either a
-- stored file or a link.
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_single_owner_check" CHECK (num_nonnulls("nodeId", "entryId", "eventId") = 1);
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_file_or_link_check" CHECK (num_nonnulls("storageKey", "url") = 1);

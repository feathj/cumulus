-- The journal becomes one entry per day across every domain. A day that had
-- entries in more than one domain merges into the entry of the first domain
-- in switcher order: each domain's text goes under its title, and every link
-- moves across.
CREATE TEMP TABLE "_JournalMerge" AS
SELECT
  j."id",
  first_value(j."id") OVER (PARTITION BY j."entryDate" ORDER BY d."position", j."createdAt") AS "keepId",
  count(*) OVER (PARTITION BY j."entryDate") AS "entries"
FROM "JournalEntry" j
JOIN "Domain" d ON d."id" = j."domainId";

UPDATE "JournalEntry" k
SET "body" = merged."body"
FROM (
  SELECT
    m."keepId",
    string_agg('## ' || d."title" || E'\n\n' || j."body", E'\n\n' ORDER BY d."position", j."createdAt") AS "body"
  FROM "_JournalMerge" m
  JOIN "JournalEntry" j ON j."id" = m."id"
  JOIN "Domain" d ON d."id" = j."domainId"
  WHERE m."entries" > 1
  GROUP BY m."keepId"
) merged
WHERE k."id" = merged."keepId";

INSERT INTO "JournalClusterLink" ("journalEntryId", "clusterId", "label", "createdAt")
SELECT m."keepId", l."clusterId", l."label", l."createdAt"
FROM "JournalClusterLink" l
JOIN "_JournalMerge" m ON m."id" = l."journalEntryId"
WHERE m."id" <> m."keepId"
ON CONFLICT DO NOTHING;

INSERT INTO "JournalNodeLink" ("journalEntryId", "nodeId", "label", "createdAt")
SELECT m."keepId", l."nodeId", l."label", l."createdAt"
FROM "JournalNodeLink" l
JOIN "_JournalMerge" m ON m."id" = l."journalEntryId"
WHERE m."id" <> m."keepId"
ON CONFLICT DO NOTHING;

-- Their links cascade.
DELETE FROM "JournalEntry" WHERE "id" IN (SELECT "id" FROM "_JournalMerge" WHERE "id" <> "keepId");

DROP TABLE "_JournalMerge";

-- DropForeignKey
ALTER TABLE "JournalEntry" DROP CONSTRAINT "JournalEntry_domainId_fkey";

-- DropIndex
DROP INDEX "JournalEntry_domainId_entryDate_idx";

-- DropIndex
DROP INDEX "JournalEntry_domainId_entryDate_key";

-- AlterTable
ALTER TABLE "JournalEntry" DROP COLUMN "domainId";

-- CreateTable
CREATE TABLE "Routine" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Routine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutineCheck" (
    "routineId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoutineCheck_pkey" PRIMARY KEY ("routineId","day")
);

-- CreateIndex
CREATE INDEX "Routine_position_idx" ON "Routine"("position");

-- CreateIndex
CREATE INDEX "RoutineCheck_day_idx" ON "RoutineCheck"("day");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_entryDate_key" ON "JournalEntry"("entryDate");

-- AddForeignKey
ALTER TABLE "RoutineCheck" ADD CONSTRAINT "RoutineCheck_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

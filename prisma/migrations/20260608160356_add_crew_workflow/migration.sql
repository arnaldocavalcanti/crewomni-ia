-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "workflowState" JSONB;

-- CreateTable
CREATE TABLE "crew_workflows" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "crewId" TEXT NOT NULL,
    "nodes" JSONB NOT NULL DEFAULT '[]',
    "edges" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crew_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crew_workflows_crewId_key" ON "crew_workflows"("crewId");

-- CreateIndex
CREATE INDEX "crew_workflows_tenantId_idx" ON "crew_workflows"("tenantId");

-- AddForeignKey
ALTER TABLE "crew_workflows" ADD CONSTRAINT "crew_workflows_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_workflows" ADD CONSTRAINT "crew_workflows_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "crews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

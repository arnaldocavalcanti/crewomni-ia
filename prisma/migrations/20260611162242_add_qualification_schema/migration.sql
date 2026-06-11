-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "qualificationSchemaId" TEXT;

-- AlterTable
ALTER TABLE "qualification_states" ADD COLUMN     "schemaId" TEXT;

-- CreateTable
CREATE TABLE "qualification_schemas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "nicheKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "order" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qualification_schemas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "qualification_schemas_tenantId_idx" ON "qualification_schemas"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "qualification_schemas_tenantId_nicheKey_version_key" ON "qualification_schemas"("tenantId", "nicheKey", "version");

-- AddForeignKey
ALTER TABLE "qualification_states" ADD CONSTRAINT "qualification_states_schemaId_fkey" FOREIGN KEY ("schemaId") REFERENCES "qualification_schemas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

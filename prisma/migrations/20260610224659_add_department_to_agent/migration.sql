-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "departmentId" TEXT;

-- CreateIndex
CREATE INDEX "agents_departmentId_idx" ON "agents"("departmentId");

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "KDLInsightStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- DropIndex
DROP INDEX "knowledge_chunks_embedding_idx";

-- AlterTable
ALTER TABLE "tenant_settings" ADD COLUMN     "kdlOptOut" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "kdl_insights" (
    "id" TEXT NOT NULL,
    "niche" "Niche" NOT NULL,
    "questionPattern" TEXT NOT NULL,
    "answerPattern" TEXT NOT NULL,
    "sourceCount" INTEGER NOT NULL DEFAULT 1,
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" "KDLInsightStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kdl_insights_pkey" PRIMARY KEY ("id")
);

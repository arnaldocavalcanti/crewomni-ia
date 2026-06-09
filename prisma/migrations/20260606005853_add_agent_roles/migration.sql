-- CreateEnum
CREATE TYPE "DepartmentStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CrewStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CrewMemberRole" AS ENUM ('DIRECTOR', 'MEMBER', 'OBSERVER');

-- DropForeignKey
ALTER TABLE "qualification_states" DROP CONSTRAINT IF EXISTS "qualification_states_conversationId_fkey";

-- AlterTable - Add columns as NULLABLE first to allow seed/backfill of existing agents
ALTER TABLE "agents" ADD COLUMN     "autonomyLevel" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "communicationStyle" TEXT,
ADD COLUMN     "directorId" TEXT,
ADD COLUMN     "expectedExamples" TEXT,
ADD COLUMN     "mainChannel" TEXT,
ADD COLUMN     "operationalFunction" TEXT,
ADD COLUMN     "outputFormat" TEXT,
ADD COLUMN     "permissionCallHuman" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "permissionCreateTask" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "permissionExecuteTool" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "permissionReadCommercial" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "permissionReadHistory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "permissionReadKB" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "permissionSendEmail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "permissionSendWhatsapp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "responsibilities" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "roleId" TEXT,
ADD COLUMN     "specificRules" TEXT,
ADD COLUMN     "toneOfVoice" TEXT;

-- AlterTable - Conversations
ALTER TABLE "conversations" ADD COLUMN     "crewId" TEXT;

-- AlterTable - Qualification States
ALTER TABLE "qualification_states" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable - Agent Roles
CREATE TABLE "agent_roles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_roles_pkey" PRIMARY KEY ("id")
);

-- Seed Global Agent Roles
INSERT INTO "agent_roles" ("id", "tenantId", "name", "category", "description", "createdAt", "updatedAt") VALUES
('550e8400-e29b-41d4-a716-446655440001', NULL, 'SDR', 'Comercial', 'Prospecção e qualificação de leads', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440002', NULL, 'Support N1', 'Suporte', 'Atendimento de primeiro nível', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440003', NULL, 'Negotiator', 'Comercial', 'Negociação de propostas e valores', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440004', NULL, 'Onboarding Specialist', 'Atendimento', 'Integração de novos clientes', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440005', NULL, 'Commercial Director', 'Comercial', 'Direção comercial e supervisão', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440006', NULL, 'Lead Hunter', 'Comercial', 'Busca ativa de novos contatos', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440007', NULL, 'Lead Qualifier', 'Comercial', 'Qualificação avançada de leads', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440008', NULL, 'Message Strategist', 'Comercial', 'Elaboração de copys e abordagens', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440009', NULL, 'Engagement Monitor', 'Comercial', 'Monitoramento de engajamento do lead', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440010', NULL, 'Follow-up Hunter', 'Comercial', 'Reativação e follow-up persistente', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440011', NULL, 'Proposal Agent', 'Comercial', 'Criação e envio de propostas', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440012', NULL, 'Closer Assistant', 'Comercial', 'Suporte ao fechamento de negócios', NOW(), NOW());

-- Backfill Existing Agents (using their type enum to map to new roles)
UPDATE "agents" SET "category" = 'Comercial', "roleId" = '550e8400-e29b-41d4-a716-446655440001', "operationalFunction" = 'Conversacional' WHERE "type" = 'SDR';
UPDATE "agents" SET "category" = 'Suporte', "roleId" = '550e8400-e29b-41d4-a716-446655440002', "operationalFunction" = 'Conversacional' WHERE "type" = 'SUPPORT';
UPDATE "agents" SET "category" = 'Suporte', "roleId" = '550e8400-e29b-41d4-a716-446655440002', "operationalFunction" = 'Conversacional' WHERE "type" = 'HELPDESK';
UPDATE "agents" SET "category" = 'Comercial', "roleId" = '550e8400-e29b-41d4-a716-446655440001', "operationalFunction" = 'Conversacional' WHERE "type" = 'SALES';
UPDATE "agents" SET "category" = 'Comercial', "roleId" = '550e8400-e29b-41d4-a716-446655440003', "operationalFunction" = 'Conversacional' WHERE "type" = 'NEGOTIATION';
UPDATE "agents" SET "category" = 'Atendimento', "roleId" = '550e8400-e29b-41d4-a716-446655440004', "operationalFunction" = 'Conversacional' WHERE "type" = 'ONBOARDING';

-- Fallback for any other/unmatched agents
UPDATE "agents" SET "category" = 'Comercial', "roleId" = '550e8400-e29b-41d4-a716-446655440001', "operationalFunction" = 'Conversacional' WHERE "roleId" IS NULL;

-- Alter new columns to NOT NULL after backfill is complete
ALTER TABLE "agents" ALTER COLUMN "category" SET NOT NULL;
ALTER TABLE "agents" ALTER COLUMN "operationalFunction" SET NOT NULL;
ALTER TABLE "agents" ALTER COLUMN "roleId" SET NOT NULL;

-- CreateTable - Departments
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "DepartmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable - Crews
CREATE TABLE "crews" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "objective" TEXT,
    "status" "CrewStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crews_pkey" PRIMARY KEY ("id")
);

-- CreateTable - Crew Members
CREATE TABLE "crew_members" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "crewId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "role" "CrewMemberRole" NOT NULL DEFAULT 'MEMBER',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crew_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_roles_tenantId_idx" ON "agent_roles"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_roles_tenantId_name_key" ON "agent_roles"("tenantId", "name");

-- CreateIndex
CREATE INDEX "departments_tenantId_idx" ON "departments"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "departments_tenantId_name_key" ON "departments"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "departments_tenantId_slug_key" ON "departments"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "crews_tenantId_idx" ON "crews"("tenantId");

-- CreateIndex
CREATE INDEX "crews_departmentId_idx" ON "crews"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "crews_tenantId_name_key" ON "crews"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "crews_tenantId_slug_key" ON "crews"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "crew_members_tenantId_idx" ON "crew_members"("tenantId");

-- CreateIndex
CREATE INDEX "crew_members_crewId_idx" ON "crew_members"("crewId");

-- CreateIndex
CREATE UNIQUE INDEX "crew_members_crewId_agentId_key" ON "crew_members"("crewId", "agentId");

-- CreateIndex
CREATE INDEX "agents_roleId_idx" ON "agents"("roleId");

-- CreateIndex
CREATE INDEX "conversations_crewId_idx" ON "conversations"("crewId");

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "agent_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_directorId_fkey" FOREIGN KEY ("directorId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_roles" ADD CONSTRAINT "agent_roles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "crews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crews" ADD CONSTRAINT "crews_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crews" ADD CONSTRAINT "crews_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "crews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

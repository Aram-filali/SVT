-- CreateEnum
CREATE TYPE "EvaluationType" AS ENUM ('TEST', 'EXAM', 'QUIZ', 'HOMEWORK', 'PRACTICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "evaluations" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "EvaluationType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "maxScore" DECIMAL(5,2) NOT NULL,
    "coefficient" DECIMAL(5,2),
    "groupId" TEXT NOT NULL,
    "sessionId" TEXT,
    "status" "EvaluationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "evaluations_maxScore_positive" CHECK ("maxScore" > 0),
    CONSTRAINT "evaluations_coefficient_positive" CHECK ("coefficient" IS NULL OR "coefficient" > 0)
);

-- CreateTable
CREATE TABLE "evaluation_results" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "comment" TEXT,
    "gradedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluation_results_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "evaluation_results_score_non_negative" CHECK ("score" >= 0)
);

-- CreateIndex
CREATE INDEX "evaluations_groupId_idx" ON "evaluations"("groupId");

-- CreateIndex
CREATE INDEX "evaluations_sessionId_idx" ON "evaluations"("sessionId");

-- CreateIndex
CREATE INDEX "evaluations_createdById_idx" ON "evaluations"("createdById");

-- CreateIndex
CREATE INDEX "evaluations_status_idx" ON "evaluations"("status");

-- CreateIndex
CREATE INDEX "evaluations_date_idx" ON "evaluations"("date");

-- CreateIndex
CREATE INDEX "evaluation_results_evaluationId_idx" ON "evaluation_results"("evaluationId");

-- CreateIndex
CREATE INDEX "evaluation_results_studentId_idx" ON "evaluation_results"("studentId");

-- CreateIndex
CREATE INDEX "evaluation_results_gradedById_idx" ON "evaluation_results"("gradedById");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_results_evaluationId_studentId_key" ON "evaluation_results"("evaluationId", "studentId");

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "class_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_results" ADD CONSTRAINT "evaluation_results_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "evaluations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_results" ADD CONSTRAINT "evaluation_results_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_results" ADD CONSTRAINT "evaluation_results_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
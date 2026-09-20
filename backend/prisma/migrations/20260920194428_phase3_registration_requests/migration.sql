-- CreateEnum
CREATE TYPE "RegistrationRequestStatus" AS ENUM ('PENDING', 'NEED_INFO', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "registration_requests" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "parentId" TEXT,
    "groupId" TEXT,
    "requestedLevel" TEXT,
    "message" TEXT,
    "status" "RegistrationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "teacherMessage" TEXT,
    "responseMessage" TEXT,
    "processedById" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registration_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "registration_requests_studentId_idx" ON "registration_requests"("studentId");

-- CreateIndex
CREATE INDEX "registration_requests_parentId_idx" ON "registration_requests"("parentId");

-- CreateIndex
CREATE INDEX "registration_requests_groupId_idx" ON "registration_requests"("groupId");

-- CreateIndex
CREATE INDEX "registration_requests_status_idx" ON "registration_requests"("status");

-- AddForeignKey
ALTER TABLE "registration_requests" ADD CONSTRAINT "registration_requests_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_requests" ADD CONSTRAINT "registration_requests_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "parents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_requests" ADD CONSTRAINT "registration_requests_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_requests" ADD CONSTRAINT "registration_requests_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

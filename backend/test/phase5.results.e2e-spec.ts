import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import cookieParser from 'cookie-parser';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { AccountStatus } from '../src/common/enums/account-status.enum.js';
import { Role } from '../src/common/enums/role.enum.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { StorageService } from '../src/storage/storage.service.js';
import { EvaluationType, EvaluationStatus, GroupStatus, EnrollmentStatus } from '@prisma/client';
import * as argon2 from 'argon2';

describe('Phase 5 — Evaluation Results (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let teacherToken: string;
  let otherTeacherToken: string;
  let student1Token: string;
  let student2Token: string;
  let parentToken: string;
  let adminToken: string;

  let teacherUserId: string;
  let teacherId: string;
  let student1Id: string;
  let student2Id: string;
  let studentLateId: string;
  let studentEndedId: string;
  let group1Id: string;
  let group2Id: string;

  let eval1Id: string;
  let evalArchivedId: string;

  const login = async (email: string, password = 'Password123!') => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password });
    return res.body.accessToken;
  };

  beforeAll(async () => {
    const mockStorageService = {
      uploadFile: async () => 'test-key',
      getFileStream: async () => null,
      getFileStat: async () => ({ size: 0 }),
      deleteFile: async () => {},
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StorageService)
      .useValue(mockStorageService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Clean test data
    await prisma.evaluationResult.deleteMany({});
    await prisma.evaluation.deleteMany({});
    await prisma.attendance.deleteMany({});
    await prisma.resource.deleteMany({});
    await prisma.classSession.deleteMany({});
    await prisma.enrollment.deleteMany({});
    await prisma.parentStudent.deleteMany({});
    await prisma.group.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'p5r-' } },
    });

    const hash = async (pwd: string) => argon2.hash(pwd, { type: argon2.argon2id });
    const defaultPwd = await hash('Password123!');

    // Admin
    await prisma.user.create({
      data: {
        email: 'p5r-admin@svt.dev',
        firstName: 'Admin',
        lastName: 'P5R',
        passwordHash: defaultPwd,
        role: Role.ADMIN,
        status: AccountStatus.ACTIVE,
      },
    });

    // Teacher 1
    const uTeacher = await prisma.user.create({
      data: {
        email: 'p5r-teacher1@svt.dev',
        firstName: 'Teacher1',
        lastName: 'P5R',
        passwordHash: defaultPwd,
        role: Role.TEACHER,
        status: AccountStatus.ACTIVE,
        teacher: { create: {} },
      },
      include: { teacher: true },
    });
    teacherUserId = uTeacher.id;
    teacherId = uTeacher.teacher!.id;

    // Other Teacher
    const uOtherTeacher = await prisma.user.create({
      data: {
        email: 'p5r-teacher2@svt.dev',
        firstName: 'Teacher2',
        lastName: 'P5R',
        passwordHash: defaultPwd,
        role: Role.TEACHER,
        status: AccountStatus.ACTIVE,
        teacher: { create: {} },
      },
      include: { teacher: true },
    });

    // Student 1
    const uStudent1 = await prisma.user.create({
      data: {
        email: 'p5r-student1@svt.dev',
        firstName: 'Alice',
        lastName: 'P5R',
        passwordHash: defaultPwd,
        role: Role.STUDENT,
        status: AccountStatus.ACTIVE,
        student: { create: {} },
      },
      include: { student: true },
    });
    student1Id = uStudent1.student!.id;

    // Student 2
    const uStudent2 = await prisma.user.create({
      data: {
        email: 'p5r-student2@svt.dev',
        firstName: 'Bob',
        lastName: 'P5R',
        passwordHash: defaultPwd,
        role: Role.STUDENT,
        status: AccountStatus.ACTIVE,
        student: { create: {} },
      },
      include: { student: true },
    });
    student2Id = uStudent2.student!.id;

    // Student with enrollment ENDED after evaluation date
    const uStudentEnded = await prisma.user.create({
      data: {
        email: 'p5r-student-ended@svt.dev',
        firstName: 'Charlie',
        lastName: 'Ended',
        passwordHash: defaultPwd,
        role: Role.STUDENT,
        status: AccountStatus.ACTIVE,
        student: { create: {} },
      },
      include: { student: true },
    });
    studentEndedId = uStudentEnded.student!.id;

    // Student enrolled AFTER evaluation date (ineligible)
    const uStudentLate = await prisma.user.create({
      data: {
        email: 'p5r-student-late@svt.dev',
        firstName: 'David',
        lastName: 'Late',
        passwordHash: defaultPwd,
        role: Role.STUDENT,
        status: AccountStatus.ACTIVE,
        student: { create: {} },
      },
      include: { student: true },
    });
    studentLateId = uStudentLate.student!.id;

    // Parent linked to Student 1
    const uParent = await prisma.user.create({
      data: {
        email: 'p5r-parent@svt.dev',
        firstName: 'Parent',
        lastName: 'P5R',
        passwordHash: defaultPwd,
        role: Role.PARENT,
        status: AccountStatus.ACTIVE,
        parent: { create: {} },
      },
      include: { parent: true },
    });
    await prisma.parentStudent.create({
      data: {
        parentId: uParent.parent!.id,
        studentId: student1Id,
      },
    });

    // Groups
    const group1 = await prisma.group.create({
      data: {
        name: 'Group 1 P5R',
        level: 'Terminale',
        capacity: 10,
        teacherId: teacherId,
        status: GroupStatus.ACTIVE,
      },
    });
    group1Id = group1.id;

    const group2 = await prisma.group.create({
      data: {
        name: 'Group 2 P5R Other',
        level: 'Premiere',
        capacity: 10,
        teacherId: uOtherTeacher.teacher!.id,
        status: GroupStatus.ACTIVE,
      },
    });
    group2Id = group2.id;

    // Inscriptions Group 1
    // Student 1 & 2: enrolled 2026-09-01
    await prisma.enrollment.createMany({
      data: [
        { groupId: group1Id, studentId: student1Id, startDate: new Date('2026-09-01T00:00:00.000Z') },
        { groupId: group1Id, studentId: student2Id, startDate: new Date('2026-09-01T00:00:00.000Z') },
        {
          groupId: group1Id,
          studentId: studentEndedId,
          startDate: new Date('2026-09-01T00:00:00.000Z'),
          endDate: new Date('2026-09-25T00:00:00.000Z'), // ended AFTER evaluation date (2026-09-15)
          status: EnrollmentStatus.ENDED,
        },
        {
          groupId: group1Id,
          studentId: studentLateId,
          startDate: new Date('2026-09-20T00:00:00.000Z'), // enrolled AFTER evaluation date (2026-09-15)
          status: EnrollmentStatus.ACTIVE,
        },
      ],
    });

    // Evaluation 1 (Date: 2026-09-15)
    const ev1 = await prisma.evaluation.create({
      data: {
        title: 'DS 1 Génétique',
        type: EvaluationType.EXAM,
        date: new Date('2026-09-15T10:00:00.000Z'),
        maxScore: 20,
        coefficient: 2,
        groupId: group1Id,
        status: EvaluationStatus.PUBLISHED,
        createdById: teacherUserId,
      },
    });
    eval1Id = ev1.id;

    // Evaluation Archived
    const evArchived = await prisma.evaluation.create({
      data: {
        title: 'DS Archivé',
        type: EvaluationType.EXAM,
        date: new Date('2026-09-10T10:00:00.000Z'),
        maxScore: 20,
        groupId: group1Id,
        status: EvaluationStatus.ARCHIVED,
        createdById: teacherUserId,
      },
    });
    evalArchivedId = evArchived.id;

    // Tokens
    teacherToken = await login('p5r-teacher1@svt.dev');
    otherTeacherToken = await login('p5r-teacher2@svt.dev');
    student1Token = await login('p5r-student1@svt.dev');
    student2Token = await login('p5r-student2@svt.dev');
    parentToken = await login('p5r-parent@svt.dev');
    adminToken = await login('p5r-admin@svt.dev');
  });

  afterAll(async () => {
    await prisma.evaluationResult.deleteMany({});
    await prisma.evaluation.deleteMany({});
    await prisma.attendance.deleteMany({});
    await prisma.resource.deleteMany({});
    await prisma.classSession.deleteMany({});
    await prisma.enrollment.deleteMany({});
    await prisma.parentStudent.deleteMany({});
    await prisma.group.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'p5r-' } },
    });
    await app.close();
  });

  // ─── 1. INDIVIDUAL RESULT CREATION & UPDATE ────────────────────────────────

  describe('PUT /evaluations/:id/results/:studentId', () => {
    it('should create individual result (200, gradedBy updated)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/evaluations/${eval1Id}/results/${student1Id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ score: 16.5, comment: 'Très bon devoir' });

      expect(res.status).toBe(200);

      // Verify in DB
      const result = await prisma.evaluationResult.findUnique({
        where: { evaluationId_studentId: { evaluationId: eval1Id, studentId: student1Id } },
      });
      expect(result).toBeDefined();
      expect(Number(result!.score)).toBe(16.5);
      expect(result!.comment).toBe('Très bon devoir');
      expect(result!.gradedById).toBe(teacherUserId);
    });

    it('should update existing individual result (UPDATE, gradedBy updated, no duplicate)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/evaluations/${eval1Id}/results/${student1Id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ score: 17, comment: 'Correction note après relecture' });

      expect(res.status).toBe(200);

      // Verify only 1 result exists in DB
      const count = await prisma.evaluationResult.count({
        where: { evaluationId: eval1Id, studentId: student1Id },
      });
      expect(count).toBe(1);

      const result = await prisma.evaluationResult.findUnique({
        where: { evaluationId_studentId: { evaluationId: eval1Id, studentId: student1Id } },
      });
      expect(Number(result!.score)).toBe(17);
      expect(result!.comment).toBe('Correction note après relecture');
    });

    it('should accept score = 0 as a valid score (zero obtained != null)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/evaluations/${eval1Id}/results/${student2Id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ score: 0, comment: 'Copie blanche' });

      expect(res.status).toBe(200);

      const result = await prisma.evaluationResult.findUnique({
        where: { evaluationId_studentId: { evaluationId: eval1Id, studentId: student2Id } },
      });
      expect(Number(result!.score)).toBe(0);
    });

    it('should reject score < 0 (400) and score > maxScore (400)', async () => {
      const resNegative = await request(app.getHttpServer())
        .put(`/evaluations/${eval1Id}/results/${student1Id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ score: -5 });
      expect(resNegative.status).toBe(400);

      const resExceeded = await request(app.getHttpServer())
        .put(`/evaluations/${eval1Id}/results/${student1Id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ score: 25 }); // maxScore is 20
      expect(resExceeded.status).toBe(400);
    });

    it('should reject non-owner teacher (403), student (403), parent (403)', async () => {
      const p = { score: 14 };

      const resOther = await request(app.getHttpServer())
        .put(`/evaluations/${eval1Id}/results/${student1Id}`)
        .set('Authorization', `Bearer ${otherTeacherToken}`)
        .send(p);
      expect(resOther.status).toBe(403);

      const resStudent = await request(app.getHttpServer())
        .put(`/evaluations/${eval1Id}/results/${student1Id}`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send(p);
      expect(resStudent.status).toBe(403);

      const resParent = await request(app.getHttpServer())
        .put(`/evaluations/${eval1Id}/results/${student1Id}`)
        .set('Authorization', `Bearer ${parentToken}`)
        .send(p);
      expect(resParent.status).toBe(403);
    });

    it('should reject recording results on ARCHIVED evaluation (409)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/evaluations/${evalArchivedId}/results/${student1Id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ score: 15 });

      expect(res.status).toBe(409);
    });
  });

  // ─── 2. BULK UPSERT & ATOMIC TRANSACTION ──────────────────────────────────

  describe('PUT /evaluations/:id/results (Bulk Upsert)', () => {
    it('should perform bulk upsert (create, update, mixed)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/evaluations/${eval1Id}/results`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          results: [
            { studentId: student1Id, score: 18, comment: 'Bravo' }, // update
            { studentId: student2Id, score: 12 }, // update from 0
            { studentId: studentEndedId, score: 14.5 }, // create for ended student
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.summary.totalGraded).toBe(3);
    });

    it('should be idempotent: repeating exact same bulk produces same state', async () => {
      const payload = {
        results: [
          { studentId: student1Id, score: 18, comment: 'Bravo' },
          { studentId: student2Id, score: 12 },
        ],
      };

      const res1 = await request(app.getHttpServer())
        .put(`/evaluations/${eval1Id}/results`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(payload);
      expect(res1.status).toBe(200);

      const res2 = await request(app.getHttpServer())
        .put(`/evaluations/${eval1Id}/results`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(payload);
      expect(res2.status).toBe(200);

      const totalCount = await prisma.evaluationResult.count({
        where: { evaluationId: eval1Id },
      });
      expect(totalCount).toBe(3); // student1, student2, studentEnded
    });

    it('should keep student absent from payload untouched (no delete, no change)', async () => {
      // Send bulk with only student1
      const res = await request(app.getHttpServer())
        .put(`/evaluations/${eval1Id}/results`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          results: [{ studentId: student1Id, score: 19 }],
        });

      expect(res.status).toBe(200);

      // Verify studentEndedId is STILL 14.5
      const endedRes = await prisma.evaluationResult.findUnique({
        where: { evaluationId_studentId: { evaluationId: eval1Id, studentId: studentEndedId } },
      });
      expect(endedRes).toBeDefined();
      expect(Number(endedRes!.score)).toBe(14.5);
    });

    it('should be atomic: if 1 score is invalid (> maxScore), entire bulk is rejected and no changes written', async () => {
      const prevStudent1 = await prisma.evaluationResult.findUnique({
        where: { evaluationId_studentId: { evaluationId: eval1Id, studentId: student1Id } },
      });

      const res = await request(app.getHttpServer())
        .put(`/evaluations/${eval1Id}/results`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          results: [
            { studentId: student1Id, score: 10 }, // would change 19 to 10
            { studentId: student2Id, score: 99 }, // INVALID score > 20
          ],
        });

      expect(res.status).toBe(400);

      // Verify student1 was NOT changed in DB (atomic rollback)
      const afterStudent1 = await prisma.evaluationResult.findUnique({
        where: { evaluationId_studentId: { evaluationId: eval1Id, studentId: student1Id } },
      });
      expect(Number(afterStudent1!.score)).toBe(Number(prevStudent1!.score));
    });

    it('should reject duplicate studentId in payload (400)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/evaluations/${eval1Id}/results`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          results: [
            { studentId: student1Id, score: 15 },
            { studentId: student1Id, score: 16 },
          ],
        });

      expect(res.status).toBe(400);
    });

    it('should reject empty results array (400)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/evaluations/${eval1Id}/results`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ results: [] });

      expect(res.status).toBe(400);
    });
  });

  // ─── 3. HISTORICAL ELIGIBILITY TESTS ─────────────────────────────────────

  describe('Historical Enrollment Eligibility', () => {
    it('should allow recording result for student whose enrollment ended AFTER evaluation date', async () => {
      // studentEndedId: startDate=2026-09-01, endDate=2026-09-25, evaluationDate=2026-09-15
      const res = await request(app.getHttpServer())
        .put(`/evaluations/${eval1Id}/results/${studentEndedId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ score: 15.5 });

      expect(res.status).toBe(200);
    });

    it('should reject recording result for student enrolled AFTER evaluation date (409)', async () => {
      // studentLateId: startDate=2026-09-20, evaluationDate=2026-09-15
      const res = await request(app.getHttpServer())
        .put(`/evaluations/${eval1Id}/results/${studentLateId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ score: 15 });

      expect(res.status).toBe(409);
    });
  });

  // ─── 4. GET /evaluations/:id/results (Teacher Summary & List) ─────────────

  describe('GET /evaluations/:id/results', () => {
    it('should return all eligible students with their results and group summary stats', async () => {
      const res = await request(app.getHttpServer())
        .get(`/evaluations/${eval1Id}/results`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.evaluation).toBeDefined();
      expect(res.body.summary).toBeDefined();
      expect(res.body.summary.totalEligible).toBe(3); // student1, student2, studentEnded
      expect(res.body.summary.totalGraded).toBe(3);
      expect(res.body.summary.minScore).toBeDefined();
      expect(res.body.summary.maxScore).toBeDefined();
      expect(res.body.summary.averageScore).toBeDefined();
      expect(res.body.summary.averagePercentage).toBeDefined();
      expect(Array.isArray(res.body.results)).toBe(true);
    });

    it('should reject student from viewing group results and group summary (403)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/evaluations/${eval1Id}/results`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(403);
    });

    it('should reject parent from viewing group results and group summary (403)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/evaluations/${eval1Id}/results`)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(403);
    });
  });
});
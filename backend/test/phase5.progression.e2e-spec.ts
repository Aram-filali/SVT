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
import { ConfigService } from '@nestjs/config';
import { EvaluationType, EvaluationStatus, GroupStatus } from '@prisma/client';
import * as argon2 from 'argon2';

describe('Phase 5 — Progression & Visibility (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let configService: ConfigService;

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
  let group1Id: string;
  let group2Id: string;

  let eval1Id: string;
  let eval2Id: string;
  let evalDraftId: string;
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
    configService = app.get<ConfigService>(ConfigService);

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
      where: { email: { startsWith: 'p5p-' } },
    });

    const hash = async (pwd: string) => argon2.hash(pwd, { type: argon2.argon2id });
    const defaultPwd = await hash('Password123!');

    // Admin
    await prisma.user.create({
      data: {
        email: 'p5p-admin@svt.dev',
        firstName: 'Admin',
        lastName: 'P5P',
        passwordHash: defaultPwd,
        role: Role.ADMIN,
        status: AccountStatus.ACTIVE,
      },
    });

    // Teacher 1
    const uTeacher = await prisma.user.create({
      data: {
        email: 'p5p-teacher1@svt.dev',
        firstName: 'Teacher1',
        lastName: 'P5P',
        passwordHash: defaultPwd,
        role: Role.TEACHER,
        status: AccountStatus.ACTIVE,
        teacher: { create: {} },
      },
      include: { teacher: true },
    });
    teacherUserId = uTeacher.id;
    teacherId = uTeacher.teacher!.id;

    // Teacher 2
    const uTeacher2 = await prisma.user.create({
      data: {
        email: 'p5p-teacher2@svt.dev',
        firstName: 'Teacher2',
        lastName: 'P5P',
        passwordHash: defaultPwd,
        role: Role.TEACHER,
        status: AccountStatus.ACTIVE,
        teacher: { create: {} },
      },
      include: { teacher: true },
    });

    // Student 1 (in Group 1 and Group 2)
    const uStudent1 = await prisma.user.create({
      data: {
        email: 'p5p-student1@svt.dev',
        firstName: 'Alice',
        lastName: 'P5P',
        passwordHash: defaultPwd,
        role: Role.STUDENT,
        status: AccountStatus.ACTIVE,
        student: { create: {} },
      },
      include: { student: true },
    });
    student1Id = uStudent1.student!.id;

    // Student 2 (in Group 2 only, unlinked)
    const uStudent2 = await prisma.user.create({
      data: {
        email: 'p5p-student2@svt.dev',
        firstName: 'Bob',
        lastName: 'P5P',
        passwordHash: defaultPwd,
        role: Role.STUDENT,
        status: AccountStatus.ACTIVE,
        student: { create: {} },
      },
      include: { student: true },
    });
    student2Id = uStudent2.student!.id;

    // Parent (linked to Student 1 only)
    const uParent = await prisma.user.create({
      data: {
        email: 'p5p-parent@svt.dev',
        firstName: 'Parent',
        lastName: 'P5P',
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
        name: 'SVT Terminale Spé',
        level: 'Terminale',
        capacity: 10,
        teacherId: teacherId,
        status: GroupStatus.ACTIVE,
      },
    });
    group1Id = group1.id;

    const group2 = await prisma.group.create({
      data: {
        name: 'Option SVT',
        level: 'Terminale',
        capacity: 10,
        teacherId: uTeacher2.teacher!.id,
        status: GroupStatus.ACTIVE,
      },
    });
    group2Id = group2.id;

    // Inscriptions
    await prisma.enrollment.createMany({
      data: [
        { groupId: group1Id, studentId: student1Id, startDate: new Date('2026-09-01T00:00:00.000Z') },
        { groupId: group2Id, studentId: student1Id, startDate: new Date('2026-09-01T00:00:00.000Z') },
        { groupId: group2Id, studentId: student2Id, startDate: new Date('2026-09-01T00:00:00.000Z') },
      ],
    });

    // Tokens
    teacherToken = await login('p5p-teacher1@svt.dev');
    otherTeacherToken = await login('p5p-teacher2@svt.dev');
    student1Token = await login('p5p-student1@svt.dev');
    student2Token = await login('p5p-student2@svt.dev');
    parentToken = await login('p5p-parent@svt.dev');
    adminToken = await login('p5p-admin@svt.dev');
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
      where: { email: { startsWith: 'p5p-' } },
    });
    await app.close();
  });

  // ─── 1. EMPTY STATE PROGRESSION ───────────────────────────────────────────

  describe('GET /students/me/progression — Empty State', () => {
    it('should return null indicators when student has no recorded evaluations', async () => {
      const res = await request(app.getHttpServer())
        .get('/students/me/progression')
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
      expect(res.body.averagePercentage).toBeNull();
      expect(res.body.minPercentage).toBeNull();
      expect(res.body.maxPercentage).toBeNull();
      expect(res.body.evolution).toBeNull();
      expect(res.body.history).toEqual([]);
    });
  });

  // ─── 2. PROGRESSION CALCULATIONS & WEIGHTED AVERAGE ───────────────────────

  describe('Progression Calculations with Normalization & Coefficients', () => {
    beforeAll(async () => {
      // 1. Eval 1: Group 1, date 2026-09-10, maxScore 20, coeff null (=> 1.00), score 15 (75.00%)
      const ev1 = await prisma.evaluation.create({
        data: {
          title: 'DS 1 Génétique',
          type: EvaluationType.EXAM,
          date: new Date('2026-09-10T10:00:00.000Z'),
          maxScore: 20,
          groupId: group1Id,
          status: EvaluationStatus.PUBLISHED,
          createdById: teacherUserId,
        },
      });
      eval1Id = ev1.id;
      await prisma.evaluationResult.create({
        data: { evaluationId: eval1Id, studentId: student1Id, score: 15 },
      });

      // 2. Eval 2: Group 1, date 2026-09-20, maxScore 10, coeff 2.00, score 8 (80.00%)
      const ev2 = await prisma.evaluation.create({
        data: {
          title: 'TP 1 Microscopie',
          type: EvaluationType.PRACTICAL,
          date: new Date('2026-09-20T10:00:00.000Z'),
          maxScore: 10,
          coefficient: 2,
          groupId: group1Id,
          status: EvaluationStatus.PUBLISHED,
          createdById: teacherUserId,
        },
      });
      eval2Id = ev2.id;
      await prisma.evaluationResult.create({
        data: { evaluationId: eval2Id, studentId: student1Id, score: 8 },
      });

      // 3. Eval DRAFT: must be EXCLUDED from progression
      const evDraft = await prisma.evaluation.create({
        data: {
          title: 'DS Draft Test',
          type: EvaluationType.TEST,
          date: new Date('2026-09-25T10:00:00.000Z'),
          maxScore: 20,
          groupId: group1Id,
          status: EvaluationStatus.DRAFT,
          createdById: teacherUserId,
        },
      });
      evalDraftId = evDraft.id;
      await prisma.evaluationResult.create({
        data: { evaluationId: evalDraftId, studentId: student1Id, score: 20 },
      });

      // 4. Eval Group 2 (ARCHIVED): date 2026-09-22, maxScore 40, coeff 1, score 35 (87.50%)
      const evArchived = await prisma.evaluation.create({
        data: {
          title: 'Option DS Archivé',
          type: EvaluationType.TEST,
          date: new Date('2026-09-22T10:00:00.000Z'),
          maxScore: 40,
          groupId: group2Id,
          status: EvaluationStatus.ARCHIVED,
          createdById: teacherUserId,
        },
      });
      evalArchivedId = evArchived.id;
      await prisma.evaluationResult.create({
        data: { evaluationId: evalArchivedId, studentId: student1Id, score: 35 },
      });
    });

    it('should calculate weighted average and evolution in percentage points correctly', async () => {
      // Included:
      // 1. date 2026-09-10: 15/20 = 75.00%, coeff 1
      // 2. date 2026-09-20: 8/10 = 80.00%, coeff 2
      // 3. date 2026-09-22: 35/40 = 87.50%, coeff 1
      // DRAFT on 2026-09-25 is EXCLUDED!
      //
      // Total ratio sum = (0.75 * 1) + (0.80 * 2) + (0.875 * 1) = 0.75 + 1.60 + 0.875 = 3.225
      // Total coeff = 1 + 2 + 1 = 4
      // Average ratio = 3.225 / 4 = 0.80625 => averagePercentage = 80.63%
      //
      // Evolution: last (87.50%) - previous (80.00%) = +7.50 percentage points

      const res = await request(app.getHttpServer())
        .get('/students/me/progression')
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(3); // 3 non-draft evaluations
      expect(res.body.averagePercentage).toBe('80.63');
      expect(res.body.minPercentage).toBe('75.00');
      expect(res.body.maxPercentage).toBe('87.50');
      expect(res.body.evolution).toBe('+7.50');

      // History should be strictly ordered by date asc
      expect(res.body.history.length).toBe(3);
      expect(res.body.history[0].evaluationId).toBe(eval1Id);
      expect(res.body.history[0].normalizedPercentage).toBe('75.00');
      expect(res.body.history[1].evaluationId).toBe(eval2Id);
      expect(res.body.history[1].normalizedPercentage).toBe('80.00');
      expect(res.body.history[2].evaluationId).toBe(evalArchivedId);
      expect(res.body.history[2].normalizedPercentage).toBe('87.50');

      // Multi-group breakdown: byGroup contains group1 and group2
      expect(res.body.byGroup[group1Id]).toBeDefined();
      expect(res.body.byGroup[group1Id].count).toBe(2);
      expect(res.body.byGroup[group2Id]).toBeDefined();
      expect(res.body.byGroup[group2Id].count).toBe(1);
    });

    it('should reject student accessing another student progression (403)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/students/${student2Id}/progression`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(403);
    });
  });

  // ─── 3. STUDENT EVALUATIONS LIST ──────────────────────────────────────────

  describe('GET /students/me/evaluations', () => {
    it('should return published and archived evaluations with own result, excluding DRAFT', async () => {
      const res = await request(app.getHttpServer())
        .get('/students/me/evaluations')
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      const draftItem = res.body.find((e: any) => e.id === evalDraftId);
      expect(draftItem).toBeUndefined(); // DRAFT excluded

      const eval1Item = res.body.find((e: any) => e.id === eval1Id);
      expect(eval1Item).toBeDefined();
      expect(eval1Item.result).toBeDefined();
      expect(eval1Item.result.score).toBe('15.00');
    });
  });

  // ─── 4. TEACHER ACCESS TO STUDENT PROGRESSION ─────────────────────────────

  describe('GET /students/:studentId/progression (Teacher / Admin)', () => {
    it('should allow teacher to view progression of student in their group', async () => {
      const res = await request(app.getHttpServer())
        .get(`/students/${student1Id}/progression`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(3);
    });

    it('should reject teacher from viewing student not in any of their groups (403)', async () => {
      // student2 is only in group 2 (teacher 2)
      const res = await request(app.getHttpServer())
        .get(`/students/${student2Id}/progression`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(403);
    });

    it('should allow admin to view any student progression', async () => {
      const res = await request(app.getHttpServer())
        .get(`/students/${student2Id}/progression`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });
  });

  // ─── 5. PARENT ACCESS & CONFIGURATION FLAG ────────────────────────────────

  describe('Parent Access (/children/:studentId/...)', () => {
    it('should reject parent when PARENT_GRADES_VISIBLE is disabled (403)', async () => {
      // By default PARENT_GRADES_VISIBLE is false
      const resProg = await request(app.getHttpServer())
        .get(`/children/${student1Id}/progression`)
        .set('Authorization', `Bearer ${parentToken}`);
      expect(resProg.status).toBe(403);

      const resEvals = await request(app.getHttpServer())
        .get(`/children/${student1Id}/evaluations`)
        .set('Authorization', `Bearer ${parentToken}`);
      expect(resEvals.status).toBe(403);
    });

    it('should allow parent to view linked child when flag is enabled', async () => {
      vi.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'PARENT_GRADES_VISIBLE') return 'true';
        return undefined as any;
      });

      const resProg = await request(app.getHttpServer())
        .get(`/children/${student1Id}/progression`)
        .set('Authorization', `Bearer ${parentToken}`);
      expect(resProg.status).toBe(200);
      expect(resProg.body.count).toBe(3);

      const resEvals = await request(app.getHttpServer())
        .get(`/children/${student1Id}/evaluations`)
        .set('Authorization', `Bearer ${parentToken}`);
      expect(resEvals.status).toBe(200);
      expect(Array.isArray(resEvals.body)).toBe(true);
    });

    it('should reject parent from viewing unlinked child even when flag is enabled (403)', async () => {
      vi.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'PARENT_GRADES_VISIBLE') return 'true';
        return undefined as any;
      });

      const resProg = await request(app.getHttpServer())
        .get(`/children/${student2Id}/progression`)
        .set('Authorization', `Bearer ${parentToken}`);
      expect(resProg.status).toBe(403);

      const resEvals = await request(app.getHttpServer())
        .get(`/children/${student2Id}/evaluations`)
        .set('Authorization', `Bearer ${parentToken}`);
      expect(resEvals.status).toBe(403);
    });
  });
});
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
import { EvaluationType, EvaluationStatus, GroupStatus } from '@prisma/client';
import * as argon2 from 'argon2';

describe('Phase 5 — Evaluations (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let teacherToken: string;
  let otherTeacherToken: string;
  let studentToken: string;
  let parentToken: string;
  let adminToken: string;

  let teacherId: string;
  let teacherUserId: string;
  let studentId: string;
  let group1Id: string;
  let group2Id: string;
  let archivedGroupId: string;
  let sessionGroup1Id: string;
  let sessionGroup2Id: string;

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
      where: { email: { startsWith: 'p5e-' } },
    });

    const hash = async (pwd: string) => argon2.hash(pwd, { type: argon2.argon2id });
    const defaultPwd = await hash('Password123!');

    // 1. Admin
    await prisma.user.create({
      data: {
        email: 'p5e-admin@svt.dev',
        firstName: 'Admin',
        lastName: 'P5',
        passwordHash: defaultPwd,
        role: Role.ADMIN,
        status: AccountStatus.ACTIVE,
      },
    });

    // 2. Teacher 1
    const uTeacher = await prisma.user.create({
      data: {
        email: 'p5e-teacher1@svt.dev',
        firstName: 'Teacher1',
        lastName: 'P5',
        passwordHash: defaultPwd,
        role: Role.TEACHER,
        status: AccountStatus.ACTIVE,
        teacher: { create: {} },
      },
      include: { teacher: true },
    });
    teacherId = uTeacher.teacher!.id;
    teacherUserId = uTeacher.id;

    // 3. Other Teacher
    const uOtherTeacher = await prisma.user.create({
      data: {
        email: 'p5e-teacher2@svt.dev',
        firstName: 'Teacher2',
        lastName: 'P5',
        passwordHash: defaultPwd,
        role: Role.TEACHER,
        status: AccountStatus.ACTIVE,
        teacher: { create: {} },
      },
      include: { teacher: true },
    });

    // 4. Student
    const uStudent = await prisma.user.create({
      data: {
        email: 'p5e-student@svt.dev',
        firstName: 'Student',
        lastName: 'P5',
        passwordHash: defaultPwd,
        role: Role.STUDENT,
        status: AccountStatus.ACTIVE,
        student: { create: { level: 'Terminale' } },
      },
      include: { student: true },
    });
    studentId = uStudent.student!.id;

    // 5. Parent
    const uParent = await prisma.user.create({
      data: {
        email: 'p5e-parent@svt.dev',
        firstName: 'Parent',
        lastName: 'P5',
        passwordHash: defaultPwd,
        role: Role.PARENT,
        status: AccountStatus.ACTIVE,
        parent: { create: {} },
      },
      include: { parent: true },
    });

    // Link parent ↔ student
    await prisma.parentStudent.create({
      data: {
        parentId: uParent.parent!.id,
        studentId: uStudent.student!.id,
      },
    });

    // Groups
    const group1 = await prisma.group.create({
      data: {
        name: 'Group 1 P5',
        level: 'Terminale',
        capacity: 10,
        teacherId: teacherId,
        status: GroupStatus.ACTIVE,
      },
    });
    group1Id = group1.id;

    const group2 = await prisma.group.create({
      data: {
        name: 'Group 2 P5 Other Teacher',
        level: 'Premiere',
        capacity: 10,
        teacherId: uOtherTeacher.teacher!.id,
        status: GroupStatus.ACTIVE,
      },
    });
    group2Id = group2.id;

    const groupArchived = await prisma.group.create({
      data: {
        name: 'Group Archived P5',
        level: 'Terminale',
        capacity: 10,
        teacherId: teacherId,
        status: GroupStatus.ARCHIVED,
      },
    });
    archivedGroupId = groupArchived.id;

    // Enrollments
    await prisma.enrollment.create({
      data: {
        groupId: group1Id,
        studentId: studentId,
        startDate: new Date('2026-09-01T00:00:00.000Z'),
      },
    });

    // Sessions
    const sess1 = await prisma.classSession.create({
      data: {
        groupId: group1Id,
        startAt: new Date('2026-09-15T10:00:00.000Z'),
        endAt: new Date('2026-09-15T12:00:00.000Z'),
      },
    });
    sessionGroup1Id = sess1.id;

    const sess2 = await prisma.classSession.create({
      data: {
        groupId: group2Id,
        startAt: new Date('2026-09-16T10:00:00.000Z'),
        endAt: new Date('2026-09-16T12:00:00.000Z'),
      },
    });
    sessionGroup2Id = sess2.id;

    // Tokens
    teacherToken = await login('p5e-teacher1@svt.dev');
    otherTeacherToken = await login('p5e-teacher2@svt.dev');
    studentToken = await login('p5e-student@svt.dev');
    parentToken = await login('p5e-parent@svt.dev');
    adminToken = await login('p5e-admin@svt.dev');
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
      where: { email: { startsWith: 'p5e-' } },
    });
    await app.close();
  });

  // ─── 1. CREATION ──────────────────────────────────────────────────────────

  describe('POST /evaluations', () => {
    it('should create an evaluation as owner teacher (201, DRAFT, decimal string format)', async () => {
      const res = await request(app.getHttpServer())
        .post('/evaluations')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Contrôle Génétique 1',
          description: 'Premier DS du trimestre',
          type: EvaluationType.EXAM,
          date: '2026-09-20T10:00:00.000Z',
          maxScore: 20,
          coefficient: 2,
          groupId: group1Id,
          sessionId: sessionGroup1Id,
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('Contrôle Génétique 1');
      expect(res.body.type).toBe(EvaluationType.EXAM);
      expect(res.body.status).toBe(EvaluationStatus.DRAFT);
      expect(res.body.maxScore).toBe('20.00');
      expect(res.body.coefficient).toBe('2.00');
      expect(res.body.groupId).toBe(group1Id);
      expect(res.body.sessionId).toBe(sessionGroup1Id);
    });

    it('should create an evaluation with nullable coefficient (null in DB, null in response)', async () => {
      const res = await request(app.getHttpServer())
        .post('/evaluations')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Interro de cours',
          type: EvaluationType.QUIZ,
          date: '2026-09-21T10:00:00.000Z',
          maxScore: 10,
          groupId: group1Id,
        });

      expect(res.status).toBe(201);
      expect(res.body.coefficient).toBeNull();
    });

    it('should reject non-owner teacher creating evaluation in another group (403)', async () => {
      const res = await request(app.getHttpServer())
        .post('/evaluations')
        .set('Authorization', `Bearer ${otherTeacherToken}`)
        .send({
          title: 'Contrôle non autorisé',
          type: EvaluationType.TEST,
          date: '2026-09-20T10:00:00.000Z',
          maxScore: 20,
          groupId: group1Id,
        });

      expect(res.status).toBe(403);
    });

    it('should reject student (403) and parent (403)', async () => {
      const p = {
        title: 'Contrôle élève',
        type: EvaluationType.TEST,
        date: '2026-09-20T10:00:00.000Z',
        maxScore: 20,
        groupId: group1Id,
      };

      const resStudent = await request(app.getHttpServer())
        .post('/evaluations')
        .set('Authorization', `Bearer ${studentToken}`)
        .send(p);
      expect(resStudent.status).toBe(403);

      const resParent = await request(app.getHttpServer())
        .post('/evaluations')
        .set('Authorization', `Bearer ${parentToken}`)
        .send(p);
      expect(resParent.status).toBe(403);
    });

    it('should reject unauthenticated request (401)', async () => {
      const res = await request(app.getHttpServer())
        .post('/evaluations')
        .send({
          title: 'Contrôle sans token',
          type: EvaluationType.TEST,
          date: '2026-09-20T10:00:00.000Z',
          maxScore: 20,
          groupId: group1Id,
        });

      expect(res.status).toBe(401);
    });

    it('should reject creating evaluation on ARCHIVED group (409)', async () => {
      const res = await request(app.getHttpServer())
        .post('/evaluations')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Contrôle groupe archivé',
          type: EvaluationType.TEST,
          date: '2026-09-20T10:00:00.000Z',
          maxScore: 20,
          groupId: archivedGroupId,
        });

      expect(res.status).toBe(409);
    });

    it('should reject sessionId belonging to another group (400)', async () => {
      const res = await request(app.getHttpServer())
        .post('/evaluations')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Contrôle session incohérente',
          type: EvaluationType.TEST,
          date: '2026-09-20T10:00:00.000Z',
          maxScore: 20,
          groupId: group1Id,
          sessionId: sessionGroup2Id, // belongs to group 2
        });

      expect(res.status).toBe(400);
    });

    it('should reject invalid maxScore <= 0 (400)', async () => {
      const res = await request(app.getHttpServer())
        .post('/evaluations')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Contrôle barème invalide',
          type: EvaluationType.TEST,
          date: '2026-09-20T10:00:00.000Z',
          maxScore: 0,
          groupId: group1Id,
        });

      expect(res.status).toBe(400);
    });

    it('should reject invalid coefficient <= 0 (400)', async () => {
      const res = await request(app.getHttpServer())
        .post('/evaluations')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Contrôle coeff invalide',
          type: EvaluationType.TEST,
          date: '2026-09-20T10:00:00.000Z',
          maxScore: 20,
          coefficient: -1,
          groupId: group1Id,
        });

      expect(res.status).toBe(400);
    });
  });

  // ─── 2. STATE MACHINE TRANSITIONS ─────────────────────────────────────────

  describe('State Machine & Transitions', () => {
    let evalId: string;

    beforeEach(async () => {
      const ev = await prisma.evaluation.create({
        data: {
          title: 'DS State Machine',
          type: EvaluationType.TEST,
          date: new Date('2026-09-22T10:00:00.000Z'),
          maxScore: 20,
          groupId: group1Id,
          status: EvaluationStatus.DRAFT,
          createdById: teacherUserId,
        },
      });
      evalId = ev.id;
    });

    it('should publish DRAFT evaluation (POST /evaluations/:id/publish -> PUBLISHED)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/evaluations/${evalId}/publish`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe(EvaluationStatus.PUBLISHED);

      // Verify in DB
      const updated = await prisma.evaluation.findUnique({ where: { id: evalId } });
      expect(updated!.status).toBe(EvaluationStatus.PUBLISHED);
    });

    it('should archive DRAFT evaluation (POST /evaluations/:id/archive -> ARCHIVED)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/evaluations/${evalId}/archive`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe(EvaluationStatus.ARCHIVED);
    });

    it('should archive PUBLISHED evaluation (POST /evaluations/:id/archive -> ARCHIVED)', async () => {
      await prisma.evaluation.update({
        where: { id: evalId },
        data: { status: EvaluationStatus.PUBLISHED },
      });

      const res = await request(app.getHttpServer())
        .post(`/evaluations/${evalId}/archive`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe(EvaluationStatus.ARCHIVED);
    });

    it('should reject publishing an ARCHIVED evaluation (409)', async () => {
      await prisma.evaluation.update({
        where: { id: evalId },
        data: { status: EvaluationStatus.ARCHIVED },
      });

      const res = await request(app.getHttpServer())
        .post(`/evaluations/${evalId}/publish`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(409);
    });
  });

  // ─── 3. LOCKED STRUCTURAL FIELDS & UPDATES ────────────────────────────────

  describe('PATCH /evaluations/:id — Locked Fields & Permissions', () => {
    let evalId: string;

    beforeEach(async () => {
      const ev = await prisma.evaluation.create({
        data: {
          title: 'DS Structural Lock',
          type: EvaluationType.TEST,
          date: new Date('2026-09-22T10:00:00.000Z'),
          maxScore: 20,
          coefficient: 1,
          groupId: group1Id,
          status: EvaluationStatus.PUBLISHED,
          createdById: teacherUserId,
        },
      });
      evalId = ev.id;
    });

    it('should allow modifying title and description when no results recorded', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/evaluations/${evalId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Nouveau titre DS',
          description: 'Nouvelle description',
        });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Nouveau titre DS');
      expect(res.body.description).toBe('Nouvelle description');
    });

    it('should reject modifying structural fields once at least one result exists (409)', async () => {
      // Record a result
      await prisma.evaluationResult.create({
        data: {
          evaluationId: evalId,
          studentId: studentId,
          score: 15,
        },
      });

      // Try changing maxScore
      const resMax = await request(app.getHttpServer())
        .patch(`/evaluations/${evalId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ maxScore: 30 });
      expect(resMax.status).toBe(409);

      // Try changing coefficient
      const resCoeff = await request(app.getHttpServer())
        .patch(`/evaluations/${evalId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ coefficient: 3 });
      expect(resCoeff.status).toBe(409);

      // Try changing date
      const resDate = await request(app.getHttpServer())
        .patch(`/evaluations/${evalId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ date: '2026-09-25T10:00:00.000Z' });
      expect(resDate.status).toBe(409);

      // Title change is still allowed even with results!
      const resTitle = await request(app.getHttpServer())
        .patch(`/evaluations/${evalId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: 'Titre modifié avec résultats' });
      expect(resTitle.status).toBe(200);
      expect(resTitle.body.title).toBe('Titre modifié avec résultats');
    });

    it('should reject any update on an ARCHIVED evaluation (409)', async () => {
      await prisma.evaluation.update({
        where: { id: evalId },
        data: { status: EvaluationStatus.ARCHIVED },
      });

      const res = await request(app.getHttpServer())
        .patch(`/evaluations/${evalId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: 'Tentative modif archivé' });

      expect(res.status).toBe(409);
    });
  });

  // ─── 4. NO DELETE ENDPOINT ────────────────────────────────────────────────

  describe('No physical DELETE endpoint', () => {
    it('should return 404/405 when calling DELETE /evaluations/:id', async () => {
      const ev = await prisma.evaluation.create({
        data: {
          title: 'Evaluation No Delete',
          type: EvaluationType.TEST,
          date: new Date('2026-09-22T10:00:00.000Z'),
          maxScore: 20,
          groupId: group1Id,
          status: EvaluationStatus.DRAFT,
          createdById: teacherUserId,
        },
      });

      const res = await request(app.getHttpServer())
        .delete(`/evaluations/${ev.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ─── 5. LIST & FILTERS ───────────────────────────────────────────────────

  describe('GET /evaluations', () => {
    it('should reject teacher querying another teacher group (403)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/evaluations?groupId=${group2Id}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(403);
    });

    it('should list evaluations belonging to teacher groups only', async () => {
      const res = await request(app.getHttpServer())
        .get('/evaluations')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      for (const ev of res.body) {
        expect(ev.groupId).toBe(group1Id);
      }
    });

    it('should allow admin to list all evaluations across all groups', async () => {
      const res = await request(app.getHttpServer())
        .get('/evaluations')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
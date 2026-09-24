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
import * as argon2 from 'argon2';

describe('Phase 4 — Attendance (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let teacherToken: string;
  let otherTeacherToken: string;
  let student1Token: string;
  let student2Token: string;
  let parentToken: string;

  let student1Id: string;
  let student2Id: string;
  let unlinkedStudentId: string;

  let group1Id: string;
  let archivedGroupId: string;
  let session1Id: string;
  let session2Id: string;
  let sessionCancelledId: string;
  let sessionArchivedId: string;

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
    await prisma.notification.deleteMany({});
    await prisma.evaluationResult.deleteMany({});
    await prisma.evaluation.deleteMany({});
    await prisma.attendance.deleteMany({});
    await prisma.resource.deleteMany({});
    await prisma.registrationRequest.deleteMany({});
    await prisma.classSession.deleteMany({});
    await prisma.enrollment.deleteMany({});
    await prisma.group.deleteMany({});
    await prisma.parentStudent.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'p4a-' } },
    });

    const hash = async (pwd: string) => argon2.hash(pwd, { type: argon2.argon2id });
    const defaultPwd = await hash('Password123!');

    // 1. Teacher
    const uTeacher = await prisma.user.create({
      data: {
        email: 'p4a-teacher@svt.dev',
        firstName: 'Teacher',
        lastName: 'P4',
        passwordHash: defaultPwd,
        role: Role.TEACHER,
        status: AccountStatus.ACTIVE,
        teacher: { create: {} },
      },
      include: { teacher: true },
    });

    // 2. Other Teacher
    await prisma.user.create({
      data: {
        email: 'p4a-other-teacher@svt.dev',
        firstName: 'Other',
        lastName: 'Teacher',
        passwordHash: defaultPwd,
        role: Role.TEACHER,
        status: AccountStatus.ACTIVE,
        teacher: { create: {} },
      },
    });

    // 3. Student 1 (Linked to parent)
    const uStudent1 = await prisma.user.create({
      data: {
        email: 'p4a-student1@svt.dev',
        firstName: 'Alice',
        lastName: 'Dupont',
        passwordHash: defaultPwd,
        role: Role.STUDENT,
        status: AccountStatus.ACTIVE,
        student: { create: { level: 'Terminale' } },
      },
      include: { student: true },
    });
    student1Id = uStudent1.student!.id;

    // 4. Student 2 (Also linked to same parent)
    const uStudent2 = await prisma.user.create({
      data: {
        email: 'p4a-student2@svt.dev',
        firstName: 'Bob',
        lastName: 'Dupont',
        passwordHash: defaultPwd,
        role: Role.STUDENT,
        status: AccountStatus.ACTIVE,
        student: { create: { level: 'Première' } },
      },
      include: { student: true },
    });
    student2Id = uStudent2.student!.id;

    // 5. Unlinked Student
    const uStudent3 = await prisma.user.create({
      data: {
        email: 'p4a-student3@svt.dev',
        firstName: 'Charlie',
        lastName: 'Martin',
        passwordHash: defaultPwd,
        role: Role.STUDENT,
        status: AccountStatus.ACTIVE,
        student: { create: { level: 'Terminale' } },
      },
      include: { student: true },
    });
    unlinkedStudentId = uStudent3.student!.id;

    // 6. Parent (Linked to Alice and Bob)
    const uParent = await prisma.user.create({
      data: {
        email: 'p4a-parent@svt.dev',
        firstName: 'Marie',
        lastName: 'Dupont',
        passwordHash: defaultPwd,
        role: Role.PARENT,
        status: AccountStatus.ACTIVE,
        parent: { create: {} },
      },
      include: { parent: true },
    });

    await prisma.parentStudent.createMany({
      data: [
        { parentId: uParent.parent!.id, studentId: student1Id },
        { parentId: uParent.parent!.id, studentId: student2Id },
      ],
    });

    // Create Groups
    const group1 = await prisma.group.create({
      data: {
        name: 'Groupe Terminale SVT',
        level: 'Terminale',
        capacity: 10,
        teacherId: uTeacher.teacher!.id,
      },
    });
    group1Id = group1.id;

    const groupArchived = await prisma.group.create({
      data: {
        name: 'Groupe Archivé SVT',
        level: 'Terminale',
        capacity: 10,
        teacherId: uTeacher.teacher!.id,
        status: 'ARCHIVED',
      },
    });
    archivedGroupId = groupArchived.id;

    // Enroll students in group1
    await prisma.enrollment.createMany({
      data: [
        { groupId: group1Id, studentId: student1Id, status: 'ACTIVE' },
        { groupId: group1Id, studentId: student2Id, status: 'ACTIVE' },
      ],
    });

    // Create Sessions
    const s1 = await prisma.classSession.create({
      data: {
        groupId: group1Id,
        startAt: new Date('2026-10-01T08:00:00Z'),
        endAt: new Date('2026-10-01T10:00:00Z'),
      },
    });
    session1Id = s1.id;

    const s2 = await prisma.classSession.create({
      data: {
        groupId: group1Id,
        startAt: new Date('2026-10-08T08:00:00Z'),
        endAt: new Date('2026-10-08T10:00:00Z'),
      },
    });
    session2Id = s2.id;

    const sCancelled = await prisma.classSession.create({
      data: {
        groupId: group1Id,
        startAt: new Date('2026-10-15T08:00:00Z'),
        endAt: new Date('2026-10-15T10:00:00Z'),
        status: 'CANCELLED',
      },
    });
    sessionCancelledId = sCancelled.id;

    const sArchived = await prisma.classSession.create({
      data: {
        groupId: archivedGroupId,
        startAt: new Date('2026-10-01T14:00:00Z'),
        endAt: new Date('2026-10-01T16:00:00Z'),
      },
    });
    sessionArchivedId = sArchived.id;

    // Auth tokens
    teacherToken = await login('p4a-teacher@svt.dev');
    otherTeacherToken = await login('p4a-other-teacher@svt.dev');
    student1Token = await login('p4a-student1@svt.dev');
    student2Token = await login('p4a-student2@svt.dev');
    parentToken = await login('p4a-parent@svt.dev');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('PUT /sessions/:sessionId/attendance', () => {
    it('should bulk upsert attendance successfully (Teacher)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/sessions/${session1Id}/attendance`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          attendances: [
            { studentId: student1Id, status: 'PRESENT', note: 'À l heure' },
            { studentId: student2Id, status: 'LATE', note: '10 min retard' },
          ],
        })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].status).toBe('PRESENT');
      expect(res.body[1].status).toBe('LATE');
    });

    it('should update existing attendance idempotently', async () => {
      const res = await request(app.getHttpServer())
        .put(`/sessions/${session1Id}/attendance`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          attendances: [
            { studentId: student1Id, status: 'EXCUSED', note: 'Certificat médical' },
          ],
        })
        .expect(200);

      expect(res.body[0].status).toBe('EXCUSED');
      expect(res.body[0].note).toBe('Certificat médical');
    });

    it('should reject when status is missing (Decision 4 - no default)', async () => {
      await request(app.getHttpServer())
        .put(`/sessions/${session1Id}/attendance`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          attendances: [
            { studentId: student1Id }, // missing status
          ],
        })
        .expect(400);
    });

    it('should reject un-enrolled student (409)', async () => {
      await request(app.getHttpServer())
        .put(`/sessions/${session1Id}/attendance`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          attendances: [
            { studentId: unlinkedStudentId, status: 'PRESENT' },
          ],
        })
        .expect(409);
    });

    it('should reject recording attendance for CANCELLED session (409)', async () => {
      await request(app.getHttpServer())
        .put(`/sessions/${sessionCancelledId}/attendance`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          attendances: [
            { studentId: student1Id, status: 'PRESENT' },
          ],
        })
        .expect(409);
    });

    it('should reject recording attendance on ARCHIVED group (409)', async () => {
      await request(app.getHttpServer())
        .put(`/sessions/${sessionArchivedId}/attendance`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          attendances: [
            { studentId: student1Id, status: 'PRESENT' },
          ],
        })
        .expect(409);
    });

    it('should reject non-owning teacher (403)', async () => {
      await request(app.getHttpServer())
        .put(`/sessions/${session1Id}/attendance`)
        .set('Authorization', `Bearer ${otherTeacherToken}`)
        .send({
          attendances: [
            { studentId: student1Id, status: 'PRESENT' },
          ],
        })
        .expect(403);
    });
  });

  describe('GET /sessions/:sessionId/attendance', () => {
    it('should return attendance records for a session (Teacher)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/sessions/${session1Id}/attendance`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('should allow enrolled student to view session attendance', async () => {
      const res = await request(app.getHttpServer())
        .get(`/sessions/${session1Id}/attendance`)
        .set('Authorization', `Bearer ${student1Token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /attendances/my-history', () => {
    beforeAll(async () => {
      // Record attendance for session2 as well
      await request(app.getHttpServer())
        .put(`/sessions/${session2Id}/attendance`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          attendances: [
            { studentId: student1Id, status: 'PRESENT' },
            { studentId: student2Id, status: 'ABSENT' },
          ],
        });
    });

    it('should return student own attendance history ordered by session date DESC', async () => {
      const res = await request(app.getHttpServer())
        .get('/attendances/my-history')
        .set('Authorization', `Bearer ${student1Token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
      // Verify DESC sort
      const date1 = new Date(res.body[0].session.startAt).getTime();
      const date2 = new Date(res.body[1].session.startAt).getTime();
      expect(date1).toBeGreaterThanOrEqual(date2);
    });

    it('should return parent history for a single child (?studentId=xxx)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/attendances/my-history?studentId=${student1Id}`)
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(200);

      expect(res.body.student).toBeDefined();
      expect(res.body.attendances).toBeDefined();
      expect(res.body.attendances.length).toBe(2);
    });

    it('should return parent history for all children grouped when no studentId is passed (Decision 3)', async () => {
      const res = await request(app.getHttpServer())
        .get('/attendances/my-history')
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2); // Alice and Bob
      expect(res.body[0].student).toBeDefined();
      expect(res.body[0].attendances).toBeDefined();

      // Check that attendances inside each child group are ordered by startAt DESC
      if (res.body[0].attendances.length >= 2) {
        const d1 = new Date(res.body[0].attendances[0].session.startAt).getTime();
        const d2 = new Date(res.body[0].attendances[1].session.startAt).getTime();
        expect(d1).toBeGreaterThanOrEqual(d2);
      }
    });

    it('should reject parent trying to view unlinked student history (403)', async () => {
      await request(app.getHttpServer())
        .get(`/attendances/my-history?studentId=${unlinkedStudentId}`)
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(403);
    });
  });
});

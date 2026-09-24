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
import { Readable } from 'stream';

describe('Phase 4 — Resources (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let adminToken: string;
  let teacherToken: string;
  let otherTeacherToken: string;
  let studentToken: string;
  let otherStudentToken: string;
  let parentToken: string;

  let group1Id: string;
  let archivedGroupId: string;
  let session1Id: string;
  let sessionCancelledId: string;

  let linkResourceId: string;
  let fileResourceId: string;

  const login = async (email: string, password = 'Password123!') => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password });
    return res.body.accessToken;
  };

  beforeAll(async () => {
    // Mock StorageService for predictable test execution without requiring active MinIO in test
    const mockStorageService = {
      uploadFile: async (buffer: Buffer, originalName: string, mimeType: string) => {
        return `test-key-${Date.now()}-${originalName}`;
      },
      getFileStream: async (storageKey: string) => {
        return Readable.from([Buffer.from('mock file content')]);
      },
      getFileStat: async () => ({ size: 17, contentType: 'application/pdf' }),
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
      where: { email: { startsWith: 'p4r-' } },
    });

    const hash = async (pwd: string) => argon2.hash(pwd, { type: argon2.argon2id });
    const defaultPwd = await hash('Password123!');

    // 1. Admin
    await prisma.user.create({
      data: {
        email: 'p4r-admin@svt.dev',
        firstName: 'Admin',
        lastName: 'P4',
        passwordHash: defaultPwd,
        role: Role.ADMIN,
        status: AccountStatus.ACTIVE,
      },
    });

    // 2. Teacher 1 (Group Owner)
    const uTeacher1 = await prisma.user.create({
      data: {
        email: 'p4r-teacher1@svt.dev',
        firstName: 'Teacher1',
        lastName: 'P4',
        passwordHash: defaultPwd,
        role: Role.TEACHER,
        status: AccountStatus.ACTIVE,
        teacher: { create: {} },
      },
      include: { teacher: true },
    });

    // 3. Teacher 2 (Other teacher)
    await prisma.user.create({
      data: {
        email: 'p4r-teacher2@svt.dev',
        firstName: 'Teacher2',
        lastName: 'P4',
        passwordHash: defaultPwd,
        role: Role.TEACHER,
        status: AccountStatus.ACTIVE,
        teacher: { create: {} },
      },
    });

    // 4. Student 1 (Enrolled in group 1)
    const uStudent1 = await prisma.user.create({
      data: {
        email: 'p4r-student1@svt.dev',
        firstName: 'Student1',
        lastName: 'P4',
        passwordHash: defaultPwd,
        role: Role.STUDENT,
        status: AccountStatus.ACTIVE,
        student: { create: { level: 'Terminale' } },
      },
      include: { student: true },
    });

    // 5. Student 2 (Not enrolled)
    await prisma.user.create({
      data: {
        email: 'p4r-student2@svt.dev',
        firstName: 'Student2',
        lastName: 'P4',
        passwordHash: defaultPwd,
        role: Role.STUDENT,
        status: AccountStatus.ACTIVE,
        student: { create: { level: 'Terminale' } },
      },
    });

    // 6. Parent (Linked to Student 1)
    const uParent = await prisma.user.create({
      data: {
        email: 'p4r-parent@svt.dev',
        firstName: 'Parent',
        lastName: 'P4',
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
        studentId: uStudent1.student!.id,
      },
    });

    // Create Groups
    const group1 = await prisma.group.create({
      data: {
        name: 'P4 Active Group',
        level: 'Terminale',
        capacity: 10,
        teacherId: uTeacher1.teacher!.id,
      },
    });
    group1Id = group1.id;

    const groupArchived = await prisma.group.create({
      data: {
        name: 'P4 Archived Group',
        level: 'Terminale',
        capacity: 10,
        teacherId: uTeacher1.teacher!.id,
        status: 'ARCHIVED',
      },
    });
    archivedGroupId = groupArchived.id;

    // Enroll Student 1 in Group 1
    await prisma.enrollment.create({
      data: {
        groupId: group1Id,
        studentId: uStudent1.student!.id,
        status: 'ACTIVE',
      },
    });

    // Create Sessions
    const s1 = await prisma.classSession.create({
      data: {
        groupId: group1Id,
        startAt: new Date('2026-10-01T10:00:00Z'),
        endAt: new Date('2026-10-01T12:00:00Z'),
      },
    });
    session1Id = s1.id;

    const sCancelled = await prisma.classSession.create({
      data: {
        groupId: group1Id,
        startAt: new Date('2026-10-02T10:00:00Z'),
        endAt: new Date('2026-10-02T12:00:00Z'),
        status: 'CANCELLED',
      },
    });
    sessionCancelledId = sCancelled.id;

    // Get Auth Tokens
    adminToken = await login('p4r-admin@svt.dev');
    teacherToken = await login('p4r-teacher1@svt.dev');
    otherTeacherToken = await login('p4r-teacher2@svt.dev');
    studentToken = await login('p4r-student1@svt.dev');
    otherStudentToken = await login('p4r-student2@svt.dev');
    parentToken = await login('p4r-parent@svt.dev');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /resources', () => {
    it('should create a LINK resource successfully (Teacher)', async () => {
      const res = await request(app.getHttpServer())
        .post('/resources')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Cours SVT - Vidéo YouTube',
          description: 'Lien vers le cours vidéo',
          type: 'LINK',
          externalUrl: 'https://youtube.com/watch?v=12345',
          groupId: group1Id,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('Cours SVT - Vidéo YouTube');
      expect(res.body.type).toBe('LINK');
      expect(res.body.externalUrl).toBe('https://youtube.com/watch?v=12345');
      expect(res.body.status).toBe('ACTIVE');

      linkResourceId = res.body.id;
    });

    it('should fail if externalUrl is missing for LINK type (400)', async () => {
      await request(app.getHttpServer())
        .post('/resources')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Invalid Link',
          type: 'LINK',
          groupId: group1Id,
        })
        .expect(400);
    });

    it('should upload a file resource (PDF) successfully', async () => {
      const res = await request(app.getHttpServer())
        .post('/resources')
        .set('Authorization', `Bearer ${teacherToken}`)
        .field('title', 'Document PDF Chapitre 1')
        .field('type', 'PDF')
        .field('groupId', group1Id)
        .field('sessionId', session1Id)
        .attach('file', Buffer.from('PDF test content'), 'chap1.pdf')
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('Document PDF Chapitre 1');
      expect(res.body.type).toBe('PDF');
      expect(res.body.storageKey).toBeDefined();
      expect(res.body.sessionId).toBe(session1Id);

      fileResourceId = res.body.id;
    });

    it('should reject non-teacher/admin creating resources (403)', async () => {
      await request(app.getHttpServer())
        .post('/resources')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'Student Attempt',
          type: 'LINK',
          externalUrl: 'https://example.com',
          groupId: group1Id,
        })
        .expect(403);
    });

    it('should reject teacher uploading to a group they do not own (403)', async () => {
      await request(app.getHttpServer())
        .post('/resources')
        .set('Authorization', `Bearer ${otherTeacherToken}`)
        .send({
          title: 'Other Teacher Attempt',
          type: 'LINK',
          externalUrl: 'https://example.com',
          groupId: group1Id,
        })
        .expect(403);
    });

    it('should reject resource creation on ARCHIVED group (409)', async () => {
      await request(app.getHttpServer())
        .post('/resources')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Archived Group Resource',
          type: 'LINK',
          externalUrl: 'https://example.com',
          groupId: archivedGroupId,
        })
        .expect(409);
    });

    it('should reject resource creation on CANCELLED session (409)', async () => {
      await request(app.getHttpServer())
        .post('/resources')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Cancelled Session Resource',
          type: 'LINK',
          externalUrl: 'https://example.com',
          sessionId: sessionCancelledId,
        })
        .expect(409);
    });
  });

  describe('GET /resources', () => {
    it('should allow teacher to list resources of their group', async () => {
      const res = await request(app.getHttpServer())
        .get(`/resources?groupId=${group1Id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    it('should allow enrolled student to list resources of their group', async () => {
      const res = await request(app.getHttpServer())
        .get(`/resources?groupId=${group1Id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    it('should allow linked parent to list resources of their child group', async () => {
      const res = await request(app.getHttpServer())
        .get(`/resources?groupId=${group1Id}`)
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty/filter for non-enrolled student', async () => {
      const res = await request(app.getHttpServer())
        .get(`/resources?groupId=${group1Id}`)
        .set('Authorization', `Bearer ${otherStudentToken}`)
        .expect(200);

      expect(res.body).toEqual([]);
    });
  });

  describe('GET /resources/:id/download', () => {
    it('should return 400 Bad Request when downloading a LINK resource (Decision 2)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/resources/${linkResourceId}/download`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(400);

      expect(res.body.message).toContain('link');
    });

    it('should download a file resource successfully', async () => {
      const res = await request(app.getHttpServer())
        .get(`/resources/${fileResourceId}/download`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(res.header['content-disposition']).toBeDefined();
    });
  });

  describe('PATCH /resources/:id and /archive', () => {
    it('should update resource metadata (Teacher)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/resources/${linkResourceId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: 'Titre Mis à Jour' })
        .expect(200);

      expect(res.body.title).toBe('Titre Mis à Jour');
    });

    it('should archive a resource (Decision 1 - soft delete Option A)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/resources/${linkResourceId}/archive`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(res.body.status).toBe('ARCHIVED');
    });

    it('should reject archiving an already archived resource (409)', async () => {
      await request(app.getHttpServer())
        .patch(`/resources/${linkResourceId}/archive`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(409);
    });
  });
});

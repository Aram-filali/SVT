import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import cookieParser from 'cookie-parser';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { AccountStatus } from '../src/common/enums/account-status.enum.js';
import { Role } from '../src/common/enums/role.enum.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import * as argon2 from 'argon2';

describe('Phase 2 — Groups, Enrollments, Sessions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let adminToken: string;
  let teacher1Token: string;
  let teacher2Token: string;
  let student1Token: string;
  let student2Token: string;
  let parentToken: string;

  let teacher1ProfileId: string;
  let teacher2ProfileId: string;
  let student1ProfileId: string;
  let student2ProfileId: string;

  let group1Id: string;
  let group2Id: string;
  let archivedGroupId: string;

  let session1Id: string;
  let sessionArchivedId: string;

  const login = async (email: string, password = 'Password123!') => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password });
    return res.body.accessToken;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Clean any previous test data
    await prisma.classSession.deleteMany({});
    await prisma.enrollment.deleteMany({});
    await prisma.group.deleteMany({});
    await prisma.parentStudent.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'p2-' } },
    });

    const hash = async (pwd: string) => argon2.hash(pwd, { type: argon2.argon2id });
    const defaultPwd = await hash('Password123!');

    // Create test users
    const uAdmin = await prisma.user.create({
      data: {
        email: 'p2-admin@svt.dev',
        firstName: 'Admin',
        lastName: 'P2',
        passwordHash: defaultPwd,
        role: Role.ADMIN,
        status: AccountStatus.ACTIVE,
      },
    });

    const uTeacher1 = await prisma.user.create({
      data: {
        email: 'p2-teacher1@svt.dev',
        firstName: 'Teacher1',
        lastName: 'P2',
        passwordHash: defaultPwd,
        role: Role.TEACHER,
        status: AccountStatus.ACTIVE,
        teacher: { create: {} },
      },
      include: { teacher: true },
    });
    teacher1ProfileId = uTeacher1.teacher!.id;

    const uTeacher2 = await prisma.user.create({
      data: {
        email: 'p2-teacher2@svt.dev',
        firstName: 'Teacher2',
        lastName: 'P2',
        passwordHash: defaultPwd,
        role: Role.TEACHER,
        status: AccountStatus.ACTIVE,
        teacher: { create: {} },
      },
      include: { teacher: true },
    });
    teacher2ProfileId = uTeacher2.teacher!.id;

    const uStudent1 = await prisma.user.create({
      data: {
        email: 'p2-student1@svt.dev',
        firstName: 'Student1',
        lastName: 'P2',
        passwordHash: defaultPwd,
        role: Role.STUDENT,
        status: AccountStatus.ACTIVE,
        student: { create: {} },
      },
      include: { student: true },
    });
    student1ProfileId = uStudent1.student!.id;

    const uStudent2 = await prisma.user.create({
      data: {
        email: 'p2-student2@svt.dev',
        firstName: 'Student2',
        lastName: 'P2',
        passwordHash: defaultPwd,
        role: Role.STUDENT,
        status: AccountStatus.ACTIVE,
        student: { create: {} },
      },
      include: { student: true },
    });
    student2ProfileId = uStudent2.student!.id;

    const uParent = await prisma.user.create({
      data: {
        email: 'p2-parent@svt.dev',
        firstName: 'Parent',
        lastName: 'P2',
        passwordHash: defaultPwd,
        role: Role.PARENT,
        status: AccountStatus.ACTIVE,
        parent: { create: {} },
      },
      include: { parent: true },
    });

    // Link parent to student1
    await prisma.parentStudent.create({
      data: {
        parentId: uParent.parent!.id,
        studentId: student1ProfileId,
      },
    });

    // Get tokens
    adminToken = await login('p2-admin@svt.dev');
    teacher1Token = await login('p2-teacher1@svt.dev');
    teacher2Token = await login('p2-teacher2@svt.dev');
    student1Token = await login('p2-student1@svt.dev');
    student2Token = await login('p2-student2@svt.dev');
    parentToken = await login('p2-parent@svt.dev');
  });

  afterAll(async () => {
    await prisma.classSession.deleteMany({});
    await prisma.enrollment.deleteMany({});
    await prisma.group.deleteMany({});
    await prisma.parentStudent.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'p2-' } },
    });
    await app.close();
  });

  // ==========================================
  // 1. GROUPS
  // ==========================================
  describe('Groups Management', () => {
    it('Teacher 1 should create Group 1 with capacity 1', async () => {
      const res = await request(app.getHttpServer())
        .post('/groups')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          name: 'Groupe 1 SVT Terminale',
          level: 'Terminale',
          capacity: 1,
          description: 'Préparation BAC',
        });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Groupe 1 SVT Terminale');
      expect(res.body.capacity).toBe(1);
      expect(res.body.status).toBe('ACTIVE');
      group1Id = res.body.id;
    });

    it('Teacher 2 should create Group 2', async () => {
      const res = await request(app.getHttpServer())
        .post('/groups')
        .set('Authorization', `Bearer ${teacher2Token}`)
        .send({
          name: 'Groupe 2 SVT 1ère',
          level: '1ère',
          capacity: 15,
        });
      expect(res.status).toBe(201);
      group2Id = res.body.id;
    });

    it('Admin can create a group specifying teacherId', async () => {
      const res = await request(app.getHttpServer())
        .post('/groups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Groupe 3 Admin-created',
          level: '2nde',
          capacity: 10,
          teacherId: teacher1ProfileId,
        });
      expect(res.status).toBe(201);
      archivedGroupId = res.body.id;
    });

    it('Student cannot create a group (403)', async () => {
      const res = await request(app.getHttpServer())
        .post('/groups')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          name: 'Groupe Hacking',
          level: 'Terminale',
          capacity: 10,
        });
      expect(res.status).toBe(403);
    });

    it('Teacher 1 can view only their groups', async () => {
      const res = await request(app.getHttpServer())
        .get('/groups')
        .set('Authorization', `Bearer ${teacher1Token}`);
      expect(res.status).toBe(200);
      const groupNames = res.body.map((g: any) => g.name);
      expect(groupNames).toContain('Groupe 1 SVT Terminale');
      expect(groupNames).toContain('Groupe 3 Admin-created');
      expect(groupNames).not.toContain('Groupe 2 SVT 1ère');
    });

    it('Admin can view all groups', async () => {
      const res = await request(app.getHttpServer())
        .get('/groups')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(3);
    });

    it('Teacher 2 cannot access or update Group 1 (403)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/groups/${group1Id}`)
        .set('Authorization', `Bearer ${teacher2Token}`)
        .send({ name: 'Hacked Name' });
      expect(res.status).toBe(403);
    });

    it('Teacher 1 can update Group 1', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/groups/${group1Id}`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ description: 'Updated description' });
      expect(res.status).toBe(200);
      expect(res.body.description).toBe('Updated description');
    });

    it('Teacher 1 can archive Group 3', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/groups/${archivedGroupId}/archive`)
        .set('Authorization', `Bearer ${teacher1Token}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ARCHIVED');
    });

    it('Modifying an archived group returns 409', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/groups/${archivedGroupId}`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ name: 'New Name' });
      expect(res.status).toBe(409);
    });

    it('Archiving an already archived group returns 409', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/groups/${archivedGroupId}/archive`)
        .set('Authorization', `Bearer ${teacher1Token}`);
      expect(res.status).toBe(409);
    });
  });

  // ==========================================
  // 2. ENROLLMENTS
  // ==========================================
  describe('Enrollments Management', () => {
    it('Teacher 1 can enroll Student 1 into Group 1', async () => {
      const res = await request(app.getHttpServer())
        .post(`/groups/${group1Id}/enrollments`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ studentId: student1ProfileId });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('ACTIVE');
    });

    it('Enrolling duplicate student in same group returns 409', async () => {
      const res = await request(app.getHttpServer())
        .post(`/groups/${group1Id}/enrollments`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ studentId: student1ProfileId });
      expect(res.status).toBe(409);
    });

    it('Enrolling student in a full capacity group returns 409 (Group 1 capacity = 1)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/groups/${group1Id}/enrollments`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ studentId: student2ProfileId });
      expect(res.status).toBe(409);
      expect(res.body.message.toLowerCase()).toMatch(/capacit/);
    });

    it('Enrolling student in an archived group returns 409', async () => {
      const res = await request(app.getHttpServer())
        .post(`/groups/${archivedGroupId}/enrollments`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ studentId: student2ProfileId });
      expect(res.status).toBe(409);
    });

    it('Teacher 2 cannot enroll student in Group 1 (403)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/groups/${group1Id}/enrollments`)
        .set('Authorization', `Bearer ${teacher2Token}`)
        .send({ studentId: student2ProfileId });
      expect(res.status).toBe(403);
    });

    it('Student 1 can see Group 1 in their /groups', async () => {
      const res = await request(app.getHttpServer())
        .get('/groups')
        .set('Authorization', `Bearer ${student1Token}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].id).toBe(group1Id);
    });

    it('Parent can see Student 1 group via /groups', async () => {
      const res = await request(app.getHttpServer())
        .get('/groups')
        .set('Authorization', `Bearer ${parentToken}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].id).toBe(group1Id);
    });
  });

  // ==========================================
  // 3. CLASS SESSIONS & CONFLICT DETECTION
  // ==========================================
  describe('ClassSessions & Conflict Detection', () => {
    const tomorrow10 = new Date(Date.now() + 24 * 3600 * 1000);
    tomorrow10.setHours(10, 0, 0, 0);
    const tomorrow12 = new Date(Date.now() + 24 * 3600 * 1000);
    tomorrow12.setHours(12, 0, 0, 0);

    const tomorrow11 = new Date(Date.now() + 24 * 3600 * 1000);
    tomorrow11.setHours(11, 0, 0, 0);
    const tomorrow13 = new Date(Date.now() + 24 * 3600 * 1000);
    tomorrow13.setHours(13, 0, 0, 0);

    const tomorrow12to14 = new Date(Date.now() + 24 * 3600 * 1000);
    tomorrow12to14.setHours(14, 0, 0, 0);

    it('Should reject session if startAt >= endAt (400)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/groups/${group1Id}/sessions`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          startAt: tomorrow12.toISOString(),
          endAt: tomorrow10.toISOString(),
          mode: 'PRESENTIEL',
        });
      expect(res.status).toBe(400);
    });

    it('Should reject session with ONLINE mode but missing meetingUrl (400)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/groups/${group1Id}/sessions`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          startAt: tomorrow10.toISOString(),
          endAt: tomorrow12.toISOString(),
          mode: 'ONLINE',
        });
      expect(res.status).toBe(400);
    });

    it('Teacher 1 can create Session 1 (10h-12h) for Group 1', async () => {
      const res = await request(app.getHttpServer())
        .post(`/groups/${group1Id}/sessions`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          startAt: tomorrow10.toISOString(),
          endAt: tomorrow12.toISOString(),
          mode: 'PRESENTIEL',
          location: 'Salle SVT 1',
        });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('SCHEDULED');
      session1Id = res.body.id;
    });

    it('Teacher 1 cannot schedule overlapping session (11h-13h) -> 409 Conflict', async () => {
      const res = await request(app.getHttpServer())
        .post(`/groups/${group1Id}/sessions`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          startAt: tomorrow11.toISOString(),
          endAt: tomorrow13.toISOString(),
          mode: 'PRESENTIEL',
        });
      expect(res.status).toBe(409);
      expect(res.body.message).toContain('conflict');
    });

    it('Teacher 1 can schedule consecutive session (12h-14h) -> Allowed', async () => {
      const res = await request(app.getHttpServer())
        .post(`/groups/${group1Id}/sessions`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          startAt: tomorrow12.toISOString(),
          endAt: tomorrow12to14.toISOString(),
          mode: 'PRESENTIEL',
        });
      expect(res.status).toBe(201);
    });

    it('Teacher 2 CAN schedule session at same time (10h-12h) for their own group -> Allowed', async () => {
      const res = await request(app.getHttpServer())
        .post(`/groups/${group2Id}/sessions`)
        .set('Authorization', `Bearer ${teacher2Token}`)
        .send({
          startAt: tomorrow10.toISOString(),
          endAt: tomorrow12.toISOString(),
          mode: 'PRESENTIEL',
        });
      expect(res.status).toBe(201);
    });

    it('Cannot schedule session for archived group -> 409', async () => {
      const res = await request(app.getHttpServer())
        .post(`/groups/${archivedGroupId}/sessions`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          startAt: tomorrow10.toISOString(),
          endAt: tomorrow12.toISOString(),
          mode: 'PRESENTIEL',
        });
      expect(res.status).toBe(409);
    });

    it('Student 1 can view sessions of Group 1', async () => {
      const res = await request(app.getHttpServer())
        .get(`/groups/${group1Id}/sessions`)
        .set('Authorization', `Bearer ${student1Token}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    it('Student 2 cannot view sessions of Group 1 (403)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/groups/${group1Id}/sessions`)
        .set('Authorization', `Bearer ${student2Token}`);
      expect(res.status).toBe(403);
    });

    it('Parent can view sessions in planning for their child', async () => {
      const res = await request(app.getHttpServer())
        .get('/sessions')
        .set('Authorization', `Bearer ${parentToken}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    it('Teacher 1 can switch Session 1 to ONLINE', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/sessions/${session1Id}/online`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ meetingUrl: 'https://meet.google.com/abc-defg-hij' });
      expect(res.status).toBe(200);
      expect(res.body.mode).toBe('ONLINE');
      expect(res.body.meetingUrl).toBe('https://meet.google.com/abc-defg-hij');
    });

    it('Teacher 1 can complete Session 1', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/sessions/${session1Id}/complete`)
        .set('Authorization', `Bearer ${teacher1Token}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('COMPLETED');
    });

    // Test archived group closure rule (cancel & complete allowed, modify/online blocked)
    describe('Archived group sessions rules', () => {
      let activeGroupToArchiveId: string;
      let sessionOnArchivedGroup: string;

      beforeAll(async () => {
        // Create an active group with a session, then archive it
        const grp = await prisma.group.create({
          data: {
            name: 'Group To Be Archived',
            level: 'Terminale',
            capacity: 5,
            teacherId: teacher1ProfileId,
          },
        });
        activeGroupToArchiveId = grp.id;

        const sess = await prisma.classSession.create({
          data: {
            groupId: activeGroupToArchiveId,
            startAt: new Date(Date.now() + 48 * 3600 * 1000),
            endAt: new Date(Date.now() + 50 * 3600 * 1000),
            status: 'SCHEDULED',
          },
        });
        sessionOnArchivedGroup = sess.id;

        // Archive group
        await prisma.group.update({
          where: { id: activeGroupToArchiveId },
          data: { status: 'ARCHIVED' },
        });
      });

      it('Rescheduling session on archived group returns 409', async () => {
        const res = await request(app.getHttpServer())
          .patch(`/sessions/${sessionOnArchivedGroup}`)
          .set('Authorization', `Bearer ${teacher1Token}`)
          .send({ notes: 'rescheduled' });
        expect(res.status).toBe(409);
      });

      it('Switching session to online on archived group returns 409', async () => {
        const res = await request(app.getHttpServer())
          .patch(`/sessions/${sessionOnArchivedGroup}/online`)
          .set('Authorization', `Bearer ${teacher1Token}`)
          .send({ meetingUrl: 'https://meet.google.com/test' });
        expect(res.status).toBe(409);
      });

      it('Cancelling session on archived group IS ALLOWED -> 200', async () => {
        const res = await request(app.getHttpServer())
          .patch(`/sessions/${sessionOnArchivedGroup}/cancel`)
          .set('Authorization', `Bearer ${teacher1Token}`);
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('CANCELLED');
      });
    });
  });
});

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

describe('Phase 3 — Registration Requests & Admin Activation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let adminToken: string;
  let teacher1Token: string;
  let teacher2Token: string;
  let parentToken: string;
  let studentToken: string;

  let teacher1ProfileId: string;
  let teacher2ProfileId: string;
  let parentProfileId: string;
  let studentProfileId: string;
  let otherStudentProfileId: string;
  let pendingUserToActivateId: string;

  let group1Id: string;
  let groupFullCapacityId: string;
  let groupArchivedId: string;

  let requestId1: string;
  let requestOpenLevelId: string;
  let requestToCancelId: string;
  let requestToRejectId: string;

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

    // Clean test data
    await prisma.registrationRequest.deleteMany({});
    await prisma.classSession.deleteMany({});
    await prisma.enrollment.deleteMany({});
    await prisma.group.deleteMany({});
    await prisma.parentStudent.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'p3-' } },
    });

    const hash = async (pwd: string) => argon2.hash(pwd, { type: argon2.argon2id });
    const defaultPwd = await hash('Password123!');

    // 1. Admin
    await prisma.user.create({
      data: {
        email: 'p3-admin@svt.dev',
        firstName: 'Admin',
        lastName: 'P3',
        passwordHash: defaultPwd,
        role: Role.ADMIN,
        status: AccountStatus.ACTIVE,
      },
    });

    // 2. Teacher 1
    const uTeacher1 = await prisma.user.create({
      data: {
        email: 'p3-teacher1@svt.dev',
        firstName: 'Teacher1',
        lastName: 'P3',
        passwordHash: defaultPwd,
        role: Role.TEACHER,
        status: AccountStatus.ACTIVE,
        teacher: { create: {} },
      },
      include: { teacher: true },
    });
    teacher1ProfileId = uTeacher1.teacher!.id;

    // 3. Teacher 2
    const uTeacher2 = await prisma.user.create({
      data: {
        email: 'p3-teacher2@svt.dev',
        firstName: 'Teacher2',
        lastName: 'P3',
        passwordHash: defaultPwd,
        role: Role.TEACHER,
        status: AccountStatus.ACTIVE,
        teacher: { create: {} },
      },
      include: { teacher: true },
    });
    teacher2ProfileId = uTeacher2.teacher!.id;

    // 4. Student 1
    const uStudent = await prisma.user.create({
      data: {
        email: 'p3-student@svt.dev',
        firstName: 'Student1',
        lastName: 'P3',
        passwordHash: defaultPwd,
        role: Role.STUDENT,
        status: AccountStatus.ACTIVE,
        student: { create: {} },
      },
      include: { student: true },
    });
    studentProfileId = uStudent.student!.id;

    // 5. Other Student (not linked to parent)
    const uOtherStudent = await prisma.user.create({
      data: {
        email: 'p3-otherstudent@svt.dev',
        firstName: 'OtherStudent',
        lastName: 'P3',
        passwordHash: defaultPwd,
        role: Role.STUDENT,
        status: AccountStatus.ACTIVE,
        student: { create: {} },
      },
      include: { student: true },
    });
    otherStudentProfileId = uOtherStudent.student!.id;

    // 6. Parent
    const uParent = await prisma.user.create({
      data: {
        email: 'p3-parent@svt.dev',
        firstName: 'Parent',
        lastName: 'P3',
        passwordHash: defaultPwd,
        role: Role.PARENT,
        status: AccountStatus.ACTIVE,
        parent: { create: {} },
      },
      include: { parent: true },
    });
    parentProfileId = uParent.parent!.id;

    // Link Parent -> Student 1
    await prisma.parentStudent.create({
      data: {
        parentId: parentProfileId,
        studentId: studentProfileId,
      },
    });

    // 7. Pending User (for admin activation test)
    const uPending = await prisma.user.create({
      data: {
        email: 'p3-pending@svt.dev',
        firstName: 'Pending',
        lastName: 'P3',
        passwordHash: defaultPwd,
        role: Role.STUDENT,
        status: AccountStatus.PENDING,
        student: { create: {} },
      },
    });
    pendingUserToActivateId = uPending.id;

    // Groups
    const grp1 = await prisma.group.create({
      data: {
        name: 'Groupe SVT Terminale Normal',
        level: 'Terminale',
        capacity: 10,
        teacherId: teacher1ProfileId,
        status: 'ACTIVE',
      },
    });
    group1Id = grp1.id;

    const grpFull = await prisma.group.create({
      data: {
        name: 'Groupe SVT Complet (Capacite 1)',
        level: 'Terminale',
        capacity: 1,
        teacherId: teacher1ProfileId,
        status: 'ACTIVE',
      },
    });
    groupFullCapacityId = grpFull.id;
    // Enroll other student in grpFull to fill it up
    await prisma.enrollment.create({
      data: {
        groupId: groupFullCapacityId,
        studentId: otherStudentProfileId,
        status: 'ACTIVE',
      },
    });

    const grpArchived = await prisma.group.create({
      data: {
        name: 'Groupe SVT Archive',
        level: 'Terminale',
        capacity: 10,
        teacherId: teacher1ProfileId,
        status: 'ARCHIVED',
      },
    });
    groupArchivedId = grpArchived.id;

    // Tokens
    adminToken = await login('p3-admin@svt.dev');
    teacher1Token = await login('p3-teacher1@svt.dev');
    teacher2Token = await login('p3-teacher2@svt.dev');
    parentToken = await login('p3-parent@svt.dev');
    studentToken = await login('p3-student@svt.dev');
  });

  afterAll(async () => {
    await prisma.registrationRequest.deleteMany({});
    await prisma.classSession.deleteMany({});
    await prisma.enrollment.deleteMany({});
    await prisma.group.deleteMany({});
    await prisma.parentStudent.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'p3-' } },
    });
    await app.close();
  });

  // ====================================================
  // 1. ADMIN USER ACTIVATION & REJECTION
  // ====================================================
  describe('Admin User Activation / Rejection', () => {
    it('Admin can view pending users', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/users/pending')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      const pendingEmails = res.body.map((u: any) => u.email);
      expect(pendingEmails).toContain('p3-pending@svt.dev');
    });

    it('Non-admin cannot view pending users (403)', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/users/pending')
        .set('Authorization', `Bearer ${teacher1Token}`);
      expect(res.status).toBe(403);
    });

    it('Admin can activate a PENDING user', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/admin/users/${pendingUserToActivateId}/activate`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ACTIVE');
    });

    it('Activating an already ACTIVE user returns 409', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/admin/users/${pendingUserToActivateId}/activate`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(409);
    });

    it('Admin can reject (suspend) a user', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/admin/users/${pendingUserToActivateId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('SUSPENDED');
    });
  });

  // ====================================================
  // 2. CREATION OF REGISTRATION REQUESTS
  // ====================================================
  describe('Creation of Registration Requests', () => {
    it('Parent creates a request for linked child targeting Group 1', async () => {
      const res = await request(app.getHttpServer())
        .post('/registration-requests')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({
          studentId: studentProfileId,
          groupId: group1Id,
          message: 'Demande pour mon enfant en Terminale',
        });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('PENDING');
      expect(res.body.studentId).toBe(studentProfileId);
      expect(res.body.groupId).toBe(group1Id);
      requestId1 = res.body.id;
    });

    it('Parent cannot create duplicate pending request for same student & group (409)', async () => {
      const res = await request(app.getHttpServer())
        .post('/registration-requests')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({
          studentId: studentProfileId,
          groupId: group1Id,
        });
      expect(res.status).toBe(409);
      expect(res.body.message).toContain('cours');
    });

    it('Parent cannot create request for an unlinked student (403)', async () => {
      const res = await request(app.getHttpServer())
        .post('/registration-requests')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({
          studentId: otherStudentProfileId,
          requestedLevel: '1ère',
        });
      expect(res.status).toBe(403);
    });

    it('Student can create their own request with requestedLevel only', async () => {
      const res = await request(app.getHttpServer())
        .post('/registration-requests')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          studentId: 'arbitrary-id-ignored',
          requestedLevel: 'Terminale',
          message: 'Je souhaite rejoindre un groupe de niveau Terminale',
        });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('PENDING');
      expect(res.body.studentId).toBe(studentProfileId); // Auto-derived!
      expect(res.body.requestedLevel).toBe('Terminale');
      expect(res.body.groupId).toBeNull();
      requestOpenLevelId = res.body.id;
    });

    it('Reject request without groupId AND without requestedLevel (400)', async () => {
      const res = await request(app.getHttpServer())
        .post('/registration-requests')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({
          studentId: studentProfileId,
        });
      expect(res.status).toBe(400);
    });

    it('Reject request targeting an archived group (409)', async () => {
      const res = await request(app.getHttpServer())
        .post('/registration-requests')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({
          studentId: studentProfileId,
          groupId: groupArchivedId,
        });
      expect(res.status).toBe(409);
    });

    it('Create another request for cancellation test', async () => {
      const res = await request(app.getHttpServer())
        .post('/registration-requests')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({
          studentId: studentProfileId,
          requestedLevel: '2nde',
        });
      expect(res.status).toBe(201);
      requestToCancelId = res.body.id;
    });

    it('Create another request for rejection test', async () => {
      const res = await request(app.getHttpServer())
        .post('/registration-requests')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({
          studentId: studentProfileId,
          requestedLevel: '3ème',
        });
      expect(res.status).toBe(201);
      requestToRejectId = res.body.id;
    });
  });

  // ====================================================
  // 3. CONSULTATION & ISOLATION
  // ====================================================
  describe('Consultation & RBAC Access', () => {
    it('Parent sees only their requests', async () => {
      const res = await request(app.getHttpServer())
        .get('/registration-requests')
        .set('Authorization', `Bearer ${parentToken}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(3);
    });

    it('Teacher 1 sees requests for Teacher 1 groups and open level requests', async () => {
      const res = await request(app.getHttpServer())
        .get('/registration-requests')
        .set('Authorization', `Bearer ${teacher1Token}`);
      expect(res.status).toBe(200);
      const ids = res.body.map((r: any) => r.id);
      expect(ids).toContain(requestId1);
      expect(ids).toContain(requestOpenLevelId);
    });

    it('Teacher 2 cannot view request targeted to Teacher 1 group (403)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/registration-requests/${requestId1}`)
        .set('Authorization', `Bearer ${teacher2Token}`);
      expect(res.status).toBe(403);
    });

    it('Teacher 2 CAN view open level request', async () => {
      const res = await request(app.getHttpServer())
        .get(`/registration-requests/${requestOpenLevelId}`)
        .set('Authorization', `Bearer ${teacher2Token}`);
      expect(res.status).toBe(200);
    });

    it('Admin sees all requests', async () => {
      const res = await request(app.getHttpServer())
        .get('/registration-requests')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(4);
    });
  });

  // ====================================================
  // 4. LIFECYCLE & WORKFLOW (NEED_INFO, RESPOND, CANCEL, REJECT)
  // ====================================================
  describe('Lifecycle & Status Transitions', () => {
    it('Teacher 1 requests info on Request 1 -> NEED_INFO', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/registration-requests/${requestId1}/request-info`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ teacherMessage: 'Merci de préciser la spécialité SVT suivie au lycée' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('NEED_INFO');
      expect(res.body.teacherMessage).toBe('Merci de préciser la spécialité SVT suivie au lycée');
    });

    it('Request info without message returns 400', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/registration-requests/${requestId1}/request-info`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('Parent responds to NEED_INFO request -> returns to PENDING', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/registration-requests/${requestId1}/respond`)
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ responseMessage: 'Il suit la spécialité SVT 6h par semaine avec 15/20 de moyenne.' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PENDING');
      expect(res.body.responseMessage).toContain('spécialité SVT');
    });

    it('Parent cancels requestToCancel -> CANCELLED', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/registration-requests/${requestToCancelId}/cancel`)
        .set('Authorization', `Bearer ${parentToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CANCELLED');
    });

    it('Cancelling an already cancelled request returns 409', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/registration-requests/${requestToCancelId}/cancel`)
        .set('Authorization', `Bearer ${parentToken}`);
      expect(res.status).toBe(409);
    });

    it('Teacher rejects requestToReject with required reason -> REJECTED', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/registration-requests/${requestToRejectId}/reject`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ reason: 'Pas de créneau disponible correspondant à ce niveau.' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('REJECTED');
      expect(res.body.teacherMessage).toBe('Pas de créneau disponible correspondant à ce niveau.');
    });

    it('Rejecting without reason returns 400', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/registration-requests/${requestOpenLevelId}/reject`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  // ====================================================
  // 5. ACCEPTANCE & ATOMIC ENROLLMENT CREATION
  // ====================================================
  describe('Acceptance & Transactional Enrollment', () => {
    it('Teacher 1 accepts Request 1 -> ACCEPTED & Enrollment created', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/registration-requests/${requestId1}/accept`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ACCEPTED');
      expect(res.body.groupId).toBe(group1Id);

      // Verify Enrollment in DB
      const enrollment = await prisma.enrollment.findFirst({
        where: {
          groupId: group1Id,
          studentId: studentProfileId,
          status: 'ACTIVE',
        },
      });
      expect(enrollment).not.toBeNull();
    });

    it('Accepting an open level request without specifying groupId returns 400', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/registration-requests/${requestOpenLevelId}/accept`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('Accepting into a full capacity group returns 409 Conflict', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/registration-requests/${requestOpenLevelId}/accept`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ groupId: groupFullCapacityId });
      expect(res.status).toBe(409);
      expect(res.body.message.toLowerCase()).toMatch(/capacit/);
    });

    it('Teacher 2 cannot accept request into Teacher 1 group (403)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/registration-requests/${requestOpenLevelId}/accept`)
        .set('Authorization', `Bearer ${teacher2Token}`)
        .send({ groupId: group1Id });
      expect(res.status).toBe(403);
    });

    it('Teacher 1 accepts open level request with a new group -> ACCEPTED', async () => {
      // Create another active group for teacher 1
      const grpNew = await prisma.group.create({
        data: {
          name: 'Groupe SVT Terminale B',
          level: 'Terminale',
          capacity: 8,
          teacherId: teacher1ProfileId,
          status: 'ACTIVE',
        },
      });

      const res = await request(app.getHttpServer())
        .patch(`/registration-requests/${requestOpenLevelId}/accept`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ groupId: grpNew.id });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ACCEPTED');

      // Verify Enrollment
      const enrollment = await prisma.enrollment.findFirst({
        where: {
          groupId: grpNew.id,
          studentId: studentProfileId,
          status: 'ACTIVE',
        },
      });
      expect(enrollment).not.toBeNull();
    });

    it('Re-accepting an already ACCEPTED request returns 409', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/registration-requests/${requestId1}/accept`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({});
      expect(res.status).toBe(409);
    });
  });
});
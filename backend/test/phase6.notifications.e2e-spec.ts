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
import { NotificationType, EvaluationType } from '@prisma/client';
import * as argon2 from 'argon2';

describe('Phase 6 — Notifications (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let configService: ConfigService;

  let adminToken: string;
  let teacherToken: string;
  let otherTeacherToken: string;
  let studentToken: string;
  let parentToken: string;

  let adminUserId: string;
  let teacherUserId: string;
  let otherTeacherUserId: string;
  let studentUserId: string;
  let parentUserId: string;

  let teacherProfileId: string;
  let studentProfileId: string;
  let parentProfileId: string;

  let enrolledGroupId: string;
  let requestGroupId: string;

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
    await prisma.notification.deleteMany({});
    await prisma.evaluationResult.deleteMany({});
    await prisma.evaluation.deleteMany({});
    await prisma.attendance.deleteMany({});
    await prisma.resource.deleteMany({});
    await prisma.classSession.deleteMany({});
    await prisma.registrationRequest.deleteMany({});
    await prisma.enrollment.deleteMany({});
    await prisma.parentStudent.deleteMany({});
    await prisma.group.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'p6-' } },
    });

    const hash = async (pwd: string) => argon2.hash(pwd, { type: argon2.argon2id });
    const defaultPwd = await hash('Password123!');

    // 1. Admin
    const uAdmin = await prisma.user.create({
      data: {
        email: 'p6-admin@svt.dev',
        firstName: 'Admin',
        lastName: 'P6',
        passwordHash: defaultPwd,
        role: Role.ADMIN,
        status: AccountStatus.ACTIVE,
      },
    });
    adminUserId = uAdmin.id;

    // 2. Teacher
    const uTeacher = await prisma.user.create({
      data: {
        email: 'p6-teacher@svt.dev',
        firstName: 'Prof',
        lastName: 'SVT',
        passwordHash: defaultPwd,
        role: Role.TEACHER,
        status: AccountStatus.ACTIVE,
        teacher: { create: {} },
      },
      include: { teacher: true },
    });
    teacherUserId = uTeacher.id;
    teacherProfileId = uTeacher.teacher!.id;

    // 3. Other Teacher
    const uOtherTeacher = await prisma.user.create({
      data: {
        email: 'p6-other-teacher@svt.dev',
        firstName: 'Other',
        lastName: 'Teacher',
        passwordHash: defaultPwd,
        role: Role.TEACHER,
        status: AccountStatus.ACTIVE,
        teacher: { create: {} },
      },
    });
    otherTeacherUserId = uOtherTeacher.id;

    // 4. Student
    const uStudent = await prisma.user.create({
      data: {
        email: 'p6-student@svt.dev',
        firstName: 'Eleve',
        lastName: 'P6',
        passwordHash: defaultPwd,
        role: Role.STUDENT,
        status: AccountStatus.ACTIVE,
        student: { create: { level: 'Terminale' } },
      },
      include: { student: true },
    });
    studentUserId = uStudent.id;
    studentProfileId = uStudent.student!.id;

    // 5. Parent
    const uParent = await prisma.user.create({
      data: {
        email: 'p6-parent@svt.dev',
        firstName: 'Parent',
        lastName: 'P6',
        passwordHash: defaultPwd,
        role: Role.PARENT,
        status: AccountStatus.ACTIVE,
        parent: { create: {} },
      },
      include: { parent: true },
    });
    parentUserId = uParent.id;
    parentProfileId = uParent.parent!.id;

    // Link Parent to Student
    await prisma.parentStudent.create({
      data: {
        parentId: parentProfileId,
        studentId: studentProfileId,
      },
    });

    // Create a Group where student is enrolled
    const grp1 = await prisma.group.create({
      data: {
        name: 'Groupe SVT Terminale Enrolled P6',
        level: 'Terminale',
        capacity: 30,
        teacherId: teacherProfileId,
      },
    });
    enrolledGroupId = grp1.id;

    // Enroll Student in Group 1
    await prisma.enrollment.create({
      data: {
        groupId: enrolledGroupId,
        studentId: studentProfileId,
        status: 'ACTIVE',
      },
    });

    // Create a second Group where student is NOT enrolled (for Registration Requests test)
    const grp2 = await prisma.group.create({
      data: {
        name: 'Groupe SVT Terminale Open P6',
        level: 'Terminale',
        capacity: 25,
        teacherId: teacherProfileId,
      },
    });
    requestGroupId = grp2.id;

    // Get Tokens
    adminToken = await login('p6-admin@svt.dev');
    teacherToken = await login('p6-teacher@svt.dev');
    otherTeacherToken = await login('p6-other-teacher@svt.dev');
    studentToken = await login('p6-student@svt.dev');
    parentToken = await login('p6-parent@svt.dev');
  });

  afterAll(async () => {
    await app.close();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 1: Notifications Core API (List, Count, Read, Read-All, Security)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('1. Notifications Core API', () => {
    let notif1Id: string;
    let notif2Id: string;

    beforeAll(async () => {
      // Create test notifications manually
      const n1 = await prisma.notification.create({
        data: {
          userId: studentUserId,
          type: NotificationType.SYSTEM,
          title: 'Bienvenue',
          message: 'Bienvenue sur la plateforme SVT',
          link: '/me',
          idempotencyKey: 'test:welcome:1',
        },
      });
      notif1Id = n1.id;

      const n2 = await prisma.notification.create({
        data: {
          userId: studentUserId,
          type: NotificationType.EVALUATION,
          title: 'Devoir 1',
          message: 'Devoir 1 disponible',
          link: '/my-evaluations',
          idempotencyKey: 'test:eval:1',
        },
      });
      notif2Id = n2.id;
    });

    it('should reject unauthenticated request with 401', async () => {
      await request(app.getHttpServer())
        .get('/notifications')
        .expect(401);
    });

    it('should list notifications for authenticated user with pagination and metadata', async () => {
      const res = await request(app.getHttpServer())
        .get('/notifications?page=1&limit=10')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(2);
      expect(res.body.meta.unreadCount).toBe(2);
      expect(res.body.meta.page).toBe(1);
    });

    it('should return unread count for user', async () => {
      const res = await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(res.body.unreadCount).toBe(2);
    });

    it('should get single notification by id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/notifications/${notif1Id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(res.body.id).toBe(notif1Id);
      expect(res.body.title).toBe('Bienvenue');
    });

    it('should prevent user from accessing another user notification (403)', async () => {
      await request(app.getHttpServer())
        .get(`/notifications/${notif1Id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(403);
    });

    it('should mark single notification as read (idempotent)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/notifications/${notif1Id}/read`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(res.body.isRead).toBe(true);
      expect(res.body.readAt).not.toBeNull();

      // Check unread count is now 1
      const countRes = await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
      expect(countRes.body.unreadCount).toBe(1);

      // Second read call is idempotent (no-op)
      await request(app.getHttpServer())
        .patch(`/notifications/${notif1Id}/read`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
    });

    it('should mark all unread notifications as read', async () => {
      const res = await request(app.getHttpServer())
        .patch('/notifications/read-all')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(res.body.count).toBe(1); // 1 remaining unread

      const countRes = await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
      expect(countRes.body.unreadCount).toBe(0);
    });

    it('should filter notifications by isRead query parameter', async () => {
      const resRead = await request(app.getHttpServer())
        .get('/notifications?isRead=true')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(resRead.body.data).toHaveLength(2);

      const resUnread = await request(app.getHttpServer())
        .get('/notifications?isRead=false')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(resUnread.body.data).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 2: RegistrationRequest Events
  // ═══════════════════════════════════════════════════════════════════════════
  describe('2. RegistrationRequest Events', () => {
    let requestId: string;

    it('should notify group teacher when a new registration request is created', async () => {
      // Clear teacher notifications
      await prisma.notification.deleteMany({ where: { userId: teacherUserId } });

      const res = await request(app.getHttpServer())
        .post('/registration-requests')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({
          studentId: studentProfileId,
          groupId: requestGroupId,
          message: 'Demande inscription SVT Groupe 2',
        })
        .expect(201);

      requestId = res.body.id;

      // Verify teacher received notification
      const teacherNotifs = await prisma.notification.findMany({
        where: { userId: teacherUserId, type: NotificationType.REGISTRATION_REQUEST },
      });
      expect(teacherNotifs).toHaveLength(1);
      expect(teacherNotifs[0].idempotencyKey).toBe(`reg_req:${requestId}:created:${teacherUserId}`);
      expect(teacherNotifs[0].title).toBe("Nouvelle demande d'inscription");
    });

    it('should notify student and parent when teacher requests info (NEED_INFO)', async () => {
      await request(app.getHttpServer())
        .patch(`/registration-requests/${requestId}/request-info`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ teacherMessage: 'Merci de fournir le bulletin T1' })
        .expect(200);

      const parentNotif = await prisma.notification.findFirst({
        where: { userId: parentUserId, idempotencyKey: `reg_req:${requestId}:need_info:${parentUserId}` },
      });
      expect(parentNotif).not.toBeNull();
      expect(parentNotif!.title).toBe('Informations complémentaires demandées');
    });

    it('should notify teacher when applicant responds to info (respondInfo)', async () => {
      await request(app.getHttpServer())
        .patch(`/registration-requests/${requestId}/respond`)
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ responseMessage: 'Voici les précisions demandées' })
        .expect(200);

      const teacherNotif = await prisma.notification.findFirst({
        where: {
          userId: teacherUserId,
          title: "Réponse à la demande d'inscription",
        },
      });
      expect(teacherNotif).not.toBeNull();
      expect(teacherNotif!.idempotencyKey).toContain(`reg_req:${requestId}:responded:`);
    });

    it('should notify student and parent when request is accepted', async () => {
      await request(app.getHttpServer())
        .patch(`/registration-requests/${requestId}/accept`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ groupId: requestGroupId })
        .expect(200);

      const parentNotif = await prisma.notification.findFirst({
        where: { userId: parentUserId, idempotencyKey: `reg_req:${requestId}:accepted:${parentUserId}` },
      });
      expect(parentNotif).not.toBeNull();
      expect(parentNotif!.title).toBe("Demande d'inscription acceptée");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 3: Evaluation & Results Events
  // ═══════════════════════════════════════════════════════════════════════════
  describe('3. Evaluation & Results Events', () => {
    let evalId: string;

    it('should NOT notify students when evaluation is created in DRAFT', async () => {
      const prevCount = await prisma.notification.count({ where: { userId: studentUserId } });

      const res = await request(app.getHttpServer())
        .post('/evaluations')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'DS 1 Génétique',
          type: EvaluationType.TEST,
          date: new Date().toISOString(),
          maxScore: 20,
          coefficient: 1,
          groupId: enrolledGroupId,
        })
        .expect(201);

      evalId = res.body.id;

      const currentCount = await prisma.notification.count({ where: { userId: studentUserId } });
      expect(currentCount).toBe(prevCount);
    });

    it('should notify eligible students on evaluation publication (and check parent visibility)', async () => {
      // By default PARENT_GRADES_VISIBLE is false -> Parent not notified
      await request(app.getHttpServer())
        .post(`/evaluations/${evalId}/publish`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(201);

      const studentNotif = await prisma.notification.findFirst({
        where: { userId: studentUserId, idempotencyKey: `eval:${evalId}:published:${studentUserId}` },
      });
      expect(studentNotif).not.toBeNull();
      expect(studentNotif!.title).toBe('Nouvelle évaluation publiée');

      // Parent should NOT receive notification when PARENT_GRADES_VISIBLE is false
      const parentNotif = await prisma.notification.findFirst({
        where: { userId: parentUserId, idempotencyKey: `eval:${evalId}:published:${parentUserId}` },
      });
      expect(parentNotif).toBeNull();
    });

    it('should notify student when grade results are recorded (saveResultsBulk)', async () => {
      await request(app.getHttpServer())
        .put(`/evaluations/${evalId}/results`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          results: [{ studentId: studentProfileId, score: 16.5, comment: 'Très bon devoir' }],
        })
        .expect(200);

      const resultNotif = await prisma.notification.findFirst({
        where: {
          userId: studentUserId,
          idempotencyKey: `eval_res:${evalId}:${studentProfileId}:graded:${studentUserId}`,
        },
      });
      expect(resultNotif).not.toBeNull();
      expect(resultNotif!.title).toBe('Note disponible');
      expect(resultNotif!.message).toContain('16.5');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 4: Resource Events
  // ═══════════════════════════════════════════════════════════════════════════
  describe('4. Resource Events', () => {
    it('should notify enrolled students when a new active resource is created', async () => {
      const res = await request(app.getHttpServer())
        .post('/resources')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Schéma Bilan Mitose',
          type: 'LINK',
          externalUrl: 'https://example.com/schema-mitose.pdf',
          groupId: enrolledGroupId,
        })
        .expect(201);

      const resId = res.body.id;

      const resourceNotif = await prisma.notification.findFirst({
        where: {
          userId: studentUserId,
          idempotencyKey: `res:${resId}:created:${studentUserId}`,
        },
      });
      expect(resourceNotif).not.toBeNull();
      expect(resourceNotif!.title).toBe('Nouvelle ressource disponible');
      expect(resourceNotif!.message).toContain('Schéma Bilan Mitose');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 5: ClassSession Events
  // ═══════════════════════════════════════════════════════════════════════════
  describe('5. ClassSession Events', () => {
    let sessionId: string;

    it('should notify students and parents when a new session is scheduled', async () => {
      const startAt = new Date(Date.now() + 86400000).toISOString();
      const endAt = new Date(Date.now() + 86400000 + 7200000).toISOString();

      const res = await request(app.getHttpServer())
        .post(`/groups/${enrolledGroupId}/sessions`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          startAt,
          endAt,
          mode: 'PRESENTIEL',
          location: 'Salle SVT 2',
        })
        .expect(201);

      sessionId = res.body.id;

      const studentSessionNotif = await prisma.notification.findFirst({
        where: {
          userId: studentUserId,
          idempotencyKey: `session:${sessionId}:created:${studentUserId}`,
        },
      });
      expect(studentSessionNotif).not.toBeNull();
      expect(studentSessionNotif!.title).toBe('Nouveau cours planifié');

      const parentSessionNotif = await prisma.notification.findFirst({
        where: {
          userId: parentUserId,
          idempotencyKey: `session:${sessionId}:created:${parentUserId}`,
        },
      });
      expect(parentSessionNotif).not.toBeNull();
    });

    it('should notify students and parents when session is cancelled', async () => {
      await request(app.getHttpServer())
        .patch(`/sessions/${sessionId}/cancel`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const cancelNotif = await prisma.notification.findFirst({
        where: {
          userId: studentUserId,
          idempotencyKey: `session:${sessionId}:cancelled:${studentUserId}`,
        },
      });
      expect(cancelNotif).not.toBeNull();
      expect(cancelNotif!.title).toBe('Cours de SVT annulé');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 6: Deduplication / Idempotence Verification
  // ═══════════════════════════════════════════════════════════════════════════
  describe('6. Deduplication & Idempotence', () => {
    it('should not create duplicate notifications for repeated event calls', async () => {
      const initialCount = await prisma.notification.count({ where: { userId: studentUserId } });

      // Publish evaluation again (already published)
      const evals = await prisma.evaluation.findMany({ where: { groupId: enrolledGroupId } });
      if (evals.length > 0) {
        await request(app.getHttpServer())
          .post(`/evaluations/${evals[0].id}/publish`)
          .set('Authorization', `Bearer ${teacherToken}`)
          .expect(201);
      }

      const postCount = await prisma.notification.count({ where: { userId: studentUserId } });
      expect(postCount).toBe(initialCount); // Zero new notifications inserted
    });
  });
});
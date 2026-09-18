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

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

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
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'test' } }
    });
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('should register a new STUDENT', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test-student1@svt.dev',
          password: 'Password123!',
          firstName: 'John',
          lastName: 'Doe',
          role: Role.STUDENT,
        });
      expect(res.status).toBe(201);
      expect(res.body.email).toBe('test-student1@svt.dev');
      expect(res.body.role).toBe(Role.STUDENT);
    });

    it('should register a new PARENT', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test-parent1@svt.dev',
          password: 'Password123!',
          firstName: 'Jane',
          lastName: 'Doe',
          role: Role.PARENT,
        });
      expect(res.status).toBe(201);
    });

    it('should reject duplicate email (409)', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test-dup@svt.dev',
          password: 'Password123!',
          firstName: 'Jane',
          lastName: 'Doe',
          role: Role.PARENT,
        });
        
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test-dup@svt.dev',
          password: 'Password123!',
          firstName: 'Jane',
          lastName: 'Doe',
          role: Role.PARENT,
        });
      expect(res.status).toBe(409);
    });

    it('should reject invalid email (400)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: 'Password123!',
          firstName: 'Jane',
          lastName: 'Doe',
          role: Role.PARENT,
        });
      expect(res.status).toBe(400);
    });

    it('should reject weak password (400)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test-weak@svt.dev',
          password: 'weak',
          firstName: 'Jane',
          lastName: 'Doe',
          role: Role.PARENT,
        });
      expect(res.status).toBe(400);
    });

    it('should reject missing fields (400)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test-missing@svt.dev',
        });
      expect(res.status).toBe(400);
    });

    it('should reject TEACHER role (400)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test-teacher-role@svt.dev',
          password: 'Password123!',
          firstName: 'Jane',
          lastName: 'Doe',
          role: Role.TEACHER,
        });
      expect(res.status).toBe(400);
    });

    it('should reject ADMIN role (400)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test-admin-role@svt.dev',
          password: 'Password123!',
          firstName: 'Jane',
          lastName: 'Doe',
          role: Role.ADMIN,
        });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /auth/login', () => {
    beforeAll(async () => {
      await request(app.getHttpServer()).post('/auth/register').send({
        email: 'test-login@svt.dev',
        password: 'Password123!',
        firstName: 'Login',
        lastName: 'User',
        role: Role.STUDENT,
      });
      await prisma.user.update({
        where: { email: 'test-login@svt.dev' },
        data: { status: AccountStatus.ACTIVE },
      });
    });

    it('should login with valid ACTIVE credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test-login@svt.dev',
          password: 'Password123!',
        });
      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeDefined();
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('should reject wrong password (401)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test-login@svt.dev',
          password: 'WrongPassword1!',
        });
      expect(res.status).toBe(401);
    });

    it('should reject non-existent user (401)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'does-not-exist@svt.dev',
          password: 'Password123!',
        });
      expect(res.status).toBe(401);
    });

    it('should reject PENDING account (403)', async () => {
      await request(app.getHttpServer()).post('/auth/register').send({
        email: 'test-pending@svt.dev',
        password: 'Password123!',
        firstName: 'Pending',
        lastName: 'User',
        role: Role.STUDENT,
      });
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test-pending@svt.dev',
          password: 'Password123!',
        });
      expect(res.status).toBe(403);
    });

    it('should reject SUSPENDED account (403)', async () => {
      await request(app.getHttpServer()).post('/auth/register').send({
        email: 'test-suspended@svt.dev',
        password: 'Password123!',
        firstName: 'Suspended',
        lastName: 'User',
        role: Role.STUDENT,
      });
      await prisma.user.update({
        where: { email: 'test-suspended@svt.dev' },
        data: { status: AccountStatus.SUSPENDED },
      });
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test-suspended@svt.dev',
          password: 'Password123!',
        });
      expect(res.status).toBe(403);
    });

    it('should reject ARCHIVED account (403)', async () => {
      await request(app.getHttpServer()).post('/auth/register').send({
        email: 'test-archived@svt.dev',
        password: 'Password123!',
        firstName: 'Archived',
        lastName: 'User',
        role: Role.STUDENT,
      });
      await prisma.user.update({
        where: { email: 'test-archived@svt.dev' },
        data: { status: AccountStatus.ARCHIVED },
      });
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test-archived@svt.dev',
          password: 'Password123!',
        });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /auth/me', () => {
    let accessToken: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test-login@svt.dev',
          password: 'Password123!',
        });
      accessToken = res.body.accessToken;
    });

    it('should return user info with valid token', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.email).toBe('test-login@svt.dev');
    });

    it('should reject invalid token (401)', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
    });

    it('should reject missing token (401)', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /auth/refresh', () => {
    let cookie: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test-login@svt.dev',
          password: 'Password123!',
        });
      cookie = res.headers['set-cookie'][0];
    });

    it('should refresh tokens and rotate refresh token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookie);
      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeDefined();
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('should reject missing refresh token (401)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh');
      expect(res.status).toBe(401);
    });

    it('should reject revoked refresh token (401)', async () => {
      const res1 = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test-login@svt.dev',
          password: 'Password123!',
        });
      const oldCookie = res1.headers['set-cookie'][0];
      
      // refresh once
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', oldCookie);
        
      // try to use old again
      const res2 = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', oldCookie);
      
      expect(res2.status).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    let cookie: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test-login@svt.dev',
          password: 'Password123!',
        });
      cookie = res.headers['set-cookie'][0];
    });

    it('should revoke session', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', cookie);
      expect(res.status).toBe(201);
    });

    it('should reject old refresh token after logout', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookie);
      expect(res.status).toBe(401);
    });
  });

  describe('RBAC', () => {
    let studentToken: string;
    let parentToken: string;
    
    beforeAll(async () => {
      await request(app.getHttpServer()).post('/auth/register').send({
        email: 'test-rbac-student@svt.dev',
        password: 'Password123!',
        firstName: 'Student',
        lastName: 'User',
        role: Role.STUDENT,
      });
      await prisma.user.update({
        where: { email: 'test-rbac-student@svt.dev' },
        data: { status: AccountStatus.ACTIVE },
      });
      const sRes = await request(app.getHttpServer()).post('/auth/login').send({
        email: 'test-rbac-student@svt.dev',
        password: 'Password123!',
      });
      studentToken = sRes.body.accessToken;

      await request(app.getHttpServer()).post('/auth/register').send({
        email: 'test-rbac-parent@svt.dev',
        password: 'Password123!',
        firstName: 'Parent',
        lastName: 'User',
        role: Role.PARENT,
      });
      await prisma.user.update({
        where: { email: 'test-rbac-parent@svt.dev' },
        data: { status: AccountStatus.ACTIVE },
      });
      const pRes = await request(app.getHttpServer()).post('/auth/login').send({
        email: 'test-rbac-parent@svt.dev',
        password: 'Password123!',
      });
      parentToken = pRes.body.accessToken;
      
      const adminPwd = await argon2.hash('Password123!');
      await prisma.user.create({
        data: {
          email: 'test-rbac-admin@svt.dev',
          passwordHash: adminPwd,
          firstName: 'Admin',
          lastName: 'User',
          role: Role.ADMIN,
          status: AccountStatus.ACTIVE
        }
      });
      const teacherPwd = await argon2.hash('Password123!');
      await prisma.user.create({
        data: {
          email: 'test-rbac-teacher@svt.dev',
          passwordHash: teacherPwd,
          firstName: 'Teacher',
          lastName: 'User',
          role: Role.TEACHER,
          status: AccountStatus.ACTIVE
        }
      });
    });

    it('STUDENT should access student-only route', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/test/student-only')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
    });

    it('STUDENT should be rejected from teacher-only route (403)', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/test/teacher-only')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(403);
    });

    it('PARENT should access parent-only route', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/test/parent-only')
        .set('Authorization', `Bearer ${parentToken}`);
      expect(res.status).toBe(200);
    });

    it('TEACHER should access teacher-only route', async () => {
      const tRes = await request(app.getHttpServer()).post('/auth/login').send({
        email: 'test-rbac-teacher@svt.dev',
        password: 'Password123!',
      });
      const res = await request(app.getHttpServer())
        .get('/users/test/teacher-only')
        .set('Authorization', `Bearer ${tRes.body.accessToken}`);
      expect(res.status).toBe(200);
    });

    it('ADMIN should access admin-only route', async () => {
      const aRes = await request(app.getHttpServer()).post('/auth/login').send({
        email: 'test-rbac-admin@svt.dev',
        password: 'Password123!',
      });
      const res = await request(app.getHttpServer())
        .get('/users/test/admin-only')
        .set('Authorization', `Bearer ${aRes.body.accessToken}`);
      expect(res.status).toBe(200);
    });

    it('no token should be rejected (401)', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/test/student-only');
      expect(res.status).toBe(401);
    });
  });

  describe('Status checks', () => {
    let accessToken: string;
    let email = 'test-status@svt.dev';

    beforeAll(async () => {
      await request(app.getHttpServer()).post('/auth/register').send({
        email,
        password: 'Password123!',
        firstName: 'Status',
        lastName: 'User',
        role: Role.STUDENT,
      });
      await prisma.user.update({
        where: { email },
        data: { status: AccountStatus.ACTIVE },
      });
      const res = await request(app.getHttpServer()).post('/auth/login').send({
        email,
        password: 'Password123!',
      });
      accessToken = res.body.accessToken;
    });

    it('should reject access when account is suspended after login', async () => {
      await prisma.user.update({
        where: { email },
        data: { status: AccountStatus.SUSPENDED },
      });
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(403);
    });

    it('should reject access when account is archived after login', async () => {
      await prisma.user.update({
        where: { email },
        data: { status: AccountStatus.ARCHIVED },
      });
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(403);
    });
  });
});

import { PrismaClient, Role, AccountStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as argon2 from 'argon2';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL || 'postgresql://svt_user:svt_password@localhost:5432/svt_platform';
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const hash = async (pwd: string) => argon2.hash(pwd, { type: argon2.argon2id });

  const adminPwd = await hash('Admin123!');
  await prisma.user.upsert({
    where: { email: 'admin@svt.dev' },
    update: {},
    create: {
      email: 'admin@svt.dev',
      firstName: 'Admin',
      lastName: 'System',
      passwordHash: adminPwd,
      role: Role.ADMIN,
      status: AccountStatus.ACTIVE,
    },
  });

  const teacherPwd = await hash('Teacher123!');
  await prisma.user.upsert({
    where: { email: 'teacher@svt.dev' },
    update: {},
    create: {
      email: 'teacher@svt.dev',
      firstName: 'Teacher',
      lastName: 'One',
      passwordHash: teacherPwd,
      role: Role.TEACHER,
      status: AccountStatus.ACTIVE,
      teacher: { create: {} },
    },
  });

  const parentPwd = await hash('Parent123!');
  const parent = await prisma.user.upsert({
    where: { email: 'parent@svt.dev' },
    update: {},
    create: {
      email: 'parent@svt.dev',
      firstName: 'Parent',
      lastName: 'One',
      passwordHash: parentPwd,
      role: Role.PARENT,
      status: AccountStatus.ACTIVE,
      parent: { create: {} },
    },
    include: { parent: true }
  });

  const studentPwd = await hash('Student123!');
  const student = await prisma.user.upsert({
    where: { email: 'student@svt.dev' },
    update: {},
    create: {
      email: 'student@svt.dev',
      firstName: 'Student',
      lastName: 'One',
      passwordHash: studentPwd,
      role: Role.STUDENT,
      status: AccountStatus.ACTIVE,
      student: { create: {} },
    },
    include: { student: true }
  });

  if (parent.parent && student.student) {
    await prisma.parentStudent.upsert({
      where: {
        parentId_studentId: {
          parentId: parent.parent.id,
          studentId: student.student.id,
        },
      },
      update: {},
      create: {
        parentId: parent.parent.id,
        studentId: student.student.id,
      },
    });
  }

  const pendingPwd = await hash('Pending123!');
  await prisma.user.upsert({
    where: { email: 'pending@svt.dev' },
    update: {},
    create: {
      email: 'pending@svt.dev',
      firstName: 'Pending',
      lastName: 'User',
      passwordHash: pendingPwd,
      role: Role.STUDENT,
      status: AccountStatus.PENDING,
      student: { create: {} },
    },
  });

  const suspendedPwd = await hash('Suspended123!');
  await prisma.user.upsert({
    where: { email: 'suspended@svt.dev' },
    update: {},
    create: {
      email: 'suspended@svt.dev',
      firstName: 'Suspended',
      lastName: 'User',
      passwordHash: suspendedPwd,
      role: Role.STUDENT,
      status: AccountStatus.SUSPENDED,
      student: { create: {} },
    },
  });

  const archivedPwd = await hash('Archived123!');
  await prisma.user.upsert({
    where: { email: 'archived@svt.dev' },
    update: {},
    create: {
      email: 'archived@svt.dev',
      firstName: 'Archived',
      lastName: 'User',
      passwordHash: archivedPwd,
      role: Role.STUDENT,
      status: AccountStatus.ARCHIVED,
      student: { create: {} },
    },
  });

  console.log('Seed completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

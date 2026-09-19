import { PrismaClient, Role, AccountStatus, SessionMode, ClassSessionStatus, EnrollmentStatus, GroupStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as argon2 from 'argon2';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL || 'postgresql://svt_user:svt_password@localhost:5433/svt_platform';
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
  const teacherUser = await prisma.user.upsert({
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
    include: { teacher: true },
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
    include: { parent: true },
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
    include: { student: true },
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

  // Create demo group if none exists
  if (teacherUser.teacher) {
    const existingGroup = await prisma.group.findFirst({
      where: { teacherId: teacherUser.teacher.id, name: 'SVT Terminale Spécialité' },
    });

    let group = existingGroup;
    if (!group) {
      group = await prisma.group.create({
        data: {
          name: 'SVT Terminale Spécialité',
          level: 'Terminale',
          capacity: 12,
          description: 'Préparation approfondie au Baccalauréat SVT',
          teacherId: teacherUser.teacher.id,
          status: GroupStatus.ACTIVE,
        },
      });
    }

    if (group && student.student) {
      const existingEnrollment = await prisma.enrollment.findFirst({
        where: { groupId: group.id, studentId: student.student.id },
      });
      if (!existingEnrollment) {
        await prisma.enrollment.create({
          data: {
            groupId: group.id,
            studentId: student.student.id,
            status: EnrollmentStatus.ACTIVE,
          },
        });
      }

      const existingSession = await prisma.classSession.findFirst({
        where: { groupId: group.id },
      });
      if (!existingSession) {
        const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
        tomorrow.setHours(10, 0, 0, 0);
        const tomorrowEnd = new Date(tomorrow.getTime() + 2 * 3600 * 1000);

        await prisma.classSession.create({
          data: {
            groupId: group.id,
            startAt: tomorrow,
            endAt: tomorrowEnd,
            mode: SessionMode.PRESENTIEL,
            location: 'Salle SVT 1',
            status: ClassSessionStatus.SCHEDULED,
            notes: 'Introduction à la génétique mendélienne',
          },
        });
      }
    }
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

  console.log('Seed completed with demo group, enrollment and session.');
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
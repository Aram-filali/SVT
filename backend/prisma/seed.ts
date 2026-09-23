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

  // ─── COMPTES ─────────────────────────────────────────────────────────────
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

  // ─── LIEN PARENT → ÉLÈVE ─────────────────────────────────────────────────
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
    console.log('ok Lien parent <-> student OK');
  }

  if (!teacherUser.teacher || !student.student) {
    console.log('Seed aborted: missing teacher or student profile.');
    return;
  }

  const teacherId = teacherUser.teacher.id;
  const teacherUserId = teacherUser.id;
  const studentId = student.student.id;

  // ─── GROUPE 1 : SVT Terminale Specialite ─────────────────────────────────
  let group1 = await prisma.group.findFirst({
    where: { teacherId, name: 'SVT Terminale Specialite' },
  });
  if (!group1) {
    group1 = await prisma.group.create({
      data: {
        name: 'SVT Terminale Specialite',
        level: 'Terminale',
        capacity: 12,
        description: 'Preparation approfondie au Baccalaureat SVT',
        teacherId,
        status: GroupStatus.ACTIVE,
      },
    });
    console.log('ok Groupe 1 cree');
  }

  const enroll1 = await prisma.enrollment.findFirst({
    where: { groupId: group1.id, studentId },
  });
  if (!enroll1) {
    await prisma.enrollment.create({
      data: { groupId: group1.id, studentId, status: EnrollmentStatus.ACTIVE },
    });
    console.log('ok Enrollment student -> groupe 1');
  }

  const now = new Date();

  // Seance 1 : COMPLETED (il y a 2 jours)
  const start1 = new Date(now);
  start1.setDate(start1.getDate() - 2);
  start1.setHours(10, 0, 0, 0);
  const end1 = new Date(start1.getTime() + 2 * 3600 * 1000);

  let session1 = await prisma.classSession.findFirst({
    where: { groupId: group1.id, status: ClassSessionStatus.COMPLETED },
  });
  if (!session1) {
    session1 = await prisma.classSession.create({
      data: {
        groupId: group1.id,
        startAt: start1,
        endAt: end1,
        mode: SessionMode.PRESENTIEL,
        location: 'Salle SVT 1',
        status: ClassSessionStatus.COMPLETED,
        notes: 'Cours sur la genetique mendelienne',
      },
    });
    console.log('ok Seance 1 COMPLETED creee (groupe 1)');
  }

  // Seance 2 : SCHEDULED (demain)
  const start2 = new Date(now);
  start2.setDate(start2.getDate() + 1);
  start2.setHours(10, 0, 0, 0);
  const end2 = new Date(start2.getTime() + 2 * 3600 * 1000);

  let session2 = await prisma.classSession.findFirst({
    where: { groupId: group1.id, status: ClassSessionStatus.SCHEDULED },
  });
  if (!session2) {
    session2 = await prisma.classSession.create({
      data: {
        groupId: group1.id,
        startAt: start2,
        endAt: end2,
        mode: SessionMode.PRESENTIEL,
        location: 'Salle SVT 1',
        status: ClassSessionStatus.SCHEDULED,
        notes: 'Introduction a la genetique moleculaire',
      },
    });
    console.log('ok Seance 2 SCHEDULED creee (groupe 1)');
  }

  // Seance 3 : CANCELLED (il y a 5 jours)
  const start3 = new Date(now);
  start3.setDate(start3.getDate() - 5);
  start3.setHours(14, 0, 0, 0);
  const end3 = new Date(start3.getTime() + 2 * 3600 * 1000);

  let session3 = await prisma.classSession.findFirst({
    where: { groupId: group1.id, status: ClassSessionStatus.CANCELLED },
  });
  if (!session3) {
    session3 = await prisma.classSession.create({
      data: {
        groupId: group1.id,
        startAt: start3,
        endAt: end3,
        mode: SessionMode.DISTANCIEL,
        status: ClassSessionStatus.CANCELLED,
        notes: 'Seance annulee - enseignant absent',
      },
    });
    console.log('ok Seance 3 CANCELLED creee (groupe 1)');
  }

  // Presence PRESENT pour seance COMPLETED groupe 1
  const att1 = await prisma.attendance.findFirst({
    where: { sessionId: session1.id, studentId },
  });
  if (!att1) {
    await prisma.attendance.create({
      data: { sessionId: session1.id, studentId, status: 'PRESENT' },
    });
    console.log('ok Presence PRESENT creee (seance COMPLETED groupe 1)');
  }

  // Ressources groupe 1
  const link1 = await prisma.resource.findFirst({
    where: { groupId: group1.id, title: 'Cours de genetique Khan Academy' },
  });
  if (!link1) {
    await prisma.resource.create({
      data: {
        groupId: group1.id,
        uploadedById: teacherUserId,
        title: 'Cours de genetique Khan Academy',
        type: 'LINK',
        externalUrl: 'https://fr.khanacademy.org/science/ap-biology/heredity',
        status: 'ACTIVE',
      },
    });
    console.log('ok Ressource LINK 1 creee (groupe 1)');
  }

  const link2 = await prisma.resource.findFirst({
    where: { groupId: group1.id, title: 'Annales Bac SVT' },
  });
  if (!link2) {
    await prisma.resource.create({
      data: {
        groupId: group1.id,
        uploadedById: teacherUserId,
        title: 'Annales Bac SVT',
        type: 'LINK',
        externalUrl: 'https://www.annabac.com/annales-bac/svt',
        status: 'ACTIVE',
      },
    });
    console.log('ok Ressource LINK 2 creee (groupe 1)');
  }

  // ─── GROUPE 2 : SVT Premiere Generale ────────────────────────────────────
  let group2 = await prisma.group.findFirst({
    where: { teacherId, name: 'SVT Premiere Generale' },
  });
  if (!group2) {
    group2 = await prisma.group.create({
      data: {
        name: 'SVT Premiere Generale',
        level: 'Premiere',
        capacity: 10,
        description: 'Cours de SVT pour les eleves de Premiere',
        teacherId,
        status: GroupStatus.ACTIVE,
      },
    });
    console.log('ok Groupe 2 cree');
  }

  const enroll2 = await prisma.enrollment.findFirst({
    where: { groupId: group2.id, studentId },
  });
  if (!enroll2) {
    await prisma.enrollment.create({
      data: { groupId: group2.id, studentId, status: EnrollmentStatus.ACTIVE },
    });
    console.log('ok Enrollment student -> groupe 2');
  }

  const start4 = new Date(now);
  start4.setDate(start4.getDate() - 1);
  start4.setHours(16, 0, 0, 0);
  const end4 = new Date(start4.getTime() + 2 * 3600 * 1000);

  let session4 = await prisma.classSession.findFirst({
    where: { groupId: group2.id, status: ClassSessionStatus.COMPLETED },
  });
  if (!session4) {
    session4 = await prisma.classSession.create({
      data: {
        groupId: group2.id,
        startAt: start4,
        endAt: end4,
        mode: SessionMode.PRESENTIEL,
        location: 'Salle SVT 2',
        status: ClassSessionStatus.COMPLETED,
        notes: 'La cellule et son organisation',
      },
    });
    console.log('ok Seance COMPLETED creee (groupe 2)');
  }

  const att2 = await prisma.attendance.findFirst({
    where: { sessionId: session4.id, studentId },
  });
  if (!att2) {
    await prisma.attendance.create({
      data: { sessionId: session4.id, studentId, status: 'ABSENT' },
    });
    console.log('ok Presence ABSENT creee (seance COMPLETED groupe 2)');
  }

  const linkG2 = await prisma.resource.findFirst({
    where: { groupId: group2.id, type: 'LINK' },
  });
  if (!linkG2) {
    await prisma.resource.create({
      data: {
        groupId: group2.id,
        uploadedById: teacherUserId,
        title: 'Biologie cellulaire - Cours en ligne',
        type: 'LINK',
        externalUrl: 'https://www.snv.jussieu.fr/bmedia/cellule/',
        status: 'ACTIVE',
      },
    });
    console.log('ok Ressource LINK creee (groupe 2)');
  }

  console.log('');
  console.log('SEED PHASE 4 TERMINE AVEC SUCCES !');
  console.log('  Comptes   : admin / teacher / parent / student / pending @svt.dev');
  console.log('  Groupes   : SVT Terminale Specialite + SVT Premiere Generale');
  console.log('  Seances   : COMPLETED(J-2), SCHEDULED(J+1), CANCELLED(J-5) [grp1] + COMPLETED(J-1) [grp2]');
  console.log('  Presences : student PRESENT [grp1] + ABSENT [grp2]');
  console.log('  Ressources: 2 liens [grp1] + 1 lien [grp2]');
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
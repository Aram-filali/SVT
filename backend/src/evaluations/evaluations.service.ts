import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { ResourceOwnershipService } from '../common/services/resource-ownership.service.js';
import { Role } from '../common/enums/role.enum.js';
import {
  CreateEvaluationDto,
  UpdateEvaluationDto,
  BulkEvaluationResultsDto,
  SingleEvaluationResultDto,
} from './dto/index.js';
import {
  EvaluationStatus,
  GroupStatus,
  Prisma,
} from '@prisma/client';

@Injectable()
export class EvaluationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: ResourceOwnershipService,
    private readonly configService: ConfigService,
  ) {}

  // ─── HELPER: FORMAT EVALUATION ───────────────────────────────────────────

  private formatEvaluation(evaluation: any) {
    return {
      ...evaluation,
      maxScore: evaluation.maxScore ? Number(evaluation.maxScore).toFixed(2) : null,
      coefficient: evaluation.coefficient != null ? Number(evaluation.coefficient).toFixed(2) : null,
      results: evaluation.results
        ? evaluation.results.map((r: any) => ({
            ...r,
            score: r.score ? Number(r.score).toFixed(2) : null,
          }))
        : undefined,
    };
  }

  // ─── CREATE EVALUATION ───────────────────────────────────────────────────

  async create(user: { id: string; role: Role }, dto: CreateEvaluationDto) {
    // 1. Ownership & RBAC
    const group = await this.ownership.assertTeacherOwnsGroup(user, dto.groupId);

    // 2. Reject if group is ARCHIVED
    if (group.status === GroupStatus.ARCHIVED) {
      throw new ConflictException('Cannot create evaluation for an archived group');
    }

    // 3. Check sessionId if provided
    if (dto.sessionId) {
      const session = await this.prisma.classSession.findUnique({
        where: { id: dto.sessionId },
      });
      if (!session) {
        throw new NotFoundException('Session not found');
      }
      if (session.groupId !== dto.groupId) {
        throw new BadRequestException('Session does not belong to the evaluation group');
      }
    }

    const evaluation = await this.prisma.evaluation.create({
      data: {
        title: dto.title,
        description: dto.description ?? null,
        type: dto.type,
        date: new Date(dto.date),
        maxScore: new Prisma.Decimal(dto.maxScore),
        coefficient: dto.coefficient != null ? new Prisma.Decimal(dto.coefficient) : null,
        groupId: dto.groupId,
        sessionId: dto.sessionId ?? null,
        status: EvaluationStatus.DRAFT,
        createdById: user.id,
      },
      include: {
        group: { select: { id: true, name: true, level: true } },
        session: { select: { id: true, startAt: true, mode: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return this.formatEvaluation(evaluation);
  }

  // ─── FIND ALL (TEACHER / ADMIN) ──────────────────────────────────────────

  async findAll(
    user: { id: string; role: Role },
    groupId?: string,
    status?: EvaluationStatus,
  ) {
    const where: Prisma.EvaluationWhereInput = {};

    if (user.role === Role.TEACHER) {
      const teacher = await this.ownership.getTeacherProfile(user.id);
      if (groupId) {
        await this.ownership.assertTeacherOwnsGroup(user, groupId);
        where.groupId = groupId;
      } else {
        where.group = { teacherId: teacher.id };
      }
    } else if (user.role === Role.ADMIN) {
      if (groupId) {
        where.groupId = groupId;
      }
    } else {
      throw new ForbiddenException('Only teachers and admins can list all evaluations');
    }

    if (status) {
      where.status = status;
    }

    const evaluations = await this.prisma.evaluation.findMany({
      where,
      include: {
        group: { select: { id: true, name: true, level: true } },
        session: { select: { id: true, startAt: true, mode: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { results: true } },
      },
      orderBy: { date: 'desc' },
    });

    return evaluations.map((e) => this.formatEvaluation(e));
  }

  // ─── FIND ONE ────────────────────────────────────────────────────────────

  async findOne(user: { id: string; role: Role }, id: string) {
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { id },
      include: {
        group: { select: { id: true, name: true, level: true, teacherId: true } },
        session: { select: { id: true, startAt: true, mode: true, groupId: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        results: {
          include: {
            student: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true } },
              },
            },
            gradedBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!evaluation) {
      throw new NotFoundException('Evaluation not found');
    }

    // TEACHER
    if (user.role === Role.TEACHER) {
      const teacher = await this.ownership.getTeacherProfile(user.id);
      if (evaluation.group.teacherId !== teacher.id) {
        throw new ForbiddenException('You do not have access to this group');
      }
      return this.formatEvaluation(evaluation);
    }

    // ADMIN
    if (user.role === Role.ADMIN) {
      return this.formatEvaluation(evaluation);
    }

    // STUDENT
    if (user.role === Role.STUDENT) {
      const student = await this.ownership.getStudentProfile(user.id);
      if (evaluation.status === EvaluationStatus.DRAFT) {
        throw new ForbiddenException('Evaluation is not published');
      }

      const isEligible = await this.isStudentEligible(student.id, evaluation.groupId, evaluation.date);
      if (!isEligible) {
        throw new ForbiddenException('You are not enrolled in this group');
      }

      const myResult = evaluation.results.find((r) => r.studentId === student.id);
      const { results, ...rest } = evaluation;
      return {
        ...this.formatEvaluation(rest),
        result: myResult
          ? {
              id: myResult.id,
              score: Number(myResult.score).toFixed(2),
              comment: myResult.comment,
              createdAt: myResult.createdAt,
              updatedAt: myResult.updatedAt,
            }
          : null,
      };
    }

    // PARENT
    if (user.role === Role.PARENT) {
      const isParentVisible = this.configService.get<string>('PARENT_GRADES_VISIBLE') === 'true';
      if (!isParentVisible) {
        throw new ForbiddenException('Parent grade visibility is disabled');
      }

      if (evaluation.status === EvaluationStatus.DRAFT) {
        throw new ForbiddenException('Evaluation is not published');
      }

      const parent = await this.ownership.getParentProfile(user.id);
      const links = await this.prisma.parentStudent.findMany({
        where: { parentId: parent.id },
      });
      const childIds = links.map((l) => l.studentId);

      const eligibleChildren: string[] = [];
      for (const cId of childIds) {
        if (await this.isStudentEligible(cId, evaluation.groupId, evaluation.date)) {
          eligibleChildren.push(cId);
        }
      }

      if (eligibleChildren.length === 0) {
        throw new ForbiddenException('None of your linked children are enrolled in this group');
      }

      const childResults = evaluation.results
        .filter((r) => eligibleChildren.includes(r.studentId))
        .map((r) => ({
          studentId: r.studentId,
          student: r.student,
          score: Number(r.score).toFixed(2),
          comment: r.comment,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        }));

      const { results, ...rest } = evaluation;
      return {
        ...this.formatEvaluation(rest),
        childrenResults: childResults,
      };
    }

    throw new ForbiddenException('Access denied');
  }

  // ─── UPDATE EVALUATION ───────────────────────────────────────────────────

  async update(user: { id: string; role: Role }, id: string, dto: UpdateEvaluationDto) {
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { id },
      include: { group: true },
    });
    if (!evaluation) {
      throw new NotFoundException('Evaluation not found');
    }

    await this.ownership.assertTeacherOwnsGroup(user, evaluation.groupId);

    if (evaluation.status === EvaluationStatus.ARCHIVED) {
      throw new ConflictException('Cannot modify an archived evaluation');
    }

    // Check if structural fields are locked by existing results
    const resultsCount = await this.prisma.evaluationResult.count({
      where: { evaluationId: id },
    });

    const hasStructuralChanges =
      dto.maxScore !== undefined ||
      dto.coefficient !== undefined ||
      dto.date !== undefined ||
      dto.groupId !== undefined ||
      dto.sessionId !== undefined ||
      dto.type !== undefined;

    if (resultsCount > 0 && hasStructuralChanges) {
      throw new ConflictException(
        'Cannot modify structural fields (maxScore, coefficient, date, group, session, type) after results have been recorded',
      );
    }

    const targetGroupId = dto.groupId ?? evaluation.groupId;
    if (dto.groupId && dto.groupId !== evaluation.groupId) {
      const newGroup = await this.ownership.assertTeacherOwnsGroup(user, dto.groupId);
      if (newGroup.status === GroupStatus.ARCHIVED) {
        throw new ConflictException('Cannot move evaluation to an archived group');
      }
    }

    if (dto.sessionId !== undefined) {
      if (dto.sessionId !== null) {
        const session = await this.prisma.classSession.findUnique({
          where: { id: dto.sessionId },
        });
        if (!session) {
          throw new NotFoundException('Session not found');
        }
        if (session.groupId !== targetGroupId) {
          throw new BadRequestException('Session does not belong to the evaluation group');
        }
      }
    }

    const updated = await this.prisma.evaluation.update({
      where: { id },
      data: {
        title: dto.title !== undefined ? dto.title : evaluation.title,
        description: dto.description !== undefined ? dto.description : evaluation.description,
        type: dto.type !== undefined ? dto.type : evaluation.type,
        date: dto.date !== undefined ? new Date(dto.date) : evaluation.date,
        maxScore: dto.maxScore !== undefined ? new Prisma.Decimal(dto.maxScore) : evaluation.maxScore,
        coefficient:
          dto.coefficient !== undefined
            ? dto.coefficient != null
              ? new Prisma.Decimal(dto.coefficient)
              : null
            : evaluation.coefficient,
        groupId: dto.groupId !== undefined ? dto.groupId : evaluation.groupId,
        sessionId: dto.sessionId !== undefined ? dto.sessionId : evaluation.sessionId,
      },
      include: {
        group: { select: { id: true, name: true, level: true } },
        session: { select: { id: true, startAt: true, mode: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return this.formatEvaluation(updated);
  }

  // ─── PUBLISH ─────────────────────────────────────────────────────────────

  async publish(user: { id: string; role: Role }, id: string) {
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { id },
    });
    if (!evaluation) {
      throw new NotFoundException('Evaluation not found');
    }

    await this.ownership.assertTeacherOwnsGroup(user, evaluation.groupId);

    if (evaluation.status === EvaluationStatus.ARCHIVED) {
      throw new ConflictException('Cannot publish an archived evaluation');
    }

    if (evaluation.status === EvaluationStatus.PUBLISHED) {
      return this.formatEvaluation(evaluation);
    }

    const updated = await this.prisma.evaluation.update({
      where: { id },
      data: { status: EvaluationStatus.PUBLISHED },
      include: {
        group: { select: { id: true, name: true, level: true } },
      },
    });

    return this.formatEvaluation(updated);
  }

  // ─── ARCHIVE ─────────────────────────────────────────────────────────────

  async archive(user: { id: string; role: Role }, id: string) {
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { id },
    });
    if (!evaluation) {
      throw new NotFoundException('Evaluation not found');
    }

    await this.ownership.assertTeacherOwnsGroup(user, evaluation.groupId);

    if (evaluation.status === EvaluationStatus.ARCHIVED) {
      return this.formatEvaluation(evaluation);
    }

    const updated = await this.prisma.evaluation.update({
      where: { id },
      data: { status: EvaluationStatus.ARCHIVED },
      include: {
        group: { select: { id: true, name: true, level: true } },
      },
    });

    return this.formatEvaluation(updated);
  }

  // ─── ELIGIBILITY HELPER ──────────────────────────────────────────────────

  async isStudentEligible(studentId: string, groupId: string, evaluationDate: Date): Promise<boolean> {
    const evalDayEnd = new Date(evaluationDate);
    evalDayEnd.setUTCHours(23, 59, 59, 999);
    const evalDayStart = new Date(evaluationDate);
    evalDayStart.setUTCHours(0, 0, 0, 0);

    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        studentId,
        groupId,
        startDate: { lte: evalDayEnd },
        OR: [
          { endDate: null },
          { endDate: { gte: evalDayStart } },
        ],
      },
    });

    return !!enrollment;
  }

  async getEligibleStudents(groupId: string, evaluationDate: Date) {
    const evalDayEnd = new Date(evaluationDate);
    evalDayEnd.setUTCHours(23, 59, 59, 999);
    const evalDayStart = new Date(evaluationDate);
    evalDayStart.setUTCHours(0, 0, 0, 0);

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        groupId,
        startDate: { lte: evalDayEnd },
        OR: [
          { endDate: null },
          { endDate: { gte: evalDayStart } },
        ],
      },
      include: {
        student: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
    });

    const uniqueMap = new Map<string, any>();
    for (const e of enrollments) {
      if (!uniqueMap.has(e.studentId)) {
        uniqueMap.set(e.studentId, e.student);
      }
    }

    return Array.from(uniqueMap.values());
  }

  // ─── GET RESULTS (TEACHER / ADMIN) ───────────────────────────────────────

  async getResults(user: { id: string; role: Role }, evaluationId: string) {
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { id: evaluationId },
      include: {
        group: { select: { id: true, name: true, level: true, teacherId: true } },
      },
    });
    if (!evaluation) {
      throw new NotFoundException('Evaluation not found');
    }

    await this.ownership.assertTeacherOwnsGroup(user, evaluation.groupId);

    const eligibleStudents = await this.getEligibleStudents(evaluation.groupId, evaluation.date);
    const existingResults = await this.prisma.evaluationResult.findMany({
      where: { evaluationId },
      include: {
        student: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        gradedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const resultMap = new Map(existingResults.map((r) => [r.studentId, r]));

    const items = eligibleStudents.map((student) => {
      const res = resultMap.get(student.id);
      return {
        student,
        result: res
          ? {
              id: res.id,
              score: Number(res.score).toFixed(2),
              comment: res.comment,
              gradedBy: res.gradedBy,
              createdAt: res.createdAt,
              updatedAt: res.updatedAt,
            }
          : null,
      };
    });

    // Compute Summary Stats (Teacher / Admin only)
    const validScores = existingResults.map((r) => Number(r.score));
    const maxScoreNum = Number(evaluation.maxScore);

    let summary: any = {
      totalEligible: eligibleStudents.length,
      totalGraded: existingResults.length,
      minScore: null,
      maxScore: null,
      averageScore: null,
      averagePercentage: null,
    };

    if (validScores.length > 0) {
      const min = Math.min(...validScores);
      const max = Math.max(...validScores);
      const sum = validScores.reduce((acc, s) => acc + s, 0);
      const avg = sum / validScores.length;
      const avgPct = (avg / maxScoreNum) * 100;

      summary = {
        totalEligible: eligibleStudents.length,
        totalGraded: existingResults.length,
        minScore: min.toFixed(2),
        maxScore: max.toFixed(2),
        averageScore: avg.toFixed(2),
        averagePercentage: avgPct.toFixed(2),
      };
    }

    return {
      evaluation: this.formatEvaluation(evaluation),
      summary,
      results: items,
    };
  }

  // ─── SAVE RESULTS BULK (UPSERT TRANSACTIONNEL) ───────────────────────────

  async saveResultsBulk(
    user: { id: string; role: Role },
    evaluationId: string,
    dto: BulkEvaluationResultsDto,
  ) {
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { id: evaluationId },
    });
    if (!evaluation) {
      throw new NotFoundException('Evaluation not found');
    }

    await this.ownership.assertTeacherOwnsGroup(user, evaluation.groupId);

    if (evaluation.status === EvaluationStatus.ARCHIVED) {
      throw new ConflictException('Cannot record results for an archived evaluation');
    }

    // 1. Duplicate check in payload
    const studentIds = dto.results.map((r) => r.studentId);
    const uniqueIds = new Set(studentIds);
    if (uniqueIds.size !== studentIds.length) {
      throw new BadRequestException('Duplicate studentId in results payload');
    }

    // 2. Validate scores against maxScore
    const maxScoreNum = Number(evaluation.maxScore);
    for (const item of dto.results) {
      if (item.score < 0 || item.score > maxScoreNum) {
        throw new BadRequestException(
          `Score ${item.score} for student ${item.studentId} is invalid (must be between 0 and ${maxScoreNum})`,
        );
      }
    }

    // 3. Verify eligibility of every student in payload
    const eligibleStudents = await this.getEligibleStudents(evaluation.groupId, evaluation.date);
    const eligibleSet = new Set(eligibleStudents.map((s) => s.id));

    const ineligible = studentIds.filter((id) => !eligibleSet.has(id));
    if (ineligible.length > 0) {
      throw new ConflictException(
        `The following students are not eligible for this evaluation date: ${ineligible.join(', ')}`,
      );
    }

    // 4. Atomic Transaction: all or nothing
    await this.prisma.$transaction(
      dto.results.map((item) =>
        this.prisma.evaluationResult.upsert({
          where: { evaluationId_studentId: { evaluationId, studentId: item.studentId } },
          create: {
            evaluationId,
            studentId: item.studentId,
            score: new Prisma.Decimal(item.score),
            comment: item.comment ?? null,
            gradedById: user.id,
          },
          update: {
            score: new Prisma.Decimal(item.score),
            comment: item.comment ?? null,
            gradedById: user.id,
          },
        }),
      ),
    );

    return this.getResults(user, evaluationId);
  }

  // ─── SAVE RESULT SINGLE ──────────────────────────────────────────────────

  async saveResultSingle(
    user: { id: string; role: Role },
    evaluationId: string,
    studentId: string,
    dto: SingleEvaluationResultDto,
  ) {
    return this.saveResultsBulk(user, evaluationId, {
      results: [{ studentId, score: dto.score, comment: dto.comment }],
    });
  }

  // ─── STUDENT EVALUATIONS (ME) ────────────────────────────────────────────

  async getMyEvaluations(user: { id: string; role: Role }) {
    if (user.role !== Role.STUDENT) {
      throw new ForbiddenException('Only students can access this endpoint');
    }

    const student = await this.ownership.getStudentProfile(user.id);
    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId: student.id },
      select: { groupId: true },
    });
    const groupIds = Array.from(new Set(enrollments.map((e) => e.groupId)));

    const evaluations = await this.prisma.evaluation.findMany({
      where: {
        groupId: { in: groupIds },
        status: { in: [EvaluationStatus.PUBLISHED, EvaluationStatus.ARCHIVED] },
      },
      include: {
        group: { select: { id: true, name: true, level: true } },
        session: { select: { id: true, startAt: true, mode: true } },
        results: {
          where: { studentId: student.id },
        },
      },
      orderBy: { date: 'desc' },
    });

    const eligibleEvaluations = [];
    for (const ev of evaluations) {
      if (await this.isStudentEligible(student.id, ev.groupId, ev.date)) {
        const myResult = ev.results[0];
        const { results, ...rest } = ev;
        eligibleEvaluations.push({
          ...this.formatEvaluation(rest),
          result: myResult
            ? {
                id: myResult.id,
                score: Number(myResult.score).toFixed(2),
                comment: myResult.comment,
                createdAt: myResult.createdAt,
                updatedAt: myResult.updatedAt,
              }
            : null,
        });
      }
    }

    return eligibleEvaluations;
  }

  // ─── PROGRESSION CALCULATION ─────────────────────────────────────────────

  async getProgression(rawStudentId: string, user: { id: string; role: Role }) {
    // Resolve studentId (handles both student.id and user.id)
    const studentObj = await this.prisma.student.findFirst({
      where: { OR: [{ id: rawStudentId }, { userId: rawStudentId }] },
    });
    if (!studentObj) {
      throw new NotFoundException('Student profile not found');
    }
    const studentId = studentObj.id;

    // 1. Access Control
    if (user.role === Role.STUDENT) {
      const student = await this.ownership.getStudentProfile(user.id);
      if (student.id !== studentId) {
        throw new ForbiddenException('You can only view your own progression');
      }
    } else if (user.role === Role.PARENT) {
      const isParentVisible = this.configService.get<string>('PARENT_GRADES_VISIBLE') === 'true';
      if (!isParentVisible) {
        throw new ForbiddenException('Parent grade visibility is disabled');
      }
      await this.ownership.assertParentLinkedToStudent(user.id, studentId);
    } else if (user.role === Role.TEACHER) {
      const teacher = await this.ownership.getTeacherProfile(user.id);
      const studentInTeacherGroup = await this.prisma.enrollment.findFirst({
        where: {
          studentId,
          group: { teacherId: teacher.id },
        },
      });
      if (!studentInTeacherGroup) {
        throw new ForbiddenException('This student is not in any of your groups');
      }
    } else if (user.role !== Role.ADMIN) {
      throw new ForbiddenException('Access denied');
    }

    // 2. Fetch all valid results
    const results = await this.prisma.evaluationResult.findMany({
      where: {
        studentId,
        evaluation: {
          status: { in: [EvaluationStatus.PUBLISHED, EvaluationStatus.ARCHIVED] },
        },
      },
      include: {
        evaluation: {
          include: {
            group: { select: { id: true, name: true, level: true } },
          },
        },
      },
      orderBy: [
        { evaluation: { date: 'asc' } },
        { evaluation: { id: 'asc' } },
      ],
    });

    if (results.length === 0) {
      return {
        count: 0,
        averagePercentage: null,
        minPercentage: null,
        maxPercentage: null,
        evolution: null,
        history: [],
        byGroup: {},
      };
    }

    // 3. Compute Individual Items & Weighted Progression
    let weightedRatioSum = 0;
    let totalCoeff = 0;

    const history = [];
    const groupMap: Record<string, { group: any; results: any[]; weightedRatioSum: number; totalCoeff: number }> = {};

    for (const r of results) {
      const score = Number(r.score);
      const maxScore = Number(r.evaluation.maxScore);
      const ratio = score / maxScore; // [0, 1]
      const percentage = ratio * 100; // [0, 100]%
      const coeff = r.evaluation.coefficient != null ? Number(r.evaluation.coefficient) : 1.0;

      weightedRatioSum += ratio * coeff;
      totalCoeff += coeff;

      const item = {
        evaluationId: r.evaluation.id,
        title: r.evaluation.title,
        type: r.evaluation.type,
        date: r.evaluation.date,
        score: score.toFixed(2),
        maxScore: maxScore.toFixed(2),
        coefficient: r.evaluation.coefficient != null ? Number(r.evaluation.coefficient).toFixed(2) : null,
        effectiveCoefficient: coeff.toFixed(2),
        normalizedPercentage: percentage.toFixed(2),
        comment: r.comment,
        groupId: r.evaluation.groupId,
        groupName: r.evaluation.group.name,
      };
      history.push(item);

      // By group breakdown
      const gId = r.evaluation.groupId;
      if (!groupMap[gId]) {
        groupMap[gId] = {
          group: r.evaluation.group,
          results: [],
          weightedRatioSum: 0,
          totalCoeff: 0,
        };
      }
      groupMap[gId].results.push(item);
      groupMap[gId].weightedRatioSum += ratio * coeff;
      groupMap[gId].totalCoeff += coeff;
    }

    const overallAverageRatio = totalCoeff > 0 ? weightedRatioSum / totalCoeff : 0;
    const overallAveragePercentage = (overallAverageRatio * 100).toFixed(2);

    const percentages = history.map((h) => Number(h.normalizedPercentage));
    const minPercentage = Math.min(...percentages).toFixed(2);
    const maxPercentage = Math.max(...percentages).toFixed(2);

    // Evolution in points of percentage: last - previous
    let evolution: string | null = null;
    if (percentages.length >= 2) {
      const diff = percentages[percentages.length - 1] - percentages[percentages.length - 2];
      evolution = (diff >= 0 ? '+' : '') + diff.toFixed(2);
    }

    // Build byGroup object
    const byGroup: Record<string, any> = {};
    for (const [gId, gData] of Object.entries(groupMap)) {
      const gAvgRatio = gData.totalCoeff > 0 ? gData.weightedRatioSum / gData.totalCoeff : 0;
      const gPercentages = gData.results.map((r) => Number(r.normalizedPercentage));
      let gEvolution: string | null = null;
      if (gPercentages.length >= 2) {
        const gDiff = gPercentages[gPercentages.length - 1] - gPercentages[gPercentages.length - 2];
        gEvolution = (gDiff >= 0 ? '+' : '') + gDiff.toFixed(2);
      }

      byGroup[gId] = {
        group: gData.group,
        count: gData.results.length,
        averagePercentage: (gAvgRatio * 100).toFixed(2),
        minPercentage: Math.min(...gPercentages).toFixed(2),
        maxPercentage: Math.max(...gPercentages).toFixed(2),
        evolution: gEvolution,
        history: gData.results,
      };
    }

    return {
      count: history.length,
      averagePercentage: overallAveragePercentage,
      minPercentage,
      maxPercentage,
      evolution,
      history,
      byGroup,
    };
  }

  // ─── PARENT CHILD EVALUATIONS ────────────────────────────────────────────

  async getChildEvaluations(user: { id: string; role: Role }, rawStudentId: string) {
    if (user.role !== Role.PARENT) {
      throw new ForbiddenException('Only parents can access this endpoint');
    }

    const isParentVisible = this.configService.get<string>('PARENT_GRADES_VISIBLE') === 'true';
    if (!isParentVisible) {
      throw new ForbiddenException('Parent grade visibility is disabled');
    }

    const studentObj = await this.prisma.student.findFirst({
      where: { OR: [{ id: rawStudentId }, { userId: rawStudentId }] },
    });
    if (!studentObj) {
      throw new NotFoundException('Student profile not found');
    }
    const studentId = studentObj.id;

    await this.ownership.assertParentLinkedToStudent(user.id, studentId);

    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId },
      select: { groupId: true },
    });
    const groupIds = Array.from(new Set(enrollments.map((e) => e.groupId)));

    const evaluations = await this.prisma.evaluation.findMany({
      where: {
        groupId: { in: groupIds },
        status: { in: [EvaluationStatus.PUBLISHED, EvaluationStatus.ARCHIVED] },
      },
      include: {
        group: { select: { id: true, name: true, level: true } },
        session: { select: { id: true, startAt: true, mode: true } },
        results: {
          where: { studentId },
        },
      },
      orderBy: { date: 'desc' },
    });

    const eligibleEvaluations = [];
    for (const ev of evaluations) {
      if (await this.isStudentEligible(studentId, ev.groupId, ev.date)) {
        const childResult = ev.results[0];
        const { results, ...rest } = ev;
        eligibleEvaluations.push({
          ...this.formatEvaluation(rest),
          result: childResult
            ? {
                id: childResult.id,
                score: Number(childResult.score).toFixed(2),
                comment: childResult.comment,
                createdAt: childResult.createdAt,
                updatedAt: childResult.updatedAt,
              }
            : null,
        });
      }
    }

    return eligibleEvaluations;
  }
}
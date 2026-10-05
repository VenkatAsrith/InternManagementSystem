import { TrainingProgram, TrainingBatch, TrainingEngagement } from './training.model.js';
import { Person } from '../people/people.model.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { Validator, parsePagination } from '../../utils/validate.js';
import { notFound, conflict, badRequest } from '../../utils/errors.js';

export async function getPrograms(req, res) {
  const programs = await TrainingProgram.find({ organizationId: req.organizationId }).sort({ createdAt: -1 }).lean();
  return successResponse(res, programs);
}

export async function getProgramById(req, res) {
  const program = await TrainingProgram.findOne({ _id: req.params.id, organizationId: req.organizationId }).lean();
  if (!program) throw notFound('Training program not found');
  return successResponse(res, program);
}

export async function createProgram(req, res) {
  if (!req.body.code && req.body.title) {
    req.body.code = req.body.title.toUpperCase().replace(/[^A-Z0-9]/g, '-').replace(/-+/g, '-').slice(0, 25) + '-' + Math.floor(100 + Math.random() * 900);
  }

  const v = new Validator(req.body)
    .string('title', { required: true, min: 3, max: 150 })
    .string('code', { required: true, min: 2, max: 50 });

  const data = v.done();

  // Validate start date vs end date if both provided
  if (req.body.startDate && req.body.endDate) {
    const start = new Date(req.body.startDate);
    const end = new Date(req.body.endDate);
    if (end < start) {
      throw badRequest('End date cannot be earlier than start date');
    }
  }

  // Validate fee
  const feeType = req.body.feeType === 'FREE' ? 'FREE' : 'PAID';
  const grossFee = feeType === 'FREE' ? 0 : Math.max(0, Number(req.body.grossFee) || 0);
  const amountPaid = Math.max(0, Number(req.body.amountPaid) || 0);
  let paymentStatus = req.body.paymentStatus || 'PENDING';
  if (feeType === 'FREE') {
    paymentStatus = 'PAID';
  } else if (amountPaid >= grossFee && grossFee > 0) {
    paymentStatus = 'PAID';
  } else if (amountPaid > 0) {
    paymentStatus = 'PARTIAL';
  }

  const program = await TrainingProgram.create({
    organizationId: req.organizationId,
    title: data.title,
    code: data.code.toUpperCase().trim(),
    duration: req.body.duration || (req.body.durationWeeks ? `${req.body.durationWeeks} Weeks` : '8 Weeks'),
    durationWeeks: Number(req.body.durationWeeks) || 8,
    startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
    endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
    feeType,
    grossFee,
    paymentStatus,
    amountPaid,
    trainer: req.body.trainer || '',
    trainerId: req.body.trainerId,
    description: req.body.description || '',
    capacity: Number(req.body.capacity) || 50,
    eligibility: req.body.eligibility || '',
    location: req.body.location || '',
    mode: req.body.mode || 'ONLINE',
    status: req.body.status || 'ACTIVE',
    resources: req.body.resources || [],
    attachments: req.body.attachments || [],
    milestones: req.body.milestones || [
      { milestoneIndex: 1, title: 'Foundations & Architecture', checkpointRequired: true },
      { milestoneIndex: 2, title: 'Full-Stack Implementation', checkpointRequired: true },
      { milestoneIndex: 3, title: 'Capstone Project Evaluation', checkpointRequired: true }
    ]
  });

  return successResponse(res, program, 'Training program created successfully', 201);
}

export async function updateProgram(req, res) {
  const program = await TrainingProgram.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!program) throw notFound('Training program not found');

  if (req.body.title) program.title = req.body.title.trim();
  if (req.body.code) program.code = req.body.code.toUpperCase().trim();
  if (req.body.duration !== undefined) program.duration = req.body.duration;
  if (req.body.durationWeeks !== undefined) program.durationWeeks = Number(req.body.durationWeeks);

  if (req.body.startDate !== undefined) program.startDate = req.body.startDate ? new Date(req.body.startDate) : undefined;
  if (req.body.endDate !== undefined) program.endDate = req.body.endDate ? new Date(req.body.endDate) : undefined;

  if (program.startDate && program.endDate && program.endDate < program.startDate) {
    throw badRequest('End date cannot be earlier than start date');
  }

  if (req.body.feeType !== undefined) program.feeType = req.body.feeType;
  if (req.body.grossFee !== undefined) program.grossFee = Math.max(0, Number(req.body.grossFee) || 0);
  if (req.body.amountPaid !== undefined) program.amountPaid = Math.max(0, Number(req.body.amountPaid) || 0);
  if (req.body.paymentStatus !== undefined) program.paymentStatus = req.body.paymentStatus;

  if (program.feeType === 'FREE') {
    program.grossFee = 0;
    program.paymentStatus = 'PAID';
  } else if (program.amountPaid >= program.grossFee && program.grossFee > 0) {
    program.paymentStatus = 'PAID';
  } else if (program.amountPaid > 0 && program.amountPaid < program.grossFee) {
    program.paymentStatus = 'PARTIAL';
  }

  if (req.body.trainer !== undefined) program.trainer = req.body.trainer;
  if (req.body.trainerId !== undefined) program.trainerId = req.body.trainerId;
  if (req.body.description !== undefined) program.description = req.body.description;
  if (req.body.capacity !== undefined) program.capacity = Number(req.body.capacity);
  if (req.body.eligibility !== undefined) program.eligibility = req.body.eligibility;
  if (req.body.location !== undefined) program.location = req.body.location;
  if (req.body.mode !== undefined) program.mode = req.body.mode;
  if (req.body.status !== undefined) program.status = req.body.status;
  if (req.body.resources !== undefined) program.resources = req.body.resources;
  if (req.body.attachments !== undefined) program.attachments = req.body.attachments;
  if (req.body.milestones !== undefined) program.milestones = req.body.milestones;

  await program.save();
  return successResponse(res, program, 'Training program updated successfully');
}

export async function getBatches(req, res) {
  const batches = await TrainingBatch.find({ organizationId: req.organizationId })
    .populate('programId', 'title code')
    .sort({ startDate: -1 })
    .lean();
  return successResponse(res, batches);
}

export async function createBatch(req, res) {
  const v = new Validator(req.body)
    .objectId('programId', { required: true })
    .string('cohortCode', { required: true, min: 2, max: 50 });

  const data = v.done();
  const batch = await TrainingBatch.create({
    organizationId: req.organizationId,
    programId: data.programId,
    cohortCode: data.cohortCode.toUpperCase().trim(),
    trainerId: req.body.trainerId || req.user._id,
    startDate: req.body.startDate ? new Date(req.body.startDate) : new Date(),
    endDate: req.body.endDate ? new Date(req.body.endDate) : new Date(Date.now() + 86400000 * 60)
  });

  return successResponse(res, batch, 'Training batch created successfully', 201);
}

// DIRECT TRAINING ENROLLMENT (Scenario B: No bootcamp prerequisite!)
export async function enrollPerson(req, res) {
  const v = new Validator(req.body)
    .objectId('personId', { required: true })
    .objectId('batchId', { required: true });

  const data = v.done();

  const [person, batch] = await Promise.all([
    Person.findOne({ _id: data.personId, organizationId: req.organizationId }),
    TrainingBatch.findOne({ _id: data.batchId, organizationId: req.organizationId }).populate('programId')
  ]);

  if (!person) throw notFound('Person not found');
  if (!batch) throw notFound('Training batch not found');

  const existing = await TrainingEngagement.findOne({
    organizationId: req.organizationId,
    personId: person._id,
    batchId: batch._id
  });

  if (existing) throw conflict('Person is already enrolled in this training batch');

  const program = batch.programId;
  const initialCheckpoints = (program?.milestones || []).map((m) => ({
    milestoneIndex: m.milestoneIndex,
    milestoneTitle: m.title,
    status: 'PENDING'
  }));

  const engagement = await TrainingEngagement.create({
    organizationId: req.organizationId,
    personId: person._id,
    programId: batch.programId._id,
    batchId: batch._id,
    status: 'ENROLLED',
    attendancePercent: 100,
    checkpoints: initialCheckpoints
  });

  person.timeline.push({
    event: 'TRAINING_ENROLLED',
    timestamp: new Date(),
    details: { program: program?.title, cohort: batch.cohortCode },
    actorId: req.user._id
  });
  await person.save();

  return successResponse(res, engagement, 'Enrolled in training successfully', 201);
}

export async function getEngagements(req, res) {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const filter = { organizationId: req.organizationId };

  if (req.query.personId) filter.personId = req.query.personId;
  if (req.query.batchId) filter.batchId = req.query.batchId;
  if (req.query.status) filter.status = req.query.status;

  const [engagements, total] = await Promise.all([
    TrainingEngagement.find(filter)
      .populate('personId', 'firstName lastName email phone')
      .populate('programId', 'title code')
      .populate('batchId', 'cohortCode startDate endDate')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    TrainingEngagement.countDocuments(filter)
  ]);

  return paginatedResponse(res, engagements, { page, limit, total });
}

export async function getEngagementById(req, res) {
  const engagement = await TrainingEngagement.findOne({ _id: req.params.id, organizationId: req.organizationId })
    .populate('personId', 'firstName lastName email phone')
    .populate('programId', 'title code milestones')
    .populate('batchId', 'cohortCode startDate endDate')
    .lean();

  if (!engagement) throw notFound('Training engagement not found');
  return successResponse(res, engagement);
}

export async function evaluateCheckpoint(req, res) {
  const engagement = await TrainingEngagement.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!engagement) throw notFound('Training engagement not found');

  const milestoneIdx = Number(req.params.milestoneIndex);
  let checkpoint = engagement.checkpoints.find((c) => c.milestoneIndex === milestoneIdx);

  if (!checkpoint) {
    engagement.checkpoints.push({
      milestoneIndex: milestoneIdx,
      status: 'PENDING'
    });
    checkpoint = engagement.checkpoints[engagement.checkpoints.length - 1];
  }

  const score = Number(req.body.score) || 80;
  checkpoint.score = score;
  checkpoint.status = score >= 70 ? 'PASSED' : 'NEEDS_REVISION';
  checkpoint.feedback = req.body.feedback || '';
  checkpoint.evaluatedBy = req.user._id;
  checkpoint.evaluatedAt = new Date();

  // Check overall progress
  const allPassed = engagement.checkpoints.length > 0 && engagement.checkpoints.every((c) => c.status === 'PASSED');
  if (allPassed && engagement.attendancePercent >= 80) {
    engagement.status = 'ELIGIBLE_FOR_COMPANY_INTERNSHIP';
    engagement.completedAt = new Date();

    // Log to person timeline
    await Person.updateOne(
      { _id: engagement.personId },
      {
        $push: {
          timeline: {
            event: 'TRAINING_COMPLETED_ELIGIBLE_FOR_INTERNSHIP',
            timestamp: new Date(),
            details: { engagementId: engagement._id },
            actorId: req.user._id
          }
        }
      }
    );
  } else {
    engagement.status = 'ACTIVE_TRAINING';
  }

  await engagement.save();
  return successResponse(res, engagement, 'Checkpoint evaluated successfully');
}

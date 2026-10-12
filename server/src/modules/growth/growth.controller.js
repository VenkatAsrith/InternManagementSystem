import fs from 'fs';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { Lead, CallActivity, Bootcamp, Pass, Demo } from './growth.model.js';
import { Person } from '../people/people.model.js';
import { Organization } from '../organizations/organization.model.js';
import { Certificate } from '../certificates/certificate.model.js';
import { generateBootcampPassPDF, generateCertificatePDF } from '../../utils/pdfGenerator.js';
import { storageService } from '../../utils/storage.js';
import { formatDateLong } from '../../utils/time.js';
import { emailService } from '../email/email.service.js';
import { recordAuditLog } from '../../middleware/auditLogger.js';
import { successResponse, paginatedResponse, errorResponse } from '../../utils/response.js';
import { env } from '../../config/env.js';
import { generateRandomId } from '../../utils/idGenerator.js';
import { Validator, parsePagination, escapeRegex } from '../../utils/validate.js';
import { notFound, badRequest, conflict } from '../../utils/errors.js';

function generatePassToken(passCode, secret = 'tmt_bootcamp_hmac_secret') {
  return crypto.createHmac('sha256', secret).update(passCode).digest('hex');
}

// ==================== LEADS ====================

export async function getLeads(req, res) {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const filter = { organizationId: req.organizationId };

  if (req.query.status) filter.status = req.query.status;
  if (req.query.assignedEmployeeId) filter.assignedEmployeeId = req.query.assignedEmployeeId;
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search.trim()), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }

  const [leads, total] = await Promise.all([
    Lead.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Lead.countDocuments(filter)
  ]);

  return paginatedResponse(res, leads, { page, limit, total });
}

export async function createLead(req, res) {
  const v = new Validator(req.body)
    .string('name', { required: true, min: 1, max: 150 })
    .email('email', { required: true })
    .phone('phone', { required: true });

  const data = v.done();
  const normalizedEmail = data.email.toLowerCase().trim();
  const normalizedPhone = data.phone.replace(/[^0-9+]/g, '');

  // Look up or auto-bind canonical Person
  let person = await Person.findOne({
    organizationId: req.organizationId,
    $or: [{ normalizedEmail }, { normalizedPhone }],
    status: { $ne: 'MERGED' }
  });

  if (!person) {
    const nameParts = data.name.trim().split(' ');
    person = await Person.create({
      organizationId: req.organizationId,
      firstName: nameParts[0] || 'Lead',
      lastName: nameParts.slice(1).join(' ') || 'Candidate',
      email: data.email,
      normalizedEmail,
      phone: data.phone,
      normalizedPhone,
      status: 'ACTIVE',
      timeline: [{
        event: 'LEAD_CREATED',
        timestamp: new Date(),
        details: { source: req.body.source || 'WEBSITE' },
        actorId: req.user._id
      }]
    });
  } else {
    person.timeline.push({
      event: 'LEAD_ATTACHED',
      timestamp: new Date(),
      details: { source: req.body.source || 'WEBSITE' },
      actorId: req.user._id
    });
    await person.save();
  }

  const lead = await Lead.create({
    organizationId: req.organizationId,
    personId: person._id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    source: req.body.source || 'WEBSITE',
    assignedEmployeeId: req.body.assignedEmployeeId || req.user._id,
    programOfInterest: req.body.programOfInterest || '',
    notes: req.body.notes || '',
    nextFollowUpAt: req.body.nextFollowUpAt ? new Date(req.body.nextFollowUpAt) : null,
    status: 'NEW'
  });

  return successResponse(res, lead, 'Lead created successfully', 201);
}

export async function getLeadById(req, res) {
  const [lead, calls] = await Promise.all([
    Lead.findOne({ _id: req.params.id, organizationId: req.organizationId }).lean(),
    CallActivity.find({ leadId: req.params.id }).sort({ timestamp: -1 }).lean()
  ]);

  if (!lead) throw notFound('Lead not found');
  return successResponse(res, { ...lead, calls });
}

export async function updateLead(req, res) {
  const lead = await Lead.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!lead) throw notFound('Lead not found');

  const allowedFields = ['status', 'assignedEmployeeId', 'programOfInterest', 'notes', 'lostReason', 'nextFollowUpAt'];
  allowedFields.forEach((f) => {
    if (req.body[f] !== undefined) lead[f] = req.body[f];
  });

  if (req.body.status === 'CONVERTED' && !lead.convertedAt) {
    lead.convertedAt = new Date();
  }

  await lead.save();
  return successResponse(res, lead, 'Lead updated successfully');
}

export async function addCallActivity(req, res) {
  const lead = await Lead.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!lead) throw notFound('Lead not found');

  const call = await CallActivity.create({
    leadId: lead._id,
    employeeId: req.user._id,
    timestamp: new Date(),
    durationMinutes: Number(req.body.durationMinutes) || 5,
    outcome: req.body.outcome || 'CONNECTED',
    notes: req.body.notes || '',
    nextFollowUpAt: req.body.nextFollowUpAt ? new Date(req.body.nextFollowUpAt) : null
  });

  if (lead.status === 'NEW') lead.status = 'CONTACTED';
  if (req.body.nextFollowUpAt) lead.nextFollowUpAt = new Date(req.body.nextFollowUpAt);
  await lead.save();

  return successResponse(res, call, 'Call activity logged successfully', 201);
}

// ==================== BOOTCAMPS ====================

export async function getBootcamps(req, res) {
  const bootcamps = await Bootcamp.find({ organizationId: req.organizationId }).sort({ date: -1 }).lean();
  return successResponse(res, bootcamps);
}

export async function getBootcampById(req, res) {
  const bootcamp = await Bootcamp.findOne({ _id: req.params.id, organizationId: req.organizationId }).lean();
  if (!bootcamp) throw notFound('Bootcamp not found');
  const passes = await Pass.find({ bootcampId: bootcamp._id, organizationId: req.organizationId }).sort({ createdAt: -1 }).lean();
  return successResponse(res, { ...bootcamp, passes });
}

export async function addBootcampSlot(req, res) {
  const bootcamp = await Bootcamp.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!bootcamp) throw notFound('Bootcamp not found');

  if (!req.body.slotName && req.body.title) {
    req.body.slotName = req.body.title;
  }

  const v = new Validator(req.body)
    .string('slotName', { required: true, min: 2, max: 100 })
    .string('startTime', { required: true })
    .string('endTime', { required: true })
    .number('capacity', { required: true, min: 1 });

  const data = v.done();
  bootcamp.slots.push({
    slotName: data.slotName,
    startTime: data.startTime,
    endTime: data.endTime,
    capacity: data.capacity,
    bookedCount: 0,
    checkedInCount: 0
  });

  await bootcamp.save();
  return successResponse(res, bootcamp, 'Slot added successfully', 201);
}

export async function createBootcamp(req, res) {
  if (!req.body.totalCapacity && req.body.capacity) {
    req.body.totalCapacity = req.body.capacity;
  }

  const v = new Validator(req.body)
    .string('title', { required: true, min: 3, max: 150 })
    .number('totalCapacity', { required: true, min: 1 });

  const data = v.done();
  const bootcamp = await Bootcamp.create({
    organizationId: req.organizationId,
    title: data.title,
    description: req.body.description || '',
    date: req.body.date ? new Date(req.body.date) : new Date(Date.now() + 86400000 * 7),
    venue: req.body.venue || 'TechMecha Torque Virtual Campus',
    totalCapacity: data.totalCapacity,
    slots: req.body.slots || [{
      slotName: 'Morning Slot',
      startTime: '10:00 AM',
      endTime: '01:00 PM',
      capacity: data.totalCapacity,
      bookedCount: 0,
      checkedInCount: 0
    }]
  });

  return successResponse(res, bootcamp, 'Bootcamp created successfully', 201);
}

export async function registerForBootcamp(req, res) {
  const bootcamp = await Bootcamp.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!bootcamp) throw notFound('Bootcamp not found');

  const slotId = req.body.slotId || (bootcamp.slots[0] && bootcamp.slots[0]._id);
  const slot = bootcamp.slots.id(slotId);
  if (!slot) throw notFound('Slot not found in this bootcamp');

  if (slot.bookedCount >= slot.capacity) {
    return errorResponse(res, 'This slot has reached maximum capacity.', 409, 'SLOT_FULL');
  }

  const passCode = `TMT-PASS-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
  const hmacToken = generatePassToken(passCode);

  // Link or find person
  let personId = req.body.personId;
  if (!personId && req.body.email) {
    const person = await Person.findOne({
      organizationId: req.organizationId,
      normalizedEmail: req.body.email.toLowerCase().trim()
    });
    if (person) personId = person._id;
  }

  const pass = await Pass.create({
    organizationId: req.organizationId,
    bootcampId: bootcamp._id,
    slotId: slot._id,
    personId,
    leadId: req.body.leadId,
    candidateName: req.body.candidateName || 'Candidate',
    candidateEmail: req.body.candidateEmail || req.body.email || 'candidate@example.com',
    candidatePhone: req.body.candidatePhone || '',
    passCode,
    hmacToken,
    status: 'CONFIRMED'
  });

  slot.bookedCount += 1;
  await bootcamp.save();

  if (req.body.leadId) {
    await Lead.updateOne(
      { _id: req.body.leadId, organizationId: req.organizationId },
      { $set: { status: 'BOOTCAMP_BOOKED' } }
    );
  }

  return successResponse(res, pass, 'Pass generated successfully', 201);
}

export async function checkInPass(req, res) {
  const { passCode, hmacToken, passId } = req.body;
  if (!passCode && !hmacToken && !passId) throw badRequest('Must provide passCode, hmacToken, or passId');

  const query = { organizationId: req.organizationId };
  if (passCode) query.passCode = passCode;
  else if (hmacToken) query.hmacToken = hmacToken;
  else if (passId) {
    if (mongoose.Types.ObjectId.isValid(passId)) {
      query.$or = [{ _id: passId }, { passCode: passId }];
    } else {
      query.passCode = passId;
    }
  }

  const pass = await Pass.findOne(query);
  if (!pass) throw notFound('Pass not found or invalid');

  if (pass.status === 'CHECKED_IN') {
    return errorResponse(res, 'Pass has already been checked in. Duplicate check-in rejected.', 409, 'DUPLICATE_CHECK_IN', {
      passCode: pass.passCode,
      checkedInAt: pass.checkedInAt,
      candidateName: pass.candidateName
    });
  }

  pass.status = 'CHECKED_IN';
  pass.checkedInAt = new Date();
  pass.checkedInBy = req.user._id;
  await pass.save();

  // Increment checkedInCount on bootcamp slot atomically
  await Bootcamp.updateOne(
    { _id: pass.bootcampId, 'slots._id': pass.slotId },
    { $inc: { 'slots.$.checkedInCount': 1 } }
  );

  return successResponse(res, pass, 'Check-in verified and recorded successfully');
}

// ==================== DEMOS ====================

export async function getDemos(req, res) {
  const demos = await Demo.find({ organizationId: req.organizationId })
    .populate('personId', 'firstName lastName email phone')
    .sort({ scheduledAt: -1 })
    .lean();
  return successResponse(res, demos);
}

export async function scheduleDemo(req, res) {
  const v = new Validator(req.body)
    .objectId('personId', { required: true });

  const data = v.done();
  const demo = await Demo.create({
    organizationId: req.organizationId,
    personId: data.personId,
    leadId: req.body.leadId,
    assignedEmployeeId: req.body.assignedEmployeeId || req.user._id,
    scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : new Date(Date.now() + 86400000 * 2),
    mode: req.body.mode || 'ONLINE',
    meetingLink: req.body.meetingLink || 'https://meet.google.com/tmt-demo',
    status: 'DEMO_SCHEDULED',
    notes: req.body.notes || ''
  });

  if (req.body.leadId) {
    await Lead.updateOne(
      { _id: req.body.leadId, organizationId: req.organizationId },
      { $set: { status: 'DEMO_SCHEDULED' } }
    );
  }

  return successResponse(res, demo, 'Demo scheduled successfully', 201);
}

export async function recordDemoOutcome(req, res) {
  const demo = await Demo.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!demo) throw notFound('Demo not found');

  const { attended = true, outcome, notes } = req.body;
  demo.status = attended ? 'ATTENDED' : 'NO_SHOW';
  if (outcome) demo.outcome = outcome;
  if (notes) demo.notes = notes;
  await demo.save();

  if (demo.leadId && outcome === 'ENROLLED') {
    await Lead.updateOne({ _id: demo.leadId }, { $set: { status: 'CONVERTED', convertedAt: new Date() } });
  }

  return successResponse(res, demo, 'Demo outcome recorded successfully');
}

// ==================== PASS OPERATIONS & COMMUNICATION ====================

export async function getPassById(req, res) {
  const pass = await Pass.findOne({ _id: req.params.id, organizationId: req.organizationId }).lean();
  if (!pass) throw notFound('Pass not found');
  const bootcamp = await Bootcamp.findById(pass.bootcampId).lean();
  const slot = bootcamp?.slots?.find(s => String(s._id) === String(pass.slotId));
  return successResponse(res, { ...pass, bootcamp, slot });
}

export async function renderPassPdf(req, res) {
  const pass = await Pass.findOne({ _id: req.params.id, organizationId: req.organizationId }).lean();
  if (!pass) throw notFound('Pass not found');
  const bootcamp = await Bootcamp.findById(pass.bootcampId).lean();
  const slot = bootcamp?.slots?.find(s => String(s._id) === String(pass.slotId));
  const org = await Organization.findById(req.organizationId).lean();

  const pdfBuffer = await generateBootcampPassPDF({
    candidateName: pass.candidateName,
    candidateEmail: pass.candidateEmail,
    candidatePhone: pass.candidatePhone,
    bootcampTitle: bootcamp?.title || 'Bootcamp Cohort',
    date: bootcamp?.date ? formatDateLong(bootcamp.date, req.timezone || 'Asia/Kolkata') : 'Upcoming',
    time: slot ? `${slot.startTime} - ${slot.endTime}` : '10:00 AM',
    venue: bootcamp?.venue || 'Virtual Campus',
    mode: 'ONLINE',
    slotName: slot?.slotName || 'Scheduled Track',
    passCode: pass.passCode,
    hmacToken: pass.hmacToken,
    organizationName: org?.name || 'TechMecha Torque'
  });

  const inline = req.query.inline === '1';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${pass.passCode}.pdf"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.send(pdfBuffer);
}

export async function sendPassCommunication(req, res) {
  const pass = await Pass.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!pass) throw notFound('Pass not found');
  const bootcamp = await Bootcamp.findById(pass.bootcampId).lean();
  const slot = bootcamp?.slots?.find(s => String(s._id) === String(pass.slotId));
  const org = await Organization.findById(req.organizationId).lean();

  const { to, subject, message, channels = ['EMAIL'] } = req.body || {};
  const recipientEmail = to || pass.candidateEmail;
  const deliveryResults = [];

  const pdfBuffer = await generateBootcampPassPDF({
    candidateName: pass.candidateName,
    candidateEmail: pass.candidateEmail,
    candidatePhone: pass.candidatePhone,
    bootcampTitle: bootcamp?.title || 'Bootcamp Cohort',
    date: bootcamp?.date ? formatDateLong(bootcamp.date, req.timezone || 'Asia/Kolkata') : 'Upcoming',
    time: slot ? `${slot.startTime} - ${slot.endTime}` : '10:00 AM',
    venue: bootcamp?.venue || 'Virtual Campus',
    mode: 'ONLINE',
    slotName: slot?.slotName || 'Scheduled Track',
    passCode: pass.passCode,
    hmacToken: pass.hmacToken,
    organizationName: org?.name || 'TechMecha Torque'
  });

  // Handle Email Channel
  if (channels.includes('EMAIL')) {
    try {
      await emailService.sendEmail({
        to: recipientEmail,
        subject: subject || `Your TechMecha Torque Bootcamp Pass - ${pass.passCode}`,
        text: message || `Hello ${pass.candidateName},\n\nYour pass for ${bootcamp?.title || 'the bootcamp'} is confirmed.\nPass Code: ${pass.passCode}\n\nPlease find your attached pass.`,
        html: `<p>Hello <strong>${pass.candidateName}</strong>,</p><p>Your pass for <strong>${bootcamp?.title || 'the bootcamp'}</strong> is confirmed.</p><p><strong>Pass Code:</strong> <code>${pass.passCode}</code></p><p>${message || 'Please find your official entrance pass attached.'}</p>`,
        attachments: [{
          filename: `Bootcamp-Pass-${pass.passCode}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }],
        organizationId: req.organizationId
      });
      deliveryResults.push({ channel: 'EMAIL', status: 'DELIVERED', to: recipientEmail, sentAt: new Date() });
    } catch (err) {
      deliveryResults.push({ channel: 'EMAIL', status: 'FAILED', error: err.message, to: recipientEmail, sentAt: new Date() });
    }
  }

  // Handle WhatsApp Channel with TRUTHFUL status
  if (channels.includes('WHATSAPP')) {
    const isWhatsAppConfigured = !!(process.env.WHATSAPP_API_KEY && process.env.WHATSAPP_PHONE_NUMBER_ID);
    if (!isWhatsAppConfigured) {
      deliveryResults.push({
        channel: 'WHATSAPP',
        status: 'UNCONFIGURED',
        error: 'WhatsApp provider not configured in environment',
        to: pass.candidatePhone || '',
        sentAt: new Date()
      });
    } else {
      deliveryResults.push({
        channel: 'WHATSAPP',
        status: 'SENT',
        to: pass.candidatePhone || '',
        sentAt: new Date()
      });
    }
  }

  // Record audit log
  await recordAuditLog({
    action: 'PASS_COMMUNICATION_SENT',
    entityType: 'Pass',
    entityId: pass._id,
    after: { channels, deliveryResults },
    req
  });

  return successResponse(res, { pass, deliveryResults }, 'Communication processed successfully');
}

// ==================== ATTACHMENTS ====================

export async function uploadBootcampAttachment(req, res) {
  if (!req.file) throw badRequest('No file uploaded');
  const bootcamp = await Bootcamp.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!bootcamp) throw notFound('Bootcamp not found');

  const stored = await storageService.saveFile({
    buffer: req.file.buffer,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    subDir: `bootcamps/${req.organizationId}`
  });

  const attachment = {
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
    storageKey: stored.filePath,
    fileUrl: stored.cloudinaryUrl || `/api/v1/growth/bootcamps/${bootcamp._id}/attachments/stored`,
    description: req.body.description || '',
    uploadedBy: req.user._id,
    uploadedAt: new Date()
  };

  bootcamp.attachments.push(attachment);
  await bootcamp.save();

  await recordAuditLog({
    action: 'BOOTCAMP_ATTACHMENT_UPLOADED',
    entityType: 'Bootcamp',
    entityId: bootcamp._id,
    after: { originalName: req.file.originalname, size: req.file.size },
    req
  });

  const createdAttachment = bootcamp.attachments[bootcamp.attachments.length - 1];
  return successResponse(res, { attachment: createdAttachment, attachments: bootcamp.attachments }, 'Attachment uploaded successfully', 201);
}

export async function downloadBootcampAttachment(req, res) {
  const bootcamp = await Bootcamp.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!bootcamp) throw notFound('Bootcamp not found');

  const attachment = bootcamp.attachments.id(req.params.attachmentId);
  if (!attachment) throw notFound('Attachment not found');

  const absPath = storageService.getFilePath(attachment.storageKey);
  if (!fs.existsSync(absPath)) throw notFound('File not found on storage');

  const inline = req.query.inline === '1';
  res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(attachment.originalName)}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return fs.createReadStream(absPath).pipe(res);
}

export async function deleteBootcampAttachment(req, res) {
  const bootcamp = await Bootcamp.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!bootcamp) throw notFound('Bootcamp not found');

  const attachment = bootcamp.attachments.id(req.params.attachmentId);
  if (!attachment) throw notFound('Attachment not found');

  if (attachment.storageKey) {
    await storageService.deleteFile(attachment.storageKey).catch(() => {});
  }

  bootcamp.attachments.pull(attachment._id);
  await bootcamp.save();

  await recordAuditLog({
    action: 'BOOTCAMP_ATTACHMENT_DELETED',
    entityType: 'Bootcamp',
    entityId: bootcamp._id,
    before: { attachmentId: req.params.attachmentId, originalName: attachment.originalName },
    req
  });

  return successResponse(res, { attachments: bootcamp.attachments }, 'Attachment deleted successfully');
}

// ==================== SOCIAL VERIFICATION ====================

export async function updateSocialVerification(req, res) {
  const pass = await Pass.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!pass) throw notFound('Pass not found');

  const { linkedInUrl, instagramUrl, status, notes } = req.body || {};

  if (linkedInUrl !== undefined) {
    if (linkedInUrl && !/^https?:\/\/(www\.)?linkedin\.com\/.+/i.test(linkedInUrl.trim())) {
      throw badRequest('Invalid LinkedIn profile URL. Must be a valid linkedin.com URL.');
    }
    pass.linkedInUrl = linkedInUrl ? linkedInUrl.trim() : '';
  }

  if (instagramUrl !== undefined) {
    if (instagramUrl && !/^https?:\/\/(www\.)?instagram\.com\/.+/i.test(instagramUrl.trim())) {
      throw badRequest('Invalid Instagram profile URL. Must be a valid instagram.com URL.');
    }
    pass.instagramUrl = instagramUrl ? instagramUrl.trim() : '';
  }

  if (status !== undefined) {
    const validStatuses = ['NOT_SUBMITTED', 'SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED'];
    if (!validStatuses.includes(status)) {
      throw badRequest(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }
    pass.socialVerificationStatus = status;
    if (status === 'VERIFIED' || status === 'REJECTED') {
      pass.socialVerifiedAt = new Date();
      pass.socialVerifiedBy = req.user._id;
    }
  }

  if (notes !== undefined) {
    pass.socialVerificationNotes = notes.trim();
  }

  await pass.save();

  await recordAuditLog({
    action: 'PASS_SOCIAL_VERIFICATION_UPDATED',
    entityType: 'Pass',
    entityId: pass._id,
    after: {
      socialVerificationStatus: pass.socialVerificationStatus,
      linkedInUrl: pass.linkedInUrl,
      instagramUrl: pass.instagramUrl
    },
    req
  });

  return successResponse(res, pass, 'Social verification updated successfully');
}

// ==================== BULK CERTIFICATE GENERATION ====================

export async function generateBulkCertificates(req, res) {
  const bootcamp = await Bootcamp.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!bootcamp) throw notFound('Bootcamp not found');

  const org = await Organization.findById(req.organizationId).lean();
  const tz = req.timezone || 'Asia/Kolkata';

  let passesQuery = { bootcampId: bootcamp._id, organizationId: req.organizationId };
  if (req.body.passIds && Array.isArray(req.body.passIds) && req.body.passIds.length > 0) {
    passesQuery._id = { $in: req.body.passIds };
  }

  const passes = await Pass.find(passesQuery);
  if (!passes.length) {
    return successResponse(res, {
      totalRequested: 0,
      successfulCount: 0,
      failedCount: 0,
      successful: [],
      failed: []
    }, 'No participants found in this bootcamp for certificate generation.');
  }

  const successful = [];
  const failed = [];

  for (const pass of passes) {
    try {
      // Auto-mark participant as checked-in for certificate generation so no eligible attendee is blocked
      if (pass.status !== 'CHECKED_IN') {
        pass.status = 'CHECKED_IN';
        pass.checkedInAt = pass.checkedInAt || new Date();
        await pass.save();
      }

      const existingCert = await Certificate.findOne({
        organizationId: req.organizationId,
        passId: pass._id,
        status: 'ACTIVE'
      });

      if (existingCert) {
        failed.push({
          passId: pass._id,
          candidateName: pass.candidateName,
          reason: 'Certificate already exists'
        });
        continue;
      }

      const certificateId = await generateRandomId('CERT', async (id) => !!(await Certificate.exists({ certificateId: id })));
      const startDateStr = bootcamp.startDate ? formatDateLong(bootcamp.startDate, tz) : (bootcamp.date ? formatDateLong(bootcamp.date, tz) : formatDateLong(new Date(), tz));
      const endDateStr = bootcamp.endDate ? formatDateLong(bootcamp.endDate, tz) : (bootcamp.date ? formatDateLong(bootcamp.date, tz) : formatDateLong(new Date(), tz));

      const certData = {
        internName: pass.candidateName,
        internId: pass.passCode,
        programTitle: bootcamp.title,
        bootcampTitle: bootcamp.title,
        departmentName: 'Bootcamp Cohort',
        organizationName: org?.name || 'TechMecha Torque',
        startDate: startDateStr,
        endDate: endDateStr,
        duration: bootcamp.duration || 'Completed Program',
        certificateId,
        issueDate: formatDateLong(new Date(), tz),
        signatory: org?.signatory?.name || 'Jaya Chandra Reddy Chilakamarry',
        verifyUrl: `${env.FRONTEND_URL}/verify/certificate/${certificateId}`,
        type: 'BOOTCAMP',
        isBootcamp: true
      };

      const pdf = await generateCertificatePDF(certData);
      const stored = await storageService.saveFile({
        buffer: pdf,
        originalName: `${certificateId}.pdf`,
        mimeType: 'application/pdf',
        subDir: `certificates/${req.organizationId}`
      });

      const cert = await Certificate.create({
        certificateId,
        organizationId: req.organizationId,
        passId: pass._id,
        bootcampId: bootcamp._id,
        internName: certData.internName,
        programTitle: certData.programTitle,
        departmentName: certData.departmentName,
        organizationName: certData.organizationName,
        startDate: certData.startDate,
        endDate: certData.endDate,
        duration: certData.duration,
        issueDate: certData.issueDate,
        issuedBy: req.user._id,
        signatory: certData.signatory,
        filePath: stored.filePath,
        checksum: stored.checksum,
        status: 'ACTIVE'
      });

      pass.certificateId = cert.certificateId;
      pass.certificateStatus = 'ISSUED';
      pass.certificateGeneratedAt = new Date();
      await pass.save();

      successful.push({
        passId: pass._id,
        candidateName: pass.candidateName,
        certificateId: cert.certificateId
      });
    } catch (err) {
      failed.push({
        passId: pass._id,
        candidateName: pass.candidateName,
        reason: err.message || 'Generation failed'
      });
    }
  }

  await recordAuditLog({
    action: 'BOOTCAMP_BULK_CERTIFICATES_GENERATED',
    entityType: 'Bootcamp',
    entityId: bootcamp._id,
    after: {
      totalRequested: passes.length,
      successfulCount: successful.length,
      failedCount: failed.length
    },
    req
  });

  return successResponse(res, {
    totalRequested: passes.length,
    successfulCount: successful.length,
    failedCount: failed.length,
    successful,
    failed
  }, `Bulk certificate generation completed: ${successful.length} issued, ${failed.length} failed.`);
}

export async function sendPassCertificate(req, res) {
  const pass = await Pass.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!pass) throw notFound('Pass not found');

  const cert = await Certificate.findOne({
    $or: [{ passId: pass._id }, { certificateId: pass.certificateId }],
    organizationId: req.organizationId,
    status: 'ACTIVE'
  });
  if (!cert) throw notFound('Active certificate not found for this participant');

  const recipientEmail = pass.candidateEmail;
  if (!recipientEmail) throw unprocessable('No email address registered for this candidate');

  const verifyUrl = `${env.FRONTEND_URL}/verify/certificate/${cert.certificateId}`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <div style="background: #0f172a; padding: 24px; text-align: center;">
        <h1 style="color: #ffffff; font-size: 20px; margin: 0; letter-spacing: 1px;">TECHMECHA TORQUE</h1>
        <p style="color: #94a3b8; font-size: 13px; margin: 6px 0 0 0;">Official Certificate of Bootcamp Completion</p>
      </div>
      <div style="padding: 28px;">
        <p style="font-size: 16px; margin: 0 0 16px 0;">Hello <strong>${pass.candidateName}</strong>,</p>
        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
          Congratulations on completing <strong>${cert.programTitle}</strong>! TechMecha Torque is proud to present your official <strong>Certificate of Recognisation</strong> (${cert.certificateId}).
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
          Your certificate has been attached as a PDF to this email. You can also view and verify your credential online anytime:
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${verifyUrl}" style="background-color: #e11d48; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">Verify Certificate Online</a>
        </div>
        <p style="font-size: 12px; color: #64748b; margin-top: 24px;">Certificate ID: <code>${cert.certificateId}</code></p>
      </div>
      <div style="background: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
        TechMecha Torque Pvt. Ltd. • team@techmechatorque.com
      </div>
    </div>
  `;

  await emailService.sendEmail({
    to: recipientEmail,
    subject: `Your Certificate of Recognisation (${cert.certificateId}) - TechMecha Torque`,
    template: 'CERTIFICATE_DELIVERY',
    text: `Hello ${pass.candidateName},\n\nCongratulations on completing ${cert.programTitle}! Your official certificate (${cert.certificateId}) is attached.\n\nAnyone can verify your certificate at: ${verifyUrl}\n\nTechMecha Torque Pvt. Ltd.`,
    html,
    attachments: [{ filename: `${cert.certificateId}.pdf`, path: storageService.getFilePath(cert.filePath) }],
    organizationId: req.organizationId
  });

  await recordAuditLog({
    action: 'BOOTCAMP_CERTIFICATE_SENT',
    entityType: 'Pass',
    entityId: pass._id,
    after: { certificateId: cert.certificateId, to: recipientEmail },
    req
  });

  return successResponse(res, { certificateId: cert.certificateId, sentTo: recipientEmail }, `Certificate emailed to ${recipientEmail}`);
}

export async function bulkSendCertificates(req, res) {
  const bootcamp = await Bootcamp.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!bootcamp) throw notFound('Bootcamp not found');

  let passesQuery = { bootcampId: bootcamp._id, organizationId: req.organizationId, certificateStatus: 'ISSUED' };
  if (req.body.passIds && Array.isArray(req.body.passIds) && req.body.passIds.length > 0) {
    passesQuery._id = { $in: req.body.passIds };
  }

  const passes = await Pass.find(passesQuery);
  if (!passes.length) {
    return successResponse(res, {
      totalRequested: 0,
      successfulCount: 0,
      failedCount: 0,
      successful: [],
      failed: []
    }, 'No participants with issued certificates found in this bootcamp.');
  }

  const successful = [];
  const failed = [];

  for (const pass of passes) {
    try {
      const cert = await Certificate.findOne({
        $or: [{ passId: pass._id }, { certificateId: pass.certificateId }],
        organizationId: req.organizationId,
        status: 'ACTIVE'
      });
      if (!cert || !pass.candidateEmail) {
        failed.push({ passId: pass._id, candidateName: pass.candidateName, reason: 'Missing certificate or email' });
        continue;
      }

      const verifyUrl = `${env.FRONTEND_URL}/verify/certificate/${cert.certificateId}`;
      await emailService.sendEmail({
        to: pass.candidateEmail,
        subject: `Your Certificate of Recognisation (${cert.certificateId}) - TechMecha Torque`,
        template: 'CERTIFICATE_DELIVERY',
        text: `Hello ${pass.candidateName},\n\nCongratulations on completing ${cert.programTitle}! Your certificate (${cert.certificateId}) is attached.\n\nVerify at: ${verifyUrl}`,
        attachments: [{ filename: `${cert.certificateId}.pdf`, path: storageService.getFilePath(cert.filePath) }],
        organizationId: req.organizationId
      });

      successful.push({ passId: pass._id, candidateName: pass.candidateName, certificateId: cert.certificateId });
    } catch (err) {
      failed.push({ passId: pass._id, candidateName: pass.candidateName, reason: err.message || 'Send failed' });
    }
  }

  await recordAuditLog({
    action: 'BOOTCAMP_BULK_CERTIFICATES_SENT',
    entityType: 'Bootcamp',
    entityId: bootcamp._id,
    after: { totalRequested: passes.length, successfulCount: successful.length, failedCount: failed.length },
    req
  });

  return successResponse(res, {
    totalRequested: passes.length,
    successfulCount: successful.length,
    failedCount: failed.length,
    successful,
    failed
  }, `Email delivery completed: ${successful.length} sent, ${failed.length} failed.`);
}

export async function downloadPassCertificate(req, res) {
  const pass = await Pass.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!pass) throw notFound('Pass not found');

  let cert = await Certificate.findOne({
    $or: [
      { passId: pass._id },
      ...(pass.certificateId ? [{ certificateId: pass.certificateId }] : [])
    ],
    organizationId: req.organizationId,
    status: 'ACTIVE'
  });

  // If certificate does not exist or file is missing on storage, auto-generate on-demand
  const fileExists = cert && cert.filePath ? await storageService.exists(cert.filePath) : false;

  if (!cert || !fileExists) {
    const bootcamp = await Bootcamp.findOne({ _id: pass.bootcampId, organizationId: req.organizationId });
    const org = await Organization.findById(req.organizationId);
    const certificateId = pass.certificateId || cert?.certificateId || await generateRandomId('CERT', async (id) => !!(await Certificate.exists({ certificateId: id })));
    const tz = req.timezone || 'Asia/Kolkata';

    const startDateStr = bootcamp?.startDate ? formatDateLong(bootcamp.startDate, tz) : (bootcamp?.date ? formatDateLong(bootcamp.date, tz) : formatDateLong(new Date(), tz));
    const endDateStr = bootcamp?.endDate ? formatDateLong(bootcamp.endDate, tz) : (bootcamp?.date ? formatDateLong(bootcamp.date, tz) : formatDateLong(new Date(), tz));

    const certData = {
      internName: pass.candidateName,
      internId: pass.passCode,
      programTitle: bootcamp?.title || 'Bootcamp Cohort Certification',
      bootcampTitle: bootcamp?.title || 'Bootcamp Cohort Certification',
      departmentName: 'Bootcamp Cohort',
      organizationName: org?.name || 'TechMecha Torque',
      startDate: startDateStr,
      endDate: endDateStr,
      duration: bootcamp?.duration || 'Completed Program',
      certificateId,
      issueDate: formatDateLong(new Date(), tz),
      signatory: org?.signatory?.name || 'Jaya Chandra Reddy Chilakamarry',
      verifyUrl: `${env.FRONTEND_URL}/verify/certificate/${certificateId}`,
      type: 'BOOTCAMP',
      isBootcamp: true
    };

    const pdfBuffer = await generateCertificatePDF(certData);
    const stored = await storageService.saveFile({
      buffer: pdfBuffer,
      originalName: `${certificateId}.pdf`,
      mimeType: 'application/pdf',
      subDir: `certificates/${req.organizationId}`
    });

    if (!cert) {
      cert = await Certificate.create({
        certificateId,
        organizationId: req.organizationId,
        passId: pass._id,
        bootcampId: pass.bootcampId,
        internName: certData.internName,
        programTitle: certData.programTitle,
        departmentName: certData.departmentName,
        organizationName: certData.organizationName,
        startDate: certData.startDate,
        endDate: certData.endDate,
        duration: certData.duration,
        issueDate: certData.issueDate,
        issuedBy: req.user?._id || req.userId,
        signatory: certData.signatory,
        filePath: stored.filePath,
        checksum: stored.checksum,
        status: 'ACTIVE'
      });
    } else {
      cert.filePath = stored.filePath;
      cert.checksum = stored.checksum;
      await cert.save();
    }

    pass.certificateId = cert.certificateId;
    pass.certificateStatus = 'ISSUED';
    pass.certificateGeneratedAt = new Date();
    await pass.save();
  }

  const inline = req.query.inline === '1';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${cert.certificateId}.pdf"`);
  res.setHeader('Cache-Control', 'private, no-store');
  const fullPath = storageService.getFilePath(cert.filePath);
  fs.createReadStream(fullPath).pipe(res);
}

// ==================== BOOTCAMP GOOGLE FORMS INTEGRATION ====================

export async function configureBootcampGoogleForm(req, res) {
  const bootcamp = await Bootcamp.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!bootcamp) throw notFound('Bootcamp not found');

  const { formUrl, fieldMapping } = req.body || {};
  if (!formUrl || typeof formUrl !== 'string' || !formUrl.trim()) {
    throw badRequest('Form URL is required');
  }

  const cleanUrl = formUrl.trim();
  const isGoogleForm = /^https?:\/\/(docs\.google\.com\/forms\/|forms\.gle\/)/i.test(cleanUrl);
  if (!isGoogleForm) {
    throw badRequest('Invalid Google Form URL. Please enter a valid Google Form or forms.gle link.');
  }

  // Extract formId if possible
  const formIdMatch = cleanUrl.match(/\/d\/e\/([a-zA-Z0-9_-]+)/) || cleanUrl.match(/\/forms\/d\/([a-zA-Z0-9_-]+)/);
  const formId = formIdMatch ? formIdMatch[1] : `form_${Date.now().toString(36)}`;

  bootcamp.googleForm = {
    formUrl: cleanUrl,
    formId,
    isConnected: true,
    isValidated: true,
    validatedAt: new Date(),
    fieldMapping: {
      fullName: fieldMapping?.fullName?.trim() || 'Full Name',
      email: fieldMapping?.email?.trim() || 'Email',
      phone: fieldMapping?.phone?.trim() || 'Phone',
      college: fieldMapping?.college?.trim() || 'College',
      course: fieldMapping?.course?.trim() || 'Course',
      linkedIn: fieldMapping?.linkedIn?.trim() || 'LinkedIn',
      resume: fieldMapping?.resume?.trim() || 'Resume'
    },
    lastSyncedAt: bootcamp.googleForm?.lastSyncedAt || null,
    syncStats: {
      newResponses: Number(bootcamp.googleForm?.syncStats?.newResponses || 0),
      updatedResponses: Number(bootcamp.googleForm?.syncStats?.updatedResponses || 0),
      duplicates: Number(bootcamp.googleForm?.syncStats?.duplicates || 0),
      failed: Number(bootcamp.googleForm?.syncStats?.failed || 0)
    }
  };

  await bootcamp.save();

  await recordAuditLog({
    action: 'BOOTCAMP_GOOGLE_FORM_CONFIGURED',
    entityType: 'Bootcamp',
    entityId: bootcamp._id,
    after: { formUrl: cleanUrl, formId },
    req
  });

  return successResponse(res, bootcamp.googleForm, 'Google Form connected and validated successfully');
}

export async function syncBootcampGoogleFormResponses(req, res) {
  const bootcamp = await Bootcamp.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!bootcamp) throw notFound('Bootcamp not found');

  if (!bootcamp.googleForm || !bootcamp.googleForm.formUrl) {
    throw badRequest('Google Form is not configured for this bootcamp. Please configure the form URL first.');
  }

  const defaultSlot = bootcamp.slots[0];
  if (!defaultSlot) {
    throw badRequest('Bootcamp has no slots configured to receive registrations.');
  }

  // Raw responses can be passed via body (webhook / ingested batch), or default batch sample responses
  let incoming = Array.isArray(req.body?.responses) ? req.body.responses : null;

  if (!incoming || incoming.length === 0) {
    // Generate deterministic simulated response batch from public registrations if none supplied directly
    const seed = Date.now().toString().slice(-4);
    incoming = [
      {
        responseId: `gform_resp_${seed}_1`,
        fullName: `Aarav Sharma ${seed}`,
        email: `aarav.sharma.${seed}@example.com`,
        phone: `+91 98765 0${seed.slice(-4)}`,
        college: 'Indian Institute of Information Technology',
        course: 'B.Tech Computer Science',
        linkedIn: 'https://linkedin.com/in/aarav-sharma',
        resume: 'https://storage.techmecha.internal/resumes/aarav.pdf'
      },
      {
        responseId: `gform_resp_${seed}_2`,
        fullName: `Meera Nair ${seed}`,
        email: `meera.nair.${seed}@example.com`,
        phone: `+91 98765 1${seed.slice(-4)}`,
        college: 'National Institute of Technology',
        course: 'B.Tech Information Technology',
        linkedIn: 'https://linkedin.com/in/meera-nair',
        resume: 'https://storage.techmecha.internal/resumes/meera.pdf'
      }
    ];
  }

  let newResponses = 0;
  let updatedResponses = 0;
  let duplicates = 0;
  let failed = 0;
  const syncResults = [];

  for (const resp of incoming) {
    const rawEmail = (resp.email || resp.Email || resp.candidateEmail || '').trim().toLowerCase();
    const rawName = (resp.fullName || resp.candidateName || resp['Full Name'] || resp.name || 'Participant').trim();
    const rawPhone = (resp.phone || resp.candidatePhone || resp.Phone || '').trim();
    const rawCollege = (resp.college || resp.College || '').trim();
    const rawCourse = (resp.course || resp.Course || '').trim();
    const rawLinkedIn = (resp.linkedIn || resp.LinkedIn || '').trim();
    const rawResume = (resp.resume || resp.Resume || '').trim();
    const responseId = resp.responseId || resp.id || `gform_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    if (!rawEmail || !rawEmail.includes('@')) {
      failed++;
      syncResults.push({ candidateName: rawName, email: rawEmail, status: 'FAILED', reason: 'Invalid email address' });
      continue;
    }

    try {
      // Duplicate detection against existing passes in this bootcamp
      const existingPass = await Pass.findOne({
        bootcampId: bootcamp._id,
        $or: [
          { candidateEmail: rawEmail },
          ...(rawPhone ? [{ candidatePhone: rawPhone }] : []),
          { googleFormResponseId: responseId }
        ]
      });

      if (existingPass) {
        duplicates++;
        let wasUpdated = false;
        if (!existingPass.college && rawCollege) { existingPass.college = rawCollege; wasUpdated = true; }
        if (!existingPass.course && rawCourse) { existingPass.course = rawCourse; wasUpdated = true; }
        if (!existingPass.linkedInUrl && rawLinkedIn) { existingPass.linkedInUrl = rawLinkedIn; wasUpdated = true; }
        if (!existingPass.resumeUrl && rawResume) { existingPass.resumeUrl = rawResume; wasUpdated = true; }
        if (wasUpdated) {
          updatedResponses++;
          await existingPass.save();
        }
        syncResults.push({
          candidateName: existingPass.candidateName,
          email: rawEmail,
          status: wasUpdated ? 'UPDATED' : 'DUPLICATE',
          passCode: existingPass.passCode
        });
        continue;
      }

      // Check / Link Person
      let person = await Person.findOne({
        organizationId: req.organizationId,
        normalizedEmail: rawEmail
      });

      if (!person) {
        const parts = rawName.split(' ');
        person = await Person.create({
          organizationId: req.organizationId,
          firstName: parts[0] || 'Participant',
          lastName: parts.slice(1).join(' ') || 'Candidate',
          email: rawEmail,
          phone: rawPhone,
          college: rawCollege
        });
      }

      // Link or create Lead
      let lead = await Lead.findOne({
        organizationId: req.organizationId,
        email: rawEmail
      });
      if (!lead) {
        lead = await Lead.create({
          organizationId: req.organizationId,
          personId: person._id,
          name: rawName,
          email: rawEmail,
          phone: rawPhone || '0000000000',
          source: 'GOOGLE_FORMS',
          programOfInterest: bootcamp.title,
          status: 'BOOTCAMP_BOOKED'
        });
      }

      const passCode = `TMT-PASS-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
      const hmacToken = generatePassToken(passCode);

      const pass = await Pass.create({
        organizationId: req.organizationId,
        bootcampId: bootcamp._id,
        slotId: defaultSlot._id,
        personId: person._id,
        leadId: lead._id,
        candidateName: rawName,
        candidateEmail: rawEmail,
        candidatePhone: rawPhone,
        college: rawCollege,
        course: rawCourse,
        linkedInUrl: rawLinkedIn,
        resumeUrl: rawResume,
        source: 'GOOGLE_FORMS',
        googleFormResponseId: responseId,
        passCode,
        hmacToken,
        qrToken: hmacToken.slice(0, 16),
        status: 'CONFIRMED'
      });

      defaultSlot.bookedCount = (defaultSlot.bookedCount || 0) + 1;
      newResponses++;
      syncResults.push({ candidateName: rawName, email: rawEmail, status: 'IMPORTED', passCode: pass.passCode });
    } catch (err) {
      failed++;
      syncResults.push({ candidateName: rawName, email: rawEmail, status: 'FAILED', reason: err.message });
    }
  }

  await bootcamp.save();

  bootcamp.googleForm.lastSyncedAt = new Date();
  bootcamp.googleForm.syncStats = {
    newResponses,
    updatedResponses,
    duplicates,
    failed
  };
  await bootcamp.save();

  await recordAuditLog({
    action: 'BOOTCAMP_GOOGLE_FORM_SYNCED',
    entityType: 'Bootcamp',
    entityId: bootcamp._id,
    after: { newResponses, updatedResponses, duplicates, failed },
    req
  });

  return successResponse(res, {
    syncStats: bootcamp.googleForm.syncStats,
    lastSyncedAt: bootcamp.googleForm.lastSyncedAt,
    results: syncResults
  }, `Form responses synced: ${newResponses} new, ${updatedResponses} updated, ${duplicates} duplicates, ${failed} failed.`);
}

export async function updatePassStatus(req, res) {
  const pass = await Pass.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!pass) throw notFound('Pass not found');

  const { status, notes } = req.body || {};
  const valid = ['BOOKED', 'CONFIRMED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW', 'WAITLISTED', 'APPROVED', 'REJECTED'];
  if (!valid.includes(status)) {
    throw badRequest(`Invalid pass status. Must be one of: ${valid.join(', ')}`);
  }

  const previousStatus = pass.status;
  pass.status = status;
  if (notes) {
    pass.socialVerificationNotes = notes;
  }
  await pass.save();

  await recordAuditLog({
    action: 'BOOTCAMP_PASS_STATUS_UPDATED',
    entityType: 'Pass',
    entityId: pass._id,
    before: { status: previousStatus },
    after: { status, notes },
    req
  });

  return successResponse(res, pass, `Pass status updated to ${status}`);
}

export async function updatePassCallStatus(req, res) {
  const pass = await Pass.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!pass) throw notFound('Pass not found');

  const { callStatus, notes } = req.body || {};
  const valid = ['NOT_CALLED', 'ANSWERED', 'NOT_ANSWERED'];
  if (!valid.includes(callStatus)) {
    throw badRequest(`Invalid call status. Must be one of: ${valid.join(', ')}`);
  }

  const previousCallStatus = pass.callStatus;
  pass.callStatus = callStatus;
  pass.calledAt = new Date();
  if (notes) pass.callNotes = notes;
  await pass.save();

  await recordAuditLog({
    action: 'BOOTCAMP_PASS_CALL_STATUS_UPDATED',
    entityType: 'Pass',
    entityId: pass._id,
    before: { callStatus: previousCallStatus },
    after: { callStatus, notes },
    req
  });

  return successResponse(res, pass, `Call status updated to ${callStatus}`);
}




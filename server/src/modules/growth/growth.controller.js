import fs from 'fs';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { Lead, CallActivity, Bootcamp, Pass, Demo } from './growth.model.js';
import { Person } from '../people/people.model.js';
import { Organization } from '../organizations/organization.model.js';
import { generateBootcampPassPDF, generateCertificatePDF, generateFeeReceiptPDF } from '../../utils/pdfGenerator.js';
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
  const query = req.organizationId ? { _id: req.params.id, organizationId: req.organizationId } : { _id: req.params.id };
  const pass = await Pass.findOne(query).lean();
  if (!pass) throw notFound('Pass not found');
  const bootcamp = await Bootcamp.findById(pass.bootcampId).lean();
  const slot = bootcamp?.slots?.find(s => String(s._id) === String(pass.slotId));
  const org = await Organization.findById(pass.organizationId || req.organizationId).lean();

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

// Helper to parse RFC-4180 CSV with quotes, commas, and CRLF
export function parseGoogleFormCSV(text) {
  if (!text || typeof text !== 'string') return [];
  const rows = [];
  let currentRow = [];
  let currentVal = '';
  let inQuotes = false;
  const clean = text.replace(/^\uFEFF/, ''); // strip BOM

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentVal += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentVal += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentVal.trim());
        currentVal = '';
      } else if (char === '\r') {
        // ignore carriage return
      } else if (char === '\n') {
        currentRow.push(currentVal.trim());
        if (currentRow.some((c) => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
  }
  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((row, rowIdx) => {
    const obj = { _rowIndex: rowIdx + 1 };
    headers.forEach((h, idx) => {
      if (h) obj[h] = row[idx] || '';
    });
    return obj;
  });
}

function extractField(row, mappedTitle, fallbacks = []) {
  if (!row || typeof row !== 'object') return '';
  if (mappedTitle && row[mappedTitle] !== undefined && String(row[mappedTitle]).trim() !== '') {
    return String(row[mappedTitle]).trim();
  }
  const target = (mappedTitle || '').trim().toLowerCase();
  for (const [k, v] of Object.entries(row)) {
    if (k.trim().toLowerCase() === target && v !== undefined && String(v).trim() !== '') {
      return String(v).trim();
    }
  }
  for (const fb of fallbacks) {
    for (const [k, v] of Object.entries(row)) {
      if (fb.test(k) && v !== undefined && String(v).trim() !== '') {
        return String(v).trim();
      }
    }
  }
  return '';
}

export async function configureBootcampGoogleForm(req, res) {
  const bootcamp = await Bootcamp.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!bootcamp) throw notFound('Bootcamp not found');

  const { formUrl, sheetUrl, fieldMapping } = req.body || {};
  if (!formUrl || typeof formUrl !== 'string' || !formUrl.trim()) {
    throw badRequest('Google Form or Spreadsheet URL is required');
  }

  const cleanFormUrl = formUrl.trim();
  const cleanSheetUrl = (sheetUrl || '').trim();

  const isGoogle = /^https?:\/\/(docs\.google\.com\/(forms|spreadsheets)\/|forms\.gle\/)/i.test(cleanFormUrl)
    || (cleanSheetUrl && /^https?:\/\/docs\.google\.com\/spreadsheets\//i.test(cleanSheetUrl));

  if (!isGoogle) {
    throw badRequest('Invalid URL. Please enter a valid Google Form or linked Google Sheet link (docs.google.com/forms/d/... or docs.google.com/spreadsheets/d/...).');
  }

  // Extract formId
  const formIdMatch = cleanFormUrl.match(/\/d\/(?:e\/)?([a-zA-Z0-9_-]+)/);
  const formId = formIdMatch ? formIdMatch[1] : `gform_${Date.now().toString(36)}`;

  bootcamp.googleForm = {
    formUrl: cleanFormUrl,
    formId,
    sheetUrl: cleanSheetUrl,
    isConnected: true,
    isValidated: true,
    validatedAt: new Date(),
    fieldMapping: {
      fullName: (fieldMapping?.fullName || fieldMapping?.candidateName || 'Full Name').trim(),
      email: (fieldMapping?.email || fieldMapping?.candidateEmail || 'Email Address').trim(),
      phone: (fieldMapping?.phone || fieldMapping?.candidatePhone || 'Phone Number').trim(),
      college: (fieldMapping?.college || 'College').trim(),
      course: (fieldMapping?.course || 'Course').trim(),
      linkedIn: (fieldMapping?.linkedIn || 'LinkedIn Profile').trim(),
      resume: (fieldMapping?.resume || fieldMapping?.resumeUrl || 'Resume Link').trim()
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
    after: { formUrl: cleanFormUrl, sheetUrl: cleanSheetUrl, formId },
    req
  });

  return successResponse(res, bootcamp.googleForm, 'Google Form connected and field mapping saved successfully');
}

export async function syncBootcampGoogleFormResponses(req, res) {
  const bootcamp = await Bootcamp.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!bootcamp) throw notFound('Bootcamp not found');

  if (!bootcamp.googleForm || !bootcamp.googleForm.formUrl) {
    throw badRequest('Google Form is not configured for this bootcamp. Please configure the form URL and field mapping first.');
  }

  const defaultSlot = bootcamp.slots[0];
  if (!defaultSlot) {
    throw badRequest('Bootcamp has no slots configured to receive registrations.');
  }

  let incoming = null;

  // 1. Direct CSV text or array of responses passed in request
  if (req.body?.csvData && typeof req.body.csvData === 'string' && req.body.csvData.trim()) {
    incoming = parseGoogleFormCSV(req.body.csvData);
  } else if (Array.isArray(req.body?.responses) && req.body.responses.length > 0) {
    incoming = req.body.responses;
  }

  // 2. Fetch live from linked Google Sheet if provided
  if (!incoming || incoming.length === 0) {
    const targetUrl = bootcamp.googleForm.sheetUrl || bootcamp.googleForm.formUrl;
    const sheetIdMatch = targetUrl.match(/\/spreadsheets\/d\/(?:e\/)?([a-zA-Z0-9_-]+)/);

    if (sheetIdMatch && sheetIdMatch[1]) {
      const sheetId = sheetIdMatch[1];
      const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
      try {
        const resp = await fetch(exportUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 TechMechaTorque-IMS' },
          redirect: 'follow'
        });
        if (resp.ok) {
          const csvText = await resp.text();
          if (csvText && csvText.includes(',')) {
            incoming = parseGoogleFormCSV(csvText);
          }
        }
      } catch (err) {
        console.warn('[Google Form Sync] Failed to fetch live Google Sheet:', err.message);
      }
    }
  }

  // 3. If still no responses found, provide a clean, helpful guide without fabricating dummy records
  if (!incoming || incoming.length === 0) {
    throw badRequest(
      'No responses could be retrieved automatically. To sync your Google Form responses: ' +
      '1) In your Google Form, click "Responses" > "Link to Sheets", paste the Google Sheet URL and ensure sharing is "Anyone with the link can view", ' +
      'or 2) Click "Import / Paste Responses CSV" to paste your downloaded Google Form responses directly.'
    );
  }

  const mapping = bootcamp.googleForm.fieldMapping || {};
  let newResponses = 0;
  let updatedResponses = 0;
  let duplicates = 0;
  let failed = 0;
  const syncResults = [];

  for (const resp of incoming) {
    const rawName = extractField(resp, mapping.fullName, [/^name$/i, /full.*name/i, /candidate.*name/i]) || 'Participant';
    const rawEmail = extractField(resp, mapping.email, [/^email$/i, /email.*address/i, /mail/i]).toLowerCase();
    const rawPhone = extractField(resp, mapping.phone, [/^phone$/i, /phone.*number/i, /mobile/i, /contact/i, /whatsapp/i]);
    const rawCollege = extractField(resp, mapping.college, [/^college$/i, /university/i, /institute/i, /school/i]);
    const rawCourse = extractField(resp, mapping.course, [/^course$/i, /branch/i, /degree/i, /department/i, /stream/i]);
    const rawResume = extractField(resp, mapping.resume, [/^resume$/i, /resume.*link/i, /cv/i, /portfolio/i, /drive/i]);
    const rawLinkedIn = extractField(resp, mapping.linkedIn, [/linkedin/i, /social/i]);
    const responseId = resp.responseId || resp.Timestamp || resp.timestamp || `gform_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    if (!rawEmail || !rawEmail.includes('@')) {
      failed++;
      syncResults.push({ candidateName: rawName, email: rawEmail || '(none)', status: 'FAILED', reason: 'Missing or invalid email address' });
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

  bootcamp.googleForm.lastSyncedAt = new Date();
  bootcamp.googleForm.syncStats = {
    newResponses: (bootcamp.googleForm.syncStats?.newResponses || 0) + newResponses,
    updatedResponses: (bootcamp.googleForm.syncStats?.updatedResponses || 0) + updatedResponses,
    duplicates: (bootcamp.googleForm.syncStats?.duplicates || 0) + duplicates,
    failed: (bootcamp.googleForm.syncStats?.failed || 0) + failed
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
  }, `Google Form responses synced: ${newResponses} new, ${updatedResponses} updated, ${duplicates} duplicates, ${failed} failed.`);
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

// ==================== BOOTCAMP FORM BUILDER & PUBLIC RESPONSES ====================

export async function getPublicBootcampForm(req, res) {
  const bootcamp = await Bootcamp.findById(req.params.id).populate('organizationId', 'name code logoUrl email phone').lean();
  if (!bootcamp) throw notFound('Bootcamp form not found or has been closed');
  if (bootcamp.status === 'CANCELLED') throw badRequest('This bootcamp event has been cancelled.');

  const org = bootcamp.organizationId || {};
  const publicData = {
    _id: bootcamp._id,
    title: bootcamp.title,
    description: bootcamp.description,
    venue: bootcamp.venue,
    duration: bootcamp.duration,
    date: bootcamp.date,
    startDate: bootcamp.startDate,
    endDate: bootcamp.endDate,
    status: bootcamp.status,
    feeType: bootcamp.feeType || 'FREE',
    feeAmount: bootcamp.feeAmount || 0,
    paymentUpiId: bootcamp.paymentUpiId || 'techmechatorque@upi',
    paymentInstructions: bootcamp.paymentInstructions || '',
    customForm: bootcamp.customForm || {
      isEnabled: true,
      bannerUrl: '',
      instructions: 'Please provide the requested details to register for the official TechMecha Torque bootcamp session.',
      fields: []
    },
    slots: (bootcamp.slots || []).map(s => ({
      _id: s._id,
      slotName: s.slotName,
      startTime: s.startTime,
      endTime: s.endTime,
      capacity: s.capacity,
      bookedCount: s.bookedCount || 0,
      isFull: (s.bookedCount || 0) >= (s.capacity || 1)
    })),
    organization: {
      name: org.name || 'TechMecha Torque Pvt. Ltd.',
      code: org.code || 'TMT',
      email: org.email || 'team@techmechatorque.com',
      phone: org.phone || '+91 94947 00000',
      logoUrl: org.logoUrl || '/letters/tmt-logo.png'
    }
  };

  return successResponse(res, publicData);
}

export async function submitPublicBootcampForm(req, res) {
  const { id } = req.params;
  const bootcamp = await Bootcamp.findById(id).populate('organizationId');
  if (!bootcamp) throw notFound('Bootcamp not found');
  if (bootcamp.status === 'CANCELLED') throw badRequest('Bootcamp registration is closed.');

  const {
    candidateName,
    candidateEmail,
    candidatePhone,
    college,
    course,
    slotId,
    paymentReference,
    customResponses = {}
  } = req.body;

  if (!candidateName?.trim()) throw badRequest('Candidate full name is required');
  if (!candidateEmail?.trim()) throw badRequest('Candidate email is required');
  if (!slotId) throw badRequest('Please select a bootcamp slot');

  const slot = bootcamp.slots?.id(slotId);
  if (!slot) throw notFound('Selected slot not found');
  if (slot.bookedCount >= slot.capacity) {
    throw conflict('This slot is fully booked. Please select an alternate slot.');
  }

  // Validate custom required fields if any
  const formFields = bootcamp.customForm?.fields || [];
  for (const f of formFields) {
    if (f.required && !customResponses[f.id] && !customResponses[f.label]) {
      throw badRequest(`Field "${f.label}" is required.`);
    }
  }

  const passCode = `TMT-${generateRandomId(4).toUpperCase()}`;
  const hmacToken = generatePassToken(passCode);

  const orgId = bootcamp.organizationId?._id || bootcamp.organizationId;
  const orgName = bootcamp.organizationId?.name || 'TechMecha Torque';

  // Fee calculation
  const feeType = bootcamp.feeType || 'FREE';
  const feeAmount = feeType === 'PAID' ? (bootcamp.feeAmount || 0) : 0;
  const receiptNumber = feeType === 'PAID'
    ? `RCP-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`
    : '';

  const candidateFee = {
    feeType,
    feeAmount,
    amountPaid: feeType === 'PAID' ? feeAmount : 0,
    paymentStatus: feeType === 'PAID' ? 'PAID' : 'FREE',
    paymentMethod: feeType === 'PAID' ? 'UPI' : 'NONE',
    paymentReference: paymentReference?.trim() || '',
    receiptNumber,
    paidAt: feeType === 'PAID' ? new Date() : undefined
  };

  // Find or create lead
  let lead = await Lead.findOne({
    organizationId: orgId,
    email: candidateEmail.toLowerCase().trim()
  });

  if (!lead) {
    lead = await Lead.create({
      organizationId: orgId,
      name: candidateName.trim(),
      email: candidateEmail.toLowerCase().trim(),
      phone: candidatePhone?.trim() || 'N/A',
      source: 'FORM_BUILDER',
      programOfInterest: bootcamp.title,
      status: 'BOOTCAMP_BOOKED'
    });
  } else {
    lead.status = 'BOOTCAMP_BOOKED';
    await lead.save();
  }

  const pass = await Pass.create({
    organizationId: orgId,
    bootcampId: bootcamp._id,
    slotId: slot._id,
    leadId: lead._id,
    candidateName: candidateName.trim(),
    candidateEmail: candidateEmail.toLowerCase().trim(),
    candidatePhone: candidatePhone?.trim() || '',
    college: college?.trim() || '',
    course: course?.trim() || '',
    source: 'FORM_BUILDER',
    passCode,
    hmacToken,
    status: 'CONFIRMED',
    candidateFee,
    customResponses
  });

  slot.bookedCount += 1;
  await bootcamp.save();

  // Generate pass PDF
  const pdfBuffer = await generateBootcampPassPDF({
    candidateName: pass.candidateName,
    candidateEmail: pass.candidateEmail,
    candidatePhone: pass.candidatePhone,
    bootcampTitle: bootcamp.title,
    date: bootcamp.date ? formatDateLong(bootcamp.date) : 'Upcoming',
    time: `${slot.startTime} - ${slot.endTime}`,
    venue: bootcamp.venue || 'Virtual Campus',
    mode: 'ONLINE',
    slotName: slot.slotName,
    passCode: pass.passCode,
    hmacToken: pass.hmacToken,
    organizationName: orgName
  });

  // Dispatch email with pass asynchronously
  try {
    const attachments = [{
      filename: `Bootcamp-Pass-${pass.passCode}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }];

    if (feeType === 'PAID') {
      const receiptBuffer = await generateFeeReceiptPDF({
        receiptNumber: candidateFee.receiptNumber,
        paymentDate: new Date(),
        traineeName: pass.candidateName,
        traineeEmail: pass.candidateEmail,
        traineePhone: pass.candidatePhone,
        programTitle: bootcamp.title,
        organizationName: orgName,
        paymentMethod: candidateFee.paymentMethod,
        paymentReference: candidateFee.paymentReference,
        feeType: candidateFee.feeType,
        feeAmount: candidateFee.feeAmount,
        amountPaid: candidateFee.amountPaid,
        paymentStatus: candidateFee.paymentStatus
      });
      attachments.push({
        filename: `Receipt-${candidateFee.receiptNumber}.pdf`,
        content: receiptBuffer,
        contentType: 'application/pdf'
      });
    }

    emailService.sendEmail({
      to: pass.candidateEmail,
      subject: `Registration Confirmed: ${bootcamp.title} - ${pass.passCode}`,
      text: `Hello ${pass.candidateName},\n\nYour pass for ${bootcamp.title} is confirmed.\nPass Code: ${pass.passCode}\nSlot: ${slot.slotName} (${slot.startTime} - ${slot.endTime})\n\nPlease find your official admission pass attached.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #0f172a; margin: 0;">Registration Confirmed!</h2>
            <p style="color: #64748b; font-size: 14px; margin-top: 4px;">${bootcamp.title}</p>
          </div>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #334155;"><strong>Candidate:</strong> ${pass.candidateName}</p>
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #334155;"><strong>Pass Code:</strong> <code style="background-color: #0284c7; color: white; padding: 3px 8px; border-radius: 4px; font-weight: bold;">${pass.passCode}</code></p>
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #334155;"><strong>Scheduled Track:</strong> ${slot.slotName} (${slot.startTime} - ${slot.endTime})</p>
            <p style="margin: 0; font-size: 14px; color: #334155;"><strong>Venue / Mode:</strong> ${bootcamp.venue || 'Virtual Campus'}</p>
          </div>
          ${feeType === 'PAID' ? `<p style="font-size: 13px; color: #16a34a; font-weight: bold;">✓ Fee of ₹${candidateFee.amountPaid} acknowledged. Receipt ${candidateFee.receiptNumber} attached.</p>` : ''}
          <p style="font-size: 13px; color: #64748b; line-height: 1.5;">Please present your admission pass attached to this email when attending the session.</p>
        </div>
      `,
      attachments,
      organizationId: orgId
    }).catch(e => console.warn('[Bootcamp Public Submit] Async email error:', e.message));
  } catch (err) {
    console.warn('[Bootcamp Public Submit] Pass PDF dispatch error:', err.message);
  }

  return successResponse(res, {
    pass,
    receipt: candidateFee,
    bootcampTitle: bootcamp.title
  }, 'Registration submitted successfully! Admission pass and receipt sent to your email.', 201);
}

export async function updateBootcampFormBuilder(req, res) {
  const bootcamp = await Bootcamp.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!bootcamp) throw notFound('Bootcamp not found');

  const {
    customForm,
    feeType,
    feeAmount,
    paymentUpiId,
    paymentInstructions
  } = req.body;

  if (customForm !== undefined) bootcamp.customForm = customForm;
  if (feeType !== undefined) bootcamp.feeType = feeType;
  if (feeAmount !== undefined) bootcamp.feeAmount = Math.max(0, Number(feeAmount) || 0);
  if (paymentUpiId !== undefined) bootcamp.paymentUpiId = paymentUpiId;
  if (paymentInstructions !== undefined) bootcamp.paymentInstructions = paymentInstructions;

  await bootcamp.save();

  await recordAuditLog({
    organizationId: req.organizationId,
    action: 'BOOTCAMP_FORM_BUILDER_UPDATED',
    entityType: 'Bootcamp',
    entityId: bootcamp._id,
    req
  });

  return successResponse(res, bootcamp, 'Bootcamp form builder settings saved successfully');
}

export async function downloadPassFeeReceipt(req, res) {
  const query = req.organizationId ? { _id: req.params.id, organizationId: req.organizationId } : { _id: req.params.id };
  const pass = await Pass.findOne(query).lean();
  if (!pass) throw notFound('Pass not found');

  const bootcamp = await Bootcamp.findById(pass.bootcampId).lean();
  const org = await Organization.findById(pass.organizationId || req.organizationId).lean();
  const cf = pass.candidateFee || {};

  const pdfBuffer = await generateFeeReceiptPDF({
    receiptNumber: cf.receiptNumber || `RCP-${pass.passCode}`,
    paymentDate: cf.paidAt || pass.createdAt || new Date(),
    traineeName: pass.candidateName,
    traineeEmail: pass.candidateEmail,
    traineePhone: pass.candidatePhone,
    programTitle: bootcamp?.title || 'Bootcamp Track',
    organizationName: org?.name || 'TechMecha Torque',
    paymentMethod: cf.paymentMethod || 'UPI',
    paymentReference: cf.paymentReference || 'N/A',
    feeType: cf.feeType || 'PAID',
    feeAmount: cf.feeAmount || 0,
    amountPaid: cf.amountPaid || 0,
    paymentStatus: cf.paymentStatus || 'PAID'
  });

  const inline = req.query.inline === '1';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="Receipt-${pass.passCode}.pdf"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.send(pdfBuffer);
}




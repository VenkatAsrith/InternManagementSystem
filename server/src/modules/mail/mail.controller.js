import { Mailbox, MailboxAccessGrant, EmailMessage } from './mail.model.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { Validator, parsePagination } from '../../utils/validate.js';
import { notFound, forbidden, badRequest } from '../../utils/errors.js';

async function checkMailboxPermission(user, mailboxId, requiredRight = 'canRead') {
  if (user.role === 'SUPER_ADMIN' || user.role === 'ORGANIZATION_ADMIN') return true;
  const grant = await MailboxAccessGrant.findOne({ mailboxId, userId: user._id });
  if (!grant || !grant[requiredRight]) return false;
  return true;
}

export async function getMailboxes(req, res) {
  const isGlobalAdmin = req.user.role === 'SUPER_ADMIN' || req.user.role === 'ORGANIZATION_ADMIN';
  let mailboxes;

  if (isGlobalAdmin) {
    mailboxes = await Mailbox.find({ organizationId: req.organizationId }).lean();
  } else {
    const grants = await MailboxAccessGrant.find({ userId: req.user._id, canRead: true }).select('mailboxId').lean();
    const grantedIds = grants.map((g) => g.mailboxId);
    mailboxes = await Mailbox.find({ _id: { $in: grantedIds }, organizationId: req.organizationId }).lean();
  }

  // Ensure no sensitive fields are present
  const sanitized = mailboxes.map((m) => {
    const { smtpPassEncrypted, ...safe } = m;
    return safe;
  });

  return successResponse(res, sanitized);
}

export async function createMailbox(req, res) {
  const v = new Validator(req.body)
    .string('name', { required: true, min: 2, max: 100 })
    .email('emailAddress', { required: true });

  const data = v.done();
  const mailbox = await Mailbox.create({
    organizationId: req.organizationId,
    name: data.name,
    emailAddress: data.emailAddress.toLowerCase().trim(),
    provider: req.body.provider || 'smtp'
  });

  return successResponse(res, mailbox, 'Mailbox created successfully', 201);
}

export async function grantMailboxAccess(req, res) {
  const v = new Validator(req.body)
    .objectId('userId', { required: true });

  const data = v.done();
  const mailbox = await Mailbox.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!mailbox) throw notFound('Mailbox not found');

  const grant = await MailboxAccessGrant.findOneAndUpdate(
    { mailboxId: mailbox._id, userId: data.userId },
    {
      $set: {
        organizationId: req.organizationId,
        canRead: req.body.canRead !== undefined ? Boolean(req.body.canRead) : true,
        canSend: req.body.canSend !== undefined ? Boolean(req.body.canSend) : false,
        canReply: req.body.canReply !== undefined ? Boolean(req.body.canReply) : false
      }
    },
    { upsert: true, new: true }
  );

  return successResponse(res, grant, 'Mailbox access granted successfully');
}

export async function getMailboxMessages(req, res) {
  const mailboxId = req.params.id;
  const allowed = await checkMailboxPermission(req.user, mailboxId, 'canRead');
  if (!allowed) {
    throw forbidden('You do not have access to read this mailbox.');
  }

  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const [messages, total] = await Promise.all([
    EmailMessage.find({ mailboxId, organizationId: req.organizationId }).sort({ sentAt: -1 }).skip(skip).limit(limit).lean(),
    EmailMessage.countDocuments({ mailboxId, organizationId: req.organizationId })
  ]);

  return paginatedResponse(res, messages, { page, limit, total });
}

export async function sendMessage(req, res) {
  const mailboxId = req.params.id;
  const allowed = await checkMailboxPermission(req.user, mailboxId, 'canSend');
  if (!allowed) {
    throw forbidden('You do not have permission to send emails from this mailbox.');
  }

  const mailbox = await Mailbox.findOne({ _id: mailboxId, organizationId: req.organizationId });
  if (!mailbox) throw notFound('Mailbox not found');

  const v = new Validator(req.body)
    .email('recipient', { required: true })
    .string('subject', { required: true, min: 1, max: 200 })
    .string('body', { required: true, min: 1 });

  const data = v.done();
  const message = await EmailMessage.create({
    organizationId: req.organizationId,
    mailboxId: mailbox._id,
    sender: mailbox.emailAddress,
    recipient: data.recipient,
    subject: data.subject,
    body: data.body,
    direction: 'OUTBOUND',
    sentBy: req.user._id,
    sentAt: new Date()
  });

  return successResponse(res, message, 'Email sent successfully', 201);
}

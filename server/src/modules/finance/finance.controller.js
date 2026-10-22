import PDFDocument from 'pdfkit';
import mongoose from 'mongoose';
import { CompensationPlan, Payment, PaymentLedger, PaymentTransaction } from './finance.model.js';
import { calculatePayroll } from './payroll.js';
import { Intern } from '../interns/intern.model.js';
import { Leave } from '../leaves/leave.model.js';
import { AttendanceRecord } from '../attendance/attendance.model.js';
import { Exit } from '../exit/exit.model.js';
import { Organization } from '../organizations/organization.model.js';
import { getOwnIntern, loadScopedIntern } from '../interns/intern.access.js';
import { generateId } from '../../utils/idGenerator.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { recordAuditLog } from '../../middleware/auditLogger.js';
import { createNotification } from '../notifications/notification.service.js';
import { PAYMENT_STATUS, LEDGER_ENTRY_TYPE, COMPENSATION_TYPE, ROLES } from '../../../../shared/constants.js';
import { INTERN_PAYABLE_STATUSES, PAYMENT_TRANSITIONS, PAYMENT_MUTABLE_STATUSES, assertTransition } from '../../../../shared/lifecycle.js';
import { ah } from '../../utils/asyncHandler.js';
import { notFound, conflict, unprocessable } from '../../utils/errors.js';
import { Validator, parsePagination, isObjectId } from '../../utils/validate.js';
import { cycleRange, startOfDay, ymdInTz, round2 } from '../../utils/time.js';

const CYCLE_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const CREDIT_TYPES = [LEDGER_ENTRY_TYPE.BONUS, LEDGER_ENTRY_TYPE.REIMBURSEMENT];
const DEBIT_TYPES = [LEDGER_ENTRY_TYPE.DEDUCTION, LEDGER_ENTRY_TYPE.PENALTY];

async function totalsFor(match) {
  const agg = await Payment.aggregate([
    { $match: match },
    { $group: {
      _id: null, count: { $sum: 1 }, gross: { $sum: '$grossAmount' }, additions: { $sum: '$totalAdditions' }, deductions: { $sum: '$totalDeductions' }, net: { $sum: '$netPayable' },
      paid: { $sum: { $cond: [{ $eq: ['$status', PAYMENT_STATUS.PAID] }, '$paidAmount', 0] } },
      pending: { $sum: { $cond: [{ $in: ['$status', PAYMENT_MUTABLE_STATUSES] }, '$netPayable', 0] } }
    } }
  ]);
  const t = agg[0] || {};
  return { count: t.count || 0, gross: round2(t.gross || 0), additions: round2(t.additions || 0), deductions: round2(t.deductions || 0), net: round2(t.net || 0), paid: round2(t.paid || 0), pending: round2(t.pending || 0) };
}

// Aggregation pipelines do not auto-cast ids: convert them explicitly.
function matchFor(query, organizationId) {
  const match = { ...query, organizationId: new mongoose.Types.ObjectId(String(organizationId)) };
  if (match.internId) match.internId = new mongoose.Types.ObjectId(String(match.internId));
  return match;
}

function paymentQuery(req) {
  const query = { organizationId: req.organizationId };
  if (req.query.cycle) {
    if (!CYCLE_RE.test(String(req.query.cycle))) throw unprocessable('Cycle must look like 2026-09', [{ field: 'cycle', message: 'Use YYYY-MM' }]);
    query.cycle = req.query.cycle;
  }
  if (Object.values(PAYMENT_STATUS).includes(req.query.status)) query.status = req.query.status;
  if (isObjectId(req.query.internId)) query.internId = req.query.internId;
  return query;
}

export const getPayments = ah(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 200 });
  const query = paymentQuery(req);
  const [payments, total, totals] = await Promise.all([
    Payment.find(query)
      .populate({ path: 'internId', select: 'internId userId departmentId mentorId', populate: { path: 'userId', select: 'firstName lastName email' } })
      .sort({ createdAt: -1 }).skip(skip).limit(limit),
    Payment.countDocuments(query),
    totalsFor(matchFor(query, req.organizationId))
  ]);
  return successResponse(res, { payments, totals, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
});

async function loadPaymentForViewer(req, id) {
  const payment = await Payment.findOne({ _id: id, organizationId: req.organizationId })
    .populate({ path: 'internId', select: 'internId userId departmentId', populate: { path: 'userId', select: 'firstName lastName email' } });
  if (!payment) throw notFound('Payment record not found');
  if ([ROLES.INTERN, ROLES.INTERN_TRAINEE].includes(req.userRole) || !req.can('finance.read')) {
    // An intern or trainee can only ever open THEIR OWN statements.
    if (String(payment.internId?.userId?._id || payment.internId?.userId) !== String(req.userId)) throw notFound('Payment record not found');
  }
  return payment;
}

export const getPaymentById = ah(async (req, res) => {
  const payment = await loadPaymentForViewer(req, req.params.id);
  const ledger = await PaymentLedger.find({ paymentId: payment._id }).populate('createdBy', 'firstName lastName email').sort({ createdAt: 1 });
  return successResponse(res, { payment, ledger });
});

export const createCompensationPlan = ah(async (req, res) => {
  const v = new Validator(req.body)
    .objectId('internId', { required: true }).oneOf('compensationType', COMPENSATION_TYPE, { required: true })
    .number('baseAmount', { required: true, min: 0, max: 10_000_000 }).oneOf('currency', ['INR', 'USD', 'EUR', 'GBP'], { defaultValue: 'INR' })
    .oneOf('paymentFrequency', ['MONTHLY', 'BI_WEEKLY', 'MILESTONE_BASED', 'ONE_TIME'], { defaultValue: 'MONTHLY' });
  const body = v.done();
  if (body.compensationType === COMPENSATION_TYPE.UNPAID && body.baseAmount !== 0) throw unprocessable('Unpaid plans must have an amount of 0', [{ field: 'baseAmount', message: 'Must be 0' }]);
  if (body.compensationType !== COMPENSATION_TYPE.UNPAID && body.baseAmount <= 0) throw unprocessable('Enter an amount greater than 0', [{ field: 'baseAmount', message: 'Must be greater than 0' }]);

  const intern = await Intern.findOne({ _id: body.internId, organizationId: req.organizationId });
  if (!intern) throw notFound('Intern not found');

  let bankDetails;
  const bank = req.body?.bankDetails;
  if (bank && typeof bank === 'object') {
    const bv = new Validator(bank).string('accountHolderName', { max: 120 }).string('accountNumber', { pattern: /^[0-9]{6,20}$/, patternMessage: 'Account number must be 6-20 digits' })
      .string('bankName', { max: 120 }).string('ifscOrRoutingCode', { upper: true, pattern: /^[A-Z]{4}0[A-Z0-9]{6}$|^[0-9A-Z]{6,12}$/, patternMessage: 'Invalid IFSC / routing code' }).done();
    bankDetails = { accountHolderName: bv.accountHolderName, accountNumberMasked: bv.accountNumber ? `****${bv.accountNumber.slice(-4)}` : undefined, bankName: bv.bankName, ifscOrRoutingCode: bv.ifscOrRoutingCode };
  }

  await CompensationPlan.updateMany({ internId: intern._id, isActive: true }, { isActive: false, effectiveTo: new Date() });
  const plan = await CompensationPlan.create({ organizationId: req.organizationId, internId: intern._id, ...body, bankDetails, isActive: true });
  await recordAuditLog({ action: 'COMPENSATION_PLAN_CREATED', entityType: 'CompensationPlan', entityId: plan._id, after: { internId: intern.internId, type: body.compensationType, amount: body.baseAmount }, req });
  return successResponse(res, plan, 'Compensation plan created successfully', 201);
});

/**
 * Payroll run. Amounts are calculated HERE from stored records (plan, engagement window, attendance, approved
 * leave). The browser sends only the cycle (and optionally one intern); dates and amounts are never accepted.
 */
export const generateCyclePayments = ah(async (req, res) => {
  const body = new Validator(req.body).string('cycle', { required: true, max: 7, pattern: CYCLE_RE, patternMessage: 'Cycle must look like 2026-09' }).objectId('internId').done();
  const range = cycleRange(body.cycle, req.timezone);
  if (range.start > startOfDay(new Date(), req.timezone)) throw unprocessable('A future cycle cannot be paid yet.', [{ field: 'cycle', message: 'Cycle has not started' }]);

  const query = { organizationId: req.organizationId, status: { $in: INTERN_PAYABLE_STATUSES }, startDate: { $lte: range.end } };
  if (body.internId) query._id = body.internId;
  const interns = await Intern.find(query);
  if (body.internId && !interns.length) throw notFound('Intern not found or not yet payable');

  const generated = [];
  const skipped = [];
  for (const intern of interns) {
    const label = intern.internId;
    const exit = await Exit.findOne({ internId: intern._id }).sort({ createdAt: -1 });
    const ends = [intern.expectedEndDate, intern.actualEndDate, exit?.lastWorkingDay].filter(Boolean).map(d => startOfDay(d, req.timezone).getTime());
    const windowEnd = new Date(Math.min(...ends));
    if (windowEnd < range.start) { skipped.push({ internId: label, reason: 'ENGAGEMENT_ENDED_BEFORE_CYCLE' }); continue; }

    if (await Payment.exists({ organizationId: req.organizationId, internId: intern._id, cycle: body.cycle })) { skipped.push({ internId: label, reason: 'ALREADY_GENERATED' }); continue; }
    const plan = await CompensationPlan.findOne({ internId: intern._id, isActive: true });
    if (!plan) { skipped.push({ internId: label, reason: 'NO_COMPENSATION_PLAN' }); continue; }
    if (plan.compensationType === COMPENSATION_TYPE.UNPAID || plan.compensationType === COMPENSATION_TYPE.PERFORMANCE_BONUS) { skipped.push({ internId: label, reason: plan.compensationType }); continue; }

    const [leaves, attendance] = await Promise.all([
      Leave.find({ internId: intern._id, startDate: { $lte: range.end }, endDate: { $gte: range.start } }).lean(),
      AttendanceRecord.find({ internId: intern._id, date: { $gte: range.start, $lte: range.end } }).lean()
    ]);
    const calc = calculatePayroll({
      compensationType: plan.compensationType, baseAmount: plan.baseAmount, cycleStart: range.start, cycleEnd: range.end,
      windowStart: startOfDay(intern.startDate, req.timezone), windowEnd, leaves, attendance, tz: req.timezone
    });
    if (calc.grossAmount <= 0) { skipped.push({ internId: label, reason: 'NOTHING_PAYABLE' }); continue; }

    try {
      const payment = await Payment.create({
        paymentId: await generateId('PAY'), organizationId: req.organizationId, internId: intern._id, cycle: body.cycle,
        startDate: range.start, endDate: range.end, compensationType: plan.compensationType, baseAmount: plan.baseAmount,
        workingDays: calc.workingDays, activeDays: calc.activeDays, lopDays: calc.lopDays, absentDays: calc.absentDays, payableDays: calc.payableDays, hoursWorked: calc.hoursWorked,
        grossAmount: calc.grossAmount, totalDeductions: calc.totalDeductions, totalAdditions: 0, netPayable: calc.netPayable,
        currency: plan.currency, status: PAYMENT_STATUS.PENDING
      });
      const entries = [{ type: LEDGER_ENTRY_TYPE.STIPEND, amount: calc.grossAmount, description: `Stipend for ${body.cycle}: ${calc.activeDays} of ${calc.workingDays} working days` }];
      const dayRate = calc.perDayRate;
      if (calc.lopDays) entries.push({ type: LEDGER_ENTRY_TYPE.DEDUCTION, amount: -round2(dayRate * calc.lopDays), description: `Loss of pay: ${calc.lopDays} unpaid leave day(s)` });
      if (calc.absentDays) entries.push({ type: LEDGER_ENTRY_TYPE.DEDUCTION, amount: -round2(dayRate * calc.absentDays), description: `Unexcused absence: ${calc.absentDays} day(s)` });
      await PaymentLedger.insertMany(entries.map(e => ({ organizationId: req.organizationId, paymentId: payment._id, internId: intern._id, currency: plan.currency, createdBy: req.userId, ...e })));
      generated.push(payment);
    } catch (err) {
      if (err?.code === 11000) skipped.push({ internId: label, reason: 'ALREADY_GENERATED' });
      else throw err;
    }
  }

  await recordAuditLog({ action: 'PAYMENTS_CYCLE_GENERATED', entityType: 'Payment', entityId: req.organizationId, after: { cycle: body.cycle, generated: generated.length, skipped: skipped.length }, req });
  return successResponse(res, { cycle: body.cycle, generatedCount: generated.length, skipped, payments: generated }, `Stipend run generated for ${generated.length} intern(s)`);
});

export const addAdjustment = ah(async (req, res) => {
  const v = new Validator(req.body)
    .oneOf('type', [...CREDIT_TYPES, ...DEBIT_TYPES], { required: true })
    .number('amount', { required: true, min: 0.01, max: 1_000_000 }).string('description', { required: true, min: 3, max: 300 });
  const { type, amount, description } = v.done();
  const amt = round2(amount);
  const isDebit = DEBIT_TYPES.includes(type);

  const existing = await Payment.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!existing) throw notFound('Payment not found');

  const ledger = await PaymentLedger.create({ organizationId: req.organizationId, paymentId: existing._id, internId: existing.internId, type, amount: isDebit ? -amt : amt, currency: existing.currency, description, createdBy: req.userId });

  // Atomic update that REFUSES to make the net payable negative or to touch a settled payment.
  const field = isDebit ? 'totalDeductions' : 'totalAdditions';
  const newNet = isDebit
    ? { $subtract: [{ $add: ['$grossAmount', '$totalAdditions'] }, { $add: ['$totalDeductions', amt] }] }
    : { $subtract: [{ $add: ['$grossAmount', '$totalAdditions', amt] }, '$totalDeductions'] };
  const updated = await Payment.findOneAndUpdate(
    { _id: existing._id, status: { $in: PAYMENT_MUTABLE_STATUSES }, $expr: { $gte: [newNet, 0] } },
    [{ $set: { [field]: { $add: [`$${field}`, amt] }, netPayable: newNet } }],
    { new: true }
  );
  if (!updated) {
    await PaymentLedger.deleteOne({ _id: ledger._id });
    const fresh = await Payment.findById(existing._id);
    if (!PAYMENT_MUTABLE_STATUSES.includes(fresh.status)) throw conflict(`A ${fresh.status} payment cannot be adjusted.`, 'PAYMENT_LOCKED');
    throw unprocessable('This deduction would make the net payable negative.', [{ field: 'amount', message: 'Exceeds the amount available to deduct' }], 'NEGATIVE_NET');
  }
  await recordAuditLog({ action: 'PAYMENT_ADJUSTMENT_ADDED', entityType: 'PaymentLedger', entityId: ledger._id, after: { type, amount: ledger.amount, paymentId: existing.paymentId }, req });
  return successResponse(res, { payment: updated, ledger }, 'Financial adjustment applied successfully');
});

export const processPayment = ah(async (req, res) => {
  const v = new Validator(req.body)
    .oneOf('paymentMethod', ['BANK_TRANSFER', 'DIRECT_DEPOSIT', 'UPI', 'CHECK', 'OTHER'], { defaultValue: 'BANK_TRANSFER' })
    .string('paymentReference', { required: true, min: 4, max: 100, pattern: /^[A-Za-z0-9][A-Za-z0-9\-_/.]+$/, patternMessage: 'Reference may contain letters, digits and - _ / .' })
    .string('notes', { max: 500 });
  const body = v.done();

  const existing = await Payment.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!existing) throw notFound('Payment not found');
  try {
    // Atomic claim: only ONE request can move PENDING -> PAID, so a double click can never pay twice.
    const paid = await Payment.findOneAndUpdate(
      { _id: existing._id, status: PAYMENT_STATUS.PENDING, netPayable: { $gt: 0 } },
      [{ $set: { status: PAYMENT_STATUS.PAID, paidAmount: '$netPayable', paymentMethod: body.paymentMethod, paymentReference: body.paymentReference, paidAt: '$$NOW', approvedBy: req.userId, approvedAt: '$$NOW', ...(body.notes ? { notes: body.notes } : {}) } }],
      { new: true }
    );
    if (!paid) {
      // Re-read: `existing` predates the claim, so a concurrent winner must be reported as ALREADY_PAID.
      const current = await Payment.findById(existing._id);
      if (current.status === PAYMENT_STATUS.PAID) throw conflict('Payment has already been processed.', 'ALREADY_PAID');
      if (current.status !== PAYMENT_STATUS.PENDING) throw conflict(`A ${current.status} payment cannot be disbursed.`, 'INVALID_TRANSITION');
      throw unprocessable('There is nothing to pay: the net payable is 0. Cancel or waive the payment instead.', [{ field: 'netPayable', message: 'Net payable is 0' }], 'ZERO_PAYABLE');
    }
    const intern = await Intern.findById(paid.internId).select('userId');
    if (intern) await createNotification({ organizationId: req.organizationId, recipientId: intern.userId, type: 'STIPEND_PAID', title: 'Stipend paid', message: `Your stipend for ${paid.cycle} (${paid.currency} ${paid.paidAmount}) was disbursed.`, entityType: 'Payment', entityId: paid._id });
    await recordAuditLog({ action: 'PAYMENT_DISBURSED', entityType: 'Payment', entityId: paid._id, after: { paymentId: paid.paymentId, paidAmount: paid.paidAmount, paymentReference: body.paymentReference }, req });
    return successResponse(res, paid, 'Payment processed and disbursed successfully');
  } catch (err) {
    if (err?.code === 11000) throw conflict('This payment reference has already been used for another payment.', 'DUPLICATE_REFERENCE');
    throw err;
  }
});

// Hold / release / cancel / waive. PAID is only reachable through processPayment.
export const changePaymentStatus = ah(async (req, res) => {
  const v = new Validator(req.body).oneOf('status', [PAYMENT_STATUS.ON_HOLD, PAYMENT_STATUS.PENDING, PAYMENT_STATUS.CANCELLED, PAYMENT_STATUS.WAIVED], { required: true }).string('reason', { required: true, min: 3, max: 300 });
  const { status, reason } = v.done();
  const payment = await Payment.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!payment) throw notFound('Payment not found');
  assertTransition('payment', PAYMENT_TRANSITIONS, payment.status, status);
  const updated = await Payment.findOneAndUpdate({ _id: payment._id, status: payment.status }, { $set: { status, notes: `${status}: ${reason}` } }, { new: true });
  if (!updated) throw conflict('The payment changed while you were updating it.', 'STATE_CHANGED');
  await recordAuditLog({ action: `PAYMENT_${status}`, entityType: 'Payment', entityId: payment._id, before: { status: payment.status }, after: { status, reason }, req });
  return successResponse(res, updated, `Payment marked ${status}`);
});

export const getInternFinancialSummary = ah(async (req, res) => {
  let intern;
  if (isObjectId(req.query.internId) && req.can('finance.read')) intern = await loadScopedIntern(req, req.query.internId);
  else intern = await getOwnIntern(req);
  const [payments, compensation] = await Promise.all([
    Payment.find({ internId: intern._id }).sort({ createdAt: -1 }),
    CompensationPlan.findOne({ internId: intern._id, isActive: true })
  ]);
  const totalEarned = round2(payments.reduce((s, p) => s + (p.status === PAYMENT_STATUS.PAID ? p.paidAmount : 0), 0));
  const pendingBalance = round2(payments.reduce((s, p) => s + (PAYMENT_MUTABLE_STATUSES.includes(p.status) ? p.netPayable : 0), 0));
  return successResponse(res, { internId: intern.internId, totalEarned, pendingBalance, currency: compensation?.currency || payments[0]?.currency || 'INR', compensationPlan: compensation, payments });
});

export const getFinanceSummary = ah(async (req, res) => {
  return successResponse(res, await totalsFor(matchFor(paymentQuery(req), req.organizationId)));
});

// Payslip: interns may download their OWN paid statements; finance staff may download any.
export const downloadPayslip = ah(async (req, res) => {
  const payment = await loadPaymentForViewer(req, req.params.id);
  const isOwn = [ROLES.INTERN, ROLES.INTERN_TRAINEE].includes(req.userRole) || !req.can('finance.read');
  if (isOwn && payment.status !== PAYMENT_STATUS.PAID) throw conflict('The payslip is available once the payment is disbursed.', 'NOT_PAID_YET');
  const [ledger, org] = await Promise.all([PaymentLedger.find({ paymentId: payment._id }).sort({ createdAt: 1 }), Organization.findById(req.organizationId)]);
  const money = (n) => `${payment.currency} ${Number(n).toFixed(2)}`;
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${payment.paymentId}-payslip.pdf"`);
  doc.pipe(res);
  doc.font('Helvetica-Bold').fontSize(16).text((org?.name || '').toUpperCase());
  doc.font('Helvetica').fontSize(10).fillColor('#64748b').text('STIPEND STATEMENT'); doc.moveDown();
  doc.fillColor('#0f172a').fontSize(10)
    .text(`Statement: ${payment.paymentId}`).text(`Intern: ${payment.internId?.userId?.firstName} ${payment.internId?.userId?.lastName} (${payment.internId?.internId})`)
    .text(`Cycle: ${payment.cycle} (${ymdInTz(payment.startDate, req.timezone)} to ${ymdInTz(payment.endDate, req.timezone)})`).text(`Status: ${payment.status}`);
  if (payment.paymentReference) doc.text(`Payment reference: ${payment.paymentReference}`);
  doc.moveDown().font('Helvetica-Bold').text('Attendance basis').font('Helvetica')
    .text(`Working days in cycle: ${payment.workingDays} | Active days: ${payment.activeDays} | Unpaid leave days: ${payment.lopDays} | Unexcused absences: ${payment.absentDays}`);
  doc.moveDown().font('Helvetica-Bold').text('Ledger').font('Helvetica');
  ledger.forEach(l => doc.text(`${l.type.padEnd(14)} ${money(l.amount).padStart(18)}   ${l.description}`));
  doc.moveDown().font('Helvetica-Bold').text(`Gross ${money(payment.grossAmount)}   Additions ${money(payment.totalAdditions)}   Deductions ${money(payment.totalDeductions)}`)
    .fontSize(12).text(`Net payable ${money(payment.netPayable)}`);
  doc.end();
});

export const handlePaymentWebhook = ah(async (req, res) => {
  const { providerPaymentId, amount, currency = 'INR', personId, metadata } = req.body;
  if (!providerPaymentId) throw unprocessable('providerPaymentId is required', [{ field: 'providerPaymentId', message: 'Required' }]);

  // Atomic idempotency check: if already processed, return 200 without creating a duplicate record or changing balances
  const existing = await PaymentTransaction.findOne({ providerPaymentId });
  if (existing) {
    return res.status(200).json({
      success: true,
      data: existing,
      message: 'Webhook already processed (idempotent)',
      idempotent: true
    });
  }

  const transaction = await PaymentTransaction.create({
    organizationId: req.organizationId || req.body.organizationId,
    transactionId: `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    providerPaymentId,
    personId: isObjectId(personId) ? personId : undefined,
    amount: Number(amount) || 0,
    currency,
    status: 'SUCCESS',
    provider: req.body.provider || 'RAZORPAY',
    metadata: metadata || {}
  });

  return res.status(200).json({
    success: true,
    data: transaction,
    message: 'Payment transaction recorded successfully',
    idempotent: false
  });
});



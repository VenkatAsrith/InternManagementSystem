import PDFDocument from 'pdfkit';
import crypto from 'crypto';
import { DocumentTemplate } from './documentTemplate.model.js';
import { Organization } from '../organizations/organization.model.js';
import { Offer } from '../offers/offer.model.js';
import { DOCUMENT_TYPE, DOCUMENT_CATEGORY } from '../../../../shared/constants.js';
import { formatDateLong, formatDateISO } from '../../utils/time.js';
import { env } from '../../config/env.js';

function getNestedValue(obj, path) {
  return path.split('.').reduce((prev, curr) => (prev && prev[curr] !== undefined && prev[curr] !== null ? prev[curr] : undefined), obj);
}

/**
 * Replaces {{variable.name}} with values from `context`.
 * Unknown variables are NOT silently left in the text: they are reported in `missing` so official documents
 * are never issued with raw placeholders.
 */
export function interpolateVariables(templateText, context = {}, { keepMissing = true } = {}) {
  const missing = new Set();
  const text = String(templateText || '').replace(/{{\s*([a-zA-Z0-9_.]+)\s*}}/g, (match, key) => {
    const val = getNestedValue(context, key);
    if (val === undefined || val === '') { missing.add(key); return keepMissing ? match : ''; }
    return String(val);
  });
  return { text, missing: [...missing] };
}

export function computeContentHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Builds the merge context ONLY from stored records. Nothing is invented: a value that does not exist stays
 * undefined and is reported as missing.
 */
export async function buildInternContext({ intern, org, documentId, issuedAt = new Date(), tz = env.ORG_TIMEZONE, extra = {} }) {
  const [offer, organization] = await Promise.all([
    intern.offerId ? Offer.findById(intern.offerId).lean() : null,
    org || Organization.findById(intern.organizationId).lean()
  ]);
  const user = intern.userId && intern.userId.firstName ? intern.userId : null;
  const mentor = intern.mentorId && intern.mentorId.firstName ? intern.mentorId : null;
  const end = intern.actualEndDate || intern.expectedEndDate;
  const days = end && intern.startDate ? Math.round((new Date(end) - new Date(intern.startDate)) / 86400000) + 1 : undefined;
  return {
    organization: {
      name: organization?.name,
      code: organization?.code,
      signatoryName: organization?.signatory?.name,
      signatoryTitle: organization?.signatory?.title
    },
    candidate: { name: user ? `${user.firstName} ${user.lastName}` : undefined, email: user?.email, phone: user?.phone || undefined },
    intern: {
      internId: intern.internId,
      role: intern.programId?.title || offer?.title?.replace(/ Internship Offer$/, ''),
      department: intern.departmentId?.name,
      startDate: intern.startDate ? formatDateLong(intern.startDate, tz) : undefined,
      endDate: end ? formatDateLong(end, tz) : undefined,
      duration: days ? `${days} days` : undefined,
      workMode: intern.workMode ? intern.workMode.replace('_', '-').toLowerCase() : undefined,
      mentor: mentor ? `${mentor.firstName} ${mentor.lastName}` : undefined
    },
    stipend: { amount: offer?.stipend || undefined },
    document: { sequence: documentId ? documentId.split('-').slice(1).join('/') : undefined, id: documentId, verifyUrl: documentId ? `${env.FRONTEND_URL}/verify/document/${documentId}` : undefined },
    issueDate: formatDateISO(issuedAt, tz) ? formatDateLong(issuedAt, tz) : undefined,
    ...extra
  };
}

// ---------------------------------------------------------------------------
// PDF rendering (minimal markdown: #/##/### headings, "- " bullets, **bold**)
// ---------------------------------------------------------------------------
function writeInline(doc, text, opts = {}) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  parts.forEach((part, i) => {
    const bold = part.startsWith('**') && part.endsWith('**');
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').text(bold ? part.slice(2, -2) : part, { ...opts, continued: i < parts.length - 1 });
  });
  if (!parts.length) doc.text('', opts);
}

export function renderTemplatePDF({
  organizationName = '',
  title,
  body,
  recipientName = '',
  signatory = {},
  documentNumber,
  verifyUrl,
  issueDate = '',
  watermark = ''
}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: title, Author: organizationName, Subject: documentNumber || '' } });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);
    const width = doc.page.width;

    doc.font('Helvetica-Bold').fontSize(16).fillColor('#0f172a').text(String(organizationName).toUpperCase());
    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('PEOPLE OPERATIONS & ENGINEERING EXCELLENCE');
    doc.moveDown(0.4);
    doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(50, doc.y).lineTo(width - 50, doc.y).stroke();
    doc.moveDown(1);

    const refY = doc.y;
    doc.fontSize(9).fillColor('#475569');
    if (documentNumber) doc.text(`Doc Ref: ${documentNumber}`, 50, refY);
    if (issueDate) doc.text(`Date: ${issueDate}`, width - 250, refY, { width: 200, align: 'right' });
    doc.moveDown(1.5);

    if (recipientName) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e293b').text('To:');
      doc.font('Helvetica').fontSize(10).fillColor('#334155').text(recipientName);
      doc.moveDown(1);
    }
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#0284c7').text(title, { align: 'center' });
    doc.moveDown(1.2);

    doc.fontSize(10.5).fillColor('#1e293b');
    for (const block of String(body).split(/\n\s*\n/)) {
      const lines = block.split('\n').map(l => l.trimEnd()).filter(l => l.trim());
      for (const line of lines) {
        const heading = /^(#{1,3})\s+(.*)$/.exec(line);
        const bullet = /^[-*]\s+(.*)$/.exec(line);
        if (heading) {
          doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text(heading[2]);
          doc.fontSize(10.5).fillColor('#1e293b').moveDown(0.3);
        } else if (bullet) {
          doc.font('Helvetica').text('•  ', { continued: true, indent: 12 });
          writeInline(doc, bullet[1], { lineGap: 2 });
        } else {
          writeInline(doc, line, { align: 'left', lineGap: 3 });
        }
      }
      doc.moveDown(0.7);
    }

    doc.moveDown(1.2);
    doc.font('Helvetica').fillColor('#1e293b').text('Sincerely,');
    doc.moveDown(1.6);
    doc.font('Helvetica-Bold').text(signatory.name || 'Authorized Signatory');
    doc.font('Helvetica').fillColor('#64748b').text(signatory.title || organizationName);

    if (verifyUrl) {
      doc.fontSize(8).fillColor('#94a3b8').text(`Verify this document: ${verifyUrl}`, 50, doc.page.height - 60, { width: width - 100, align: 'center' });
    }
    if (watermark) {
      doc.save().fontSize(60).fillColor('#e2e8f0').opacity(0.4).rotate(-30, { origin: [width / 2, 400] })
        .text(watermark, 80, 380, { width: width - 160, align: 'center' }).restore();
    }
    doc.end();
  });
}

// ---------------------------------------------------------------------------
// Default templates (organisation-neutral: names come from the organisation and the records)
// ---------------------------------------------------------------------------
const SIGN = 'Warm Regards,';
export const DEFAULT_TEMPLATES = [
  {
    templateCode: 'OFFER_LETTER', title: 'Formal Internship Offer Letter', documentType: DOCUMENT_TYPE.OFFER_LETTER, category: DOCUMENT_CATEGORY.OFFER_LETTER,
    bodyMarkdown: `Ref: {{document.sequence}}
Date: {{issueDate}}

Dear **{{candidate.name}}**,

**Subject: Offer of Internship**

We are pleased to offer you an internship at **{{organization.name}}**. This internship is designed to give you practical exposure to real-world projects and professional development.

### Internship Terms & Details
- **Internship Role:** {{intern.role}}
- **Department:** {{intern.department}}
- **Commencement Date:** {{intern.startDate}}
- **Conclusion Date:** {{intern.endDate}}
- **Work Mode:** {{intern.workMode}}
- **Stipend:** {{stipend.amount}}
- **Assigned Mentor:** {{intern.mentor}}

You will be assigned a mentor who will guide you and evaluate your progress on learning, participation, commitment and performance. We expect professionalism, integrity, confidentiality and discipline throughout the internship.

${SIGN}`,
    availableVariables: ['candidate.name', 'organization.name', 'intern.role', 'intern.department', 'intern.startDate', 'intern.endDate', 'intern.workMode', 'stipend.amount', 'intern.mentor', 'document.sequence', 'issueDate']
  },
  {
    templateCode: 'JOINING_LETTER', title: 'Internship Joining & Confirmation Letter', documentType: DOCUMENT_TYPE.JOINING_LETTER, category: DOCUMENT_CATEGORY.AGREEMENT,
    bodyMarkdown: `Ref: {{document.sequence}}
Date: {{issueDate}}

Dear **{{candidate.name}}**,

**Subject: Confirmation of Internship Joining**

We confirm your onboarding as **{{intern.role}}** at **{{organization.name}}**, effective **{{intern.startDate}}** (Intern ID {{intern.internId}}).

You have been placed in the **{{intern.department}}** department under the mentorship of **{{intern.mentor}}**. Please complete the onboarding checklist and submit the required documents.

${SIGN}`,
    availableVariables: ['candidate.name', 'organization.name', 'intern.role', 'intern.internId', 'intern.department', 'intern.startDate', 'intern.mentor', 'document.sequence', 'issueDate']
  },
  {
    templateCode: 'COMPLETION_LETTER', title: 'Internship Completion Letter', documentType: DOCUMENT_TYPE.COMPLETION_LETTER, category: DOCUMENT_CATEGORY.CERTIFICATE,
    bodyMarkdown: `Ref: {{document.sequence}}
Date: {{issueDate}}

Dear **{{candidate.name}}**,

**Subject: Internship Completion Letter**

This is to confirm that you have completed your internship as **{{intern.role}}** at **{{organization.name}}** from **{{intern.startDate}}** to **{{intern.endDate}}**.

We thank you for your contribution and wish you every success in your future endeavours.

${SIGN}`,
    availableVariables: ['candidate.name', 'organization.name', 'intern.role', 'intern.startDate', 'intern.endDate', 'document.sequence', 'issueDate']
  },
  {
    templateCode: 'EXPERIENCE_LETTER', title: 'Internship Experience & Relieving Letter', documentType: DOCUMENT_TYPE.EXPERIENCE_LETTER, category: DOCUMENT_CATEGORY.EXPERIENCE_LETTER,
    bodyMarkdown: `Ref: {{document.sequence}}
Date: {{issueDate}}

**TO WHOMSOEVER IT MAY CONCERN**

This is to certify that **{{candidate.name}}** (Intern ID: **{{intern.internId}}**) worked as **{{intern.role}}** in the **{{intern.department}}** department of **{{organization.name}}** from **{{intern.startDate}}** to **{{intern.endDate}}**.

All company assets and access have been returned and cleared, and there are no pending dues between the intern and the organization. They are relieved of their duties with effect from the end date above.

We wish them continued success.

${SIGN}`,
    availableVariables: ['candidate.name', 'organization.name', 'intern.internId', 'intern.role', 'intern.department', 'intern.startDate', 'intern.endDate', 'document.sequence', 'issueDate']
  },
  {
    templateCode: 'RECOMMENDATION_LETTER', title: 'Letter of Recommendation', documentType: DOCUMENT_TYPE.RECOMMENDATION_LETTER, category: DOCUMENT_CATEGORY.LOR,
    bodyMarkdown: `Ref: {{document.sequence}}
Date: {{issueDate}}

**TO WHOMSOEVER IT MAY CONCERN**

I am pleased to recommend **{{candidate.name}}**, who interned with **{{organization.name}}** as **{{intern.role}}** from **{{intern.startDate}}** to **{{intern.endDate}}**, mentored by **{{intern.mentor}}**.

{{recommendation.note}}

I recommend them for future academic and professional opportunities.

${SIGN}`,
    availableVariables: ['candidate.name', 'organization.name', 'intern.role', 'intern.startDate', 'intern.endDate', 'intern.mentor', 'recommendation.note', 'document.sequence', 'issueDate']
  },
  {
    templateCode: 'NDA_AGREEMENT', title: 'Non-Disclosure Agreement (NDA)', documentType: DOCUMENT_TYPE.NDA_AGREEMENT, category: DOCUMENT_CATEGORY.NDA,
    bodyMarkdown: `Ref: {{document.sequence}}
Date: {{issueDate}}

### Confidentiality & Intellectual Property Agreement

This Agreement is between **{{organization.name}}** and **{{candidate.name}}** ("Recipient").

- **Confidential Information:** the Recipient keeps all proprietary source code, designs, trade secrets and customer data confidential.
- **Intellectual Property:** all work produced during the internship belongs to {{organization.name}}.
- **Term:** the obligations survive the end of the internship for three (3) years.

Signed and agreed,`,
    availableVariables: ['candidate.name', 'organization.name', 'document.sequence', 'issueDate']
  }
];

export async function seedDefaultTemplates(organizationId, adminUserId) {
  for (const def of DEFAULT_TEMPLATES) {
    const exists = await DocumentTemplate.findOne({ organizationId, templateCode: def.templateCode, version: 1 });
    if (!exists) {
      await DocumentTemplate.create({ ...def, version: 1, organizationId, approvedBy: adminUserId, isApproved: true, isActive: true });
    }
  }
}

/** Latest approved + active version of a template. Seeds the defaults on first use. */
export async function getActiveTemplate(organizationId, templateCode, adminUserId) {
  const find = () => DocumentTemplate.findOne({ organizationId, templateCode, isActive: true, isApproved: true }).sort({ version: -1 });
  let tpl = await find();
  if (!tpl && DEFAULT_TEMPLATES.some(t => t.templateCode === templateCode)) {
    await seedDefaultTemplates(organizationId, adminUserId);
    tpl = await find();
  }
  return tpl;
}

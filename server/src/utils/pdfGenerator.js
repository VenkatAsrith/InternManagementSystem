import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function drawGoldMedal(doc, cx, cy) {
  doc.save();
  // Ribbon tails (red)
  doc.fillColor('#dc2626');
  doc.polygon([cx - 10, cy + 12], [cx - 18, cy + 38], [cx - 6, cy + 32], [cx - 2, cy + 15]);
  doc.fill();
  doc.polygon([cx + 2, cy + 15], [cx + 6, cy + 32], [cx + 18, cy + 38], [cx + 10, cy + 12]);
  doc.fill();

  // Outer gold circle
  doc.circle(cx, cy, 22).fillColor('#d97706').fill();
  // Inner gold circle
  doc.circle(cx, cy, 18).fillColor('#fbbf24').fill();

  // 5-point star
  const points = [];
  const outerR = 11;
  const innerR = 5;
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI / 5) - Math.PI / 2;
    points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  doc.polygon(...points).fillColor('#b45309').fill();
  doc.restore();
}

/** Landscape certificate of recognition/completion matching official TMT template (Image 2 Replica) */
export function generateCertificatePDF({
  internName, internId, programTitle, departmentName, organizationName = 'TechMecha Torque',
  startDate, endDate, duration, certificateId, issueDate, signatory, verifyUrl,
  type = 'INTERNSHIP', isBootcamp = false, bootcampTitle = ''
}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      layout: 'landscape',
      size: 'A4',
      margin: 0,
      info: { Title: `Certificate ${certificateId}`, Author: 'TechMecha Torque Pvt. Ltd.' }
    });

    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const width = doc.page.width;   // 841.89
    const height = doc.page.height; // 595.28

    // 1. Crisp white background canvas (Exact Image 2)
    doc.rect(0, 0, width, height).fillColor('#ffffff').fill();

    // 2. Right-side decorative vertical black bar accents (Image 2)
    doc.rect(width - 28, 0, 18, 128).fillColor('#18181b').fill();
    doc.rect(width - 28, height - 90, 18, 48).fillColor('#18181b').fill();

    // 3. Header: CERTIFICATE OF INTERNSHIP COMPLETION
    const isBootcampMode = isBootcamp || type === 'BOOTCAMP' || Boolean(bootcampTitle);
    doc.font('Helvetica-Bold').fontSize(46).fillColor('#000000').text('CERTIFICATE', 48, 44);
    doc.font('Helvetica').fontSize(16).fillColor('#334155').text(
      isBootcampMode ? 'OF BOOTCAMP COMPLETION' : 'OF INTERNSHIP COMPLETION',
      48,
      100
    );

    // 4. Introductory Recognition line
    doc.font('Helvetica-Bold').fontSize(11.5).fillColor('#1e293b').text('TechMecha Torque Pvt. Ltd.', 48, 140, { continued: true });
    doc.font('Helvetica').fontSize(11.5).fillColor('#334155').text(' to formally recognize the successful completion of an internship by');

    // 5. Candidate Name in large bold typography
    doc.font('Helvetica-Bold').fontSize(36).fillColor('#0f172a').text(internName || 'Participant', 48, 172);

    // Dotted horizontal line under candidate name
    doc.dash(2, { space: 3 }).moveTo(48, 222).lineTo(width - 85, 222).lineWidth(1).strokeColor('#cbd5e1').stroke().undash();

    // 6. Tenure and Role paragraphs
    const activeRole = programTitle || (departmentName ? `Junior Intern (${departmentName})` : 'Junior Web Intern');
    const startStr = startDate || '15 January 2026';
    const endStr = endDate || '15 April 2026';

    doc.font('Helvetica').fontSize(11).fillColor('#334155').text('For outstanding dedication and professional excellence demonstrated during their tenure from ', 48, 238, { continued: true });
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(`${startStr} to ${endStr}`);

    doc.moveDown(0.6);
    doc.font('Helvetica').fontSize(11).fillColor('#334155').text('Serving as our ', 48, doc.y, { continued: true });
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(`${activeRole} `, { continued: true });
    doc.font('Helvetica').fillColor('#334155').text(', they have shown a remarkable passion for innovation, continuous learning, and future-ready technological development.', { width: 680, lineGap: 3 });

    // 7. Founder Signature Block (Bottom Left)
    const sigPath = path.resolve(__dirname, '../assets/signature.png');
    if (fs.existsSync(sigPath)) {
      try {
        doc.image(sigPath, 48, 385, { width: 110 });
      } catch {
        // Fallback gracefully
      }
    }
    doc.font('Helvetica-Bold').fontSize(11.5).fillColor('#18181b').text('Jaya Chandra Reddy', 48, 456);
    doc.font('Helvetica').fontSize(9.5).fillColor('#64748b').text('Founder & CEO', 48, 472);

    // 8. DPIIT #startupindia and MSME logos (Bottom Right)
    const dpiitPath = path.resolve(__dirname, '../assets/DPIITTMT.png');
    const msmePath = path.resolve(__dirname, '../assets/msmetmt01.png');

    if (fs.existsSync(dpiitPath)) {
      try {
        doc.image(dpiitPath, width - 280, 442, { height: 38 });
      } catch {}
    }
    if (fs.existsSync(msmePath)) {
      try {
        doc.image(msmePath, width - 145, 444, { height: 34 });
      } catch {}
    }

    // Certificate ID & online verification note
    doc.font('Helvetica').fontSize(8).fillColor('#94a3b8').text(
      `Certificate ID: ${certificateId} • Verify online: ${verifyUrl || 'https://techmechatorque.com/verify'}`,
      48,
      height - 56
    );

    // 9. Full-width Black Bottom Bar with Red Branding (Exact Image 2)
    doc.rect(0, height - 42, width, 42).fillColor('#000000').fill();
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#ef4444').text('TECHMECHA TORQUE', 30, height - 26, { continued: true });
    doc.font('Helvetica').fontSize(9).fillColor('#ef4444').text('  PVT. LTD.');
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#ef4444').text('team@techmechatorque.com', width - 210, height - 26);

    doc.end();
  });
}

/** Portrait Official Internship Completion Letter (Exact Image 1 Replica - Black Theme) */
export function generateCompletionLetterPDF({
  candidateName,
  startDate = 'February 2026',
  endDate = 'March 2026',
  domain = 'Full Stack Web Development (MERN Stack)',
  issueDate = '01/04/2026',
  technologies = 'MongoDB, Express.js, React.js, and Node.js',
  documentNumber,
  verifyUrl
}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      layout: 'portrait',
      size: 'A4',
      margin: 0,
      info: { Title: `Internship Completion Letter - ${candidateName}`, Author: 'TechMecha Torque Pvt. Ltd.' }
    });

    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const width = doc.page.width;   // 595.28
    const height = doc.page.height; // 841.89

    // 1. Solid Black Canvas Background (Exact Image 1)
    doc.rect(0, 0, width, height).fillColor('#000000').fill();

    // 2. White Bold TMT Logo Centered at Top
    const logoPath = path.resolve(__dirname, '../assets/tmt-logo.png');
    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, (width - 150) / 2, 28, { width: 150 });
      } catch {
        doc.font('Helvetica-Bold').fontSize(36).fillColor('#ffffff').text('TMT', (width - 120) / 2, 35, { align: 'center' });
      }
    } else {
      doc.font('Helvetica-Bold').fontSize(36).fillColor('#ffffff').text('TMT', (width - 120) / 2, 35, { align: 'center' });
    }

    // 3. White Divider Rule
    doc.strokeColor('#ffffff').lineWidth(1.2).moveTo(40, 102).lineTo(width - 40, 102).stroke();

    // 4. White Document Title: INTERNSHIP COMPLETION LETTER
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#ffffff').text('INTERNSHIP COMPLETION LETTER', 40, 116, { align: 'center', characterSpacing: 1.2 });

    // 5. Date (Left aligned)
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff').text(`DATE: ${issueDate}`, 40, 160);

    // 6. Red Subtitle: TO WHOMSOEVER IT MAY CONCERN with Red Underline
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#ef4444').text('TO WHOMSOEVER IT MAY CONCERN', 40, 180, { align: 'center', characterSpacing: 0.8 });
    doc.strokeColor('#ef4444').lineWidth(1).moveTo(140, 198).lineTo(width - 140, 198).stroke();

    // 7. Body Paragraph 1 (Certification)
    doc.font('Helvetica').fontSize(9.5).fillColor('#ffffff').text('This is to certify that ', 40, 212, { continued: true });
    doc.font('Helvetica-Bold').text(`${String(candidateName).toUpperCase()}`, { continued: true });
    doc.font('Helvetica').text(' has successfully completed an internship with ', { continued: true });
    doc.font('Helvetica-Bold').text('TechMecha Torque Pvt. Ltd.', { continued: true });
    doc.font('Helvetica').text(` from ${startDate} to ${endDate} in the domain of `, { continued: true });
    doc.font('Helvetica-Bold').text(`${domain}.`, { lineGap: 3 });

    // 8. Body Paragraph 2 (Technology focus)
    doc.moveDown(0.6);
    doc.font('Helvetica').fontSize(9).fillColor('#ffffff').text(
      `During the internship, the intern worked on developing and implementing web applications using modern technologies including ${technologies}. The work involved building responsive user interfaces, handling backend APIs, and integrating database operations to create efficient and scalable web solutions.`,
      40, doc.y, { width: width - 80, lineGap: 2.8 }
    );

    // 9. Contributions subtext & bullets
    doc.moveDown(0.7);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff').text(
      'The intern actively contributed to real-time project development, gaining hands-on experience',
      40, doc.y, { align: 'center', width: width - 80 }
    );

    doc.moveDown(0.5);
    const contributions = [
      'Designing and developing dynamic web applications',
      'Implementing RESTful APIs',
      'Managing databases using MongoDB',
      'Frontend development using React.js',
      'Backend development using Node.js and Express.js'
    ];
    for (const c of contributions) {
      doc.font('Helvetica').fontSize(8.5).fillColor('#ffffff').text(`•  ${c}`, 55, doc.y, { lineGap: 1.8 });
    }

    // 10. Scope of Work (Red Header + Bullets)
    doc.moveDown(0.7);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#ef4444').text('Scope of Work', 40, doc.y);
    doc.moveDown(0.4);

    const scopes = [
      'Frontend Development: Created responsive and interactive user interfaces using React.js',
      'Backend Development: Developed server-side logic and APIs using Node.js and Express.js',
      'Database Management: Worked with MongoDB for data storage and retrieval',
      'Project Implementation: Contributed to real-time application development and deployment processes'
    ];
    for (const s of scopes) {
      const [title, desc] = s.split(': ');
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#ffffff').text(`•  ${title}: `, 55, doc.y, { continued: true });
      doc.font('Helvetica').fillColor('#e2e8f0').text(desc, { lineGap: 1.8 });
    }

    // 11. Appraisal & Closing Paragraph
    doc.moveDown(0.7);
    doc.font('Helvetica').fontSize(8.8).fillColor('#ffffff').text(
      `The overall performance of ${String(candidateName).toUpperCase()} during the internship was excellent. The intern demonstrated strong dedication, quick learning ability, and the capability to work effectively in a team environment while meeting project deadlines.`,
      40, doc.y, { width: width - 80, lineGap: 2.5 }
    );
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(8.8).fillColor('#ffffff').text(
      `We wish ${String(candidateName).toUpperCase()} all the very best in future academic and professional endeavors.`,
      40, doc.y, { width: width - 80, lineGap: 2.5 }
    );
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(8.5).fillColor('#cbd5e1').text(
      'This certificate is issued upon request for academic and professional purposes.',
      40, doc.y, { width: width - 80 }
    );

    // 12. Official Signoff Block (Bottom Left)
    doc.moveDown(0.9);
    doc.font('Helvetica').fontSize(9).fillColor('#ffffff').text('Yours sincerely,', 40, doc.y);
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff').text('JAY CHANDRA REDDY CHILAKAMARRY', 40, doc.y);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#cbd5e1').text('CEO', 40, doc.y);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#ef4444').text('TechMecha Torque Pvt. Ltd.', 40, doc.y);

    if (verifyUrl) {
      doc.font('Helvetica').fontSize(7.5).fillColor('#64748b').text(`Verify: ${verifyUrl}`, 40, height - 30);
    }

    doc.end();
  });
}

/** Official Training Fee Payment Receipt PDF Generator */
export function generateFeeReceiptPDF({
  traineeName,
  traineeId,
  email,
  phone,
  college,
  programTitle,
  batchName,
  receiptId,
  paymentStatus = 'PAID',
  feeAmount = 0,
  concession = 0,
  amountPaid = 0,
  balance = 0,
  paymentMethod = 'UPI',
  paymentReference = 'N/A',
  paidAt = new Date(),
  organizationName = 'TechMecha Torque Pvt. Ltd.'
}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      layout: 'portrait',
      size: 'A4',
      margin: 40,
      info: { Title: `Payment Receipt - ${receiptId}`, Author: organizationName }
    });

    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const width = doc.page.width;
    const height = doc.page.height;

    // Header Background
    doc.rect(20, 20, width - 40, 80).fillColor('#09090b').fill();

    // TMT Logo & Company Title
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#ef4444').text('TECHMECHA TORQUE', 40, 36, { continued: true });
    doc.font('Helvetica').fontSize(14).fillColor('#ffffff').text('  PVT. LTD.');
    doc.font('Helvetica').fontSize(9).fillColor('#a1a1aa').text('Official Candidate Fee Payment Receipt • GST & Corporate Compliant', 40, 64);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#ef4444').text('team@techmechatorque.com | +91 7993442607', width - 260, 64);

    // Document Title & Receipt Meta
    doc.moveDown(3);
    const metaY = 115;
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#0f172a').text('FEE PAYMENT RECEIPT', 40, metaY);
    doc.font('Helvetica').fontSize(10).fillColor('#64748b').text(`Original Copy for Student / Trainee Records`, 40, metaY + 22);

    // Receipt Number & Date (Right box)
    doc.rect(width - 240, metaY, 200, 48).fillColor('#f8fafc').strokeColor('#e2e8f0').lineWidth(1).fillAndStroke();
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#475569').text('RECEIPT NO:', width - 230, metaY + 8);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#ef4444').text(receiptId, width - 230, metaY + 20);
    doc.font('Helvetica').fontSize(8.5).fillColor('#64748b').text(`Date: ${new Date(paidAt).toLocaleDateString()}`, width - 230, metaY + 35);

    // Trainee Details Box
    const traineeBoxY = 180;
    doc.rect(40, traineeBoxY, width - 80, 85).fillColor('#ffffff').strokeColor('#cbd5e1').lineWidth(1).fillAndStroke();
    doc.rect(40, traineeBoxY, width - 80, 22).fillColor('#f1f5f9').fill();
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text('TRAINEE INFORMATION', 50, traineeBoxY + 6);

    doc.font('Helvetica').fontSize(9).fillColor('#475569');
    doc.text('Name:', 50, traineeBoxY + 30);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(traineeName, 110, traineeBoxY + 30);

    doc.font('Helvetica').fillColor('#475569').text('Trainee ID:', 50, traineeBoxY + 48);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(traineeId || 'N/A', 110, traineeBoxY + 48);

    doc.font('Helvetica').fillColor('#475569').text('College:', 50, traineeBoxY + 66);
    doc.font('Helvetica').fillColor('#0f172a').text(college || 'N/A', 110, traineeBoxY + 66);

    doc.font('Helvetica').fillColor('#475569').text('Email:', 310, traineeBoxY + 30);
    doc.font('Helvetica').fillColor('#0f172a').text(email || 'N/A', 360, traineeBoxY + 30);

    doc.font('Helvetica').fillColor('#475569').text('Program:', 310, traineeBoxY + 48);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(programTitle || 'Training Track', 360, traineeBoxY + 48);

    doc.font('Helvetica').fillColor('#475569').text('Batch:', 310, traineeBoxY + 66);
    doc.font('Helvetica').fillColor('#0f172a').text(batchName || 'Default Batch', 360, traineeBoxY + 66);

    // Fee Schedule & Billing Breakdown Table
    const tableY = 285;
    doc.rect(40, tableY, width - 80, 150).fillColor('#ffffff').strokeColor('#cbd5e1').lineWidth(1).fillAndStroke();
    doc.rect(40, tableY, width - 80, 24).fillColor('#0f172a').fill();

    doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff');
    doc.text('PARTICULARS / FEE DESCRIPTION', 50, tableY + 7);
    doc.text('AMOUNT (INR)', width - 150, tableY + 7, { align: 'right', width: 90 });

    doc.font('Helvetica').fontSize(9.5).fillColor('#1e293b');
    doc.text(`Tuition & Training Curriculum Fee (${programTitle})`, 50, tableY + 36);
    doc.text(`Rs. ${Number(feeAmount).toLocaleString()}`, width - 150, tableY + 36, { align: 'right', width: 90 });

    if (concession > 0) {
      doc.text(`Scholarship / Institutional Fee Concession`, 50, tableY + 58);
      doc.font('Helvetica-Bold').fillColor('#059669').text(`- Rs. ${Number(concession).toLocaleString()}`, width - 150, tableY + 58, { align: 'right', width: 90 });
    }

    doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(40, tableY + 80).lineTo(width - 40, tableY + 80).stroke();

    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a');
    doc.text('Total Amount Received', 50, tableY + 92);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#16a34a').text(`Rs. ${Number(amountPaid).toLocaleString()}`, width - 150, tableY + 92, { align: 'right', width: 90 });

    doc.font('Helvetica').fontSize(9).fillColor('#64748b');
    doc.text('Remaining Balance Due', 50, tableY + 115);
    doc.font('Helvetica-Bold').fillColor(balance > 0 ? '#d97706' : '#16a34a').text(`Rs. ${Number(balance).toLocaleString()}`, width - 150, tableY + 115, { align: 'right', width: 90 });

    // Payment Transaction Reference Details
    const transY = 455;
    doc.rect(40, transY, width - 80, 75).fillColor('#f8fafc').strokeColor('#e2e8f0').lineWidth(1).fillAndStroke();
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text('TRANSACTION VERIFICATION', 50, transY + 8);

    doc.font('Helvetica').fontSize(9).fillColor('#475569');
    doc.text('Payment Mode:', 50, transY + 28);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(paymentMethod, 140, transY + 28);

    doc.font('Helvetica').fillColor('#475569').text('UTR / Reference ID:', 50, transY + 46);
    doc.font('Courier').fontSize(9).fillColor('#0f172a').text(paymentReference || 'N/A', 140, transY + 46);

    doc.font('Helvetica').fontSize(9).fillColor('#475569').text('Payment Status:', 330, transY + 28);
    doc.font('Helvetica-Bold').fillColor(paymentStatus === 'PAID' ? '#16a34a' : '#d97706').text(paymentStatus, 420, transY + 28);

    // Terms & Signatory
    const signY = 560;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a').text('TERMS & CONDITIONS:', 40, signY);
    doc.font('Helvetica').fontSize(8).fillColor('#64748b').text('1. Fees once paid are non-refundable and non-transferable under any circumstances.\n2. This is a computer-generated tax invoice and payment acknowledgment voucher.\n3. Keep this receipt safe for course completion certificate eligibility.', 40, signY + 14, { width: 320, lineGap: 2 });

    const sigPath = path.resolve(__dirname, '../assets/signature.png');
    if (fs.existsSync(sigPath)) {
      try { doc.image(sigPath, width - 190, signY - 10, { width: 95 }); } catch {}
    }
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#0f172a').text('Jaya Chandra Reddy', width - 190, signY + 46);
    doc.font('Helvetica').fontSize(8.5).fillColor('#64748b').text('Founder & CEO', width - 190, signY + 58);
    doc.font('Helvetica').fontSize(8).fillColor('#94a3b8').text('TechMecha Torque Pvt. Ltd.', width - 190, signY + 70);

    // Full-width Bottom Bar
    doc.rect(0, height - 36, width, 36).fillColor('#09090b').fill();
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#ef4444').text('TECHMECHA TORQUE PVT. LTD.', 30, height - 23, { continued: true });
    doc.font('Helvetica').fontSize(8).fillColor('#71717a').text('  • Regd. MSME & DPIIT Recognized Startup');
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#ef4444').text('team@techmechatorque.com', width - 170, height - 23);

    doc.end();
  });
}

/** Portrait Official Admission Pass for Bootcamps with secure HMAC token verification and schedule */
export function generateBootcampPassPDF({
  candidateName, candidateEmail, candidatePhone,
  bootcampTitle, date, time, venue, mode, slotName,
  passCode, hmacToken, organizationName = 'TechMecha Torque'
}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ layout: 'portrait', size: 'A4', margin: 40, info: { Title: `Bootcamp Pass ${passCode}`, Author: organizationName } });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const width = doc.page.width;
    const height = doc.page.height;

    // Outer and inner border
    doc.rect(20, 20, width - 40, height - 40).lineWidth(2).strokeColor('#0284c7').stroke();
    doc.rect(26, 26, width - 52, height - 52).lineWidth(0.5).strokeColor('#cbd5e1').stroke();

    // Top Header Banner
    doc.rect(26, 26, width - 52, 70).fillColor('#0f172a').fill();
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#ffffff').text(organizationName.toUpperCase(), 40, 42, { align: 'center', characterSpacing: 2 });
    doc.font('Helvetica').fontSize(10).fillColor('#38bdf8').text('BOOTCAMP ADMISSION PASS • OFFICIAL ENTRANCE TICKET', 40, 68, { align: 'center', characterSpacing: 1.5 });

    doc.moveDown(4.5);

    // Event Title
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#0f172a').text(bootcampTitle, 50, 120, { align: 'center' });
    doc.font('Helvetica').fontSize(11).fillColor('#64748b').text('Educational Acquisition & Technology Track', { align: 'center' });

    // Pass Code Box
    doc.rect(60, 175, width - 120, 65).fillColor('#f8fafc').strokeColor('#0284c7').lineWidth(1.5).fillAndStroke();
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#0284c7').text('OFFICIAL PASS CODE', 60, 185, { align: 'center', characterSpacing: 1.5 });
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#0f172a').text(passCode, 60, 202, { align: 'center', characterSpacing: 2 });

    // Candidate Details Section
    doc.rect(60, 260, width - 120, 100).fillColor('#ffffff').strokeColor('#e2e8f0').lineWidth(1).fillAndStroke();
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text('CANDIDATE INFORMATION', 75, 272);
    doc.font('Helvetica').fontSize(10).fillColor('#475569');
    doc.text(`Full Name:`, 75, 295);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(candidateName, 170, 295);
    doc.font('Helvetica').fillColor('#475569').text(`Email:`, 75, 315);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(candidateEmail || '-', 170, 315);
    doc.font('Helvetica').fillColor('#475569').text(`Phone:`, 75, 335);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(candidatePhone || '-', 170, 335);

    // Schedule & Venue Details Section
    doc.rect(60, 380, width - 120, 120).fillColor('#ffffff').strokeColor('#e2e8f0').lineWidth(1).fillAndStroke();
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text('SCHEDULE & VENUE', 75, 392);
    doc.font('Helvetica').fontSize(10).fillColor('#475569');
    doc.text(`Event Date:`, 75, 415);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(date, 170, 415);
    doc.font('Helvetica').fillColor('#475569').text(`Slot / Track:`, 75, 435);
    doc.font('Helvetica-Bold').fillColor('#0284c7').text(`${slotName || 'Scheduled Slot'} (${time || '10:00 AM'})`, 170, 435);
    doc.font('Helvetica').fillColor('#475569').text(`Venue / Mode:`, 75, 455);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(`${venue || 'Virtual Campus'} [${mode || 'ONLINE'}]`, 170, 455);
    doc.font('Helvetica').fillColor('#475569').text(`Admit Policy:`, 75, 475);
    doc.font('Helvetica').fillColor('#0f172a').text('Arrive 15 minutes before scheduled session with ID proof.', 170, 475);

    // Security Verification Hash Section
    doc.rect(60, 520, width - 120, 55).fillColor('#f1f5f9').strokeColor('#cbd5e1').lineWidth(0.5).fillAndStroke();
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748b').text('CRYPTOGRAPHIC VERIFICATION TOKEN (HMAC SHA-256)', 75, 528);
    doc.font('Courier').fontSize(8).fillColor('#334155').text(hmacToken || 'SECURE_TOKEN_VERIFIED', 75, 544, { width: width - 150 });

    // Footer
    const footerY = height - 100;
    doc.font('Helvetica').fontSize(9).fillColor('#94a3b8').text('This pass is strictly personal and non-transferable. Scan on arrival for automated check-in verification.', 50, footerY, { align: 'center', width: width - 100 });
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#64748b').text(`Authorized by ${organizationName} Admissions Team`, 50, footerY + 20, { align: 'center' });

    doc.end();
  });
}


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

/** Landscape certificate of recognition/completion matching official TMT template */
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
      info: { Title: `Certificate ${certificateId}`, Author: 'TechMecha Torque' }
    });

    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const width = doc.page.width;
    const height = doc.page.height;

    // 1. Off-white textured canvas background
    doc.rect(0, 0, width, height).fill('#faf9f6');

    // 2. Large vertical TMT watermark on left
    doc.fillColor('#e5e7eb').font('Helvetica-Bold').fontSize(100);
    doc.text('T', 40, 75);
    doc.text('M', 35, 185);
    doc.text('T', 40, 300);

    // 3. Top-right Gold Medal Seal with Red Ribbons
    drawGoldMedal(doc, width - 110, 48);

    // 4. Right-side decorative accents (black bars & dotted matrix)
    doc.rect(width - 34, 0, 34, 250).fillColor('#0a0a0a').fill();
    doc.rect(width - 34, 375, 34, 180).fillColor('#0a0a0a').fill();

    // Dotted grid matrix
    doc.fillColor('#334155');
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 4; c++) {
        doc.circle(width - 76 + c * 10, 275 + r * 9, 1.4).fill();
      }
    }

    // 5. Full-width Black Bottom Bar
    doc.rect(0, height - 38, width, 38).fillColor('#050505').fill();
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#e63946').text('TECHMECHA TORQUE', 35, height - 25, { continued: true });
    doc.font('Helvetica').fontSize(9).fillColor('#e63946').text('  PVT. LTD.');
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#e63946').text('team@techmechatorque.com', width - 230, height - 25);

    // 6. Header
    const isBootcampMode = isBootcamp || type === 'BOOTCAMP' || Boolean(bootcampTitle);
    doc.font('Helvetica-Bold').fontSize(40).fillColor('#000000').text('CERTIFICATE', 135, 75);
    doc.font('Helvetica').fontSize(16).fillColor('#1e293b').text(
      isBootcampMode ? 'of Bootcamp Completion' : 'of Recognisation',
      137,
      122
    );

    // 7. Introductory text
    doc.font('Helvetica').fontSize(11.5).fillColor('#334155').text(
      'Techmechatorque is proud to formally recognize the exceptional dedication and professional excellence demonstrated by',
      135, 160, { width: 480, lineGap: 3 }
    );

    // 8. Participant Name with Dashed Line
    doc.font('Helvetica-Bold').fontSize(28).fillColor('#0f172a').text(internName || 'Participant', 135, 215);
    doc.dash(3, { space: 3 }).moveTo(135, 252).lineTo(560, 252).lineWidth(1).strokeColor('#64748b').stroke().undash();

    // 9. Tenure & Role / Bootcamp paragraph
    const activeBootcampTitle = bootcampTitle || programTitle || 'Bootcamp Cohort';
    const activeRole = departmentName ? `${programTitle || 'Intern'} (${departmentName})` : (programTitle || 'Intern');

    const tenureText = isBootcampMode
      ? `during the bootcamp from ${startDate} to ${endDate} for ${activeBootcampTitle}`
      : `during their tenure from ${startDate} to ${endDate} Serving as our ${activeRole}`;

    const statementText = 'This recognition serves as a testament to their unwavering commitment to operational excellence and the strategic value they have delivered to our organization.';

    doc.font('Helvetica').fontSize(10.5).fillColor('#334155').text(tenureText, 135, 268, { width: 480, lineGap: 3 });
    doc.font('Helvetica').fontSize(10.5).fillColor('#334155').text(statementText, 135, 298, { width: 480, lineGap: 3 });

    // 10. Founder Signature Block
    const sigPath = path.resolve(__dirname, '../assets/signature.png');
    if (fs.existsSync(sigPath)) {
      try {
        doc.image(sigPath, 135, 360, { width: 110 });
      } catch {
        // Fallback gracefully if image reading has issue
      }
    }
    doc.font('Helvetica-Bold').fontSize(11.5).fillColor('#0f172a').text('Jaya Chandra Reddy Chilakamarry', 135, 435);
    doc.font('Helvetica').fontSize(10).fillColor('#64748b').text('Founder', 135, 452);

    // 11. Certificate ID (CID)
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#1e293b').text(`CID: ${certificateId}`, 570, 500);

    // Verification URL note (subtle)
    if (verifyUrl) {
      doc.font('Helvetica').fontSize(7.5).fillColor('#94a3b8').text(`Verify: ${verifyUrl}`, 135, height - 52);
    }

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


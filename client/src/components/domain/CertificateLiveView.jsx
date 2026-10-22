import React, { useRef } from 'react';
import { ShieldCheck, Award, Printer, CheckCircle2, Download } from 'lucide-react';
import { fmtDate } from '../../lib/format';
import { Button } from '../ui';

export function CertificateLiveView({ cert, onDownloadPdf }) {
  const printRef = useRef(null);

  const internName = cert.internName || cert.candidateName || 'Participant';
  const programTitle = cert.programTitle || cert.bootcampTitle || 'Internship Program';
  const certificateId = cert.certificateId || cert._id || 'TMT-CERT-2026';
  const issueDate = cert.issueDate ? (String(cert.issueDate).includes('T') ? fmtDate(cert.issueDate) : cert.issueDate) : fmtDate(new Date());
  const periodText = cert.startDate && cert.endDate
    ? `${fmtDate(cert.startDate)} to ${fmtDate(cert.endDate)}`
    : (cert.duration || 'Curriculum Term 2026');
  const signatoryName = cert.signatory || 'Jay Chandra Reddy Chilakamarry';
  const verifyUrl = `${window.location.origin}/verify/certificate/${certificateId}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col items-center w-full space-y-4">
      {/* Control bar */}
      <div className="flex w-full items-center justify-between px-2 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            <ShieldCheck className="h-3.5 w-3.5" /> Authenticated Digital Credential
          </span>
          <span className="hidden sm:inline font-mono">ID: {certificateId}</span>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Button size="xs" variant="outline" icon={Printer} onClick={handlePrint} data-testid="cert-print-btn">
            Print Certificate
          </Button>
          {onDownloadPdf && (
            <Button size="xs" variant="primary" icon={Download} onClick={onDownloadPdf} data-testid="cert-download-btn">
              Download PDF
            </Button>
          )}
        </div>
      </div>

      {/* The Printable Certificate Canvas Frame */}
      <div
        ref={printRef}
        data-testid="live-certificate-document"
        className="relative w-full max-w-[820px] aspect-[1.414/1] bg-white rounded-xl shadow-lg border-[10px] border-slate-900 overflow-hidden flex flex-col justify-between p-8 sm:p-12 text-slate-900 select-text"
        style={{
          boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.15), 0 0 0 3px #d81b28',
          background: 'radial-gradient(circle at 50% 50%, #ffffff 0%, #fafafa 100%)'
        }}
      >
        {/* Subtle Decorative Geometric Accents */}
        <div className="pointer-events-none absolute inset-2 border border-slate-200 rounded-lg" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-3 border border-dashed border-brand-200/60 rounded" aria-hidden="true" />

        {/* Top Header */}
        <div className="relative text-center space-y-2">
          <div className="flex items-center justify-center gap-3">
            <img
              src="/letters/tmt-logo.png"
              alt="TechMecha Torque"
              className="h-10 w-auto max-w-[160px] object-contain"
              onError={(e) => {
                // Fallback to text if image not available
                e.target.style.display = 'none';
              }}
            />
            <div className="text-left border-l-2 border-brand-600 pl-3">
              <h2 className="text-base sm:text-lg font-black tracking-wider text-slate-900 uppercase">
                TechMecha Torque
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-500 font-semibold tracking-wide uppercase">
                Private Limited • Innovation & Technology Solutions
              </p>
            </div>
          </div>

          <div className="pt-2">
            <div className="inline-block bg-brand-50 border border-brand-200 px-4 py-1 rounded-full">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-brand-700">
                Official Credential of Recognition
              </span>
            </div>
          </div>
        </div>

        {/* Central Award Body */}
        <div className="relative text-center my-auto py-4 space-y-3">
          <p className="text-xs sm:text-sm font-serif tracking-widest text-slate-500 uppercase">
            This Certificate is Proudly Presented to
          </p>

          <div className="py-1">
            <h1
              data-testid="cert-recipient-name"
              className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 font-serif"
              style={{ color: '#0f172a' }}
            >
              {internName}
            </h1>
            <div className="mx-auto mt-2 h-1 w-32 rounded-full bg-gradient-to-r from-transparent via-brand-600 to-transparent" />
          </div>

          <div className="mx-auto max-w-xl text-xs sm:text-sm text-slate-700 leading-relaxed font-sans">
            <p>
              for demonstrating exceptional commitment, problem-solving, and successfully completing the curriculum requirements of the{' '}
              <strong className="font-semibold text-slate-900">{programTitle}</strong> program, conducted during the term of{' '}
              <strong className="font-semibold text-slate-900">{periodText}</strong>.
            </p>
          </div>
        </div>

        {/* Bottom Signature & Verification Bar */}
        <div className="relative pt-6 border-t border-slate-200 flex flex-row items-end justify-between gap-4 text-xs">
          {/* Issue Date & ID */}
          <div className="space-y-1 text-left">
            <p className="text-[10px] uppercase font-bold text-slate-400">Credential Identifier</p>
            <p className="font-mono font-bold text-slate-900 text-xs sm:text-sm tracking-wide">{certificateId}</p>
            <p className="text-[10px] text-slate-500">Issued On: {issueDate}</p>
          </div>

          {/* Official Verification Seal */}
          <div className="hidden sm:flex flex-col items-center">
            <div className="h-14 w-14 rounded-full border-2 border-brand-600 bg-brand-50 flex items-center justify-center p-1 shadow-inner">
              <Award className="h-8 w-8 text-brand-600" />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-brand-800 mt-1">Official Seal</span>
          </div>

          {/* Director & Signatory */}
          <div className="text-right space-y-1">
            <div className="inline-block border-b-2 border-slate-900 pb-1 px-4">
              <span className="font-serif italic font-bold text-slate-900 text-sm sm:text-base">
                {signatoryName}
              </span>
            </div>
            <p className="font-bold text-slate-900 text-xs">Director & CEO</p>
            <p className="text-[10px] text-slate-500">TechMecha Torque Private Limited</p>
          </div>
        </div>

        {/* Verified link watermark */}
        <div className="text-center pt-2">
          <p className="text-[9px] text-slate-400 font-mono">
            Verify authentic credential online at: <span className="text-brand-700">{verifyUrl}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

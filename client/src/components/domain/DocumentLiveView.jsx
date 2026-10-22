import React from 'react';
import { ShieldCheck, Award, Printer, CheckCircle, FileText, ExternalLink } from 'lucide-react';
import { fmtDate } from '../../lib/format';

/**
 * Official Live Letterhead Replica for TechMecha Torque documents & letters.
 * Formatted with corporate alignment, typography, verified stamp, and print stylesheet.
 */
export function DocumentLiveView({ doc, onDownloadPdf }) {
  if (!doc) return null;

  const recipient = doc.recipientName ||
    (doc.internId?.userId ? `${doc.internId.userId.firstName} ${doc.internId.userId.lastName}` : null) ||
    'Intern Participant';
  const internCode = doc.internId?.internId || (typeof doc.internId === 'string' ? doc.internId : 'TMT-INT-2026');
  const docRef = doc.documentId || doc.originalName || 'DOC-2026-TMT-OFFICIAL';
  const issueDateStr = doc.issuedAt || doc.createdAt ? fmtDate(doc.issuedAt || doc.createdAt) : fmtDate(new Date());

  const docType = doc.documentType || doc.type || 'OFFICIAL_DOCUMENT';
  const isCompletion = docType.includes('COMPLETION') || doc.title?.toLowerCase().includes('completion');
  const isOffer = docType.includes('OFFER') || doc.title?.toLowerCase().includes('offer');
  const isLor = docType.includes('RECOMMENDATION') || docType.includes('LOR') || doc.title?.toLowerCase().includes('recommendation');

  const verifyUrl = `${window.location.origin}/verify/document/${docRef}`;

  return (
    <div className="w-full max-w-3xl mx-auto my-2">
      {/* Print styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #official-letter-replica, #official-letter-replica * {
            visibility: visible !important;
          }
          #official-letter-replica {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 24px !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Action Toolbar */}
      <div className="no-print flex items-center justify-between pb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Verified Official Document
          </span>
          <span className="text-xs text-slate-500 font-mono hidden sm:inline">{docRef}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" /> Print Letter
          </button>
        </div>
      </div>

      {/* Letter Canvas */}
      <div
        id="official-letter-replica"
        className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 sm:p-12 text-slate-900 font-serif leading-relaxed relative overflow-hidden"
      >
        {/* Top Decorative Header Accent */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-600 via-rose-500 to-slate-900" />

        {/* Company Letterhead */}
        <div className="border-b-2 border-slate-900/80 pb-5 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black font-sans tracking-tight text-red-600">TECHMECHA</span>
                <span className="text-2xl font-black font-sans tracking-tight text-slate-900">TORQUE</span>
                <span className="text-xs font-sans font-bold px-1.5 py-0.5 rounded bg-slate-900 text-white ml-1">PVT. LTD.</span>
              </div>
              <p className="text-xs font-sans tracking-wide text-slate-600 mt-1 uppercase font-semibold">
                Engineering & Technology Solutions • Skill Development Track
              </p>
              <p className="text-[11px] font-sans text-slate-500">
                Regd. MSME & DPIIT Recognized Startup | CIN/Reg No: UDYAM-TS-02-0144921
              </p>
            </div>
            <div className="text-right font-sans text-xs text-slate-600 space-y-0.5">
              <p className="font-semibold text-slate-900">TechMecha Torque Headquarters</p>
              <p>Email: <span className="text-red-600 font-medium">team@techmechatorque.com</span></p>
              <p>Contact: +91 7993442607</p>
              <p>Web: <span className="text-slate-900 font-medium">techmechatorque.com</span></p>
            </div>
          </div>
        </div>

        {/* Reference & Date Bar */}
        <div className="flex items-center justify-between font-sans text-xs font-semibold text-slate-700 mb-6 pb-2 border-b border-slate-100">
          <div>
            Ref: <span className="font-mono text-slate-900 font-bold">{docRef}</span>
          </div>
          <div>
            Date: <span className="text-slate-900">{issueDateStr}</span>
          </div>
        </div>

        {/* Recipient Details */}
        <div className="mb-6 font-sans text-xs text-slate-800 leading-normal bg-slate-50/70 p-3.5 rounded-lg border border-slate-200">
          <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px] mb-1">To,</p>
          <p className="text-sm font-bold text-slate-900">{recipient}</p>
          <p className="text-slate-600 font-mono text-xs">Intern ID: {internCode}</p>
          <p className="text-slate-600">TechMecha Torque Skill & Innovation Center</p>
        </div>

        {/* Document Subject */}
        <div className="mb-6 font-sans">
          <p className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-wide border-l-4 border-red-600 pl-3 py-0.5">
            Subject: {doc.title || (isCompletion ? 'Internship Completion Certificate & Relieving Letter' : isOffer ? 'Formal Internship Offer Letter' : isLor ? 'Letter of Recommendation' : 'Official Letter of Record')}
          </p>
        </div>

        {/* Document Body */}
        <div className="space-y-4 text-sm text-slate-800 font-sans leading-relaxed text-justify">
          {doc.bodyMarkdown ? (
            <div className="whitespace-pre-wrap">{doc.bodyMarkdown}</div>
          ) : isCompletion ? (
            <>
              <p>
                <strong>TO WHOMSOEVER IT MAY CONCERN</strong>
              </p>
              <p>
                This is to certify that <strong>{recipient}</strong> (Intern ID: <strong>{internCode}</strong>) has successfully completed their intensive internship program with <strong>TechMecha Torque Pvt. Ltd.</strong> in the domain of <strong>{doc.internId?.programId?.title || 'Full Stack Web Development & Software Engineering'}</strong>.
              </p>
              <p>
                During their internship tenure, the intern demonstrated commendable technical competence, problem-solving prowess, and professional diligence. They actively participated in software architecture design, collaborative sprint deliverables, and code evaluation under technical mentorship.
              </p>
              <p>
                The intern has successfully returned all organizational digital access, credentials, and assets. We have found them to be disciplined, self-motivated, and result-oriented.
              </p>
              <p>
                We appreciate their contributions to our engineering pipeline and wish them the very best in all their future academic and professional endeavors.
              </p>
            </>
          ) : isOffer ? (
            <>
              <p>
                Dear <strong>{recipient}</strong>,
              </p>
              <p>
                We are pleased to offer you an internship appointment at <strong>TechMecha Torque Pvt. Ltd.</strong> as an <strong>Intern Trainee</strong>. This program is structured to provide intensive industry mentorship, production architecture experience, and verified project milestones.
              </p>
              <p>
                Throughout your engagement, you will be expected to adhere to the organization's high standards of professionalism, integrity, and intellectual property confidentiality.
              </p>
              <p>
                Welcome to TechMecha Torque. We look forward to a mutually rewarding learning and innovation journey.
              </p>
            </>
          ) : (
            <>
              <p>
                <strong>TO WHOMSOEVER IT MAY CONCERN</strong>
              </p>
              <p>
                This official letter is issued on behalf of <strong>TechMecha Torque Pvt. Ltd.</strong> for <strong>{recipient}</strong> (Ref ID: <strong>{internCode}</strong>) regarding their official association and records with the organization.
              </p>
              <p>
                All records, credentials, and achievements noted herein are authenticated by our People Operations and Engineering Division.
              </p>
            </>
          )}
        </div>

        {/* Signatory Block & Official Stamp */}
        <div className="mt-12 pt-6 border-t border-slate-200 font-sans">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div>
              <p className="text-xs text-slate-500 font-semibold mb-2">Yours sincerely,</p>
              <p className="text-sm font-black text-slate-900 tracking-tight">JAY CHANDRA REDDY CHILAKAMARRY</p>
              <p className="text-xs font-bold text-red-600">Founder & Chief Executive Officer</p>
              <p className="text-xs text-slate-600">TechMecha Torque Pvt. Ltd.</p>
            </div>

            {/* Official Digital Seal & QR Code */}
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full border-2 border-dashed border-red-500 flex flex-col items-center justify-center p-1 text-center bg-red-50/50">
                <span className="text-[7px] font-black text-red-700 tracking-widest uppercase">TECHMECHA</span>
                <Award className="w-5 h-5 text-red-600 my-0.5" />
                <span className="text-[6.5px] font-black text-red-700 tracking-widest uppercase">SEAL OF AUTH</span>
              </div>
              <div className="text-left font-sans text-[10px] text-slate-500 space-y-0.5 max-w-[150px]">
                <p className="font-bold text-slate-700">Digital Authenticity</p>
                <p className="font-mono text-[9px] truncate">{docRef}</p>
                <a
                  href={verifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-red-600 font-semibold inline-flex items-center gap-0.5 hover:underline"
                >
                  Verify Online <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Disclaimer */}
        <div className="mt-8 pt-3 border-t border-slate-100 text-center font-sans text-[10px] text-slate-400">
          This document is generated and securely verified by TechMecha Torque Platform • Regd. MSME & DPIIT Recognized
        </div>
      </div>
    </div>
  );
}

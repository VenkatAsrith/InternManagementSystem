import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Calendar, Clock, MapPin, CheckCircle2, AlertCircle, Copy, Check,
  Download, ArrowLeft, ShieldCheck, IndianRupee, Sparkles, Building2
} from 'lucide-react';
import api, { downloadFile } from '../../lib/http';
import { useToast } from '../../context/ToastContext';
import { fmtDate, humanize } from '../../lib/format';
import { Button, InlineAlert } from '../../components/ui';

export function PublicBootcampFormPage() {
  const { id } = useParams();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [bootcamp, setBootcamp] = useState(null);
  const [error, setError] = useState(null);

  // Form State
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [candidatePhone, setCandidatePhone] = useState('');
  const [college, setCollege] = useState('');
  const [course, setCourse] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [customResponses, setCustomResponses] = useState({});

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submittedPass, setSubmittedPass] = useState(null);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [downloadingPass, setDownloadingPass] = useState(false);
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);

  useEffect(() => {
    async function loadForm() {
      try {
        setLoading(true);
        const res = await api.get(`/growth/bootcamps/${id}/public-form`);
        setBootcamp(res.data);
        if (res.data?.slots?.length > 0) {
          const available = res.data.slots.find(s => !s.isFull);
          if (available) setSelectedSlotId(available._id);
        }
      } catch (err) {
        setError(err.message || 'Unable to load registration form');
      } finally {
        setLoading(false);
      }
    }
    if (id) loadForm();
  }, [id]);

  const handleCustomChange = (fieldId, val) => {
    setCustomResponses(prev => ({ ...prev, [fieldId]: val }));
  };

  const handleCheckboxToggle = (fieldId, opt) => {
    const current = Array.isArray(customResponses[fieldId]) ? customResponses[fieldId] : [];
    if (current.includes(opt)) {
      setCustomResponses(prev => ({ ...prev, [fieldId]: current.filter(x => x !== opt) }));
    } else {
      setCustomResponses(prev => ({ ...prev, [fieldId]: [...current, opt] }));
    }
  };

  const copyUpiId = () => {
    const upi = bootcamp?.paymentUpiId || 'techmechatorque@upi';
    navigator.clipboard.writeText(upi);
    setCopiedUpi(true);
    toast.success('UPI ID copied to clipboard');
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!candidateName.trim()) return toast.error('Please enter your full name');
    if (!candidateEmail.trim()) return toast.error('Please enter your email address');
    if (!selectedSlotId) return toast.error('Please select an available session slot');

    const isPaid = bootcamp?.feeType === 'PAID';
    if (isPaid && !paymentReference.trim()) {
      return toast.error('Please enter your UPI / Transaction reference number');
    }

    // Verify required custom questions
    const fields = bootcamp?.customForm?.fields || [];
    for (const f of fields) {
      if (f.required && !customResponses[f.id]) {
        return toast.error(`Please answer required question: "${f.label}"`);
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        candidateName: candidateName.trim(),
        candidateEmail: candidateEmail.trim(),
        candidatePhone: candidatePhone.trim(),
        college: college.trim(),
        course: course.trim(),
        slotId: selectedSlotId,
        paymentReference: paymentReference.trim(),
        customResponses
      };

      const res = await api.post(`/growth/bootcamps/${id}/public-submit`, payload);
      setSubmittedPass(res.data);
      toast.success('Registration successful! Admission pass generated.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      toast.error(err.message || 'Failed to submit registration');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPass = async () => {
    if (!submittedPass?.pass?._id) return;
    setDownloadingPass(true);
    try {
      await downloadFile(`/growth/public/passes/${submittedPass.pass._id}/pdf`, `Bootcamp-Pass-${submittedPass.pass.passCode}.pdf`);
      toast.success('Pass downloaded');
    } catch (e) {
      toast.error(e.message || 'Failed to download pass PDF');
    } finally {
      setDownloadingPass(false);
    }
  };

  const handleDownloadReceipt = async () => {
    if (!submittedPass?.pass?._id) return;
    setDownloadingReceipt(true);
    try {
      await downloadFile(`/growth/public/passes/${submittedPass.pass._id}/receipt`, `Receipt-${submittedPass.pass.passCode}.pdf`);
      toast.success('Fee receipt downloaded');
    } catch (e) {
      toast.error(e.message || 'Failed to download receipt');
    } finally {
      setDownloadingReceipt(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-brand-600" />
          <p className="text-sm font-medium text-slate-600">Loading Bootcamp Registration Form...</p>
        </div>
      </div>
    );
  }

  if (error || !bootcamp) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm space-y-4">
          <AlertCircle className="mx-auto h-12 w-12 text-rose-500" />
          <h2 className="text-xl font-bold text-slate-900">Registration Unavailable</h2>
          <p className="text-xs text-slate-600">{error || 'This bootcamp registration form is no longer accepting responses.'}</p>
          <Link to="/" className="inline-block mt-2">
            <Button variant="outline" size="sm">Back to Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const org = bootcamp.organization || {};
  const isPaid = bootcamp.feeType === 'PAID';

  // SUCCESS CONFIRMATION VIEW
  if (submittedPass) {
    const pass = submittedPass.pass || {};
    const rcpt = submittedPass.receipt || {};

    return (
      <div className="min-h-screen bg-slate-100/70 py-12 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="h-3.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />
            <div className="p-8 text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Registration Confirmed!</h1>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                Thank you, <strong>{pass.candidateName}</strong>! Your registration for{' '}
                <strong>{bootcamp.title}</strong> has been successfully confirmed.
              </p>

              {/* Pass Code Highlight Box */}
              <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 p-5 max-w-sm mx-auto space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Official Pass Code</span>
                <p className="text-2xl font-mono font-black text-slate-900 tracking-wider">{pass.passCode}</p>
                <p className="text-xs text-slate-500">Sent to: <strong>{pass.candidateEmail}</strong></p>
              </div>

              {isPaid && rcpt.receiptNumber && (
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 max-w-sm mx-auto text-xs text-slate-700 flex justify-between items-center">
                  <span>Receipt No: <strong>{rcpt.receiptNumber}</strong></span>
                  <span className="font-semibold text-emerald-700">₹{rcpt.amountPaid} (Acknowledged)</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                <Button
                  variant="primary"
                  icon={Download}
                  loading={downloadingPass}
                  onClick={handleDownloadPass}
                  data-testid="download-pass-btn"
                >
                  Download Admission Pass (PDF)
                </Button>

                {isPaid && (
                  <Button
                    variant="outline"
                    icon={Download}
                    loading={downloadingReceipt}
                    onClick={handleDownloadReceipt}
                    data-testid="download-receipt-btn"
                  >
                    Download Fee Receipt (PDF)
                  </Button>
                )}
              </div>

              <div className="pt-6 border-t border-slate-100 flex items-center justify-center gap-4 text-xs text-slate-500">
                <button
                  type="button"
                  onClick={() => {
                    setSubmittedPass(null);
                    setCandidateName('');
                    setCandidateEmail('');
                    setCandidatePhone('');
                    setPaymentReference('');
                    setCustomResponses({});
                  }}
                  className="hover:text-brand-600 font-medium"
                >
                  Submit Another Response
                </button>
                <span>•</span>
                <Link to="/" className="hover:text-brand-600 font-medium">
                  Return to Home
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // FORM FILLING VIEW
  return (
    <div className="min-h-screen bg-slate-100/70 py-10 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header Branding Card */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          {/* Top Google-Forms Accent Bar */}
          <div className="h-3.5 bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600" />
          <div className="p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <img
                  src="/letters/tmt-logo.png"
                  alt="TechMecha Torque"
                  className="h-9 w-auto object-contain"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm tracking-tight">{org.name || 'TechMecha Torque Pvt. Ltd.'}</h3>
                  <p className="text-[11px] text-slate-500 font-mono">OFFICIAL REGISTRATION PORTAL</p>
                </div>
              </div>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                isPaid ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}>
                {isPaid ? `Fee: ₹${bootcamp.feeAmount}` : 'Free Bootcamp'}
              </span>
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{bootcamp.title}</h1>
              {bootcamp.description && (
                <p className="mt-2 text-sm text-slate-600 leading-relaxed whitespace-pre-line">{bootcamp.description}</p>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs text-slate-600">
              <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                <Calendar className="h-4 w-4 text-brand-600 flex-shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Event Date</span>
                  <span className="font-semibold text-slate-800">{bootcamp.date ? fmtDate(bootcamp.date) : 'Upcoming'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                <MapPin className="h-4 w-4 text-brand-600 flex-shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Venue</span>
                  <span className="font-semibold text-slate-800 truncate block">{bootcamp.venue || 'Virtual Campus'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2.5 border border-slate-100 col-span-2 sm:col-span-1">
                <Clock className="h-4 w-4 text-brand-600 flex-shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Duration</span>
                  <span className="font-semibold text-slate-800">{bootcamp.duration || 'Full Session'}</span>
                </div>
              </div>
            </div>

            {bootcamp.customForm?.instructions && (
              <div className="rounded-lg bg-blue-50/70 border border-blue-100 p-3 text-xs text-blue-900">
                {bootcamp.customForm.instructions}
              </div>
            )}
          </div>
        </div>

        {/* The Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Card 1: Candidate Basic Information */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-4 shadow-sm">
            <h3 className="font-bold text-slate-900 text-base pb-2 border-b border-slate-100">
              1. Candidate Information
            </h3>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                data-testid="input-candidate-name"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={candidateEmail}
                  onChange={(e) => setCandidateEmail(e.target.value)}
                  placeholder="rahul@example.com"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                  data-testid="input-candidate-email"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">Your admission pass will be delivered here.</span>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  WhatsApp / Phone Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={candidatePhone}
                  onChange={(e) => setCandidatePhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                  data-testid="input-candidate-phone"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 pt-1">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  College / University
                </label>
                <input
                  type="text"
                  value={college}
                  onChange={(e) => setCollege(e.target.value)}
                  placeholder="e.g. IIT Madras / JNTU"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Degree & Branch
                </label>
                <input
                  type="text"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  placeholder="e.g. B.Tech Computer Science"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Select Slot */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-4 shadow-sm">
            <h3 className="font-bold text-slate-900 text-base pb-2 border-b border-slate-100">
              2. Select Session Slot <span className="text-rose-500">*</span>
            </h3>

            {bootcamp.slots?.length === 0 ? (
              <p className="text-xs text-slate-500">No session slots provisioned for this bootcamp yet.</p>
            ) : (
              <div className="space-y-2.5">
                {bootcamp.slots.map((s) => {
                  const remaining = Math.max(0, (s.capacity || 1) - (s.bookedCount || 0));
                  const isFull = s.isFull || remaining === 0;
                  const isSelected = selectedSlotId === s._id;

                  return (
                    <label
                      key={s._id}
                      className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                        isFull
                          ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                          : isSelected
                          ? 'border-brand-600 bg-brand-50/40 ring-1 ring-brand-500'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="slot"
                          disabled={isFull}
                          checked={isSelected}
                          onChange={() => setSelectedSlotId(s._id)}
                          className="h-4 w-4 text-brand-600 focus:ring-brand-500"
                        />
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{s.slotName}</p>
                          <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                            {s.startTime} - {s.endTime}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        isFull ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {isFull ? 'Fully Booked' : `${remaining} seat(s) left`}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Card 3: Dynamic Form Builder Questions */}
          {(bootcamp.customForm?.fields || []).length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-5 shadow-sm">
              <h3 className="font-bold text-slate-900 text-base pb-2 border-b border-slate-100">
                3. Additional Information
              </h3>

              {bootcamp.customForm.fields.map((field) => {
                const val = customResponses[field.id] || '';

                return (
                  <div key={field.id} className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                      {field.label} {field.required && <span className="text-rose-500">*</span>}
                    </label>

                    {field.fieldType === 'TEXT' && (
                      <input
                        type="text"
                        required={field.required}
                        value={val}
                        onChange={(e) => handleCustomChange(field.id, e.target.value)}
                        placeholder={field.placeholder || 'Your answer'}
                        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                      />
                    )}

                    {field.fieldType === 'TEXTAREA' && (
                      <textarea
                        rows={3}
                        required={field.required}
                        value={val}
                        onChange={(e) => handleCustomChange(field.id, e.target.value)}
                        placeholder={field.placeholder || 'Your answer'}
                        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                      />
                    )}

                    {field.fieldType === 'NUMBER' && (
                      <input
                        type="number"
                        required={field.required}
                        value={val}
                        onChange={(e) => handleCustomChange(field.id, e.target.value)}
                        placeholder={field.placeholder || '0'}
                        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                      />
                    )}

                    {field.fieldType === 'SELECT' && (
                      <select
                        required={field.required}
                        value={val}
                        onChange={(e) => handleCustomChange(field.id, e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                      >
                        <option value="">Select an option</option>
                        {(field.options || []).map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    )}

                    {field.fieldType === 'RADIO' && (
                      <div className="space-y-2 pt-1">
                        {(field.options || []).map((opt) => (
                          <label key={opt} className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                            <input
                              type="radio"
                              name={`radio-${field.id}`}
                              required={field.required}
                              checked={val === opt}
                              onChange={() => handleCustomChange(field.id, opt)}
                              className="h-4 w-4 text-brand-600 focus:ring-brand-500"
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {field.fieldType === 'CHECKBOX' && (
                      <div className="space-y-2 pt-1">
                        {(field.options || []).map((opt) => {
                          const isChecked = Array.isArray(val) && val.includes(opt);
                          return (
                            <label key={opt} className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleCheckboxToggle(field.id, opt)}
                                className="h-4 w-4 rounded text-brand-600 focus:ring-brand-500"
                              />
                              <span>{opt}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Card 4: Fee Payment (If Paid Bootcamp) */}
          {isPaid && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-6 sm:p-8 space-y-4 shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b border-amber-200">
                <h3 className="font-bold text-amber-950 text-base flex items-center gap-2">
                  <IndianRupee className="h-5 w-5 text-amber-600" />
                  Bootcamp Fee Payment
                </h3>
                <span className="font-black text-amber-900 text-lg">₹{bootcamp.feeAmount}</span>
              </div>

              <p className="text-xs text-amber-800 leading-relaxed">
                Please complete the registration fee payment using UPI or NetBanking, and enter your Transaction / UTR reference number below.
              </p>

              <div className="rounded-xl border border-amber-200 bg-white p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Official UPI ID</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">{bootcamp.paymentUpiId || 'techmechatorque@upi'}</span>
                  </div>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    icon={copiedUpi ? Check : Copy}
                    onClick={copyUpiId}
                  >
                    {copiedUpi ? 'Copied' : 'Copy UPI'}
                  </Button>
                </div>

                {bootcamp.paymentInstructions && (
                  <p className="text-xs text-slate-500 border-t border-slate-100 pt-2">
                    {bootcamp.paymentInstructions}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1">
                  UPI / Bank Transaction Reference (UTR) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="e.g. 4289XXXXXXXX or UPI Ref ID"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                  data-testid="input-payment-ref"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  An official GST / payment invoice receipt will be generated and emailed with your pass.
                </span>
              </div>
            </div>
          )}

          {/* Submit Action */}
          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={submitting}
              className="w-full py-3.5 text-base font-bold shadow-md shadow-brand-500/20"
              data-testid="submit-bootcamp-form-btn"
            >
              {isPaid ? `Complete Payment & Get Pass (₹${bootcamp.feeAmount})` : 'Submit Registration & Generate Pass'}
            </Button>
            <p className="mt-3 text-center text-xs text-slate-400">
              By registering, you agree to TechMecha Torque event guidelines and attendance terms.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

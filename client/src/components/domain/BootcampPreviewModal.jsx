import React from 'react';
import { Calendar, Clock, MapPin, Users, Ticket, CheckCircle2, ShieldCheck, Mail, ArrowRight } from 'lucide-react';
import { Button, Modal, StatusBadge } from '../ui';
import { fmtDate, fmtDateTime } from '../../lib/format';

export function BootcampPreviewModal({ bootcamp, onClose, onRegister, onCheckIn, onOpenPass }) {
  if (!bootcamp) return null;

  const slots = bootcamp.slots || [];
  const passes = bootcamp.passes || [];
  const totalBooked = slots.reduce((sum, s) => sum + (s.bookedCount || 0), 0);
  const totalCheckedIn = slots.reduce((sum, s) => sum + (s.checkedInCount || 0), 0);
  const totalCap = bootcamp.totalCapacity || 1;
  const available = Math.max(0, totalCap - totalBooked);
  const pctBooked = Math.min(100, Math.round((totalBooked / totalCap) * 100));

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      testId="bootcamp-preview-modal"
      title={`Operational Preview: ${bootcamp.title}`}
      footer={
        <div className="flex w-full items-center justify-between">
          <Button variant="outline" size="sm" onClick={onClose} data-testid="bootcamp-preview-close">
            Close
          </Button>
          <div className="flex gap-2">
            {onCheckIn && (
              <Button size="sm" variant="outline" onClick={() => { onClose(); onCheckIn(bootcamp); }} data-testid="preview-checkin-btn">
                Check-In Pass
              </Button>
            )}
            {onRegister && (
              <Button size="sm" variant="primary" onClick={() => { onClose(); onRegister(bootcamp); }} data-testid="preview-register-btn">
                Register Candidate
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-6" data-testid="bootcamp-preview-content">
        {/* Banner Details */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900" data-testid="preview-title">{bootcamp.title}</h2>
              <p className="text-xs text-slate-600 mt-0.5">{bootcamp.description || 'Educational Cohort & Technology Training Track'}</p>
            </div>
            <StatusBadge status={bootcamp.status || 'SCHEDULED'} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-700">
            <div>
              <span className="text-slate-500 font-semibold uppercase block">Date & Time</span>
              <span className="font-medium text-slate-900 flex items-center gap-1 mt-0.5">
                <Calendar className="h-3.5 w-3.5 text-brand-600" /> {fmtDate(bootcamp.date)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold uppercase block">Venue & Mode</span>
              <span className="font-medium text-slate-900 flex items-center gap-1 mt-0.5">
                <MapPin className="h-3.5 w-3.5 text-brand-600" /> {bootcamp.venue || 'Virtual Campus'} [ONLINE]
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold uppercase block">Capacity</span>
              <span className="font-medium text-slate-900 mt-0.5 block">{totalCap} Total Seats</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold uppercase block">Availability</span>
              <span className={`font-bold mt-0.5 block ${available > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {available} Seats Available
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="pt-2">
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium text-slate-700">Booking Progress</span>
              <span className="font-semibold text-slate-900">{totalBooked} / {totalCap} Booked ({pctBooked}%)</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
              <div className={`h-full ${pctBooked >= 100 ? 'bg-amber-600' : 'bg-brand-600'}`} style={{ width: `${pctBooked}%` }} />
            </div>
          </div>
        </div>

        {/* Slots & Schedule */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-brand-600" /> Cohort Slots & Capacities
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {slots.map((s) => (
              <div key={s._id} className="rounded-lg border border-slate-200 bg-white p-3 space-y-1.5 text-xs shadow-sm">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900">{s.slotName}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                    {s.startTime} - {s.endTime}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-100">
                  <span>Capacity: <strong>{s.capacity}</strong></span>
                  <span>Booked: <strong>{s.bookedCount}</strong></span>
                  <span className="text-emerald-700">Attended: <strong>{s.checkedInCount}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Issued Passes */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Ticket className="h-4 w-4 text-brand-600" /> Issued Registrations & Pass Status
          </h3>
          {passes.length === 0 ? (
            <p className="text-xs text-slate-500 py-3 text-center bg-slate-50 rounded border border-slate-200">
              No admission passes generated yet. Click "Register Candidate" to issue passes.
            </p>
          ) : (
            <div className="max-h-48 overflow-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs" data-testid="preview-passes-table">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="p-2">Pass Code</th>
                    <th className="p-2">Candidate</th>
                    <th className="p-2">Email</th>
                    <th className="p-2">Status</th>
                    <th className="p-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {passes.map((p) => (
                    <tr key={p._id} className="hover:bg-slate-50">
                      <td className="p-2 font-mono font-medium text-slate-900">{p.passCode}</td>
                      <td className="p-2 font-medium text-slate-900">{p.candidateName}</td>
                      <td className="p-2 text-slate-600">{p.candidateEmail}</td>
                      <td className="p-2">
                        <span className={`px-1.5 py-0.5 rounded font-semibold text-[10px] ${p.status === 'CHECKED_IN' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="p-2 text-right">
                        {onOpenPass && (
                          <Button size="xs" variant="outline" onClick={() => onOpenPass(p)} data-testid={`view-pass-${p.passCode}`}>
                            View Pass
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

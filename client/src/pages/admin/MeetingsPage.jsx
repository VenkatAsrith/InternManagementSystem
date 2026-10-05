import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Video, Calendar, Bell, CheckCircle2, AlertCircle, ArrowLeft, Search, Users, ExternalLink, Clock } from 'lucide-react';
import api from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useForm, rules } from '../../hooks/useForm';
import { fmtDate, fullName, humanize, todayISO } from '../../lib/format';
import { MEETING_TYPE } from '@shared/constants.js';
import { Button, CheckboxField, DataTable, FormGrid, FormModal, Modal, PageHeader, SelectField, StatusBadge, TextAreaField, TextField } from '../../components/ui';
import { MeetingLink } from '../intern/InternMeetingsPage';

const NEXT = { SCHEDULED: ['STARTED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'], RESCHEDULED: ['STARTED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'], STARTED: ['COMPLETED'] };
const OPEN = ['SCHEDULED', 'RESCHEDULED'];

const PROVIDERS = [
  { value: 'GOOGLE_MEET', label: 'Google Meet' },
  { value: 'MS_TEAMS', label: 'Microsoft Teams' },
  { value: 'ZOOM', label: 'Zoom' },
  { value: 'CUSTOM', label: 'Custom Platform' },
  { value: 'IN_PERSON', label: 'In Person' }
];

function NewMeetingModal({ onClose, onDone }) {
  const toast = useToast();
  const interns = useFetch(() => api.get('/interns', { params: { open: true, limit: 200 } }), []);
  const staff = useFetch(() => api.get('/users', { params: { limit: 100 } }), []);
  const projects = useFetch(() => api.get('/projects', { params: { limit: 100 } }), []);
  const googleStatus = useFetch(() => api.get('/integrations/google/status'), []);

  const [step, setStep] = useState('FORM'); // 'FORM' | 'PREVIEW'
  const [participantSearch, setParticipantSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);

  const form = useForm({
    title: '',
    type: 'MENTOR_1ON1',
    scheduledDate: todayISO(),
    startTime: '10:00',
    endTime: '11:00',
    internIds: [],
    participants: [],
    meetingProvider: 'GOOGLE_MEET',
    meetingLink: '',
    agenda: '',
    description: '',
    projectId: '',
    reminder24h: true,
    reminder15m: true
  });
  const f = form.field;

  const toggleIntern = (id) => {
    form.set('internIds', form.values.internIds.includes(id)
      ? form.values.internIds.filter((x) => x !== id)
      : [...form.values.internIds, id]);
  };

  const internList = interns.data || [];
  const filteredInterns = useMemo(() => {
    if (!participantSearch.trim()) return internList;
    const q = participantSearch.toLowerCase();
    return internList.filter(i =>
      fullName(i.userId).toLowerCase().includes(q) ||
      (i.internId && i.internId.toLowerCase().includes(q)) ||
      (i.userId?.email && i.userId.email.toLowerCase().includes(q))
    );
  }, [internList, participantSearch]);

  const selectAllVisible = () => {
    const visibleIds = filteredInterns.map(i => i._id);
    const combined = Array.from(new Set([...form.values.internIds, ...visibleIds]));
    form.set('internIds', combined);
  };

  const clearSelected = () => {
    form.set('internIds', []);
  };

  const handleValidateForPreview = (e) => {
    e?.preventDefault();
    setApiError(null);
    if (!form.values.title.trim()) {
      form.set('title', form.values.title);
      toast.error('Meeting title is required');
      return;
    }
    if (!form.values.scheduledDate) {
      toast.error('Meeting date is required');
      return;
    }
    if (!form.values.startTime || !form.values.endTime || form.values.endTime <= form.values.startTime) {
      toast.error('End time must be after the start time');
      return;
    }
    if (!form.values.internIds.length) {
      toast.error('Please select at least one intern participant');
      return;
    }
    setStep('PREVIEW');
  };

  const handleFinalSubmit = async () => {
    if (submitting) return; // Prevent double submit idempotency
    setSubmitting(true);
    setApiError(null);

    const idempotencyKey = `meet_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    try {
      await api.post('/meetings', {
        title: form.values.title.trim(),
        type: form.values.type,
        scheduledDate: form.values.scheduledDate,
        startTime: form.values.startTime,
        endTime: form.values.endTime,
        internIds: form.values.internIds,
        meetingProvider: form.values.meetingProvider,
        idempotencyKey,
        ...(form.values.meetingLink.trim() ? { meetingLink: form.values.meetingLink.trim() } : {}),
        ...(form.values.agenda.trim() || form.values.description.trim()
          ? { agenda: (form.values.agenda || form.values.description).trim(), description: (form.values.description || form.values.agenda).trim() }
          : {}),
        ...(form.values.projectId ? { projectId: form.values.projectId } : {})
      });

      toast.success(
        form.values.meetingProvider === 'GOOGLE_MEET'
          ? 'Meeting scheduled with Google Meet conference and reminders set.'
          : 'Meeting scheduled successfully. Participants were notified.'
      );
      onDone();
    } catch (err) {
      const errMsg = err.message || 'Failed to schedule meeting';
      setApiError(errMsg);
      toast.error(errMsg);
      setStep('FORM'); // Return to form to fix
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCount = form.values.internIds.length;
  const isGoogleMeet = form.values.meetingProvider === 'GOOGLE_MEET';
  const isGoogleConnected = googleStatus.data?.isConnected;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      testId="meeting-modal"
      title={step === 'PREVIEW' ? 'Meeting Preview' : 'Schedule Meeting'}
      description={step === 'PREVIEW' ? 'Review conference details and participants before confirming.' : 'Create a 1-on-1, review or sync meeting.'}
    >
      {apiError && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Unable to schedule meeting</p>
              <p className="mt-0.5">{apiError}</p>
              {isGoogleMeet && !isGoogleConnected && (
                <p className="mt-2 text-rose-700 font-medium">
                  Tip: Connect your Google Workspace in Admin Settings &gt; Integrations to automatically create Google Calendar events and Meet links.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {step === 'FORM' ? (
        <form onSubmit={handleValidateForPreview} className="space-y-4">
          <FormGrid>
            <TextField {...f('title')} label="Meeting Title" required className="sm:col-span-2" placeholder="Weekly Intern Review" />
            <SelectField {...f('type')} label="Type" options={Object.values(MEETING_TYPE).map((t) => ({ value: t, label: humanize(t) }))} />
            <SelectField {...f('meetingProvider')} label="Meeting Platform" options={PROVIDERS} />
            <TextField {...f('scheduledDate')} label="Date" type="date" required min={todayISO()} />
            <div className="grid grid-cols-2 gap-2">
              <TextField {...f('startTime')} label="Start Time" type="time" required />
              <TextField {...f('endTime')} label="End Time" type="time" required />
            </div>

            {isGoogleMeet && (
              <div className="sm:col-span-2 rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-xs text-blue-900">
                <div className="flex items-center gap-2 font-medium">
                  <Video className="h-4 w-4 text-blue-700" />
                  <span>Google Meet Integration</span>
                  {isGoogleConnected ? (
                    <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="h-3 w-3" /> Workspace Linked
                    </span>
                  ) : (
                    <span className="ml-auto text-[11px] font-medium text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full">
                      OAuth setup optional
                    </span>
                  )}
                </div>
                <p className="mt-1 text-slate-600">
                  Google Meet conference URL and calendar invitations with 24-hour and 15-minute reminders will be provisioned.
                </p>
              </div>
            )}

            {!isGoogleMeet && form.values.meetingProvider !== 'IN_PERSON' && (
              <TextField
                {...f('meetingLink')}
                label="Custom Meeting Link"
                type="url"
                placeholder="https://..."
                className="sm:col-span-2"
                hint="Leave empty to automatically generate a secure meeting link."
              />
            )}

            <SelectField
              {...f('projectId')}
              label="Related Project (Optional)"
              placeholder="None (General / Direct Review)"
              options={(projects.data?.projects || projects.data || []).map((p) => ({ value: p._id, label: `${p.title} (${p.code || 'Project'})` }))}
              className="sm:col-span-2"
            />
          </FormGrid>

          {/* Participant Selection */}
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-600" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Select Intern Participants <span className="text-rose-600">*</span>
                </span>
                <span className="rounded-full bg-brand-100 px-2.5 py-0.5 font-mono text-xs font-bold text-brand-800">
                  {selectedCount} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllVisible}
                  className="text-xs font-semibold text-brand-700 hover:text-brand-900 focus:outline-none"
                >
                  Select all visible
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={clearSelected}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700 focus:outline-none"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="mb-2.5 relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search intern by name, email, or intern ID..."
                value={participantSearch}
                onChange={(e) => setParticipantSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
              {filteredInterns.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-500">No interns found matching filter.</p>
              ) : (
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {filteredInterns.map((i) => {
                    const checked = form.values.internIds.includes(i._id);
                    return (
                      <label
                        key={i._id}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-xs transition-colors ${
                          checked ? 'border-brand-300 bg-brand-50/60 font-medium text-brand-950' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                          checked={checked}
                          onChange={() => toggleIntern(i._id)}
                          data-testid={`meeting-intern-${i.internId}`}
                        />
                        <div className="truncate flex-1">
                          <p className="truncate font-semibold">{fullName(i.userId)}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{i.internId} &bull; {i.userId?.email}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Automated Reminders */}
          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="h-4 w-4 text-brand-600" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">Automated Reminders</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
              <label className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <input
                  type="checkbox"
                  checked={form.values.reminder24h}
                  onChange={(e) => form.set('reminder24h', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600"
                />
                <div>
                  <p className="font-semibold text-slate-800">24 Hours Before</p>
                  <p className="text-[10px] text-slate-500">In-app & Calendar reminder</p>
                </div>
              </label>

              <label className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <input
                  type="checkbox"
                  checked={form.values.reminder15m}
                  onChange={(e) => form.set('reminder15m', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600"
                />
                <div>
                  <p className="font-semibold text-slate-800">15 Minutes Before</p>
                  <p className="text-[10px] text-slate-500">Urgent join notification</p>
                </div>
              </label>
            </div>
          </div>

          <TextAreaField {...f('agenda')} label="Agenda / Discussion Topics" rows={2} placeholder="Points to discuss, milestones, blockers..." />

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" data-testid="preview-meeting-btn">
              Preview Meeting
            </Button>
          </div>
        </form>
      ) : (
        /* Real Useful Meeting Preview Step (§9) */
        <div className="space-y-5" data-testid="meeting-preview-screen">
          <div className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50/50 to-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-800 uppercase tracking-wide">
                  {humanize(form.values.type)}
                </span>
                <h3 className="mt-2 text-xl font-bold text-slate-900">{form.values.title}</h3>
              </div>
              <span className="rounded-lg bg-emerald-100 px-3 py-1 font-mono text-xs font-semibold text-emerald-800">
                {humanize(form.values.meetingProvider)}
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 text-xs">
              <div className="rounded-lg border border-slate-100 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Date & Time</p>
                <p className="mt-1 font-semibold text-slate-900 text-sm">
                  {fmtDate(form.values.scheduledDate)}
                </p>
                <p className="text-slate-600">
                  {form.values.startTime} &ndash; {form.values.endTime}
                </p>
              </div>

              <div className="rounded-lg border border-slate-100 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Platform</p>
                <div className="mt-1 flex items-center gap-1.5 font-semibold text-slate-900 text-sm">
                  <Video className="h-4 w-4 text-brand-600" />
                  <span>{humanize(form.values.meetingProvider)}</span>
                </div>
                <p className="text-slate-600">
                  {isGoogleMeet ? 'Real Google Meet conference will be provisioned' : 'Secure conference link'}
                </p>
              </div>

              <div className="rounded-lg border border-slate-100 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Participants ({selectedCount})</p>
                <ul className="mt-1 max-h-24 overflow-y-auto space-y-0.5 text-slate-700">
                  {internList.filter(i => form.values.internIds.includes(i._id)).map(i => (
                    <li key={i._id} className="flex items-center gap-1 font-medium">
                      &bull; {fullName(i.userId)} <span className="font-mono text-[10px] text-slate-500">({i.internId})</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-slate-100 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Delivery & Reminders</p>
                <div className="mt-1 space-y-1 text-slate-700">
                  <p className="flex items-center gap-1.5 text-emerald-700 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Google Calendar Event
                  </p>
                  {form.values.reminder24h && (
                    <p className="flex items-center gap-1.5 text-slate-700">
                      <Clock className="h-3.5 w-3.5 text-brand-600" /> 24 hours before
                    </p>
                  )}
                  {form.values.reminder15m && (
                    <p className="flex items-center gap-1.5 text-slate-700">
                      <Clock className="h-3.5 w-3.5 text-brand-600" /> 15 minutes before
                    </p>
                  )}
                </div>
              </div>
            </div>

            {form.values.agenda && (
              <div className="mt-4 rounded-lg border border-slate-100 bg-white p-3 text-xs">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Agenda</p>
                <p className="mt-1 text-slate-700 whitespace-pre-wrap">{form.values.agenda}</p>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-2">
            <Button type="button" variant="outline" icon={ArrowLeft} onClick={() => setStep('FORM')}>
              Edit Details
            </Button>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                type="button"
                loading={submitting}
                onClick={handleFinalSubmit}
                data-testid="confirm-schedule-meeting-btn"
              >
                Schedule Meeting
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function RescheduleModal({ meeting, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({ scheduledDate: todayISO(), startTime: '10:00', endTime: '11:00', reason: '' });
  const f = form.field;
  return (
    <FormModal
      open
      onClose={onClose}
      size="sm"
      testId="meeting-reschedule-modal"
      title="Reschedule Meeting"
      description="Updates Google Calendar event and notifies all participants."
      submitLabel="Reschedule"
      form={form}
      rules={{
        scheduledDate: rules.required('Date'),
        startTime: rules.required('Start'),
        endTime: [rules.required('End'), (v, a) => (v && a.startTime && v <= a.startTime ? 'End time must be after the start time' : null)],
        reason: [rules.required('Reason'), rules.min(3, 'Reason')]
      }}
      onSubmit={(v) => api.post(`/meetings/${meeting._id}/reschedule`, {
        scheduledDate: v.scheduledDate,
        startTime: v.startTime,
        endTime: v.endTime,
        reason: v.reason.trim()
      })}
      onDone={() => { toast.success('Meeting rescheduled and Google Calendar updated'); onDone(); }}
    >
      <FormGrid>
        <TextField {...f('scheduledDate')} label="Date" type="date" required min={todayISO()} />
        <div className="grid grid-cols-2 gap-3">
          <TextField {...f('startTime')} label="Start" type="time" required />
          <TextField {...f('endTime')} label="End" type="time" required />
        </div>
      </FormGrid>
      <TextAreaField {...f('reason')} label="Reason for Rescheduling" required rows={2} placeholder="Reason sent to participants..." />
    </FormModal>
  );
}

function ActionItemModal({ meeting, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({ title: '', assigneeId: '', dueDate: '', convertToTask: false });
  const f = form.field;
  return (
    <FormModal open onClose={onClose} size="sm" testId="action-item-modal" title="Add action item" submitLabel="Add" form={form}
      rules={{ title: [rules.required('Title'), rules.max(300, 'Title')], assigneeId: (v, a) => (a.convertToTask && !v ? 'Choose who the task is for' : null) }}
      onSubmit={(v) => api.post(`/meetings/${meeting._id}/action-items`, { title: v.title.trim(), ...(v.assigneeId ? { assigneeId: v.assigneeId } : {}), ...(v.dueDate ? { dueDate: v.dueDate } : {}), convertToTask: !!v.convertToTask })}
      onDone={() => { toast.success(form.values.convertToTask ? 'Action item added and a task was created' : 'Action item added'); onDone(); }}>
      <TextField {...f('title')} label="Action item" required />
      <SelectField {...f('assigneeId')} label="Assignee" placeholder="Unassigned" options={(meeting.participants || []).map((p) => ({ value: p._id, label: fullName(p) }))} />
      <TextField {...f('dueDate')} label="Due date" type="date" />
      <CheckboxField name="convertToTask" label="Also create a task for the assignee" checked={form.values.convertToTask} onChange={f('convertToTask').onChange} />
    </FormModal>
  );
}

function StatusModal({ meeting, status, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({ notes: meeting.notes || '' });
  return (
    <FormModal
      open
      onClose={onClose}
      size="sm"
      testId="meeting-status-modal"
      title={`Mark meeting ${humanize(status).toLowerCase()}`}
      description={status === 'CANCELLED' ? 'Cancels Google Calendar event and alerts participants.' : ''}
      submitLabel="Confirm"
      submitVariant={['CANCELLED', 'NO_SHOW'].includes(status) ? 'danger' : 'primary'}
      form={form}
      onSubmit={(v) => api.patch(`/meetings/${meeting._id}/status`, { status, ...(v.notes.trim() ? { notes: v.notes.trim() } : {}) })}
      onDone={() => { toast.success(`Meeting marked as ${humanize(status).toLowerCase()}`); onDone(); }}
    >
      <TextAreaField {...form.field('notes')} label="Notes" rows={4} hint="Optional decisions, follow-ups or cancellation reason." />
    </FormModal>
  );
}

export function MeetingsPage() {
  const { can, user } = useAuth();
  const state = useFetch(() => api.get('/meetings'), []);
  const [modal, setModal] = useState(null);
  const close = () => setModal(null);
  const done = () => { close(); state.reload({ silent: true }); };
  const manages = (m) => can('meetings.manage') && (!['MENTOR', 'TEAM_LEAD'].includes(user.role) || m.mentorId?._id === user._id);

  const cols = [
    {
      key: 'title',
      header: 'Meeting',
      render: (m) => (
        <div>
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-slate-900">{m.title}</p>
            {m.meetingProvider === 'GOOGLE_MEET' && (
              <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200" title="Google Meet Scheduled">
                <Video className="h-3 w-3" /> Meet
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600">{humanize(m.type)} &bull; host {fullName(m.mentorId)}</p>
        </div>
      )
    },
    { key: 'when', header: 'When', render: (m) => `${fmtDate(m.scheduledDate)}, ${m.startTime}-${m.endTime}` },
    { key: 'people', header: 'Participants', render: (m) => (m.participants || []).map((p) => p.firstName).join(', ') },
    {
      key: 'reminders',
      header: 'Reminders',
      render: (m) => (
        <div className="space-y-0.5 text-[11px]">
          <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">
            24h &bull; {m.reminders?.[0]?.status || 'SCHEDULED'}
          </span>
          <br />
          <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">
            15m &bull; {m.reminders?.[1]?.status || 'SCHEDULED'}
          </span>
        </div>
      )
    },
    { key: 'status', header: 'Status', render: (m) => <StatusBadge status={m.status} /> },
    { key: 'link', header: 'Conference Link', render: (m) => (OPEN.includes(m.status) || m.status === 'STARTED' ? <MeetingLink url={m.meetingLink || m.googleMeetLink} /> : '-') },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (m) => manages(m) && (
        <div className="flex flex-wrap justify-end gap-2">
          {OPEN.includes(m.status) && <Button size="sm" variant="outline" onClick={() => setModal({ type: 'reschedule', m })} data-testid={`meeting-reschedule-${m._id}`}>Reschedule</Button>}
          {(NEXT[m.status] || []).slice(0, 2).map((s) => <Button key={s} size="sm" variant="outline" onClick={() => setModal({ type: 'status', m, s })} data-testid={`meeting-${s}-${m._id}`}>{humanize(s)}</Button>)}
          {!['CANCELLED', 'NO_SHOW'].includes(m.status) && <Button size="sm" variant="outline" onClick={() => setModal({ type: 'item', m })} data-testid={`meeting-item-${m._id}`}>Action item</Button>}
        </div>
      )
    }
  ];

  return (
    <>
      <PageHeader
        title="Meetings"
        description="1-on-1s, syncs and intern reviews with integrated Google Meet and automated calendar reminders."
        actions={(
          <div className="flex items-center gap-2">
            <Link
              to="/admin/google-meet"
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
              data-testid="open-gmeet-dashboard-link"
            >
              <Video className="h-4 w-4" /> Google Meet Hub
            </Link>
            {can('meetings.manage') && <Button icon={Plus} onClick={() => setModal({ type: 'new' })} data-testid="new-meeting">Schedule meeting</Button>}
          </div>
        )}
      />
      <DataTable
        testId="meetings-table"
        columns={cols}
        rows={state.data || []}
        loading={state.loading}
        error={state.error}
        onRetry={state.reload}
        caption="Meetings"
        emptyTitle="No meetings"
        emptyDescription="Schedule a meeting with one or more interns."
      />
      {modal?.type === 'new' && <NewMeetingModal onClose={close} onDone={done} />}
      {modal?.type === 'reschedule' && <RescheduleModal meeting={modal.m} onClose={close} onDone={done} />}
      {modal?.type === 'item' && <ActionItemModal meeting={modal.m} onClose={close} onDone={done} />}
      {modal?.type === 'status' && <StatusModal meeting={modal.m} status={modal.s} onClose={close} onDone={done} />}
    </>
  );
}

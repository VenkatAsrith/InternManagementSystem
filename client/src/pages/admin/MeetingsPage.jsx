import React, { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Plus, Video, Calendar, Bell, CheckCircle2, AlertCircle, ArrowLeft,
  Search, Users, ExternalLink, Clock, Copy, Check, RefreshCw, AlertTriangle,
  Globe, Link2, ShieldCheck, Mail, BookOpen, Layers, X
} from 'lucide-react';
import api from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useForm, rules } from '../../hooks/useForm';
import { fmtDate, fullName, humanize, todayISO } from '../../lib/format';
import { MEETING_TYPE } from '@shared/constants.js';
import { Button, CheckboxField, DataTable, FormGrid, FormModal, Modal, PageHeader, SelectField, StatusBadge, TextAreaField, TextField } from '../../components/ui';
import { MeetingLink } from '../intern/InternMeetingsPage';

const NEXT = {
  SCHEDULED: ['STARTED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
  RESCHEDULED: ['STARTED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
  STARTED: ['COMPLETED']
};
const OPEN = ['SCHEDULED', 'RESCHEDULED'];

const PROVIDERS = [
  { value: 'GOOGLE_MEET', label: 'Google Meet (Official Calendar API)' },
  { value: 'MS_TEAMS', label: 'Microsoft Teams' },
  { value: 'ZOOM', label: 'Zoom' },
  { value: 'CUSTOM', label: 'Custom Platform' },
  { value: 'IN_PERSON', label: 'In Person' }
];

const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'India Standard Time (IST, UTC+5:30)' },
  { value: 'UTC', label: 'Coordinated Universal Time (UTC)' },
  { value: 'America/New_York', label: 'Eastern Time (ET, UTC-5)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT, UTC-8)' },
  { value: 'Europe/London', label: 'Greenwich Mean Time (GMT, UTC+0)' },
  { value: 'Asia/Dubai', label: 'Gulf Standard Time (GST, UTC+4)' },
  { value: 'Asia/Singapore', label: 'Singapore Time (SGT, UTC+8)' }
];

function GoogleIntegrationBanner({ googleStatus, onReload }) {
  const toast = useToast();
  const [connecting, setConnecting] = useState(false);

  const isConnected = !!googleStatus.data?.isConnected;
  const isConfigured = googleStatus.data?.isConfigured !== false;
  const accountEmail = googleStatus.data?.accountEmail;
  const missingConfig = googleStatus.data?.missingConfig || [];

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await api.get('/integrations/google/auth-url');
      if (res.data?.authUrl) {
        window.location.href = res.data.authUrl;
      } else {
        toast.error('Unable to generate Google authorization URL');
      }
    } catch (err) {
      toast.error(err.message || 'Google OAuth initialization failed');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect Google Calendar integration?')) return;
    try {
      await api.post('/integrations/google/disconnect');
      toast.success('Google Workspace account disconnected');
      onReload();
    } catch (err) {
      toast.error(err.message || 'Failed to disconnect');
    }
  };

  if (isConnected) {
    return (
      <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-emerald-900 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm flex-shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold text-sm text-emerald-950">Google Calendar & Meet Connected</p>
                <span className="rounded-full bg-emerald-200/80 px-2.5 py-0.5 text-[11px] font-bold text-emerald-900 uppercase">
                  Live OAuth 2.0
                </span>
              </div>
              <p className="text-xs text-emerald-800 mt-0.5">
                Authorized account: <strong className="font-semibold text-emerald-950">{accountEmail}</strong> &bull; Genuine Google Meet conferences & Calendar events will be provisioned.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center">
            <Button size="sm" variant="outline" onClick={handleConnect} loading={connecting} title="Reconnect Google Account">
              Reconnect
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDisconnect} className="text-emerald-800 hover:text-rose-700 hover:bg-rose-50">
              Disconnect
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-amber-900 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm flex-shrink-0 mt-0.5">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm text-amber-950">Google Meet Integration Not Configured</p>
            <p className="text-xs text-amber-800 mt-0.5">
              The Google Calendar API requires environment variables in <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[11px]">server/.env</code>:
              {' '}<strong className="font-semibold">{missingConfig.join(', ')}</strong>.
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Add your Google OAuth 2.0 Client ID and Client Secret from the Google Cloud Console to enable automated Google Meet creation.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50/60 p-4 text-blue-900 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm flex-shrink-0">
            <Video className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-bold text-sm text-blue-950">Google Calendar Not Connected</p>
              <span className="rounded-full bg-blue-200/80 px-2 py-0.5 text-[10px] font-bold text-blue-900 uppercase">
                Action Required
              </span>
            </div>
            <p className="text-xs text-blue-800 mt-0.5">
              Connect your authorized Google Workspace account to generate real Google Meet conference links and calendar invitations.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="primary"
          icon={Video}
          onClick={handleConnect}
          loading={connecting}
          className="self-end sm:self-center shadow-sm"
          data-testid="connect-google-calendar-banner-btn"
        >
          Connect Google Calendar
        </Button>
      </div>
    </div>
  );
}

function NewMeetingModal({ onClose, onDone, isGoogleConnected, onConnectGoogle }) {
  const toast = useToast();
  const { user } = useAuth();
  const interns = useFetch(() => api.get('/interns', { params: { open: true, limit: 200 } }), []);
  const staff = useFetch(() => api.get('/users', { params: { limit: 150 } }), []);
  const projects = useFetch(() => api.get('/projects', { params: { limit: 100 } }), []);
  const bootcamps = useFetch(() => api.get('/growth/bootcamps'), []);
  const programs = useFetch(() => api.get('/training/programs'), []);

  const [step, setStep] = useState('FORM'); // 'FORM' | 'CONFIRMATION'
  const [participantSearch, setParticipantSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [createdMeeting, setCreatedMeeting] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const form = useForm({
    title: '',
    type: 'MENTOR_1ON1',
    scheduledDate: todayISO(),
    startTime: '10:00',
    endTime: '11:00',
    timezone: 'Asia/Kolkata',
    internIds: [],
    participants: [],
    externalAttendees: '',
    meetingProvider: 'GOOGLE_MEET',
    meetingLink: '',
    agenda: '',
    description: '',
    projectId: '',
    programId: '',
    bootcampId: '',
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

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    toast.success('Google Meet link copied to clipboard');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setApiError(null);

    // Validation
    if (!form.values.title.trim()) {
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

    const isGoogleMeet = form.values.meetingProvider === 'GOOGLE_MEET';
    if (isGoogleMeet && !isGoogleConnected) {
      setApiError('Google Calendar is not connected. Please connect your Google account before scheduling a Google Meet conference.');
      toast.error('Google Calendar account not connected');
      return;
    }

    if (submitting) return; // Prevent double submit idempotency
    setSubmitting(true);

    const idempotencyKey = `meet_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    try {
      const res = await api.post('/meetings', {
        title: form.values.title.trim(),
        type: form.values.type,
        scheduledDate: form.values.scheduledDate,
        startTime: form.values.startTime,
        endTime: form.values.endTime,
        timezone: form.values.timezone,
        internIds: form.values.internIds,
        meetingProvider: form.values.meetingProvider,
        idempotencyKey,
        ...(form.values.externalAttendees.trim() ? { externalAttendees: form.values.externalAttendees.trim() } : {}),
        ...(form.values.meetingLink.trim() ? { meetingLink: form.values.meetingLink.trim() } : {}),
        ...(form.values.agenda.trim() || form.values.description.trim()
          ? { agenda: (form.values.agenda || form.values.description).trim(), description: (form.values.description || form.values.agenda).trim() }
          : {}),
        ...(form.values.projectId ? { projectId: form.values.projectId } : {}),
        ...(form.values.programId ? { programId: form.values.programId } : {}),
        ...(form.values.bootcampId ? { bootcampId: form.values.bootcampId } : {})
      });

      const meetingData = res.data;
      setCreatedMeeting(meetingData);
      setStep('CONFIRMATION');
      toast.success('Meeting created successfully with genuine Google Meet link and reminders!');
    } catch (err) {
      const errMsg = err.message || 'Failed to schedule meeting';
      setApiError(errMsg);
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCount = form.values.internIds.length;
  const isGoogleMeet = form.values.meetingProvider === 'GOOGLE_MEET';

  return (
    <Modal
      open
      onClose={() => {
        if (step === 'CONFIRMATION') onDone();
        else onClose();
      }}
      size="lg"
      testId="meeting-modal"
      title={step === 'CONFIRMATION' ? 'Meeting Confirmed & Provisioned' : 'Schedule Meeting'}
      description={step === 'CONFIRMATION' ? 'Google Calendar event and video conference have been generated successfully.' : 'Create a 1-on-1, review or sync meeting with genuine conference link.'}
    >
      {step === 'FORM' ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          {apiError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-rose-950">Unable to schedule meeting</p>
                  <p className="mt-0.5">{apiError}</p>
                  {isGoogleMeet && !isGoogleConnected && (
                    <div className="mt-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        icon={Video}
                        onClick={onConnectGoogle}
                      >
                        Connect Google Calendar Now
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <FormGrid>
            <TextField {...f('title')} label="Meeting Title" required className="sm:col-span-2" placeholder="e.g. Weekly Technical Progress Review" />
            <SelectField {...f('type')} label="Meeting Type" options={Object.values(MEETING_TYPE).map((t) => ({ value: t, label: humanize(t) }))} />
            <SelectField {...f('meetingProvider')} label="Meeting Platform" options={PROVIDERS} />
            <TextField {...f('scheduledDate')} label="Meeting Date" type="date" required min={todayISO()} />
            <div className="grid grid-cols-2 gap-2">
              <TextField {...f('startTime')} label="Start Time" type="time" required />
              <TextField {...f('endTime')} label="End Time" type="time" required />
            </div>
            <SelectField {...f('timezone')} label="Time Zone" options={TIMEZONES} />
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Meeting Organizer</label>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 font-medium truncate">
                {fullName(user)} ({user?.email}) &bull; {humanize(user?.role)}
              </div>
            </div>

            {isGoogleMeet && (
              <div className="sm:col-span-2 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900">
                <div className="flex items-center justify-between gap-2 font-medium">
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-blue-700" />
                    <span className="font-semibold">Google Meet Integration</span>
                  </div>
                  {isGoogleConnected ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                      <CheckCircle2 className="h-3 w-3" /> Workspace Authorized
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={onConnectGoogle}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-full border border-amber-300 transition-colors"
                    >
                      <AlertTriangle className="h-3 w-3" /> Connect Required &rarr;
                    </button>
                  )}
                </div>
                <p className="mt-1 text-slate-600">
                  {isGoogleConnected
                    ? 'A real Google Calendar event will be created and an authentic Google Meet URL generated.'
                    : 'Google Calendar must be connected before scheduling a Google Meet conference.'}
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
                hint="Leave empty to automatically generate a secure meeting conference link."
              />
            )}

            <TextField
              {...f('externalAttendees')}
              label="External Attendee Emails (Optional)"
              type="text"
              placeholder="client@partner.com, advisor@external.org (comma-separated)"
              className="sm:col-span-2"
              hint="External guests will receive calendar invites and reminder emails."
            />

            <SelectField
              {...f('projectId')}
              label="Related Project (Optional)"
              placeholder="None (General / Direct Review)"
              options={(projects.data?.projects || projects.data || []).map((p) => ({ value: p._id, label: `${p.title} (${p.code || 'Project'})` }))}
            />

            <SelectField
              {...f('programId')}
              label="Related Training Program (Optional)"
              placeholder="None (Direct Review)"
              options={(programs.data || []).map((p) => ({ value: p._id, label: `${p.title} (${p.code || 'Track'})` }))}
            />

            <SelectField
              {...f('bootcampId')}
              label="Related Bootcamp (Optional)"
              placeholder="None"
              options={(bootcamps.data || []).map((b) => ({ value: b._id, label: `${b.title} (${b.category || 'Bootcamp'})` }))}
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

          {/* Automated Reminders Configuration */}
          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="h-4 w-4 text-brand-600" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">Automated Dual Reminders</span>
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
                  <p className="text-[10px] text-slate-500">Automated email & calendar notification</p>
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
                  <p className="text-[10px] text-slate-500">Direct urgent join alert to all attendees</p>
                </div>
              </label>
            </div>
          </div>

          <TextAreaField {...f('agenda')} label="Agenda / Discussion Topics" rows={2} placeholder="Points to discuss, milestones, blockers..." />

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={submitting}
              disabled={isGoogleMeet && !isGoogleConnected}
              data-testid="create-meeting-submit-btn"
            >
              Create Meeting
            </Button>
          </div>
        </form>
      ) : (
        /* Step 5 — Meeting Confirmation Screen */
        <div className="space-y-5" data-testid="meeting-confirmation-screen">
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 text-xs font-bold uppercase tracking-wide border border-emerald-200">
                  Meeting Created & Confirmed
                </span>
                <h3 className="mt-2 text-xl font-bold text-slate-900">{createdMeeting?.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Type: {humanize(createdMeeting?.type)} &bull; Organizer: {fullName(user)}
                </p>
              </div>
              <span className="rounded-lg bg-blue-100 text-blue-800 px-3 py-1 text-xs font-bold border border-blue-200">
                {humanize(createdMeeting?.meetingProvider || 'GOOGLE_MEET')}
              </span>
            </div>

            {/* Meet Link Highlight Box */}
            <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50/80 p-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 block mb-1">
                Authentic Google Meet Joining Link
              </span>
              <p className="font-mono text-base font-bold text-blue-900 select-all break-all">
                {createdMeeting?.googleMeetLink || createdMeeting?.meetingLink}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  icon={copiedLink ? Check : Copy}
                  onClick={() => copyToClipboard(createdMeeting?.googleMeetLink || createdMeeting?.meetingLink)}
                  data-testid="copy-meet-link-confirm-btn"
                >
                  {copiedLink ? 'Copied to Clipboard' : 'Copy Meet Link'}
                </Button>
                <a
                  href={createdMeeting?.googleMeetLink || createdMeeting?.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors shadow-sm"
                  data-testid="open-google-meet-confirm-btn"
                >
                  <Video className="h-4 w-4" /> Open Google Meet
                </a>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 text-xs">
              <div className="rounded-lg border border-slate-100 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Date & Time</p>
                <p className="mt-1 font-semibold text-slate-900 text-sm">
                  {fmtDate(createdMeeting?.scheduledDate)}
                </p>
                <p className="text-slate-600">
                  {createdMeeting?.startTime} &ndash; {createdMeeting?.endTime} ({createdMeeting?.timezone || 'Asia/Kolkata'})
                </p>
              </div>

              <div className="rounded-lg border border-slate-100 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Google Calendar Event</p>
                <p className="mt-1 font-mono text-xs text-slate-700">
                  {createdMeeting?.googleCalendarEventId || 'primary_event'}
                </p>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 mt-1">
                  <CheckCircle2 className="h-3 w-3" /> Event Synchronized
                </span>
              </div>

              <div className="rounded-lg border border-slate-100 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Participants ({createdMeeting?.participants?.length || selectedCount})</p>
                <p className="mt-1 text-slate-700 font-medium">
                  {selectedCount} intern participant(s) enrolled
                </p>
                {form.values.externalAttendees && (
                  <p className="text-[11px] text-slate-500 mt-1 truncate">
                    Guests: {form.values.externalAttendees}
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-slate-100 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Dual Reminders</p>
                <div className="mt-1 space-y-0.5 text-slate-700">
                  <p className="flex items-center gap-1.5 text-emerald-700 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" /> 24 Hours Before: Scheduled
                  </p>
                  <p className="flex items-center gap-1.5 text-emerald-700 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" /> 15 Minutes Before: Scheduled
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              variant="primary"
              onClick={onDone}
              data-testid="done-confirm-meeting-btn"
            >
              Done & View Meeting in List
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function MeetingDetailsModal({ meeting, onClose, onReschedule, onStatusChange }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const meetUrl = meeting.googleMeetLink || meeting.meetingLink;

  const copyLink = () => {
    if (!meetUrl) return;
    navigator.clipboard.writeText(meetUrl);
    setCopied(true);
    toast.success('Meeting link copied');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      testId="meeting-details-modal"
      title={meeting.title}
      description={`${humanize(meeting.type)} • Organized by ${fullName(meeting.organizerId || meeting.mentorId)}`}
    >
      <div className="space-y-4">
        {meetUrl && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 block mb-1">
              Google Meet Conference URL
            </span>
            <p className="font-mono text-sm font-bold text-blue-900 break-all select-all">
              {meetUrl}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Button size="sm" variant="outline" icon={copied ? Check : Copy} onClick={copyLink}>
                {copied ? 'Copied' : 'Copy Meet Link'}
              </Button>
              <a
                href={meetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <Video className="h-3.5 w-3.5" /> Open Google Meet
              </a>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 text-xs">
          <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">When</span>
            <p className="mt-1 font-semibold text-slate-900">{fmtDate(meeting.scheduledDate)}</p>
            <p className="text-slate-600">{meeting.startTime} &ndash; {meeting.endTime} ({meeting.timezone || 'Asia/Kolkata'})</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Status & Provider</span>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={meeting.status} />
              <span className="font-semibold text-slate-700">{humanize(meeting.meetingProvider)}</span>
            </div>
          </div>
        </div>

        <div>
          <span className="text-xs font-semibold text-slate-700 uppercase block mb-1.5">Participants</span>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            {(meeting.participants || []).map((p) => (
              <span key={p._id} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-800">
                {fullName(p)} <span className="text-slate-500 font-mono text-[10px]">({p.email})</span>
              </span>
            ))}
            {(meeting.externalAttendees || []).map((email, idx) => (
              <span key={idx} className="rounded-md bg-blue-50 px-2 py-1 text-xs text-blue-800 border border-blue-200">
                {email} (Guest)
              </span>
            ))}
          </div>
        </div>

        {meeting.agenda && (
          <div>
            <span className="text-xs font-semibold text-slate-700 uppercase block mb-1">Agenda</span>
            <p className="text-xs text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-100">
              {meeting.agenda}
            </p>
          </div>
        )}

        {meeting.reminders?.length > 0 && (
          <div>
            <span className="text-xs font-semibold text-slate-700 uppercase block mb-1">Automated Reminders</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {meeting.reminders.map((rem, idx) => (
                <div key={idx} className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                  <p className="font-semibold text-slate-800">{rem.type === '24_HOURS' ? '24 Hours Before' : '15 Minutes Before'}</p>
                  <p className="text-[11px] text-slate-500">Status: <strong className="text-emerald-700">{rem.status}</strong></p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="outline" onClick={onClose}>Close</Button>
          {OPEN.includes(meeting.status) && (
            <Button variant="primary" onClick={() => { onClose(); onReschedule(meeting); }}>
              Reschedule
            </Button>
          )}
        </div>
      </div>
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
      description="Updates Google Calendar event, recalculates reminders, and notifies participants."
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
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const state = useFetch(() => api.get('/meetings'), []);
  const googleStatus = useFetch(() => api.get('/integrations/google/status'), []);

  const [modal, setModal] = useState(null);
  const [selectedMeeting, setSelectedMeeting] = useState(null);

  const close = () => { setModal(null); setSelectedMeeting(null); };
  const done = () => { close(); state.reload({ silent: true }); googleStatus.reload({ silent: true }); };
  const manages = (m) => can('meetings.manage') && (!['MENTOR', 'TEAM_LEAD'].includes(user.role) || m.mentorId?._id === user._id);

  // Check URL query parameters for OAuth redirect notifications
  useEffect(() => {
    const googleParam = searchParams.get('google');
    if (googleParam === 'connected') {
      const email = searchParams.get('email');
      toast.success(email ? `Google Workspace connected successfully (${email})!` : 'Google Workspace connected successfully!');
      googleStatus.reload({ silent: true });
      searchParams.delete('google');
      searchParams.delete('email');
      setSearchParams(searchParams, { replace: true });
    } else if (googleParam === 'error') {
      const msg = searchParams.get('message') || 'Google authentication failed';
      toast.error(msg);
      searchParams.delete('google');
      searchParams.delete('message');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, toast, googleStatus]);

  const handleConnectGoogle = async () => {
    try {
      const res = await api.get('/integrations/google/auth-url');
      if (res.data?.authUrl) {
        window.location.href = res.data.authUrl;
      } else {
        toast.error('Unable to generate Google authorization URL');
      }
    } catch (err) {
      toast.error(err.message || 'Google OAuth initialization failed');
    }
  };

  const cols = [
    {
      key: 'title',
      header: 'Meeting',
      render: (m) => (
        <div>
          <button
            type="button"
            onClick={() => setSelectedMeeting(m)}
            className="text-left font-semibold text-slate-900 hover:text-blue-600 transition-colors flex items-center gap-1.5"
            data-testid={`meeting-title-${m._id}`}
          >
            <span>{m.title}</span>
            {m.meetingProvider === 'GOOGLE_MEET' && (
              <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200" title="Google Meet Scheduled">
                <Video className="h-3 w-3" /> Meet
              </span>
            )}
          </button>
          <p className="text-xs text-slate-600">{humanize(m.type)} &bull; host {fullName(m.mentorId || m.organizerId)}</p>
        </div>
      )
    },
    { key: 'when', header: 'When', render: (m) => `${fmtDate(m.scheduledDate)}, ${m.startTime}-${m.endTime}` },
    {
      key: 'people',
      header: 'Participants',
      render: (m) => (
        <span className="text-xs text-slate-700">
          {(m.participants || []).map((p) => p.firstName).join(', ') || 'No attendees'}
        </span>
      )
    },
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
      render: (m) => (
        <div className="flex flex-wrap justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setSelectedMeeting(m)} data-testid={`view-details-${m._id}`}>
            Details
          </Button>
          {manages(m) && OPEN.includes(m.status) && (
            <Button size="sm" variant="outline" onClick={() => setModal({ type: 'reschedule', m })} data-testid={`meeting-reschedule-${m._id}`}>
              Reschedule
            </Button>
          )}
          {manages(m) && (NEXT[m.status] || []).slice(0, 1).map((s) => (
            <Button key={s} size="sm" variant="outline" onClick={() => setModal({ type: 'status', m, s })} data-testid={`meeting-${s}-${m._id}`}>
              {humanize(s)}
            </Button>
          ))}
        </div>
      )
    }
  ];

  return (
    <>
      <PageHeader
        title="Meetings"
        description="Schedule 1-on-1s, technical reviews, and sync calls with genuine Google Meet links and automated dual reminders."
        actions={(
          <div className="flex items-center gap-2">
            <Link
              to="/admin/google-meet"
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
              data-testid="open-gmeet-dashboard-link"
            >
              <Video className="h-4 w-4" /> Google Meet Hub
            </Link>
            {can('meetings.manage') && (
              <Button icon={Plus} onClick={() => setModal({ type: 'new' })} data-testid="new-meeting">
                Schedule Meeting
              </Button>
            )}
          </div>
        )}
      />

      {/* Integration Diagnostic Banner */}
      <GoogleIntegrationBanner
        googleStatus={googleStatus}
        onReload={() => googleStatus.reload({ silent: true })}
      />

      <DataTable
        testId="meetings-table"
        columns={cols}
        rows={state.data || []}
        loading={state.loading}
        error={state.error}
        onRetry={state.reload}
        caption="Meetings"
        emptyTitle="No meetings scheduled"
        emptyDescription="Schedule a real Google Meet meeting with one or more interns to get started."
      />

      {modal?.type === 'new' && (
        <NewMeetingModal
          onClose={close}
          onDone={done}
          isGoogleConnected={!!googleStatus.data?.isConnected}
          onConnectGoogle={handleConnectGoogle}
        />
      )}
      {selectedMeeting && (
        <MeetingDetailsModal
          meeting={selectedMeeting}
          onClose={() => setSelectedMeeting(null)}
          onReschedule={(m) => setModal({ type: 'reschedule', m })}
          onStatusChange={(m, s) => setModal({ type: 'status', m, s })}
        />
      )}
      {modal?.type === 'reschedule' && <RescheduleModal meeting={modal.m} onClose={close} onDone={done} />}
      {modal?.type === 'item' && <ActionItemModal meeting={modal.m} onClose={close} onDone={done} />}
      {modal?.type === 'status' && <StatusModal meeting={modal.m} status={modal.s} onClose={close} onDone={done} />}
    </>
  );
}

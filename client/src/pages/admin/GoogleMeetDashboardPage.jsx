import React, { useState } from 'react';
import {
  Video, Calendar, Plus, ExternalLink, Copy, Check, Users, Mail,
  Send, RefreshCw, CheckCircle2, XCircle, AlertCircle, Sparkles, Clock, Radio
} from 'lucide-react';
import api from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useForm, rules } from '../../hooks/useForm';
import { fmtDate, fullName, humanize, todayISO } from '../../lib/format';
import {
  Button, DataTable, DetailList, FormGrid, FormModal, Modal,
  PageHeader, SectionCard, SelectField, StatusBadge, Tabs, TabPanel,
  TextAreaField, TextField, StatCard, InlineAlert
} from '../../components/ui';
import { ROLES } from '@shared/constants.js';

export function GoogleMeetDashboardPage() {
  const { user, can } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('meet-hub');
  const [copiedLink, setCopiedLink] = useState(null);

  // Instant meet state
  const [instantMeetLoading, setInstantMeetLoading] = useState(false);
  const [instantMeetData, setInstantMeetData] = useState(null);
  const [instantModalOpen, setInstantModalOpen] = useState(false);
  const [instantTitle, setInstantTitle] = useState('Instant Google Meet Sync');
  const [selectedParticipants, setSelectedParticipants] = useState([]);

  // Email Broadcast state
  const [broadcastRoles, setBroadcastRoles] = useState(['INTERN']);
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastActionUrl, setBroadcastActionUrl] = useState('');
  const [broadcastActionText, setBroadcastActionText] = useState('');
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastPreview, setBroadcastPreview] = useState(false);

  // Data queries
  const googleStatus = useFetch(() => api.get('/integrations/google/status'), []);
  const meetings = useFetch(() => api.get('/meetings'), []);
  const roleSummary = useFetch(() => api.get('/emails/roles-summary'), []);
  const users = useFetch(() => api.get('/users', { params: { limit: 150 } }), []);
  const emailLogs = useFetch(() => api.get('/emails/logs', { params: { limit: 20 } }), []);

  const isGoogleConnected = googleStatus.data?.isConnected;
  const isMeetAvailable = googleStatus.data?.meetAvailable;

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(id);
    toast.success('Google Meet link copied to clipboard');
    setTimeout(() => setCopiedLink(null), 2500);
  };

  const handleStartInstantMeet = async () => {
    setInstantMeetLoading(true);
    try {
      const res = await api.post('/integrations/google/instant-meet', {
        title: instantTitle || 'Instant Google Meet Conference',
        participants: selectedParticipants,
        saveAsMeeting: true
      });
      setInstantMeetData(res.data);
      toast.success('Instant Google Meet room created');
      meetings.reload({ silent: true });
    } catch (err) {
      toast.error(err.message || 'Failed to create Google Meet room');
    } finally {
      setInstantMeetLoading(false);
    }
  };

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastSubject.trim()) return toast.error('Please enter an email subject');
    if (!broadcastMessage.trim()) return toast.error('Please enter an announcement message');
    if (!broadcastRoles.length) return toast.error('Please select at least one recipient role');

    setBroadcastSending(true);
    try {
      const res = await api.post('/emails/broadcast', {
        roles: broadcastRoles,
        subject: broadcastSubject.trim(),
        message: broadcastMessage.trim(),
        ...(broadcastActionUrl.trim() ? { actionUrl: broadcastActionUrl.trim() } : {}),
        ...(broadcastActionText.trim() ? { actionText: broadcastActionText.trim() } : {})
      });

      toast.success(res.message || `Dispatched to ${res.data?.sentCount || 0} user(s)`);
      setBroadcastSubject('');
      setBroadcastMessage('');
      setBroadcastActionUrl('');
      setBroadcastActionText('');
      setBroadcastPreview(false);
      emailLogs.reload({ silent: true });
    } catch (err) {
      toast.error(err.message || 'Failed to dispatch email broadcast');
    } finally {
      setBroadcastSending(false);
    }
  };

  const toggleRole = (r) => {
    if (r === 'ALL') {
      setBroadcastRoles(broadcastRoles.includes('ALL') ? [] : ['ALL']);
      return;
    }
    const withoutAll = broadcastRoles.filter(x => x !== 'ALL');
    if (withoutAll.includes(r)) {
      setBroadcastRoles(withoutAll.filter(x => x !== r));
    } else {
      setBroadcastRoles([...withoutAll, r]);
    }
  };

  // Calculate target audience count for email broadcast
  const roleCounts = roleSummary.data?.roleCounts || {};
  const totalActiveRecipients = broadcastRoles.includes('ALL')
    ? (roleSummary.data?.totalActive || 0)
    : broadcastRoles.reduce((sum, r) => sum + (roleCounts[r] || 0), 0);

  // Filter Google Meet conferences
  const allMeetingsList = meetings.data || [];
  const googleMeets = allMeetingsList.filter(m => m.meetingProvider === 'GOOGLE_MEET' || m.googleMeetLink);
  const activeMeets = googleMeets.filter(m => ['SCHEDULED', 'RESCHEDULED', 'STARTED'].includes(m.status));

  return (
    <>
      <PageHeader
        title="Google Meet & Communications Dashboard"
        description="Launch real-time video conferences, manage Google Workspace calendar links, and broadcast announcements to all organizational roles."
        actions={(
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              icon={RefreshCw}
              onClick={() => {
                googleStatus.reload({ silent: true });
                meetings.reload({ silent: true });
                roleSummary.reload({ silent: true });
              }}
              data-testid="refresh-meet-hub"
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              icon={Video}
              onClick={() => setInstantModalOpen(true)}
              data-testid="open-instant-meet-btn"
            >
              Instant Google Meet
            </Button>
          </div>
        )}
      />

      {/* Overview Stat Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Google Workspace"
          value={isGoogleConnected ? 'Connected' : 'Ready'}
          hint={isGoogleConnected ? googleStatus.data?.accountEmail : 'One-click meet active'}
        />
        <StatCard
          label="Google Meets"
          value={googleMeets.length}
          hint={`${activeMeets.length} upcoming or active`}
        />
        <StatCard
          label="Active Staff & Interns"
          value={roleSummary.data?.totalActive || 0}
          hint="Across all org roles"
        />
        <StatCard
          label="Calendar Sync"
          value={isGoogleConnected ? 'Automated' : 'Direct URL'}
          hint="Reminders enabled"
        />
      </div>

      <Tabs
        label="Dashboard sections"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'meet-hub', label: 'Google Meet Hub', count: activeMeets.length },
          { id: 'email-broadcast', label: 'Broadcast by Role' },
          { id: 'calendar', label: 'All Video Conferences', count: googleMeets.length },
          { id: 'logs', label: 'Email Delivery Logs' }
        ]}
      />

      {/* TAB 1: GOOGLE MEET HUB */}
      <TabPanel id="meet-hub" active={tab}>
        <div className="space-y-6">
          {/* Quick Meet Launcher Card */}
          <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 p-6 text-white shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-300 border border-blue-400/30">
                  <Radio className="h-3.5 w-3.5 animate-pulse text-emerald-400" />
                  Live Video Collaboration
                </div>
                <h3 className="text-2xl font-bold tracking-tight text-white">Start an Instant Google Meet</h3>
                <p className="max-w-xl text-sm text-slate-300">
                  Generate an authenticated Google Meet conference link in 1-click. Invite interns, mentors, and review panels directly.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-900/40"
                  icon={Video}
                  onClick={() => setInstantModalOpen(true)}
                  data-testid="start-meet-hero-btn"
                >
                  Generate Meet Link
                </Button>
              </div>
            </div>
          </div>

          {/* Active Conferences List */}
          <SectionCard
            title="Scheduled & Active Google Meet Calls"
            description="Upcoming 1-on-1s, technical reviews, and sync calls provisioned on Google Meet."
          >
            {activeMeets.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-500">
                <Video className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                <p className="font-semibold text-slate-700">No active Google Meet conferences right now</p>
                <p className="text-xs text-slate-400 mt-1">Use the "Instant Google Meet" button above to launch an instant room.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {activeMeets.map((m) => {
                  const meetUrl = m.googleMeetLink || m.meetingLink;
                  return (
                    <div
                      key={m._id}
                      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300 transition-all space-y-4"
                      data-testid={`active-meet-card-${m._id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide border border-blue-200">
                            {humanize(m.type)}
                          </span>
                          <h4 className="mt-1.5 font-bold text-slate-900 text-base">{m.title}</h4>
                          <p className="text-xs text-slate-500">Host: {fullName(m.mentorId || m.organizerId)}</p>
                        </div>
                        <StatusBadge status={m.status} />
                      </div>

                      <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-medium text-slate-800">
                          <Clock className="h-4 w-4 text-blue-600" />
                          <span>{fmtDate(m.scheduledDate)}, {m.startTime} - {m.endTime}</span>
                        </div>
                        <span className="text-[11px] text-slate-500">{m.participants?.length || 0} participant(s)</span>
                      </div>

                      {meetUrl && (
                        <div className="flex items-center gap-2 pt-1">
                          <a
                            href={meetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm"
                            data-testid={`join-meet-${m._id}`}
                          >
                            <Video className="h-4 w-4" />
                            Join Google Meet
                          </a>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(meetUrl, m._id)}
                            className="inline-flex items-center justify-center rounded-lg border border-slate-300 p-2 text-slate-700 hover:bg-slate-50"
                            title="Copy Meet URL"
                            data-testid={`copy-meet-${m._id}`}
                          >
                            {copiedLink === m._id ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      </TabPanel>

      {/* TAB 2: BROADCAST EMAIL BY ROLE */}
      <TabPanel id="email-broadcast" active={tab}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Email Composer Form */}
          <div className="lg:col-span-2 space-y-6">
            <SectionCard
              title="Broadcast Email to Organizational Roles"
              description="Send official notifications, Google Meet links, or onboarding directives to specific roles or the entire organization."
            >
              <form onSubmit={handleSendBroadcast} className="space-y-5">
                {/* Target Role Selector Chips */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
                    Target Roles <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => toggleRole('ALL')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        broadcastRoles.includes('ALL')
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                      data-testid="role-chip-ALL"
                    >
                      🌟 All Users ({roleSummary.data?.totalActive || 0})
                    </button>
                    {Object.values(ROLES).map((r) => {
                      const count = roleCounts[r] || 0;
                      const isSelected = broadcastRoles.includes(r) || broadcastRoles.includes('ALL');
                      return (
                        <button
                          key={r}
                          type="button"
                          disabled={broadcastRoles.includes('ALL')}
                          onClick={() => toggleRole(r)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            isSelected
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                          } ${broadcastRoles.includes('ALL') ? 'opacity-60 cursor-not-allowed' : ''}`}
                          data-testid={`role-chip-${r}`}
                        >
                          {humanize(r)} ({count})
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-blue-700 font-medium">
                    🎯 Selected target audience: <strong>{totalActiveRecipients} active user(s)</strong> will receive this email.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Email Subject <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={broadcastSubject}
                    onChange={(e) => setBroadcastSubject(e.target.value)}
                    placeholder="e.g. Important: Weekly Cohort Review & Google Meet Link"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    data-testid="broadcast-subject-input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Message Content (Formatted) <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={6}
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="Type your message here. Line breaks and formatting are automatically preserved in the email..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    data-testid="broadcast-message-input"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                      Action Button URL (Optional)
                    </label>
                    <input
                      type="url"
                      value={broadcastActionUrl}
                      onChange={(e) => setBroadcastActionUrl(e.target.value)}
                      placeholder="https://meet.google.com/xxx-yyyy-zzz"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      data-testid="broadcast-action-url-input"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                      Action Button Text (Optional)
                    </label>
                    <input
                      type="text"
                      value={broadcastActionText}
                      onChange={(e) => setBroadcastActionText(e.target.value)}
                      placeholder="e.g. Join Google Meet Now"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      data-testid="broadcast-action-text-input"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setBroadcastPreview(!broadcastPreview)}
                  >
                    {broadcastPreview ? 'Hide Preview' : 'Show Live Preview'}
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    icon={Send}
                    loading={broadcastSending}
                    disabled={totalActiveRecipients === 0}
                    data-testid="send-broadcast-btn"
                  >
                    Broadcast to {totalActiveRecipients} Recipient(s)
                  </Button>
                </div>
              </form>
            </SectionCard>
          </div>

          {/* Email Preview Column */}
          <div className="space-y-4">
            <h4 className="font-semibold text-slate-900 text-sm">Recipient Live Preview</h4>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <span className="text-[11px] font-semibold text-slate-400 uppercase">Subject:</span>
                <p className="font-bold text-slate-900 text-sm mt-0.5">
                  {broadcastSubject || '(Subject will appear here)'}
                </p>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  To: {broadcastRoles.map(r => humanize(r)).join(', ')} ({totalActiveRecipients} users)
                </span>
              </div>

              <div className="rounded-lg bg-slate-50 p-4 border border-slate-100 min-h-40">
                <p className="text-xs text-slate-500 mb-2">Hello [Recipient Name],</p>
                <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {broadcastMessage || 'Your message preview will appear here as you type in the editor.'}
                </p>
                {broadcastActionUrl && (
                  <div className="mt-4 text-center">
                    <span className="inline-block rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm">
                      {broadcastActionText || 'View Details'}
                    </span>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-slate-400 text-center">
                Dispatched using automated dual-SMTP relay with delivery verification.
              </p>
            </div>
          </div>
        </div>
      </TabPanel>

      {/* TAB 3: ALL VIDEO CONFERENCES */}
      <TabPanel id="calendar" active={tab}>
        <SectionCard
          title="All Provisioned Video Conferences"
          description="Complete registry of all Google Meet calls and virtual review sessions."
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="all-meets-table">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="p-3">Meeting</th>
                  <th className="p-3">Schedule</th>
                  <th className="p-3">Host</th>
                  <th className="p-3">Participants</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {googleMeets.map((m) => (
                  <tr key={m._id} className="hover:bg-slate-50">
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <Video className="h-4 w-4 text-blue-600 flex-shrink-0" />
                        <span className="font-semibold text-slate-900">{m.title}</span>
                      </div>
                      <span className="text-xs text-slate-500">{humanize(m.type)}</span>
                    </td>
                    <td className="p-3 text-xs">
                      <p className="font-medium text-slate-800">{fmtDate(m.scheduledDate)}</p>
                      <p className="text-slate-500">{m.startTime} - {m.endTime}</p>
                    </td>
                    <td className="p-3 text-xs text-slate-700">
                      {fullName(m.mentorId || m.organizerId)}
                    </td>
                    <td className="p-3 text-xs text-slate-600">
                      {m.participants?.length || 0} user(s)
                    </td>
                    <td className="p-3">
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="p-3 text-right">
                      {m.googleMeetLink || m.meetingLink ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={m.googleMeetLink || m.meetingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200 hover:bg-blue-100"
                          >
                            <ExternalLink className="h-3 w-3" /> Join
                          </a>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(m.googleMeetLink || m.meetingLink, m._id)}
                            className="p-1 rounded text-slate-500 hover:bg-slate-100"
                            title="Copy link"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </TabPanel>

      {/* TAB 4: EMAIL DELIVERY LOGS */}
      <TabPanel id="logs" active={tab}>
        <SectionCard
          title="Email Dispatch & Audit Log"
          description="Verification of emails dispatched across roles with status tracking."
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="email-logs-table">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="p-3">Recipient</th>
                  <th className="p-3">Subject</th>
                  <th className="p-3">Template</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Dispatched At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(emailLogs.data?.data || emailLogs.data || []).map((l, i) => (
                  <tr key={l._id || i} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-xs text-slate-800">{l.recipient}</td>
                    <td className="p-3 font-medium text-slate-900 text-xs">{l.subject}</td>
                    <td className="p-3 text-xs text-slate-600">{l.template || 'BROADCAST'}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        l.status === 'SENT' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-slate-500">
                      {l.sentAt || l.createdAt ? new Date(l.sentAt || l.createdAt).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </TabPanel>

      {/* Instant Meet Modal */}
      {instantModalOpen && (
        <Modal
          open
          onClose={() => {
            setInstantModalOpen(false);
            setInstantMeetData(null);
          }}
          size="md"
          title={instantMeetData ? "Google Meet Room Created" : "Start Instant Google Meet"}
          description={instantMeetData ? "Share this link with participants to start your call immediately." : "Generates a real Google Meet room with instant video link."}
          footer={
            instantMeetData ? (
              <div className="flex justify-between w-full">
                <Button
                  variant="outline"
                  icon={Copy}
                  onClick={() => copyToClipboard(instantMeetData.meetLink, 'modal')}
                >
                  Copy Link
                </Button>
                <a
                  href={instantMeetData.meetLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                >
                  <Video className="h-4 w-4" /> Open in Google Meet
                </a>
              </div>
            ) : (
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setInstantModalOpen(false)}>Cancel</Button>
                <Button variant="primary" loading={instantMeetLoading} onClick={handleStartInstantMeet} data-testid="confirm-instant-meet">
                  Launch Google Meet
                </Button>
              </div>
            )
          }
        >
          {instantMeetData ? (
            <div className="space-y-4 text-center py-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h4 className="font-bold text-slate-900 text-lg">{instantMeetData.title}</h4>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <span className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Meet Video Link</span>
                <p className="font-mono text-base font-bold text-blue-700 break-all select-all">
                  {instantMeetData.meetLink}
                </p>
              </div>
              <p className="text-xs text-slate-500">
                Code: <span className="font-mono font-semibold">{instantMeetData.meetCode}</span> &bull; Conference ID: <span className="font-mono">{instantMeetData.conferenceId}</span>
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Meeting Title</label>
                <input
                  type="text"
                  value={instantTitle}
                  onChange={(e) => setInstantTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="e.g. Quick Technical Review"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Invite Participants (Optional)</label>
                <select
                  multiple
                  value={selectedParticipants}
                  onChange={(e) => setSelectedParticipants(Array.from(e.target.selectedOptions, o => o.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm h-32 focus:border-blue-500 focus:outline-none"
                >
                  {(users.data || []).map((u) => (
                    <option key={u._id} value={u._id}>
                      {fullName(u)} ({u.email}) - {u.role}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">Hold Ctrl (or Cmd) to select multiple participants.</p>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

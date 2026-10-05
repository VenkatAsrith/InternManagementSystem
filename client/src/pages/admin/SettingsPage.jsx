import React, { useState } from 'react';
import { Plus, Calendar, Video, CheckCircle2, XCircle, AlertCircle, RefreshCw, Link as LinkIcon, Unlink } from 'lucide-react';
import api from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useForm, rules } from '../../hooks/useForm';
import { useStaffUsers } from '../../hooks/useRefData';
import { fullName } from '../../lib/format';
import { Button, DataTable, FormError, FormGrid, FormModal, PageHeader, SectionCard, SelectField, StateView, StatusBadge, TabPanel, Tabs, TextAreaField, TextField, useConfirm } from '../../components/ui';

const TIMEZONES = (() => {
  try { return Intl.supportedValuesOf('timeZone'); } catch { return ['Asia/Kolkata', 'UTC', 'America/New_York', 'Europe/London']; }
})();

function ProfileForm({ org, onSaved }) {
  const { can } = useAuth();
  const toast = useToast();
  const editable = can('settings.manage');
  const form = useForm({
    name: org.name || '', domain: org.domain || '', email: org.email || '', phone: org.phone || '', website: org.website || '', timezone: org.timezone || 'Asia/Kolkata',
    signatoryName: org.signatory?.name || '', signatoryTitle: org.signatory?.title || '', street: org.address?.street || '', city: org.address?.city || '', state: org.address?.state || '', country: org.address?.country || '', zipCode: org.address?.zipCode || ''
  });
  const f = form.field;
  const ro = { disabled: !editable };
  const onSubmit = (e) => {
    e.preventDefault();
    form.submit({ name: [rules.required('Name'), rules.max(150, 'Name')], email: rules.email('Email'), website: rules.url('Website') }, async (v) => {
      await api.patch('/organizations/current', {
        name: v.name.trim(), domain: v.domain.trim(), ...(v.email.trim() ? { email: v.email.trim() } : {}), ...(v.phone.trim() ? { phone: v.phone.trim() } : {}), ...(v.website.trim() ? { website: v.website.trim() } : {}), timezone: v.timezone,
        signatory: { name: v.signatoryName.trim(), title: v.signatoryTitle.trim() }, address: { street: v.street.trim(), city: v.city.trim(), state: v.state.trim(), country: v.country.trim(), zipCode: v.zipCode.trim() }
      });
      toast.success('Organization settings saved');
      onSaved();
    });
  };
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5" data-testid="org-form">
      <FormError error={form.formError} />
      <SectionCard title="Profile">
        <FormGrid>
          <TextField {...f('name')} label="Organization name" required {...ro} />
          <TextField {...f('domain')} label="Email domain" {...ro} />
          <TextField {...f('email')} label="Contact email" type="email" {...ro} />
          <TextField {...f('phone')} label="Phone" type="tel" {...ro} />
          <TextField {...f('website')} label="Website" type="url" {...ro} />
          <SelectField {...f('timezone')} label="Time zone" options={TIMEZONES} hint="Attendance days, deadlines and reports follow this zone." {...ro} />
        </FormGrid>
      </SectionCard>
      <SectionCard title="Letter signatory" description="Printed on certificates and official letters. Certificates cannot be issued without a signatory.">
        <FormGrid><TextField {...f('signatoryName')} label="Name" {...ro} /><TextField {...f('signatoryTitle')} label="Title" {...ro} /></FormGrid>
      </SectionCard>
      <SectionCard title="Address">
        <FormGrid><TextField {...f('street')} label="Street" className="sm:col-span-2" {...ro} /><TextField {...f('city')} label="City" {...ro} /><TextField {...f('state')} label="State" {...ro} /><TextField {...f('country')} label="Country" {...ro} /><TextField {...f('zipCode')} label="Postal code" {...ro} /></FormGrid>
      </SectionCard>
      {editable && <Button type="submit" loading={form.submitting} data-testid="org-save">Save settings</Button>}
    </form>
  );
}

function DepartmentModal({ dept, onClose, onDone }) {
  const toast = useToast();
  const edit = !!dept;
  const { users } = useStaffUsers();
  const form = useForm({ name: dept?.name || '', code: dept?.code || '', description: dept?.description || '', headOfDepartment: dept?.headOfDepartment?._id || '' });
  const f = form.field;
  return (
    <FormModal open onClose={onClose} size="md" testId="department-modal" title={edit ? 'Edit department' : 'New department'} submitLabel={edit ? 'Save' : 'Create'} form={form}
      rules={{ name: [rules.required('Name'), rules.max(120, 'Name')], code: [rules.required('Code'), (v) => (v && !/^[A-Za-z0-9_-]{2,12}$/.test(v) ? 'Use 2-12 letters, digits, - or _' : null)] }}
      onSubmit={(v) => { const body = { name: v.name.trim(), code: v.code.trim(), description: v.description.trim(), ...(v.headOfDepartment ? { headOfDepartment: v.headOfDepartment } : {}) }; return edit ? api.patch(`/organizations/departments/${dept._id}`, body) : api.post('/organizations/departments', body); }}
      onDone={() => { toast.success(edit ? 'Department updated' : 'Department created'); onDone(); }}>
      <FormGrid>
        <TextField {...f('name')} label="Name" required />
        <TextField {...f('code')} label="Code" required hint="Stored in capitals." />
        <SelectField {...f('headOfDepartment')} label="Head of department" placeholder="None" options={users.map((u) => ({ value: u._id, label: fullName(u) }))} className="sm:col-span-2" />
        <TextAreaField {...f('description')} label="Description" rows={2} className="sm:col-span-2" />
      </FormGrid>
    </FormModal>
  );
}

function Departments() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const state = useFetch(() => api.get('/organizations/departments', { params: { includeArchived: true } }), []);
  const [modal, setModal] = useState(null);
  const manage = can('departments.manage');
  const archive = async (d) => {
    if (!(await confirm({ title: `Archive ${d.name}?`, message: 'A department that still has openings, programs, interns or users cannot be archived.', confirmLabel: 'Archive', tone: 'danger' }))) return;
    try { await api.post(`/organizations/departments/${d._id}/archive`); toast.success('Department archived'); } catch (e) { toast.error(e.message); }
    state.reload({ silent: true });
  };
  const restore = async (d) => { try { await api.post(`/organizations/departments/${d._id}/restore`); toast.success('Department restored'); } catch (e) { toast.error(e.message); } state.reload({ silent: true }); };
  const cols = [
    { key: 'name', header: 'Department', render: (d) => <div><p className="font-medium text-slate-900">{d.name}</p><p className="font-mono text-xs text-slate-600">{d.code}</p></div> },
    { key: 'head', header: 'Head', render: (d) => (d.headOfDepartment ? fullName(d.headOfDepartment) : '-') }, { key: 'status', header: 'Status', render: (d) => <StatusBadge status={d.isActive ? 'ACTIVE' : 'DISABLED'} label={d.isActive ? 'Active' : 'Archived'} /> },
    { key: 'actions', header: '', align: 'right', render: (d) => manage && (
      <div className="flex justify-end gap-2">
        {d.isActive && <Button size="sm" variant="outline" onClick={() => setModal(d)} data-testid={`dept-edit-${d.code}`}>Edit</Button>}
        {d.isActive ? <Button size="sm" variant="outline" onClick={() => archive(d)} data-testid={`dept-archive-${d.code}`}>Archive</Button> : <Button size="sm" variant="outline" onClick={() => restore(d)} data-testid={`dept-restore-${d.code}`}>Restore</Button>}
      </div>
    ) }
  ];
  return (
    <>
      {manage && <div className="mb-3 flex justify-end"><Button icon={Plus} onClick={() => setModal('new')} data-testid="new-department">New department</Button></div>}
      <DataTable testId="departments-table" columns={cols} rows={state.data || []} loading={state.loading} error={state.error} onRetry={state.reload} rowKey={(d) => d.code} caption="Departments" emptyTitle="No departments" emptyDescription="Create a department before adding programs." />
      {modal && <DepartmentModal dept={modal === 'new' ? null : modal} onClose={() => setModal(null)} onDone={() => { setModal(null); state.reload({ silent: true }); }} />}
    </>
  );
}

function GoogleIntegrations() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const state = useFetch(() => api.get('/integrations/google/status'), []);
  const [connectModal, setConnectModal] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [accountEmail, setAccountEmail] = useState('');
  const manage = can('settings.manage');

  const status = state.data || {
    isConnected: false,
    accountEmail: '',
    calendarConnected: false,
    meetAvailable: false
  };

  const handleConnect = async (e) => {
    e.preventDefault();
    setConnecting(true);
    try {
      await api.post('/integrations/google/connect', {
        accountEmail: accountEmail.trim() || 'workspace.admin@techmecha.com'
      });
      toast.success('Google Workspace successfully connected');
      setConnectModal(false);
      setAccountEmail('');
      state.reload({ silent: true });
    } catch (err) {
      toast.error(err.message || 'Failed to connect Google Workspace');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!(await confirm({
      title: 'Disconnect Google Workspace?',
      message: 'New meetings will no longer automatically create Google Calendar events or Google Meet conferences until reconnected.',
      confirmLabel: 'Disconnect',
      tone: 'danger'
    }))) return;

    try {
      await api.post('/integrations/google/disconnect');
      toast.success('Google Workspace disconnected');
      state.reload({ silent: true });
    } catch (err) {
      toast.error(err.message || 'Failed to disconnect');
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Google Workspace Integration"
        description="Connect Google Calendar and Google Meet for automated event synchronization and video conferences."
        actions={manage && (
          status.isConnected ? (
            <Button size="sm" variant="outline" tone="danger" icon={Unlink} onClick={handleDisconnect} data-testid="disconnect-google-btn">
              Disconnect Google
            </Button>
          ) : (
            <Button size="sm" icon={LinkIcon} onClick={() => setConnectModal(true)} data-testid="connect-google-btn">
              Connect Google
            </Button>
          )
        )}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Google Calendar</span>
              <Calendar className="h-4 w-4 text-brand-600" />
            </div>
            <div className="mt-2 flex items-center gap-2">
              {status.calendarConnected ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  <XCircle className="h-3.5 w-3.5" /> Not Connected
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500">Automatically creates calendar events with reminders for scheduled meetings.</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Google Meet</span>
              <Video className="h-4 w-4 text-brand-600" />
            </div>
            <div className="mt-2 flex items-center gap-2">
              {status.meetAvailable ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Available
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  <XCircle className="h-3.5 w-3.5" /> Not Available
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500">Generates unique, secure video conference rooms for intern reviews and 1-on-1s.</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Google Account</span>
              <RefreshCw className="h-4 w-4 text-brand-600" />
            </div>
            <div className="mt-2">
              {status.isConnected && status.accountEmail ? (
                <p className="font-mono text-xs font-semibold text-slate-900 truncate" title={status.accountEmail}>
                  {status.accountEmail}
                </p>
              ) : (
                <span className="text-xs text-slate-500">No account linked</span>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {status.connectedAt ? `Linked on ${new Date(status.connectedAt).toLocaleDateString()}` : 'Connect your Google account to start.'}
            </p>
          </div>
        </div>

        {status.lastError && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>Last Integration Warning: {status.lastError}. You may need to reconnect Google.</span>
          </div>
        )}

        <div className="mt-6 rounded-lg border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-medium text-slate-700">Enterprise Security Note</p>
          <p className="mt-1 text-xs text-slate-500">
            OAuth client secrets, refresh tokens, and authentication cookies are stored server-side with encryption and are never exposed to the browser.
          </p>
        </div>
      </SectionCard>

      {connectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Connect Google Workspace</h3>
            <p className="mt-1 text-xs text-slate-600">
              Authorizes IMS to manage Google Calendar events and generate Google Meet video conference links for meetings.
            </p>
            <form onSubmit={handleConnect} className="mt-4 space-y-4">
              <TextField
                name="accountEmail"
                label="Workspace Account Email"
                type="email"
                placeholder="workspace.admin@techmecha.com"
                value={accountEmail}
                onChange={(e) => setAccountEmail(e.target.value)}
                hint="Authorized Google Workspace account."
              />
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setConnectModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={connecting} data-testid="confirm-google-connect">
                  Authorize & Connect
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function SettingsPage() {
  const { can, reload } = useAuth();
  const [tab, setTab] = useState(can('settings.manage') ? 'profile' : 'departments');
  const org = useFetch(() => api.get('/organizations/current'), []);
  const tabs = [
    { id: 'profile', label: 'Profile' },
    { id: 'departments', label: 'Departments' },
    { id: 'integrations', label: 'Integrations' }
  ];
  return (
    <>
      <PageHeader title="Organization" description="Profile, signatory, departments, and Google Workspace integrations." />
      <Tabs label="Organization sections" active={tab} onChange={setTab} tabs={tabs} />
      <TabPanel id="profile" active={tab}><StateView state={org}>{(o) => <ProfileForm key={o.updatedAt} org={o} onSaved={() => { org.reload({ silent: true }); reload(); }} />}</StateView></TabPanel>
      <TabPanel id="departments" active={tab}><Departments /></TabPanel>
      <TabPanel id="integrations" active={tab}><GoogleIntegrations /></TabPanel>
    </>
  );
}


import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import api from '../../lib/http';
import { session } from '../../lib/session';
import { useToast } from '../../context/ToastContext';
import { useFetch, useDebounced } from '../../hooks/useFetch';
import { useList } from '../../hooks/useList';
import { useForm, rules } from '../../hooks/useForm';
import { fmtDateTime, fullName, humanize } from '../../lib/format';
import { ROLES, ROLE_DEFINITIONS } from '@shared/constants.js';
import { Button, CopyField, DataTable, FilterBar, FormGrid, FormModal, InlineAlert, Modal, PageHeader, Pagination, SectionCard, SelectField, StateView, StatCard, StatusBadge, Tabs, TabPanel, TextAreaField, TextField, useConfirm } from '../../components/ui';

function OrgModal({ onClose, onDone }) {
  const toast = useToast();
  const [created, setCreated] = useState(null);
  const form = useForm({ name: '', code: '', email: '', timezone: 'Asia/Kolkata', adminFirstName: '', adminLastName: '', adminEmail: '' });
  const f = form.field;
  if (created) {
    return (
      <Modal open onClose={onDone} size="md" testId="org-created" title="Organization created" footer={<Button onClick={onDone} data-testid="org-created-done">Done</Button>}>
        <p className="mb-3 text-sm text-slate-800">{created.organization.name} is ready.</p>
        {created.setupLink ? <><InlineAlert tone="info" className="mb-3">Give this single-use link to the organization administrator. It is shown only now.</InlineAlert><CopyField label="Administrator setup link" value={created.setupLink} testId="admin-link" /></> : <InlineAlert tone="warning">No administrator was invited. Add one before the organization can be used.</InlineAlert>}
      </Modal>
    );
  }
  return (
    <FormModal open onClose={onClose} size="lg" testId="org-modal" title="New organization" description="Creates a fully isolated tenant. Its data is never visible to other organizations." submitLabel="Create organization" form={form}
      rules={{
        name: rules.required('Name'), code: [rules.required('Code'), (v) => (v && !/^[A-Za-z0-9]{2,12}$/.test(v) ? 'Use 2-12 letters or digits' : null)], email: [rules.required('Contact email'), rules.email('Contact email')],
        adminEmail: [rules.email('Administrator email')], adminFirstName: (v, a) => (a.adminEmail && !String(v).trim() ? 'Required with an administrator email' : null), adminLastName: (v, a) => (a.adminEmail && !String(v).trim() ? 'Required with an administrator email' : null)
      }}
      onSubmit={(v) => api.post('/global-admin/organizations', { name: v.name.trim(), code: v.code.trim(), email: v.email.trim(), timezone: v.timezone, ...(v.adminEmail.trim() ? { adminEmail: v.adminEmail.trim(), adminFirstName: v.adminFirstName.trim(), adminLastName: v.adminLastName.trim() } : {}) })}
      onDone={(res) => { toast.success('Organization created'); setCreated(res.data); }}>
      <FormGrid>
        <TextField {...f('name')} label="Organization name" required /><TextField {...f('code')} label="Code" required hint="2-12 capital letters or digits." />
        <TextField {...f('email')} label="Contact email" type="email" required /><TextField {...f('timezone')} label="Time zone" />
        <TextField {...f('adminFirstName')} label="Admin first name" /><TextField {...f('adminLastName')} label="Admin last name" />
        <TextField {...f('adminEmail')} label="Admin email" type="email" className="sm:col-span-2" hint="Optional. Invites the first administrator." />
      </FormGrid>
    </FormModal>
  );
}

function StatusModal({ org, status, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({ reason: '' });
  return (
    <FormModal open onClose={onClose} size="sm" testId="org-status-modal" title={`${status === 'ACTIVE' ? 'Reactivate' : 'Suspend'} ${org.name}?`} description={status === 'ACTIVE' ? 'People can sign in again.' : 'Every session of this organization ends immediately and nobody can sign in.'} submitLabel="Confirm" submitVariant={status === 'ACTIVE' ? 'primary' : 'danger'} form={form}
      onSubmit={(v) => api.patch(`/global-admin/organizations/${org._id}/status`, { status, ...(v.reason.trim() ? { reason: v.reason.trim() } : {}) })} onDone={() => { toast.success(`Organization ${status.toLowerCase()}`); onDone(); }}>
      <TextAreaField {...form.field('reason')} label="Reason" rows={2} />
    </FormModal>
  );
}

function GlobalUserModal({ orgs, defaultRole = 'ORGANIZATION_ADMIN', onClose, onDone }) {
  const toast = useToast();
  const [created, setCreated] = useState(null);
  const form = useForm({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: defaultRole || 'ORGANIZATION_ADMIN',
    organizationId: orgs[0]?._id || ''
  });
  const f = form.field;
  const selectedRoleDef = form.values.role ? ROLE_DEFINITIONS[form.values.role] : null;

  if (created) {
    return (
      <Modal open onClose={onDone} size="md" testId="global-user-created" title="User Account Created" footer={<Button onClick={onDone} data-testid="global-user-done">Done</Button>}>
        <InlineAlert tone="success" className="mb-3">
          Account created for <strong>{created.user.firstName} {created.user.lastName}</strong> ({created.user.email}) as <strong>{humanize(created.user.role)}</strong>.
        </InlineAlert>
        <p className="text-xs text-slate-600 mb-2">Give this activation link to the user to complete password setup:</p>
        <CopyField label="Activation Link" value={created.setupLink} testId="global-setup-link" />
      </Modal>
    );
  }

  const roleOptions = [
    { value: 'ORGANIZATION_ADMIN', label: 'Organization Administrator (Executive)' },
    { value: 'HR_ADMIN', label: 'HR Administrator' },
    { value: 'HR_RECRUITER', label: 'HR Recruiter' },
    { value: 'MENTOR', label: 'Mentor / Technical Lead' },
    { value: 'INTERN', label: 'Intern / Mentee' },
    { value: 'INTERN_TRAINEE', label: 'Intern Trainee (Bootcamp / Training)' },
    { value: 'INTERVIEWER', label: 'Technical Interviewer' },
    { value: 'FINANCE_ADMIN', label: 'Finance Administrator' },
    { value: 'AUDITOR', label: 'Compliance Auditor' },
    { value: 'SUPER_ADMIN', label: 'Global Administrator (Platform)' }
  ];

  const handleSubmit = async (v) => {
    return await api.post('/global-admin/users', {
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      email: v.email.trim(),
      phone: v.phone.trim() || undefined,
      role: v.role,
      organizationId: v.role === 'SUPER_ADMIN' ? undefined : v.organizationId
    });
  };

  return (
    <FormModal
      open
      onClose={onClose}
      size="lg"
      testId="global-user-modal"
      title="Create Internal User"
      description="Provision an administrator, manager, or staff account across any tenant."
      submitLabel="Create User & Generate Link"
      form={form}
      rules={{
        firstName: rules.required('First name'),
        lastName: rules.required('Last name'),
        email: [rules.required('Email'), rules.email('Email')],
        role: rules.required('Role')
      }}
      onSubmit={handleSubmit}
      onDone={(res) => {
        toast.success('User account created');
        setCreated(res.data);
      }}
    >
      <FormGrid>
        <div className="sm:col-span-2 text-xs font-semibold uppercase tracking-wider text-slate-500 pb-1 border-b border-slate-100">
          1. Identity & Credentials
        </div>
        <TextField {...f('firstName')} label="First name" required />
        <TextField {...f('lastName')} label="Last name" required />
        <TextField {...f('email')} label="Email address" type="email" required />
        <TextField {...f('phone')} label="Phone number" type="tel" />

        <div className="sm:col-span-2 text-xs font-semibold uppercase tracking-wider text-slate-500 pt-2 pb-1 border-b border-slate-100">
          2. Organization & Role Assignment
        </div>
        <SelectField
          {...f('organizationId')}
          label="Target Organization"
          required={form.values.role !== 'SUPER_ADMIN'}
          disabled={form.values.role === 'SUPER_ADMIN'}
          options={orgs.map((o) => ({ value: o._id, label: o.name }))}
        />
        <SelectField
          {...f('role')}
          label="Assigned Role"
          required
          options={roleOptions}
        />

        {selectedRoleDef && (
          <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs space-y-2" data-testid="role-summary-card">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-900">{selectedRoleDef.label}</span>
              <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">Scope: {selectedRoleDef.scope || 'ORGANIZATION'}</span>
            </div>
            <p className="text-slate-600">{selectedRoleDef.description}</p>
            <div className="border-t border-slate-200 pt-2 space-y-1">
              <p className="font-semibold text-slate-800">Granted Capabilities:</p>
              <div className="flex flex-wrap gap-1">
                {(selectedRoleDef.permissions || []).slice(0, 10).map((p) => (
                  <span key={p} className="inline-block px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-mono text-[11px] border border-emerald-200">
                    ✓ {p}
                  </span>
                ))}
                {(selectedRoleDef.permissions || []).length > 10 && (
                  <span className="text-[11px] text-slate-500 font-mono">+{selectedRoleDef.permissions.length - 10} more</span>
                )}
              </div>
            </div>
            <div className="border-t border-slate-200 pt-2 space-y-0.5 text-slate-600">
              <p className="font-semibold text-slate-700">Security & Boundary Policies:</p>
              <p className="text-[11px] text-slate-500">• 🔒 Founder private tasks isolated (accessible by creator only)</p>
              <p className="text-[11px] text-slate-500">• 🔒 Multi-mailboxes require explicit access grants</p>
              {selectedRoleDef.key !== 'FINANCE_ADMIN' && selectedRoleDef.key !== 'SUPER_ADMIN' && (
                <p className="text-[11px] text-amber-700">• ✗ Stipends and payroll mutations restricted</p>
              )}
            </div>
          </div>
        )}
      </FormGrid>
    </FormModal>
  );
}

export function GlobalAdminPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState('orgs');
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState('');
  const [orgFilter, setOrgFilter] = useState('');
  const q = useDebounced(search.trim());
  const overview = useFetch(() => api.get('/global-admin/overview'), []);
  const orgs = useFetch(() => api.get('/global-admin/organizations'), []);
  const users = useList('/global-admin/users', { filters: { search: q, organizationId: orgFilter }, limit: 25 });
  const acting = session.getActingOrg();

  const enter = (o) => { session.setActingOrg(o._id); toast.success(`Now acting inside ${o.name}`); window.location.assign('/admin/dashboard'); };
  const toggleUser = async (u) => {
    const next = !u.isActive;
    if (!next && !(await confirm({ title: `Deactivate ${fullName(u)}?`, message: 'They are signed out everywhere.', confirmLabel: 'Deactivate', tone: 'danger' }))) return;
    try { await api.patch(`/global-admin/users/${u._id}/status`, { isActive: next }); toast.success(next ? 'Account activated' : 'Account deactivated'); } catch (e) { toast.error(e.message); }
    users.reload({ silent: true });
  };

  const orgCols = [
    { key: 'name', header: 'Organization', render: (o) => <div><p className="font-medium text-slate-900">{o.name}</p><p className="font-mono text-xs text-slate-600">{o.code}</p></div> },
    { key: 'users', header: 'Users', render: (o) => o.userCount }, { key: 'interns', header: 'Active interns', render: (o) => o.activeInternsCount }, { key: 'tz', header: 'Time zone', render: (o) => o.timezone },
    { key: 'status', header: 'Status', render: (o) => <StatusBadge status={o.status} /> },
    { key: 'actions', header: '', align: 'right', render: (o) => (
      <div className="flex flex-wrap justify-end gap-2">
        {o.status === 'ACTIVE' && <Button size="sm" variant="outline" onClick={() => enter(o)} data-testid={`org-enter-${o.code}`}>Enter</Button>}
        {o.status === 'ACTIVE' ? <Button size="sm" variant="outline" onClick={() => setModal({ type: 'status', o, s: 'SUSPENDED' })} data-testid={`org-suspend-${o.code}`}>Suspend</Button> : <Button size="sm" variant="outline" onClick={() => setModal({ type: 'status', o, s: 'ACTIVE' })} data-testid={`org-activate-${o.code}`}>Reactivate</Button>}
      </div>
    ) }
  ];
  const userCols = [
    { key: 'name', header: 'Name', render: (u) => <div><p className="font-medium text-slate-900">{fullName(u)}</p><p className="text-xs text-slate-600">{u.email}</p></div> }, { key: 'org', header: 'Organization', render: (u) => u.organizationId?.name || 'Platform' },
    { key: 'role', header: 'Role', render: (u) => humanize(u.role) }, { key: 'status', header: 'Status', render: (u) => <StatusBadge status={u.isActive ? 'ACTIVE' : 'DISABLED'} label={u.isActive ? 'Active' : 'Deactivated'} /> },
    { key: 'actions', header: '', align: 'right', render: (u) => <Button size="sm" variant="outline" onClick={() => toggleUser(u)} data-testid={`gu-toggle-${u.email}`}>{u.isActive ? 'Deactivate' : 'Activate'}</Button> }
  ];
  const pending = useFetch(() => api.get('/global-admin/pending-registrations'), []);

  const approveReg = async (u) => {
    try {
      await api.post(`/global-admin/users/${u._id}/approve-registration`, {});
      toast.success(`Approved and activated ${fullName(u)}`);
      pending.reload({ silent: true });
      users.reload({ silent: true });
      overview.reload({ silent: true });
    } catch (e) {
      toast.error(e.message);
    }
  };

  const rejectReg = async (u) => {
    if (!(await confirm({ title: `Reject registration for ${fullName(u)}?`, message: 'The user will not be allowed to log in.', confirmLabel: 'Reject', tone: 'danger' }))) return;
    try {
      await api.post(`/global-admin/users/${u._id}/reject-registration`, {});
      toast.success(`Registration rejected for ${fullName(u)}`);
      pending.reload({ silent: true });
    } catch (e) {
      toast.error(e.message);
    }
  };

  const pendingCount = (pending.data || []).length;

  const pendingCols = [
    { key: 'name', header: 'Applicant', render: (u) => <div><p className="font-medium text-slate-900">{fullName(u)}</p><p className="text-xs text-slate-600">{u.email}{u.phone ? ` • ${u.phone}` : ''}</p></div> },
    { key: 'org', header: 'Organization', render: (u) => u.organizationId?.name || 'Unassigned' },
    { key: 'role', header: 'Requested Role', render: (u) => <span className="font-semibold text-brand-800">{humanize(u.requestedRole || u.role)}</span> },
    { key: 'notes', header: 'Notes', render: (u) => <p className="max-w-xs truncate text-xs text-slate-600" title={u.registrationNotes}>{u.registrationNotes || '-'}</p> },
    { key: 'date', header: 'Submitted', render: (u) => fmtDateTime(u.createdAt) },
    { key: 'status', header: 'Status', render: () => <StatusBadge status="PENDING" label="Pending Approval" /> },
    {
      key: 'actions', header: '', align: 'right', render: (u) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="brand" onClick={() => approveReg(u)} data-testid={`approve-user-${u.email}`}>
            Approve & Activate
          </Button>
          <Button size="sm" variant="outline" onClick={() => rejectReg(u)} data-testid={`reject-user-${u.email}`}>
            Reject
          </Button>
        </div>
      )
    }
  ];

  return (
    <>
      <PageHeader
        title="Global Command Center"
        description="Platform administration, multi-tenant isolation, and direct account provisioning."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModal({ type: 'newUser', role: 'ORGANIZATION_ADMIN' })}
              data-testid="provision-org-admin-btn"
            >
              + Org Admin
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModal({ type: 'newUser', role: 'HR_ADMIN' })}
              data-testid="provision-hr-btn"
            >
              + HR Admin
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModal({ type: 'newUser', role: 'MENTOR' })}
              data-testid="provision-mentor-btn"
            >
              + Mentor
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModal({ type: 'newUser', role: 'INTERN' })}
              data-testid="provision-mentee-btn"
            >
              + Mentee / Intern
            </Button>
            <Button
              icon={Plus}
              size="sm"
              variant="primary"
              onClick={() => setModal({ type: 'new' })}
              data-testid="new-org"
            >
              New Organization
            </Button>
          </div>
        }
      />
      {acting && <InlineAlert tone="warning" className="mb-4" testId="acting-notice">You are currently acting inside an organization. Use "Leave organization" in the banner above to return.</InlineAlert>}
      <StateView state={overview}>
        {(d) => (
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4" data-testid="global-kpis">
            <StatCard testId="kpi-orgs" label="Organizations" value={d.kpis.totalOrgs} hint={`${d.kpis.suspendedOrgs} suspended`} />
            <StatCard testId="kpi-users" label="Active users" value={d.kpis.totalUsers} />
            <StatCard testId="kpi-interns" label="Active interns" value={d.kpis.activeInterns} />
            <StatCard testId="kpi-db" label="Database" value={d.systemHealth.databaseState} tone={d.systemHealth.database === 'HEALTHY' ? 'emerald' : 'rose'} hint={`Up ${Math.floor(d.systemHealth.uptimeSeconds / 60)} min`} />
          </div>
        )}
      </StateView>
      <Tabs
        label="Platform sections"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'orgs', label: 'Organizations' },
          { id: 'pending', label: pendingCount > 0 ? `Pending Approvals (${pendingCount})` : 'Pending Approvals' },
          { id: 'users', label: 'Users' },
          { id: 'audit', label: 'Recent activity' }
        ]}
      />
      <TabPanel id="orgs" active={tab}><DataTable testId="orgs-table" columns={orgCols} rows={orgs.data || []} loading={orgs.loading} error={orgs.error} onRetry={orgs.reload} rowKey={(o) => o.code} caption="Organizations" emptyTitle="No organizations" /></TabPanel>
      <TabPanel id="pending" active={tab}>
        <DataTable
          testId="pending-registrations-table"
          columns={pendingCols}
          rows={pending.data || []}
          loading={pending.loading}
          error={pending.error}
          onRetry={pending.reload}
          rowKey={(u) => u._id}
          caption="Pending Registrations"
          emptyTitle="No registrations pending approval"
          emptyDescription="When new users register through the public portal, their requests appear here for review."
        />
      </TabPanel>
      <TabPanel id="users" active={tab}>
        <FilterBar>
          <TextField name="search" label="Search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or email" />
          <SelectField name="organizationId" label="Organization" value={orgFilter} onChange={(e) => setOrgFilter(e.target.value)} placeholder="All" options={(orgs.data || []).map((o) => ({ value: o._id, label: o.name }))} />
        </FilterBar>
        <DataTable testId="global-users-table" columns={userCols} rows={users.rows} loading={users.loading} error={users.error} onRetry={users.reload} rowKey={(u) => u.email} caption="All users" emptyTitle="No users" />
        <Pagination pagination={users.pagination} onPage={users.setPage} />
      </TabPanel>
      <TabPanel id="audit" active={tab}>
        <StateView state={overview}>
          {(d) => (
            <SectionCard title="Latest platform events"><ul className="divide-y divide-slate-100" data-testid="recent-events">{d.recentAuditEvents.map((e) => <li key={e._id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span className="font-mono text-xs">{e.action}</span><span className="text-slate-700">{e.actorEmail || 'System'}</span><span className="text-xs text-slate-600">{fmtDateTime(e.timestamp)}</span></li>)}{d.recentAuditEvents.length === 0 && <li className="py-2 text-sm text-slate-600">No events yet.</li>}</ul></SectionCard>
          )}
        </StateView>
      </TabPanel>
      {modal?.type === 'new' && <OrgModal onClose={() => setModal(null)} onDone={() => { setModal(null); orgs.reload({ silent: true }); overview.reload({ silent: true }); }} />}
      {modal?.type === 'newUser' && <GlobalUserModal orgs={orgs.data || []} defaultRole={modal.role} onClose={() => setModal(null)} onDone={() => { setModal(null); users.reload({ silent: true }); overview.reload({ silent: true }); }} />}
      {modal?.type === 'status' && <StatusModal org={modal.o} status={modal.s} onClose={() => setModal(null)} onDone={() => { setModal(null); orgs.reload({ silent: true }); overview.reload({ silent: true }); }} />}
    </>
  );
}

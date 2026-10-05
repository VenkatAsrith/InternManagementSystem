import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import api from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch, useDebounced } from '../../hooks/useFetch';
import { useList } from '../../hooks/useList';
import { useForm, rules } from '../../hooks/useForm';
import { useDepartments } from '../../hooks/useRefData';
import { fmtDateTime, fullName, humanize } from '../../lib/format';
import { ROLES, ROLE_DEFINITIONS } from '@shared/constants.js';
import { Button, CheckboxField, CopyField, DataTable, FilterBar, FormGrid, FormModal, InlineAlert, Modal, PageHeader, Pagination, SelectField, StatusBadge, Tabs, TabPanel, TextAreaField, TextField, useConfirm } from '../../components/ui';

/** Roles that can be handed out by hand. Interns and candidates are created by the recruitment workflow. */
function assignableRoles(user, customRoles) {
  const system = Object.values(ROLE_DEFINITIONS).filter((r) => !['INTERN', 'CANDIDATE', 'SUPER_ADMIN'].includes(r.key) && (user.role === 'SUPER_ADMIN' || r.assignableBy.includes(user.role)));
  const custom = ['SUPER_ADMIN', 'ORGANIZATION_ADMIN'].includes(user.role) ? customRoles.filter((r) => !r.isSystemRole && r.status === 'ACTIVE') : [];
  return [...system.map((r) => ({ value: r.key, label: r.label })), ...custom.map((r) => ({ value: r.key, label: `${r.label} (custom)` }))];
}

function InviteModal({ roles, departments, onClose, onDone }) {
  const toast = useToast();
  const [created, setCreated] = useState(null);
  const form = useForm({ firstName: '', lastName: '', email: '', role: '', phone: '', departmentId: '' });
  const f = form.field;
  const selectedRoleDef = form.values.role ? ROLE_DEFINITIONS[form.values.role] : null;

  if (created) {
    return (
      <Modal open onClose={onDone} size="md" testId="invite-result" title="User invited" footer={<Button onClick={onDone} data-testid="invite-done">Done</Button>}>
        <InlineAlert tone="info" className="mb-4">{created.user.firstName} was emailed a link to set a password. Email delivery is simulated here, so you can share the link yourself. It is single-use and shown only now.</InlineAlert>
        <CopyField label="Password setup link" value={created.setupLink} testId="setup-link" />
      </Modal>
    );
  }
  return (
    <FormModal open onClose={onClose} size="lg" testId="invite-modal" title="Create Internal User" description="The person sets their own password from the emailed activation link." submitLabel="Create User & Send Invitation" form={form}
      rules={{ firstName: rules.required('First name'), lastName: rules.required('Last name'), email: [rules.required('Email'), rules.email('Email')], role: rules.required('Role') }}
      onSubmit={(v) => api.post('/users', { firstName: v.firstName.trim(), lastName: v.lastName.trim(), email: v.email.trim(), role: v.role, ...(v.phone.trim() ? { phone: v.phone.trim() } : {}), ...(v.departmentId ? { departmentId: v.departmentId } : {}) })}
      onDone={(res) => { toast.success('User account created'); setCreated(res.data); }}>
      <FormGrid>
        <div className="sm:col-span-2 text-xs font-semibold uppercase tracking-wider text-slate-500 pb-1 border-b border-slate-100">
          1. Personal & Account Identity
        </div>
        <TextField {...f('firstName')} label="First name" required autoComplete="off" />
        <TextField {...f('lastName')} label="Last name" required autoComplete="off" />
        <TextField {...f('email')} label="Email" type="email" required autoComplete="off" />
        <TextField {...f('phone')} label="Phone" type="tel" placeholder="+91 98765 43210" />

        <div className="sm:col-span-2 text-xs font-semibold uppercase tracking-wider text-slate-500 pt-2 pb-1 border-b border-slate-100">
          2. Organization & Department
        </div>
        <SelectField {...f('departmentId')} label="Department" placeholder="Unassigned" options={departments.map((d) => ({ value: d._id, label: d.name }))} className="sm:col-span-2" />

        <div className="sm:col-span-2 text-xs font-semibold uppercase tracking-wider text-slate-500 pt-2 pb-1 border-b border-slate-100">
          3. Role Assignment & Security Boundary
        </div>
        <SelectField {...f('role')} label="Assign Role" required placeholder="Select a role" options={roles} hint="Interns are created automatically when an offer is accepted." className="sm:col-span-2" />

        {selectedRoleDef && (
          <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs space-y-2" data-testid="role-access-preview">
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

function EditModal({ user, departments, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({ firstName: user.firstName, lastName: user.lastName, phone: user.phone || '', departmentId: user.departmentId?._id || '' });
  const f = form.field;
  return (
    <FormModal open onClose={onClose} size="md" testId="edit-user-modal" title={`Edit ${fullName(user)}`} submitLabel="Save" form={form} rules={{ firstName: rules.required('First name'), lastName: rules.required('Last name') }}
      onSubmit={(v) => api.patch(`/users/${user._id}`, { firstName: v.firstName.trim(), lastName: v.lastName.trim(), ...(v.phone.trim() ? { phone: v.phone.trim() } : {}), ...(v.departmentId ? { departmentId: v.departmentId } : {}) })}
      onDone={() => { toast.success('User updated'); onDone(); }}>
      <FormGrid><TextField {...f('firstName')} label="First name" required /><TextField {...f('lastName')} label="Last name" required /><TextField {...f('phone')} label="Phone" type="tel" /><SelectField {...f('departmentId')} label="Department" placeholder="None" options={departments.map((d) => ({ value: d._id, label: d.name }))} /></FormGrid>
    </FormModal>
  );
}

function RoleModal({ user, roles, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({ newRoleKey: '', reason: '' });
  const preview = useFetch(() => api.post('/roles/preview-change', { userId: user._id, newRoleKey: form.values.newRoleKey }), [form.values.newRoleKey], { enabled: !!form.values.newRoleKey });
  const f = form.field;
  return (
    <FormModal open onClose={onClose} size="lg" testId="role-modal" title={`Change role of ${fullName(user)}`} description={`Current role: ${humanize(user.role)}. The change takes effect immediately and signs the user out of their current sessions.`} submitLabel="Change role" form={form}
      rules={{ newRoleKey: rules.required('New role'), reason: [rules.required('Reason'), rules.min(3, 'Reason')] }}
      onSubmit={(v) => api.post('/roles/assign', { userId: user._id, newRoleKey: v.newRoleKey, reason: v.reason.trim() })} onDone={() => { toast.success('Role changed'); onDone(); }}>
      <SelectField {...f('newRoleKey')} label="New role" required placeholder="Select a role" options={roles.filter((r) => r.value !== user.role)} />
      {form.values.newRoleKey && preview.data && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm" data-testid="role-preview">
          {(preview.data.warnings || []).map((w) => <p key={w} className="mb-2 font-medium text-amber-900">{w}</p>)}
          <p className="text-slate-800"><strong>Gains:</strong> {preview.data.permissionsAdded.length ? preview.data.permissionsAdded.join(', ') : 'nothing'}</p>
          <p className="mt-1 text-slate-800"><strong>Loses:</strong> {preview.data.permissionsRemoved.length ? preview.data.permissionsRemoved.join(', ') : 'nothing'}</p>
        </div>
      )}
      {preview.error && <InlineAlert tone="error">{preview.error.message}</InlineAlert>}
      <TextAreaField {...f('reason')} label="Reason" required rows={2} />
    </FormModal>
  );
}

export function UsersPage() {
  const { can, user: me } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState('active');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [inactive, setInactive] = useState(false);
  const [modal, setModal] = useState(null);
  const q = useDebounced(search.trim());
  const { departments } = useDepartments();
  const rolesState = useFetch(() => api.get('/roles'), [], { enabled: can('roles.read') });
  const list = useList('/users', { filters: { search: q, role, includeInactive: inactive ? 'true' : '' }, limit: 25 });
  const pending = useFetch(() => api.get('/users/pending-registrations'), [], { enabled: can('users.read') });
  const roleOptions = assignableRoles(me, rolesState.data || []);
  const close = () => setModal(null);
  const done = () => { close(); list.reload({ silent: true }); };

  const deactivate = async (u) => {
    if (!(await confirm({ title: `Deactivate ${fullName(u)}?`, message: 'They are signed out everywhere and cannot sign in until reactivated. Their records are kept.', confirmLabel: 'Deactivate', tone: 'danger' }))) return;
    try { await api.post(`/users/${u._id}/deactivate`, {}); toast.success('User deactivated'); } catch (e) { toast.error(e.message); }
    list.reload({ silent: true });
  };
  const reactivate = async (u) => { try { await api.post(`/users/${u._id}/reactivate`); toast.success('User reactivated'); } catch (e) { toast.error(e.message); } list.reload({ silent: true }); };

  const approveReg = async (u) => {
    try {
      await api.post(`/users/${u._id}/approve-registration`, {});
      toast.success(`Approved and activated ${fullName(u)}`);
      pending.reload({ silent: true });
      list.reload({ silent: true });
    } catch (e) {
      toast.error(e.message);
    }
  };

  const rejectReg = async (u) => {
    if (!(await confirm({ title: `Reject registration for ${fullName(u)}?`, message: 'The user will not be allowed to log in.', confirmLabel: 'Reject', tone: 'danger' }))) return;
    try {
      await api.post(`/users/${u._id}/reject-registration`, {});
      toast.success(`Registration rejected for ${fullName(u)}`);
      pending.reload({ silent: true });
    } catch (e) {
      toast.error(e.message);
    }
  };

  const pendingCount = (pending.data || []).length;

  const cols = [
    { key: 'name', header: 'Name', render: (u) => <div><p className="font-medium text-slate-900">{fullName(u)}</p><p className="text-xs text-slate-600">{u.email}</p></div> },
    { key: 'role', header: 'Role', render: (u) => humanize(u.role) }, { key: 'dept', header: 'Department', render: (u) => u.departmentId?.name || '-' },
    { key: 'login', header: 'Last sign-in', render: (u) => fmtDateTime(u.lastLoginAt) },
    { key: 'status', header: 'Status', render: (u) => <StatusBadge status={u.isActive ? 'ACTIVE' : 'DISABLED'} label={u.isActive ? 'Active' : 'Deactivated'} /> },
    { key: 'actions', header: '', align: 'right', render: (u) => (
      <div className="flex flex-wrap justify-end gap-2">
        {can('users.manage') && <Button size="sm" variant="outline" onClick={() => setModal({ type: 'edit', u })} data-testid={`user-edit-${u.email}`}>Edit</Button>}
        {can('roles.assign') && u.role !== 'INTERN' && u._id !== me._id && u.isActive && <Button size="sm" variant="outline" onClick={() => setModal({ type: 'role', u })} data-testid={`user-role-${u.email}`}>Change role</Button>}
        {can('users.manage') && u._id !== me._id && (u.isActive ? <Button size="sm" variant="outline" onClick={() => deactivate(u)} data-testid={`user-deactivate-${u.email}`}>Deactivate</Button> : <Button size="sm" variant="outline" onClick={() => reactivate(u)} data-testid={`user-reactivate-${u.email}`}>Reactivate</Button>)}
      </div>
    ) }
  ];

  const pendingCols = [
    { key: 'name', header: 'Applicant', render: (u) => <div><p className="font-medium text-slate-900">{fullName(u)}</p><p className="text-xs text-slate-600">{u.email}{u.phone ? ` • ${u.phone}` : ''}</p></div> },
    { key: 'role', header: 'Requested Role', render: (u) => <span className="font-semibold text-brand-800">{humanize(u.requestedRole || u.role)}</span> },
    { key: 'notes', header: 'Notes', render: (u) => <p className="max-w-xs truncate text-xs text-slate-600" title={u.registrationNotes}>{u.registrationNotes || '-'}</p> },
    { key: 'date', header: 'Submitted', render: (u) => fmtDateTime(u.createdAt) },
    { key: 'status', header: 'Status', render: () => <StatusBadge status="PENDING" label="Pending Approval" /> },
    {
      key: 'actions', header: '', align: 'right', render: (u) => (
        <div className="flex justify-end gap-2">
          {can('users.manage') && (
            <>
              <Button size="sm" variant="brand" onClick={() => approveReg(u)} data-testid={`approve-user-${u.email}`}>
                Approve & Activate
              </Button>
              <Button size="sm" variant="outline" onClick={() => rejectReg(u)} data-testid={`reject-user-${u.email}`}>
                Reject
              </Button>
            </>
          )}
        </div>
      )
    }
  ];

  return (
    <>
      <PageHeader title="Users" description="Accounts in your organization." actions={can('users.create') && <Button icon={Plus} onClick={() => setModal({ type: 'invite' })} data-testid="invite-user">Invite user</Button>} />
      
      <Tabs
        label="User management views"
        active={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'active', label: 'All Users' },
          { id: 'pending', label: pendingCount > 0 ? `Pending Approvals (${pendingCount})` : 'Pending Approvals' }
        ]}
      />

      <TabPanel id="active" active={activeTab}>
        <FilterBar>
          <TextField name="search" label="Search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or email" />
          <SelectField name="role" label="Role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="All roles" options={Object.keys(ROLES).map((r) => ({ value: r, label: humanize(r) }))} />
          {can('users.manage') && <div className="pb-2"><CheckboxField name="inactive" label="Include deactivated" checked={inactive} onChange={(e) => setInactive(e.target.checked)} /></div>}
        </FilterBar>
        <DataTable testId="users-table" columns={cols} rows={list.rows} loading={list.loading} error={list.error} onRetry={list.reload} rowKey={(u) => u.email} caption="Users" emptyTitle="No users match" emptyDescription="Clear the filters to see everyone." />
        <Pagination pagination={list.pagination} onPage={list.setPage} />
      </TabPanel>

      <TabPanel id="pending" active={activeTab}>
        <DataTable
          testId="org-pending-table"
          columns={pendingCols}
          rows={pending.data || []}
          loading={pending.loading}
          error={pending.error}
          onRetry={pending.reload}
          rowKey={(u) => u._id}
          caption="Pending User Approvals"
          emptyTitle="No registrations pending approval"
          emptyDescription="When prospective interns or staff register through the portal, their requests appear here for approval."
        />
      </TabPanel>

      {modal?.type === 'invite' && <InviteModal roles={roleOptions} departments={departments} onClose={close} onDone={done} />}
      {modal?.type === 'edit' && <EditModal user={modal.u} departments={departments} onClose={close} onDone={done} />}
      {modal?.type === 'role' && <RoleModal user={modal.u} roles={roleOptions} onClose={close} onDone={done} />}
    </>
  );
}

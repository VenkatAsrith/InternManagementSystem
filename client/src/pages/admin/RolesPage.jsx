import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import api from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useForm, rules } from '../../hooks/useForm';
import { humanize } from '../../lib/format';
import { hasGranted } from '@shared/permissions.js';
import { Button, DataTable, FormGrid, FormModal, Modal, PageHeader, SelectField, StatusBadge, TextAreaField, TextField, useConfirm } from '../../components/ui';

const CATEGORIES = ['ADMINISTRATION', 'RECRUITMENT', 'ENGINEERING', 'FINANCE', 'COMPLIANCE'].map((c) => ({ value: c, label: humanize(c) }));

function PermissionPicker({ groups, selected, onToggle, actorPerms }) {
  return (
    <div className="space-y-4" data-testid="permission-picker">
      {groups.map((g) => (
        <fieldset key={g.module} className="rounded-lg border border-slate-200 p-3">
          <legend className="px-1 text-sm font-semibold text-slate-900">{g.module}</legend>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {g.permissions.map((p) => {
              // You cannot put a permission into a role that you do not hold yourself (no privilege escalation).
              const holdable = actorPerms.includes('*') || (p.key.endsWith('.*') ? actorPerms.includes(p.key) : hasGranted(actorPerms, p.key));
              return (
                <li key={p.key}>
                  <label className={`flex items-start gap-2 text-sm ${holdable ? 'cursor-pointer text-slate-800' : 'cursor-not-allowed text-slate-500'}`}>
                    <input type="checkbox" className="mt-0.5 h-4 w-4" disabled={!holdable} checked={selected.includes(p.key)} onChange={() => onToggle(p.key)} data-testid={`perm-${p.key}`} />
                    <span>{p.label} <span className="font-mono text-[11px] text-slate-600">{p.key}</span>{!holdable && <span className="block text-[11px]">You do not hold this permission.</span>}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}
    </div>
  );
}

function RoleFormModal({ role, catalog, onClose, onDone }) {
  const { permissions: actorPerms } = useAuth();
  const toast = useToast();
  const edit = !!role;
  const form = useForm({ key: role?.key || '', label: role?.label || '', description: role?.description || '', category: role?.category || 'ADMINISTRATION', permissions: role?.permissions || [] });
  const f = form.field;
  const toggle = (k) => form.set('permissions', form.values.permissions.includes(k) ? form.values.permissions.filter((x) => x !== k) : [...form.values.permissions, k]);
  return (
    <FormModal open onClose={onClose} size="xl" testId="role-form-modal" title={edit ? `Edit role ${role.label}` : 'New custom role'} description="A custom role can only contain permissions you hold yourself. The all-access permission is never available." submitLabel={edit ? 'Save role' : 'Create role'} form={form}
      rules={{ key: (v) => (!edit && !/^[A-Za-z][A-Za-z0-9_]{2,39}$/.test(v) ? 'Use 3-40 letters, digits or underscores, starting with a letter' : null), label: rules.required('Label'), permissions: rules.required('At least one permission') }}
      onSubmit={(v) => (edit ? api.patch(`/roles/${role._id}`, { label: v.label.trim(), description: v.description.trim(), category: v.category, permissions: v.permissions })
        : api.post('/roles', { key: v.key.trim(), label: v.label.trim(), description: v.description.trim(), category: v.category, permissions: v.permissions }))}
      onDone={() => { toast.success(edit ? 'Role updated' : 'Role created'); onDone(); }}>
      <FormGrid>
        <TextField {...f('key')} label="Role key" required disabled={edit} hint="Stored in capitals, e.g. SUPPORT_LEAD." />
        <TextField {...f('label')} label="Display name" required />
        <SelectField {...f('category')} label="Category" options={CATEGORIES} />
        <TextAreaField {...f('description')} label="Description" rows={2} className="sm:col-span-2" />
      </FormGrid>
      <PermissionPicker groups={catalog.groups} selected={form.values.permissions} onToggle={toggle} actorPerms={actorPerms} />
      {form.errors.permissions && <p role="alert" data-testid="error-permissions" className="text-xs font-medium text-rose-700">{form.errors.permissions}</p>}
    </FormModal>
  );
}

export function RolesPage() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const roles = useFetch(() => api.get('/roles'), []);
  const catalog = useFetch(() => api.get('/roles/catalog/permissions'), []);
  const [modal, setModal] = useState(null);
  const manage = can('roles.manage');
  const close = () => setModal(null);
  const done = () => { close(); roles.reload({ silent: true }); };

  const remove = async (r, kind) => {
    const archive = kind === 'archive';
    if (!(await confirm({ title: `${archive ? 'Archive' : 'Delete'} role "${r.label}"?`, message: archive ? 'Archived roles cannot be assigned. Roles that people still hold cannot be archived.' : 'Only roles that were never assigned can be deleted permanently.', confirmLabel: archive ? 'Archive' : 'Delete', tone: 'danger' }))) return;
    try { archive ? await api.post(`/roles/${r._id}/archive`) : await api.delete(`/roles/${r._id}`); toast.success(archive ? 'Role archived' : 'Role deleted'); } catch (e) { toast.error(e.message); }
    roles.reload({ silent: true });
  };

  const cols = [
    { key: 'label', header: 'Role', render: (r) => <div><p className="font-medium text-slate-900">{r.label}</p><p className="font-mono text-xs text-slate-600">{r.key}</p></div> },
    { key: 'kind', header: 'Type', render: (r) => (r.isSystemRole ? 'Built-in' : 'Custom') }, { key: 'category', header: 'Category', render: (r) => humanize(r.category) },
    { key: 'perms', header: 'Permissions', render: (r) => (r.permissions.includes('*') ? 'All' : r.permissions.length) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'actions', header: '', align: 'right', render: (r) => (
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => setModal({ type: 'view', r })} data-testid={`role-view-${r.key}`}>View</Button>
        {manage && !r.isSystemRole && <><Button size="sm" variant="outline" onClick={() => setModal({ type: 'edit', r })} data-testid={`role-edit-${r.key}`}>Edit</Button><Button size="sm" variant="outline" onClick={() => remove(r, 'archive')} data-testid={`role-archive-${r.key}`}>Archive</Button><Button size="sm" variant="outline" onClick={() => remove(r, 'delete')} data-testid={`role-delete-${r.key}`}>Delete</Button></>}
      </div>
    ) }
  ];
  return (
    <>
      <PageHeader title="Roles & permissions" description="Built-in roles are fixed. Custom roles are limited to permissions their creator holds."
        actions={manage && <Button icon={Plus} onClick={() => setModal({ type: 'new' })} disabled={!catalog.data} data-testid="new-role">New custom role</Button>} />
      <DataTable testId="roles-table" columns={cols} rows={roles.data || []} loading={roles.loading} error={roles.error} onRetry={roles.reload} rowKey={(r) => r.key} caption="Roles" emptyTitle="No roles" />
      {modal?.type === 'view' && (
        <Modal open onClose={close} size="lg" testId="role-detail" title={modal.r.label} description={modal.r.description}>
          <p className="mb-2 text-sm font-semibold text-slate-900">Permissions</p>
          <ul className="flex flex-wrap gap-1.5" data-testid="role-permissions">{modal.r.permissions.map((p) => <li key={p} className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-0.5 font-mono text-xs text-slate-800">{p}</li>)}</ul>
        </Modal>
      )}
      {(modal?.type === 'new' || modal?.type === 'edit') && catalog.data && <RoleFormModal role={modal.type === 'edit' ? modal.r : null} catalog={catalog.data} onClose={close} onDone={done} />}
    </>
  );
}

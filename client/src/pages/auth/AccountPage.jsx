import React from 'react';
import api from '../../lib/http';
import { session } from '../../lib/session';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useForm, rules, useAction } from '../../hooks/useForm';
import { Button, DetailList, FormError, PageHeader, SectionCard, TextField, useConfirm } from '../../components/ui';
import { fmtDateTime, fullName, humanize } from '../../lib/format';

export function AccountPage() {
  const { user, organization, logout } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const form = useForm({ currentPassword: '', newPassword: '', confirm: '' });
  const all = useAction();

  const onSubmit = (e) => {
    e.preventDefault();
    form.submit(
      {
        currentPassword: rules.required('Current password'),
        newPassword: [
          rules.required('New password'),
          (v) => (v && v.length < 8 ? 'Use at least 8 characters' : null),
          (v) => (v && (!/[A-Za-z]/.test(v) || !/[0-9]/.test(v)) ? 'Include at least one letter and one number' : null),
          (v, values) => (v && v === values.currentPassword ? 'New password must differ from the current one' : null)
        ],
        confirm: [rules.required('Confirmation'), (v, values) => (v !== values.newPassword ? 'Passwords do not match' : null)]
      },
      async (v) => {
        try {
          const res = await api.post('/auth/change-password', { currentPassword: v.currentPassword, newPassword: v.newPassword });
          session.setTokens(res.data.token, res.data.refreshToken);
          form.reset({ currentPassword: '', newPassword: '', confirm: '' });
          toast.success('Password changed. Other devices have been signed out.');
        } catch (error) {
          if (error.code === 'INVALID_PASSWORD') form.setErrors({ currentPassword: 'Current password is incorrect' });
          throw error;
        }
      }
    );
  };

  const signOutEverywhere = () => all.run(async () => {
    const ok = await confirm({ title: 'Sign out of all devices?', message: 'Every active session, including this one, will end and you will need to sign in again.', confirmLabel: 'Sign out everywhere', tone: 'danger' });
    if (!ok) return;
    try {
      await api.post('/auth/logout-all');
      session.clear('logout');
    } catch (error) {
      toast.error(error.message);
    }
  });

  return (
    <>
      <PageHeader title="Account & security" description="Your sign-in details and password." />
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Profile" testId="account-profile">
          <DetailList cols={1} items={[
            { label: 'Name', value: fullName(user), testId: 'account-name' },
            { label: 'Email', value: user?.email, testId: 'account-email' },
            { label: 'Role', value: humanize(user?.role), testId: 'account-role' },
            { label: 'Organization', value: organization?.name || '-' },
            { label: 'Last sign-in', value: fmtDateTime(user?.lastLoginAt) }
          ]} />
          <p className="mt-4 text-xs text-slate-600">To change your name or email, ask your organization administrator.</p>
        </SectionCard>

        <SectionCard title="Change password" testId="account-password">
          <form onSubmit={onSubmit} noValidate className="space-y-4" data-testid="change-password-form">
            <FormError error={form.formError && !Object.keys(form.errors).length ? form.formError : null} />
            <TextField {...form.field('currentPassword')} label="Current password" type="password" autoComplete="current-password" required />
            <TextField {...form.field('newPassword')} label="New password" type="password" autoComplete="new-password" required hint="At least 8 characters, with a letter and a number." />
            <TextField {...form.field('confirm')} label="Confirm new password" type="password" autoComplete="new-password" required />
            <Button type="submit" loading={form.submitting} data-testid="change-password-submit">Change password</Button>
          </form>
          <div className="mt-6 border-t border-slate-200 pt-4">
            <p className="mb-2 text-sm text-slate-700">Lost a device or used a shared computer?</p>
            <Button variant="outline" onClick={signOutEverywhere} loading={all.pending} data-testid="logout-all">Sign out of all devices</Button>
            <Button variant="ghost" onClick={logout} className="ml-2" data-testid="account-logout">Sign out</Button>
          </div>
        </SectionCard>
      </div>
    </>
  );
}

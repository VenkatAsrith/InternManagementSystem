import React, { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, ShieldCheck, UserCheck, AlertTriangle } from 'lucide-react';
import api from '../../lib/http';
import { session } from '../../lib/session';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useForm, rules } from '../../hooks/useForm';
import { Button, TextField, FormError, InlineAlert, LoadingBlock } from '../../components/ui';
import { humanize } from '../../lib/format';

const passwordRules = (label) => [
  rules.required(label),
  (v) => (v && v.length < 8 ? 'Use at least 8 characters' : null),
  (v) => (v && (!/[A-Za-z]/.test(v) || !/[0-9]/.test(v)) ? 'Include at least one letter and one number' : null)
];

/** Public page opened from an invitation email (new staff account, or an intern whose offer was accepted). */
export function SetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const auth = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const form = useForm({ password: '', confirm: '', acceptTerms: false });
  const [inviteInfo, setInviteInfo] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(!!token);
  const [tokenError, setTokenError] = useState(null);
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    document.title = 'Account Activation - TechMecha Torque IMS';
    if (!token) return;

    let active = true;
    async function verifyToken() {
      try {
        setLoadingInfo(true);
        const res = await api.get(`/auth/invitation-info?token=${token}`);
        if (active) {
          setInviteInfo(res.data);
          setTokenError(null);
        }
      } catch (err) {
        if (active) {
          setTokenError(err.message || 'This setup link is invalid or has expired.');
        }
      } finally {
        if (active) setLoadingInfo(false);
      }
    }
    verifyToken();

    return () => { active = false; };
  }, [token]);

  if (auth.isAuthenticated && !form.submitting && !activated) return <Navigate to="/" replace />;

  const onSubmit = (e) => {
    e.preventDefault();
    form.submit(
      {
        password: passwordRules('Password'),
        confirm: [rules.required('Confirmation'), (v, all) => (v !== all.password ? 'Passwords do not match' : null)]
      },
      async (v) => {
        const res = await api.post('/auth/setup-password', { token, password: v.password });
        session.setTokens(res.data.token, res.data.refreshToken);
        session.setUser(res.data.user);
        toast.success('Password set successfully. Account activated!');
        setActivated(true);
        await auth.reload();
      }
    );
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 px-4 py-12">
      <div className="text-center sm:mx-auto sm:w-full sm:max-w-md">
        <img src="/tmt-logo.png" alt="TechMecha Torque" className="mx-auto h-12 w-auto object-contain" />
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900" data-testid="page-title">
          Activate Your Account
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Verify your identity and set your personal password to begin.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 space-y-4">
          {!token ? (
            <InlineAlert tone="error" title="This link is incomplete" testId="setup-missing-token">
              Open the exact link from your invitation email, or ask your administrator to send a new one.
            </InlineAlert>
          ) : loadingInfo ? (
            <LoadingBlock label="Verifying invitation link..." />
          ) : tokenError ? (
            <div className="space-y-4 text-center">
              <InlineAlert tone="error" title="Invalid or Expired Invitation" testId="setup-token-error">
                {tokenError}
              </InlineAlert>
              <p className="text-xs text-slate-600">
                Please contact your administrator to request a fresh invitation link.
              </p>
              <Button variant="outline" onClick={() => navigate('/login')}>
                Go to Sign In
              </Button>
            </div>
          ) : activated ? (
            <div className="text-center space-y-4 py-4" data-testid="activation-success">
              <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
              <h2 className="text-lg font-bold text-slate-900">Account Successfully Activated!</h2>
              <p className="text-sm text-slate-600">
                Your credentials are verified. You can now sign in to your role dashboard.
              </p>
              <Button variant="primary" className="w-full" onClick={() => navigate('/login')} data-testid="go-to-login">
                Proceed to Sign In
              </Button>
            </div>
          ) : (
            <>
              {/* Identity summary banner */}
              {inviteInfo && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-1.5 text-xs" data-testid="invitation-summary">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-700">Invited User</span>
                    <span className="font-mono text-[11px] font-bold text-slate-900" data-testid="invited-email-display">{inviteInfo.email}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-700">Assigned Role</span>
                    <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-brand-100 text-brand-800 font-mono" data-testid="invited-role-badge">
                      {humanize(inviteInfo.role)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-700">Organization</span>
                    <span className="text-slate-800">{inviteInfo.organizationName}</span>
                  </div>
                </div>
              )}

              <form onSubmit={onSubmit} noValidate className="space-y-4" data-testid="set-password-form">
                <FormError error={form.formError && !form.errors.password ? form.formError : null} />
                <TextField
                  {...form.field('password')}
                  label="Create password"
                  type="password"
                  autoComplete="new-password"
                  required
                  testId="new-password-input"
                  hint="At least 8 characters, with a letter and a number."
                />
                <TextField
                  {...form.field('confirm')}
                  label="Confirm password"
                  type="password"
                  autoComplete="new-password"
                  required
                  testId="confirm-password-input"
                />

                <div className="flex items-start gap-2 pt-1 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    id="accept-terms"
                    data-testid="accept-terms-checkbox"
                    checked={form.values.acceptTerms}
                    onChange={(e) => form.set('acceptTerms', e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-brand-800 focus:ring-brand-700"
                  />
                  <label htmlFor="accept-terms">
                    I acknowledge the platform usage terms and organizational security policies.
                  </label>
                </div>

                <Button
                  type="submit"
                  variant="brand"
                  loading={form.submitting}
                  className="w-full"
                  data-testid="activate-account-submit"
                >
                  Set Password & Activate
                </Button>
              </form>
            </>
          )}
        </div>
        <p className="mt-4 text-center text-sm text-slate-600">
          Already have an activated account?{' '}
          <Link to="/login" className="font-medium text-brand-800 underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

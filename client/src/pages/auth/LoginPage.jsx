import React, { useEffect } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useForm, rules } from '../../hooks/useForm';
import { Button, TextField, FormError, InlineAlert } from '../../components/ui';
import { landingPath } from '../../lib/access';

const REASONS = {
  expired: 'Your session expired. Please sign in again.',
  TOKEN_REVOKED: 'Your session was ended. Please sign in again.',
  INVALID_TOKEN: 'Your session was not valid. Please sign in again.',
  USER_INACTIVE: 'Your account is no longer active. Contact your administrator.',
  ORG_SUSPENDED: 'Your organization is suspended. Contact the platform administrator.',
  'other-tab': 'You were signed out in another tab.',
  logout: 'You have been signed out.'
};

export function LoginPage() {
  const auth = useAuth();
  const location = useLocation();
  const form = useForm({ email: '', password: '' });

  useEffect(() => { document.title = 'Sign in - TechMecha Torque IMS'; }, []);

  if (auth.isAuthenticated) {
    const target = location.state?.from && !location.state.from.startsWith('/login') ? location.state.from : landingPath(auth);
    return <Navigate to={target} replace />;
  }

  const onSubmit = (e) => {
    e.preventDefault();
    form.submit(
      { email: [rules.required('Email'), rules.email('Email')], password: rules.required('Password') },
      (v) => auth.login(v.email.trim(), v.password) // success re-renders authenticated and <Navigate> above redirects
    );
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="text-center sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="inline-flex flex-col items-center gap-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-600">
          <img src="/tmt-logo.png" alt="TechMecha Torque" className="h-12 w-auto object-contain" />
        </Link>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900" data-testid="page-title">Sign in to your workspace</h1>
        <p className="mt-1 text-sm text-slate-600">Staff, mentors and interns sign in with the account created for them.</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {auth.endedReason && REASONS[auth.endedReason] && (
            <InlineAlert tone={auth.endedReason === 'logout' ? 'info' : 'warning'} className="mb-4" testId="session-ended">{REASONS[auth.endedReason]}</InlineAlert>
          )}
          <form onSubmit={onSubmit} noValidate className="space-y-4" data-testid="login-form">
            <FormError error={form.formError && !form.errors.email && !form.errors.password ? form.formError : null} />
            <TextField {...form.field('email')} label="Email address" type="email" autoComplete="username" required placeholder="you@company.com" />
            <TextField {...form.field('password')} label="Password" type="password" autoComplete="current-password" required />
            <Button type="submit" variant="brand" loading={form.submitting} className="w-full" icon={ArrowRight} data-testid="login-submit">Sign in</Button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-4">
            <p className="text-center text-sm text-slate-600">
              Don't have an account?{' '}
              <Link to="/register" className="font-semibold text-brand-800 hover:text-brand-900 underline" data-testid="register-link">
                Register here &rarr;
              </Link>
            </p>
          </div>


        </div>
        <p className="mt-4 text-center text-sm text-slate-600">
          Applying for an internship? <Link to="/internships" className="font-medium text-brand-800 underline">Browse openings</Link>
        </p>
      </div>
    </div>
  );
}

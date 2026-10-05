import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock, ShieldCheck, UserCheck, Building2, User, KeyRound } from 'lucide-react';
import api from '../../lib/http';
import { useForm, rules } from '../../hooks/useForm';
import { Button, TextField, SelectField, TextAreaField, FormError, InlineAlert, FormGrid } from '../../components/ui';

const ROLES_OPTIONS = [
  { value: 'INTERN', label: 'Intern (Learner / Participant)' },
  { value: 'MENTOR', label: 'Mentor / Technical Supervisor' },
  { value: 'HR_ADMIN', label: 'HR / Staff Administrator' },
  { value: 'INTERVIEWER', label: 'Technical Interviewer' },
  { value: 'ORGANIZATION_ADMIN', label: 'Organization Administrator' }
];

export function RegisterPage() {
  const navigate = useNavigate();
  const [submittedUser, setSubmittedUser] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);

  const form = useForm({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    requestedRole: 'INTERN',
    organizationId: '',
    password: '',
    confirmPassword: '',
    notes: ''
  });

  useEffect(() => {
    document.title = 'Create Account - TechMecha Torque IMS';
    let isMounted = true;
    api.get('/auth/organizations/public')
      .then((res) => {
        if (isMounted) {
          const orgs = res.data || [];
          setOrganizations(orgs);
          if (orgs.length > 0 && !form.values.organizationId) {
            form.setValue('organizationId', orgs[0]._id);
          }
          setLoadingOrgs(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoadingOrgs(false);
      });
    return () => { isMounted = false; };
  }, []);

  const onSubmit = (e) => {
    e.preventDefault();
    form.submit(
      {
        firstName: rules.required('First name'),
        lastName: rules.required('Last name'),
        email: [rules.required('Email address'), rules.email('Email address')],
        requestedRole: rules.required('Role'),
        password: [
          rules.required('Password'),
          (v) => (v && v.length < 8 ? 'Password must be at least 8 characters' : null)
        ],
        confirmPassword: [
          rules.required('Password confirmation'),
          (v, all) => (v !== all.password ? 'Passwords do not match' : null)
        ]
      },
      async (values) => {
        const payload = {
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          email: values.email.trim(),
          phone: values.phone.trim(),
          requestedRole: values.requestedRole,
          organizationId: values.organizationId || (organizations[0]?._id),
          password: values.password,
          notes: values.notes.trim()
        };
        const res = await api.post('/auth/register', payload);
        setSubmittedUser(res.data.user);
      }
    );
  };

  const f = form.field;

  if (submittedUser) {
    return (
      <div className="flex min-h-screen flex-col justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-lg">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600 mb-4">
              <Clock className="h-8 w-8" />
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 border border-amber-200 mb-3">
              Registration Pending Approval
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">
              Registration Submitted!
            </h2>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Thank you, <strong className="text-slate-900">{submittedUser.firstName} {submittedUser.lastName}</strong> ({submittedUser.email}).
              Your account request for the <strong className="text-slate-900">{submittedUser.requestedRole}</strong> role has been registered.
            </p>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-left text-xs text-slate-700 space-y-2 mb-6">
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>An administrator (Global Admin or Organization Admin) must review and approve your account.</span>
              </div>
              <div className="flex items-start gap-2">
                <UserCheck className="h-4 w-4 text-brand-600 flex-shrink-0 mt-0.5" />
                <span>Once approved, you can immediately sign in with your email and password to access your dedicated dashboard.</span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="brand"
                className="w-full"
                onClick={() => navigate('/login')}
                icon={ArrowRight}
              >
                Go to Sign In
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  setSubmittedUser(null);
                  form.reset();
                }}
              >
                Register another account
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="text-center sm:mx-auto sm:w-full sm:max-w-xl">
        <Link to="/" className="inline-flex flex-col items-center gap-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-600">
          <img src="/tmt-logo.png" alt="TechMecha Torque" className="h-12 w-auto object-contain" />
        </Link>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
          Register for Platform Access
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Submit your details to request access. Accounts are activated upon administrator approval.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <form onSubmit={onSubmit} noValidate className="space-y-4" data-testid="register-form">
            <FormError error={form.formError} />

            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 pb-1 border-b border-slate-100 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-slate-400" />
              1. Personal Information
            </div>

            <FormGrid>
              <TextField {...f('firstName')} label="First name" required autoComplete="given-name" placeholder="E.g. Arjun" />
              <TextField {...f('lastName')} label="Last name" required autoComplete="family-name" placeholder="E.g. Sharma" />
              <TextField {...f('email')} label="Email address" type="email" required autoComplete="email" placeholder="you@example.com" className="sm:col-span-2" />
              <TextField {...f('phone')} label="Phone number" type="tel" autoComplete="tel" placeholder="+91 98765 43210" className="sm:col-span-2" />
            </FormGrid>

            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 pt-3 pb-1 border-b border-slate-100 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              2. Role & Organization
            </div>

            <FormGrid>
              <SelectField
                {...f('requestedRole')}
                label="Requested Role"
                required
                options={ROLES_OPTIONS}
                hint="Interns get access to the participant workspace, mentors supervise candidates, HR/Admin manage cohorts."
                className="sm:col-span-2"
              />

              {organizations.length > 0 && (
                <SelectField
                  {...f('organizationId')}
                  label="Target Organization"
                  required
                  options={organizations.map((org) => ({ value: org._id, label: `${org.name} (${org.code})` }))}
                  className="sm:col-span-2"
                />
              )}

              <TextAreaField
                {...f('notes')}
                label="Registration Notes / Purpose (Optional)"
                placeholder="State your college, department, or purpose of registration..."
                rows={2}
                className="sm:col-span-2"
              />
            </FormGrid>

            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 pt-3 pb-1 border-b border-slate-100 flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-slate-400" />
              3. Security Credentials
            </div>

            <FormGrid>
              <TextField
                {...f('password')}
                label="Create Password"
                type="password"
                required
                autoComplete="new-password"
                hint="Minimum 8 characters with at least one letter and digit."
              />
              <TextField
                {...f('confirmPassword')}
                label="Confirm Password"
                type="password"
                required
                autoComplete="new-password"
              />
            </FormGrid>

            <div className="pt-2">
              <Button
                type="submit"
                variant="brand"
                loading={form.submitting}
                className="w-full py-2.5"
                icon={ArrowRight}
                data-testid="register-submit"
              >
                Submit Registration Request
              </Button>
            </div>
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-slate-600">
          Already have an approved account?{' '}
          <Link to="/login" className="font-semibold text-brand-800 hover:text-brand-900 underline">
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  );
}

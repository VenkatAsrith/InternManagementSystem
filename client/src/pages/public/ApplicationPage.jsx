import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../../lib/http';
import { useFetch } from '../../hooks/useFetch';
import { useForm, rules } from '../../hooks/useForm';
import { Button, CheckboxField, EmptyState, ErrorState, FileField, FormError, FormGrid, LoadingBlock, SectionCard, TextAreaField, TextField } from '../../components/ui';
import { fmtDate } from '../../lib/format';

const MAX_RESUME_BYTES = 10 * 1024 * 1024;
const RESUME_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const thisYear = new Date().getFullYear();

const INITIAL = {
  firstName: '', lastName: '', email: '', phone: '', city: '', state: '', country: '',
  college: '', degree: '', branch: '', graduationYear: '', cgpa: '',
  technicalSkills: '', softSkills: '', github: '', linkedin: '', portfolio: '',
  coverLetter: '', preferredStartDate: '', resume: null, privacyConsent: false
};

export function ApplicationPage() {
  const { openingSlug } = useParams();
  const navigate = useNavigate();
  const opening = useFetch(() => api.get(`/recruitment/openings/public/${encodeURIComponent(openingSlug)}`), [openingSlug]);
  const form = useForm(INITIAL);
  const f = form.field;

  const validation = {
    firstName: [rules.required('First name'), rules.max(100, 'First name')],
    lastName: [rules.required('Last name'), rules.max(100, 'Last name')],
    email: [rules.required('Email'), rules.email('Email')],
    phone: [rules.required('Phone number'), (v) => (v && !/^\+?[0-9][0-9\s().-]{5,18}[0-9]$/.test(v.trim()) ? 'Enter a valid phone number (7-15 digits, optional +)' : null)],
    college: [rules.required('College'), rules.max(200, 'College')],
    degree: [rules.required('Degree'), rules.max(100, 'Degree')],
    branch: [rules.required('Branch'), rules.max(100, 'Branch')],
    graduationYear: [rules.required('Graduation year'), rules.number('Graduation year', { min: 1990, max: thisYear + 8 }), (v) => (v && !Number.isInteger(Number(v)) ? 'Graduation year must be a whole number' : null)],
    github: rules.url('GitHub link'),
    linkedin: rules.url('LinkedIn link'),
    portfolio: rules.url('Portfolio link'),
    coverLetter: rules.max(3000, 'Cover letter'),
    resume: (file) => {
      if (!file) return 'Please attach your resume';
      if (!RESUME_TYPES.includes(file.type)) return 'Resume must be a PDF, DOC or DOCX file';
      if (file.size > MAX_RESUME_BYTES) return 'Resume must be smaller than 10 MB';
      return null;
    },
    privacyConsent: (v) => (v ? null : 'You must accept the declaration to apply')
  };

  const onSubmit = (e) => {
    e.preventDefault();
    form.submit(validation, async (v) => {
      const body = new FormData();
      body.append('openingId', opening.data._id);
      Object.entries(v).forEach(([key, value]) => {
        if (key === 'resume' || key === 'privacyConsent') return;
        if (typeof value === 'string' && value.trim() !== '') body.append(key, value.trim());
      });
      body.append('resume', v.resume);
      body.append('privacyConsent', 'true');
      const res = await api.post('/recruitment/applications/public', body);
      navigate(`/application/success?id=${encodeURIComponent(res.data.applicationId)}`, { replace: true });
    });
  };

  if (opening.loading && !opening.data) return <div className="mx-auto max-w-3xl px-4 py-10"><LoadingBlock label="Loading application form..." /></div>;
  if (opening.error?.status === 404) {
    return <div className="mx-auto max-w-3xl px-4 py-10"><EmptyState title="This opening is closed" description="It is no longer accepting applications." testId="opening-closed" action={<Link to="/internships" className="text-sm font-medium text-brand-800 underline">Browse open internships</Link>} /></div>;
  }
  if (opening.error) return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorState error={opening.error} onRetry={opening.reload} /></div>;

  const o = opening.data;
  const duplicate = form.formError?.code === 'DUPLICATE_APPLICATION';

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link to={`/internships/${o.slug}`} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to opening</Link>
      <header className="mb-6">
        <h1 data-testid="page-title" className="text-3xl font-bold tracking-tight text-slate-900">Apply: {o.title}</h1>
        <p className="mt-1 text-sm text-slate-700">{o.organizationId?.name} - apply by {fmtDate(o.deadline)}. Fields marked * are required.</p>
      </header>

      <form onSubmit={onSubmit} noValidate className="space-y-5" data-testid="application-form" encType="multipart/form-data">
        <FormError error={form.formError && !duplicate ? form.formError : null} />
        {duplicate && (
          <div role="alert" data-testid="duplicate-application" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            You have already applied for this opening. <Link to="/application/status" className="font-semibold underline">Track your application</Link> with the Application ID from your confirmation email.
          </div>
        )}

        <SectionCard title="Personal details">
          <FormGrid>
            <TextField {...f('firstName')} label="First name" required autoComplete="given-name" />
            <TextField {...f('lastName')} label="Last name" required autoComplete="family-name" />
            <TextField {...f('email')} label="Email" type="email" required autoComplete="email" hint="Used to contact you about this application." />
            <TextField {...f('phone')} label="Phone" type="tel" required autoComplete="tel" placeholder="+91 98765 43210" />
            <TextField {...f('city')} label="City" autoComplete="address-level2" />
            <TextField {...f('state')} label="State" autoComplete="address-level1" />
            <TextField {...f('country')} label="Country" autoComplete="country-name" />
          </FormGrid>
        </SectionCard>

        <SectionCard title="Education">
          <FormGrid>
            <TextField {...f('college')} label="College / university" required className="sm:col-span-2" />
            <TextField {...f('degree')} label="Degree" required placeholder="B.Tech" />
            <TextField {...f('branch')} label="Branch / major" required placeholder="Computer Science" />
            <TextField {...f('graduationYear')} label="Graduation year" type="number" inputMode="numeric" required min="1990" max={thisYear + 8} />
            <TextField {...f('cgpa')} label="CGPA / percentage" />
          </FormGrid>
        </SectionCard>

        <SectionCard title="Skills & links">
          <FormGrid>
            <TextField {...f('technicalSkills')} label="Technical skills" hint="Separate with commas: React, Node.js, SQL" />
            <TextField {...f('softSkills')} label="Soft skills" hint="Separate with commas" />
            <TextField {...f('github')} label="GitHub" type="url" placeholder="https://github.com/username" />
            <TextField {...f('linkedin')} label="LinkedIn" type="url" placeholder="https://linkedin.com/in/username" />
            <TextField {...f('portfolio')} label="Portfolio" type="url" className="sm:col-span-2" />
          </FormGrid>
        </SectionCard>

        <SectionCard title="Resume & message">
          <div className="space-y-4">
            <FileField
              name="resume" label="Resume" required accept=".pdf,.doc,.docx" hint="PDF, DOC or DOCX, up to 10 MB."
              error={form.errors.resume}
              onChange={(e) => form.set('resume', e.target.files?.[0] || null)}
            />
            <TextAreaField {...f('coverLetter')} label="Why do you want this internship?" rows={5} maxLength={3000} hint={`${(form.values.coverLetter || '').length}/3000`} />
            <TextField {...f('preferredStartDate')} label="Preferred start date" type="date" />
          </div>
        </SectionCard>

        <CheckboxField
          name="privacyConsent" checked={form.values.privacyConsent} onChange={f('privacyConsent').onChange} error={form.errors.privacyConsent}
          label="I confirm the information is accurate and consent to TechMecha Torque processing it for this application."
        />

        <Button type="submit" variant="brand" size="lg" loading={form.submitting} className="w-full sm:w-auto" data-testid="apply-submit">Submit application</Button>
      </form>
    </div>
  );
}

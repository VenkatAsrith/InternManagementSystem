import React, { useState } from 'react';
import { Mail, Plus, Edit2, Trash2, Send, Eye, CheckCircle2, Code, Sparkles, Copy } from 'lucide-react';
import api from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useForm, rules } from '../../hooks/useForm';
import { humanize, fmtDateTime } from '../../lib/format';
import {
  Button, DataTable, FormGrid, FormModal, Modal, PageHeader,
  SectionCard, SelectField, StatusBadge, TextAreaField, TextField
} from '../../components/ui';

function TemplateModal({ template, onClose, onDone }) {
  const toast = useToast();
  const isEdit = !!template?._id;

  const form = useForm({
    templateCode: template?.templateCode || '',
    title: template?.title || '',
    category: template?.category || 'GENERAL',
    subject: template?.subject || '',
    bodyHtml: template?.bodyHtml || ''
  });
  const f = form.field;

  const handleSubmit = async (v) => {
    return await api.post('/emails/templates', {
      templateCode: v.templateCode.trim(),
      title: v.title.trim(),
      category: v.category,
      subject: v.subject.trim(),
      bodyHtml: v.bodyHtml
    });
  };

  const insertVariable = (varKey) => {
    const current = form.values.bodyHtml || '';
    form.setValues((prev) => ({
      ...prev,
      bodyHtml: `${current} {{${varKey}}}`
    }));
    toast.success(`Inserted {{${varKey}}}`);
  };

  const sampleVars = [
    { key: 'name', desc: 'Participant full name' },
    { key: 'email', desc: 'Login email address' },
    { key: 'password', desc: 'Generated password' },
    { key: 'role', desc: 'Role (Intern / Trainee)' },
    { key: 'orgName', desc: 'Organization name' },
    { key: 'loginUrl', desc: 'Portal login URL' },
    { key: 'documentTitle', desc: 'Required document name' },
    { key: 'meetingLink', desc: 'Google Meet URL' }
  ];

  return (
    <FormModal
      open
      onClose={onClose}
      size="xl"
      testId="email-template-modal"
      title={isEdit ? `Edit Template: ${template.title}` : 'Create Email Template'}
      description="Design customized notification emails with merge tags for automated intern & trainee workflows."
      submitLabel={isEdit ? 'Save Changes' : 'Create Template'}
      form={form}
      rules={{
        templateCode: rules.required('Template code'),
        title: rules.required('Title'),
        subject: rules.required('Subject line'),
        bodyHtml: rules.required('Email body')
      }}
      onSubmit={handleSubmit}
      onDone={() => {
        toast.success(isEdit ? 'Email template updated' : 'Email template created');
        onDone();
      }}
    >
      <FormGrid>
        <TextField
          {...f('templateCode')}
          label="Template Code"
          required
          disabled={isEdit}
          placeholder="e.g. WELCOME_ONBOARDING"
          hint="Unique identifier in uppercase alphanumeric format"
        />
        <SelectField
          {...f('category')}
          label="Category"
          options={[
            { value: 'ONBOARDING', label: 'Onboarding & Credentials' },
            { value: 'INTERVIEW', label: 'Interview Scheduling' },
            { value: 'DOCUMENTS', label: 'Documents & Verification' },
            { value: 'BOOTCAMP', label: 'Bootcamp Passes' },
            { value: 'OFFER', label: 'Offer Letters' },
            { value: 'GENERAL', label: 'General Announcement' }
          ]}
        />
        <TextField
          {...f('title')}
          label="Template Name"
          required
          placeholder="e.g. Welcome & Login Credentials"
          className="sm:col-span-2"
        />
        <TextField
          {...f('subject')}
          label="Email Subject Line"
          required
          placeholder="e.g. Welcome to {{orgName}} – Your Login Details"
          className="sm:col-span-2"
        />

        {/* Dynamic Variable Pills */}
        <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
          <p className="text-xs font-semibold text-slate-700">Click to insert merge variables:</p>
          <div className="flex flex-wrap gap-1.5">
            {sampleVars.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => insertVariable(v.key)}
                className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-xs font-mono font-medium text-brand-800 border border-slate-200 hover:bg-brand-50 hover:border-brand-300"
                title={v.desc}
              >
                + &#123;&#123;{v.key}&#125;&#125;
              </button>
            ))}
          </div>
        </div>

        <TextAreaField
          {...f('bodyHtml')}
          label="Email Body (HTML / Text)"
          required
          rows={10}
          className="sm:col-span-2 font-mono text-xs"
          placeholder="<h2>Welcome, {{name}}!</h2><p>Here are your credentials...</p>"
        />
      </FormGrid>
    </FormModal>
  );
}

function TestSendModal({ template, onClose }) {
  const toast = useToast();
  const { user } = useAuth();
  const [testEmail, setTestEmail] = useState(user?.email || '');
  const [sending, setSending] = useState(false);

  const handleSendTest = async (e) => {
    e.preventDefault();
    if (!testEmail.trim()) return toast.error('Enter recipient email');
    setSending(true);
    try {
      await api.post(`/emails/templates/${template._id}/test`, { to: testEmail.trim() });
      toast.success(`Test preview email dispatched to ${testEmail.trim()}`);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to dispatch test email');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={`Send Test: ${template.title}`}
      testId="test-send-modal"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={Send} loading={sending} onClick={handleSendTest} data-testid="send-test-btn">
            Send Test Email
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-2">
        <p className="text-xs text-slate-600">
          Sends an actual email preview rendered with sample data to verify design and formatting.
        </p>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Recipient Email</label>
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            required
          />
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <p className="font-semibold text-slate-800">Subject Preview:</p>
          <p className="mt-0.5 text-slate-700">{template.subject}</p>
        </div>
      </div>
    </Modal>
  );
}

export function EmailTemplatesPage() {
  const toast = useToast();
  const [modal, setModal] = useState(null); // 'create' | { type: 'edit', template } | { type: 'test', template }
  const state = useFetch(() => api.get('/emails/templates'), []);

  const templates = state.data || [];

  const handleDelete = async (t) => {
    if (!window.confirm(`Delete template "${t.title}"?`)) return;
    try {
      await api.delete(`/emails/templates/${t._id}`);
      toast.success('Template deleted');
      state.reload();
    } catch (err) {
      toast.error(err.message || 'Failed to delete template');
    }
  };

  const cols = [
    {
      key: 'title',
      header: 'Template',
      render: (t) => (
        <div>
          <p className="font-semibold text-slate-900 text-sm">{t.title}</p>
          <p className="font-mono text-xs text-slate-500">{t.templateCode}</p>
        </div>
      )
    },
    {
      key: 'category',
      header: 'Category',
      render: (t) => (
        <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
          {humanize(t.category)}
        </span>
      )
    },
    {
      key: 'subject',
      header: 'Subject Line',
      render: (t) => <span className="text-xs text-slate-800 font-medium truncate max-w-[260px] block">{t.subject}</span>
    },
    {
      key: 'updatedAt',
      header: 'Last Updated',
      render: (t) => <span className="text-xs text-slate-500">{fmtDateTime(t.updatedAt || t.createdAt)}</span>
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (t) => (
        <div className="flex items-center gap-1.5">
          <Button
            size="xs"
            variant="outline"
            icon={Send}
            onClick={() => setModal({ type: 'test', template: t })}
            data-testid={`test-template-${t.templateCode}`}
            title="Send test email preview"
          >
            Test
          </Button>
          <Button
            size="xs"
            variant="outline"
            icon={Edit2}
            onClick={() => setModal({ type: 'edit', template: t })}
            data-testid={`edit-template-${t.templateCode}`}
          >
            Edit
          </Button>
          <Button
            size="xs"
            variant="ghost"
            icon={Trash2}
            onClick={() => handleDelete(t)}
            data-testid={`delete-template-${t.templateCode}`}
          />
        </div>
      )
    }
  ];

  return (
    <>
      <PageHeader
        title="Email Templates"
        description="Configure and personalize automated communication emails for onboarding, credentials, document requests, and interview calls."
        actions={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => setModal('create')}
            data-testid="create-email-template-btn"
          >
            Create Template
          </Button>
        }
      />

      <DataTable
        testId="email-templates-table"
        columns={cols}
        rows={templates}
        loading={state.loading}
        error={state.error}
        onRetry={state.reload}
        rowKey={(t) => t._id}
        caption="Email Templates"
        emptyTitle="No email templates found"
        emptyDescription="Create a template or wait for defaults to seed."
      />

      {modal === 'create' && (
        <TemplateModal
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            state.reload();
          }}
        />
      )}

      {modal?.type === 'edit' && (
        <TemplateModal
          template={modal.template}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            state.reload();
          }}
        />
      )}

      {modal?.type === 'test' && (
        <TestSendModal
          template={modal.template}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}

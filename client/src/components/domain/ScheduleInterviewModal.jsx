import React from 'react';
import api from '../../lib/http';
import { useToast } from '../../context/ToastContext';
import { useForm, rules } from '../../hooks/useForm';
import { useStaffUsers, userLabel } from '../../hooks/useRefData';
import { todayISO } from '../../lib/format';
import { FormGrid, FormModal, InlineAlert, SelectField, TextAreaField, TextField } from '../ui';

const TYPES = ['TECHNICAL', 'HR', 'MANAGERIAL', 'FINAL'].map((t) => ({ value: t, label: t.charAt(0) + t.slice(1).toLowerCase() }));

/** Used by the application detail page and the interviews page. `application` needs applicationId (APP-...) and candidate name. */
export function ScheduleInterviewModal({ open, onClose, application, onDone }) {
  const toast = useToast();
  const { interviewers, loading, error } = useStaffUsers();
  const form = useForm({ type: 'TECHNICAL', mode: 'ONLINE', scheduledDate: todayISO(), startTime: '10:00', endTime: '11:00', interviewers: [], meetingLink: '', location: '', notes: '' });
  const f = form.field;
  const toggle = (id) => form.set('interviewers', form.values.interviewers.includes(id) ? form.values.interviewers.filter((x) => x !== id) : [...form.values.interviewers, id]);

  return (
    <FormModal
      open={open} onClose={onClose} size="lg" testId="schedule-modal" title="Schedule interview" description={application ? `${application.candidateName} - ${application.applicationId}` : undefined}
      submitLabel="Schedule interview" form={form}
      rules={{
        scheduledDate: rules.required('Date'), startTime: rules.required('Start time'),
        endTime: [rules.required('End time'), (v, all) => (v && all.startTime && v <= all.startTime ? 'End time must be after the start time' : null)],
        interviewers: [rules.required('At least one interviewer'), (v) => (v.length > 5 ? 'Choose at most 5 interviewers' : null)],
        location: (v, all) => (all.mode === 'IN_PERSON' && !String(v).trim() ? 'Location is required for in-person interviews' : null),
        meetingLink: rules.url('Meeting link')
      }}
      onSubmit={(v) => api.post('/interviews', {
        applicationId: application.applicationId, type: v.type, mode: v.mode, scheduledDate: v.scheduledDate, startTime: v.startTime, endTime: v.endTime,
        interviewers: v.interviewers, ...(v.mode === 'ONLINE' && v.meetingLink ? { meetingLink: v.meetingLink.trim() } : {}),
        ...(v.mode === 'IN_PERSON' ? { location: v.location.trim() } : {}), ...(v.notes.trim() ? { notes: v.notes.trim() } : {})
      })}
      onDone={() => { toast.success('Interview scheduled. The candidate and panel were notified.'); onDone?.(); }}
    >
      <FormGrid>
        <SelectField {...f('type')} label="Interview type" options={TYPES} />
        <SelectField {...f('mode')} label="Mode" options={[{ value: 'ONLINE', label: 'Online' }, { value: 'IN_PERSON', label: 'In person' }]} />
        <TextField {...f('scheduledDate')} label="Date" type="date" required min={todayISO()} />
        <div className="grid grid-cols-2 gap-3">
          <TextField {...f('startTime')} label="Start" type="time" required />
          <TextField {...f('endTime')} label="End" type="time" required />
        </div>
        {form.values.mode === 'ONLINE'
          ? <TextField {...f('meetingLink')} label="Meeting link" type="url" hint="Leave empty to generate one." className="sm:col-span-2" />
          : <TextField {...f('location')} label="Location" required className="sm:col-span-2" />}
      </FormGrid>
      <fieldset className="mt-4">
        <legend className="mb-1.5 text-sm font-medium text-slate-800">Interview panel <span className="text-rose-700" aria-hidden="true">*</span></legend>
        {loading ? <p className="text-sm text-slate-600">Loading interviewers...</p> : error ? <InlineAlert tone="error">{error.message}</InlineAlert> : interviewers.length === 0 ? (
          <InlineAlert tone="warning" testId="no-interviewers">No active users can conduct interviews yet.</InlineAlert>
        ) : (
          <ul className="grid gap-1.5 sm:grid-cols-2" data-testid="interviewer-options">
            {interviewers.map((u) => (
              <li key={u._id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
                  <input type="checkbox" checked={form.values.interviewers.includes(u._id)} onChange={() => toggle(u._id)} data-testid={`interviewer-${u._id}`} className="h-4 w-4 rounded border-slate-400" />
                  <span>{userLabel(u)}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {form.errors.interviewers && <p role="alert" data-testid="error-interviewers" className="mt-1 text-xs font-medium text-rose-700">{form.errors.interviewers}</p>}
      </fieldset>
      <TextAreaField {...f('notes')} label="Notes for the panel" rows={2} className="mt-4" />
    </FormModal>
  );
}

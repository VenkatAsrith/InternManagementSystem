import React from 'react';
import api from '../../lib/http';
import { useToast } from '../../context/ToastContext';
import { useForm, rules } from '../../hooks/useForm';
import { useStaffUsers, userLabel } from '../../hooks/useRefData';
import { addDaysISO, todayISO } from '../../lib/format';
import { FormGrid, FormModal, SelectField, TextAreaField, TextField } from '../ui';

const COMP_TYPES = [
  { value: 'MONTHLY_STIPEND', label: 'Monthly stipend' }, { value: 'DAILY_RATE', label: 'Daily rate' },
  { value: 'HOURLY_RATE', label: 'Hourly rate' }, { value: 'PERFORMANCE_BONUS', label: 'Performance bonus' }, { value: 'UNPAID', label: 'Unpaid' }
];

/**
 * Drafts (or edits) an offer. Duration, the stipend display text and the compensation plan are derived by the API,
 * the browser only supplies dates and the amount.
 */
export function OfferDraftModal({ open, onClose, application, offer, onDone }) {
  const toast = useToast();
  const edit = !!offer;
  const { mentors } = useStaffUsers();
  const day = (d) => (d ? String(d).slice(0, 10) : '');
  const form = useForm({
    startDate: day(offer?.startDate) || addDaysISO(todayISO(), 14), endDate: day(offer?.endDate) || addDaysISO(todayISO(), 14 + 59),
    compensationType: offer?.compensationType || 'MONTHLY_STIPEND', stipendAmount: offer?.stipendAmount ?? '', currency: offer?.currency || 'INR',
    workMode: offer?.workMode || 'REMOTE', mentorId: offer?.mentorId?._id || offer?.mentorId || '', responsibilities: (offer?.responsibilities || []).join('\n'), terms: offer?.terms || ''
  });
  const f = form.field;
  const unpaid = form.values.compensationType === 'UNPAID';

  return (
    <FormModal
      open={open} onClose={onClose} size="lg" testId="offer-modal" title={edit ? `Edit offer ${offer.offerId}` : 'Draft internship offer'}
      description={application ? `${application.candidateName} - ${application.title}` : undefined} submitLabel={edit ? 'Save offer' : 'Create draft'} form={form}
      rules={{
        startDate: rules.required('Start date'),
        endDate: [rules.required('End date'), (v, all) => (v && all.startDate && v <= all.startDate ? 'End date must be after the start date' : null)],
        stipendAmount: [(v, all) => (all.compensationType !== 'UNPAID' && !(Number(v) > 0) ? 'Enter an amount greater than 0, or choose Unpaid' : null), rules.number('Amount', { min: 0 })]
      }}
      onSubmit={(v) => {
        const body = {
          startDate: v.startDate, endDate: v.endDate, compensationType: v.compensationType, stipendAmount: unpaid ? 0 : Number(v.stipendAmount), currency: v.currency, workMode: v.workMode,
          ...(v.mentorId ? { mentorId: v.mentorId } : {}), ...(v.responsibilities.trim() ? { responsibilities: v.responsibilities } : {}), ...(v.terms.trim() ? { terms: v.terms.trim() } : {})
        };
        return edit ? api.patch(`/offers/${offer._id}`, body) : api.post('/offers', { ...body, applicationId: application.applicationId });
      }}
      onDone={() => { toast.success(edit ? 'Offer updated' : 'Offer drafted. Review it, then send it to the candidate.'); onDone?.(); }}
    >
      <FormGrid>
        <TextField {...f('startDate')} label="Start date" type="date" required min={todayISO()} />
        <TextField {...f('endDate')} label="End date" type="date" required />
        <SelectField {...f('compensationType')} label="Compensation type" options={COMP_TYPES} />
        <SelectField {...f('workMode')} label="Work mode" options={[{ value: 'REMOTE', label: 'Remote' }, { value: 'HYBRID', label: 'Hybrid' }, { value: 'ON_SITE', label: 'On site' }]} />
        <TextField {...f('stipendAmount')} label="Amount" type="number" min="0" step="0.01" disabled={unpaid} value={unpaid ? 0 : form.values.stipendAmount} required={!unpaid} />
        <SelectField {...f('currency')} label="Currency" options={['INR', 'USD', 'EUR', 'GBP']} />
        <SelectField {...f('mentorId')} label="Mentor" placeholder="Assign later" options={mentors.map((u) => ({ value: u._id, label: userLabel(u) }))} className="sm:col-span-2" />
        <TextAreaField {...f('responsibilities')} label="Responsibilities" rows={3} hint="One per line. Defaults to the opening's responsibilities." className="sm:col-span-2" />
        <TextAreaField {...f('terms')} label="Terms" rows={3} className="sm:col-span-2" />
      </FormGrid>
    </FormModal>
  );
}

import React, { useId } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { FormError } from './Field';

/**
 * Modal wrapping a form. The owning component calls useForm() and passes it in, and mounts this component
 * only while open, so every open starts from a clean form.
 *   <FormModal open title="New program" form={form} rules={rules} onSubmit={(values) => api.post(...)} onDone={...}>
 */
export function FormModal({ open, onClose, title, description, form, rules, onSubmit, onDone, submitLabel = 'Save', submitVariant = 'primary', size = 'md', testId = 'form-modal', children, extraFooter }) {
  const formId = useId();
  const handle = async (e) => {
    e.preventDefault();
    const result = await form.submit(rules || {}, onSubmit);
    if (result.ok) onDone?.(result.value);
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size={size}
      testId={testId}
      footer={(
        <>
          {extraFooter}
          <Button variant="outline" onClick={onClose} data-testid={`${testId}-cancel`}>Cancel</Button>
          <Button type="submit" form={formId} variant={submitVariant} loading={form.submitting} data-testid={`${testId}-submit`}>{submitLabel}</Button>
        </>
      )}
    >
      <form id={formId} onSubmit={handle} noValidate className="space-y-4" data-testid={`${testId}-form`}>
        <FormError error={form.formError} />
        {children}
      </form>
    </Modal>
  );
}

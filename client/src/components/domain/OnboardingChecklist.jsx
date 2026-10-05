import React, { useRef, useState } from 'react';
import { Download, Eye, Upload } from 'lucide-react';
import api, { downloadFile } from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { fmtDate, humanize } from '../../lib/format';
import { Button, InlineAlert, StatusBadge, useConfirm } from '../ui';
import { DocumentPreviewModal } from './DocumentPreviewModal';

const DOC_STATE = {
  UPLOADED: 'Waiting for HR approval', UNDER_REVIEW: 'Under review', APPROVED: 'Approved', REJECTED: 'Rejected'
};

/**
 * One checklist for both audiences.
 *  - intern: complete own non-document tasks, upload documents for document tasks
 *  - staff (onboarding.manage): complete/skip/block any task, approve or reject uploaded documents
 * Document tasks are never toggled by hand: their state follows the document (upload -> in progress, approval -> completed).
 */
export function OnboardingChecklist({ tasks, mode, locked, onChanged }) {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const fileRefs = useRef({});
  const staff = mode === 'staff';
  const manage = staff && can('onboarding.manage');
  const review = staff && can('documents.approve');

  const setStatus = async (task, status) => {
    setBusy(task._id);
    try {
      const res = await api.patch(`/onboarding/tasks/${task._id}`, { status });
      toast.success(res.data.activated ? 'Task updated. Onboarding is complete and the intern is now ACTIVE.' : 'Task updated');
      onChanged();
    } catch (e) { toast.error(e.message); onChanged(); } finally { setBusy(null); }
  };

  const upload = async (task, file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('File must be smaller than 10 MB'); return; }
    setBusy(task._id);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('type', task.documentType);
      body.append('onboardingTaskId', task._id);
      await api.post('/documents/upload', body);
      toast.success('Document uploaded. HR will review it.');
      onChanged();
    } catch (e) { toast.error(e.message); } finally { setBusy(null); if (fileRefs.current[task._id]) fileRefs.current[task._id].value = ''; }
  };

  const approve = async (doc, task) => {
    setBusy(task._id);
    try { await api.post(`/documents/${doc._id}/approve`, {}); toast.success('Document approved'); onChanged(); }
    catch (e) { toast.error(e.message); onChanged(); } finally { setBusy(null); }
  };
  const reject = async (doc, task) => {
    const reason = await confirm({ title: 'Reject this document?', message: 'The intern will see your reason and can upload a replacement.', requireReason: true, reasonLabel: 'Reason', confirmLabel: 'Reject', tone: 'danger' });
    if (!reason) return;
    setBusy(task._id);
    try { await api.post(`/documents/${doc._id}/reject`, { rejectionReason: reason }); toast.success('Document rejected'); onChanged(); }
    catch (e) { toast.error(e.message); onChanged(); } finally { setBusy(null); }
  };
  const download = async (doc) => {
    try { await downloadFile(`/documents/${doc._id}/download`, doc.originalName || 'document'); } catch (e) { toast.error(e.message); }
  };

  return (
    <div>
      {locked && <InlineAlert tone="success" className="mb-4" testId="onboarding-locked">Onboarding is finished. Tasks can no longer be changed.</InlineAlert>}
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white" data-testid="onboarding-tasks">
        {tasks.map((t) => {
          const doc = t.documentId && typeof t.documentId === 'object' ? t.documentId : null;
          const isDocTask = !!t.documentType;
          const internOwned = t.owner === 'INTERN';
          const mine = !staff && internOwned;
          const disabled = locked || busy === t._id;
          return (
            <li key={t._id} data-testid={`onboarding-task-${t.key || t._id}`} data-status={t.status} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">{t.title}</p>
                  <StatusBadge status={t.status === 'IN_PROGRESS' ? 'UNDER_REVIEW' : t.status} label={t.status === 'IN_PROGRESS' ? 'Awaiting approval' : undefined} testId={`task-status-${t.key || t._id}`} />
                  {!t.required && <span className="text-xs text-slate-600">Optional</span>}
                </div>
                <p className="mt-0.5 text-xs text-slate-700">{t.description}</p>
                <p className="mt-1 text-xs text-slate-600">Owner: {humanize(t.owner)}{t.completedAt ? ` - completed ${fmtDate(t.completedAt)}` : ''}</p>
                {t.notes && <p className="mt-1 text-xs font-medium text-rose-700" data-testid="task-note">{t.notes}</p>}
                {doc && <p className="mt-1 text-xs text-slate-700" data-testid="task-document">Document: {doc.originalName || 'file'} (v{doc.version}) - {DOC_STATE[doc.status] || humanize(doc.status)}</p>}
              </div>
              <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                {isDocTask && internOwned && mine && !locked && t.status !== 'COMPLETED' && (
                  <>
                    <input ref={(el) => { fileRefs.current[t._id] = el; }} id={`upload-${t._id}`} type="file" className="sr-only" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" onChange={(e) => upload(t, e.target.files?.[0])} data-testid={`upload-input-${t.key || t._id}`} />
                    <Button size="sm" variant="outline" icon={Upload} disabled={disabled} loading={busy === t._id} onClick={() => fileRefs.current[t._id]?.click()} data-testid={`upload-${t.key || t._id}`}>{doc ? 'Replace' : 'Upload'}</Button>
                  </>
                )}
                {isDocTask && doc && (staff || mine) && (
                  <>
                    <Button size="sm" variant="outline" icon={Eye} onClick={() => setPreviewDoc(doc)} data-testid={`preview-${t.key || t._id}`}>Preview</Button>
                    <Button size="sm" variant="ghost" icon={Download} onClick={() => download(doc)} data-testid={`download-${t.key || t._id}`}>Download</Button>
                  </>
                )}
                {review && doc && ['UPLOADED', 'UNDER_REVIEW'].includes(doc.status) && !locked && (
                  <>
                    <Button size="sm" variant="success" disabled={disabled} onClick={() => approve(doc, t)} data-testid={`approve-${t.key || t._id}`}>Approve</Button>
                    <Button size="sm" variant="outline" disabled={disabled} onClick={() => reject(doc, t)} data-testid={`reject-${t.key || t._id}`}>Reject</Button>
                  </>
                )}
                {!isDocTask && !locked && (manage || (mine && !isDocTask)) && (
                  t.status === 'COMPLETED'
                    ? <Button size="sm" variant="outline" disabled={disabled} onClick={() => setStatus(t, 'PENDING')} data-testid={`reopen-${t.key || t._id}`}>Mark not done</Button>
                    : <Button size="sm" variant="success" disabled={disabled} loading={busy === t._id} onClick={() => setStatus(t, 'COMPLETED')} data-testid={`complete-${t.key || t._id}`}>Mark complete</Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {previewDoc && <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </div>
  );
}

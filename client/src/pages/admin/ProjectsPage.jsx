import React, { useState } from 'react';
import { Plus, UserPlus, Trash2, Eye, Download, Upload, MessageSquare, FolderKanban, Users, CheckSquare, FileText } from 'lucide-react';
import api, { downloadFile } from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useForm, rules } from '../../hooks/useForm';
import { usePrograms } from '../../hooks/useRefData';
import { fmtDate, fmtDateTime, fullName, humanize, todayISO, addDaysISO, fileSize } from '../../lib/format';
import { 
  Button, DataTable, DetailList, FormGrid, FormModal, Modal, PageHeader, 
  ProgressBar, SelectField, StateView, StatusBadge, TextAreaField, TextField, 
  Tabs, TabPanel, FileField, useConfirm, InlineAlert
} from '../../components/ui';
import { TaskFormModal } from '../../components/domain/TaskFormModal';
import { TaskDetailModal } from '../../components/domain/TaskDetailModal';
import { DocumentPreviewModal } from '../../components/domain/DocumentPreviewModal';
import { ChatPanel } from '../../components/chat/ChatPanel';
import { DOCUMENT_CATEGORY } from '@shared/constants.js';

const NEXT = { 
  PLANNED: ['ACTIVE', 'CANCELLED'], 
  ACTIVE: ['ON_HOLD', 'COMPLETED', 'CANCELLED'], 
  ON_HOLD: ['ACTIVE', 'CANCELLED'], 
  COMPLETED: [], 
  CANCELLED: [] 
};

const day = (d) => (d ? String(d).slice(0, 10) : '');
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_DOC_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/csv'];

function ProjectFormModal({ project, onClose, onDone }) {
  const toast = useToast();
  const edit = !!project;
  const { programs } = usePrograms();
  const usersState = useFetch(() => api.get('/users', { params: { isActive: true, limit: 100 } }), []);

  const form = useForm({
    name: project?.name || '',
    description: project?.description || '',
    objective: project?.objective || '',
    programId: project?.programId?._id || project?.programId || '',
    startDate: day(project?.startDate) || todayISO(),
    endDate: day(project?.endDate) || addDaysISO(todayISO(), 60),
    repositoryUrl: project?.repositoryUrl || '',
    documentationUrl: project?.documentationUrl || '',
    members: (project?.members || []).map(m => m._id || m)
  });

  const f = form.field;

  return (
    <FormModal
      open
      onClose={onClose}
      size="lg"
      testId="project-modal"
      title={edit ? 'Edit project' : 'New project'}
      submitLabel={edit ? 'Save project' : 'Create project'}
      form={form}
      rules={{
        name: [rules.required('Name'), rules.max(150, 'Name')],
        startDate: rules.required('Start date'),
        endDate: [
          rules.required('End date'),
          (v, a) => (v && a.startDate && v <= a.startDate ? 'End date must be after the start date' : null)
        ],
        repositoryUrl: rules.url('Repository URL'),
        documentationUrl: rules.url('Documentation URL')
      }}
      onSubmit={(v) => {
        const body = {
          name: v.name.trim(),
          description: v.description.trim(),
          objective: v.objective.trim(),
          startDate: v.startDate,
          endDate: v.endDate
        };
        if (v.programId) body.programId = v.programId;
        if (v.repositoryUrl.trim()) body.repositoryUrl = v.repositoryUrl.trim();
        if (v.documentationUrl.trim()) body.documentationUrl = v.documentationUrl.trim();
        if (Array.isArray(v.members)) body.members = v.members;
        return edit ? api.patch(`/projects/${project._id}`, body) : api.post('/projects', body);
      }}
      onDone={() => {
        toast.success(edit ? 'Project updated' : 'Project created');
        onDone();
      }}
    >
      <FormGrid>
        <TextField {...f('name')} label="Project name" required className="sm:col-span-2" />
        <SelectField
          {...f('programId')}
          label="Program"
          placeholder="None"
          options={programs.map((p) => ({ value: p._id, label: p.title }))}
        />
        <div />
        <TextField {...f('startDate')} label="Start date" type="date" required />
        <TextField {...f('endDate')} label="End date" type="date" required />
        <TextField {...f('repositoryUrl')} label="Repository URL" type="url" />
        <TextField {...f('documentationUrl')} label="Documentation URL" type="url" />
        <TextAreaField {...f('objective')} label="Objective" rows={2} className="sm:col-span-2" />
        <TextAreaField {...f('description')} label="Description" rows={3} className="sm:col-span-2" />
      </FormGrid>
    </FormModal>
  );
}

function AddMemberModal({ projectId, existingMemberIds, onClose, onDone }) {
  const toast = useToast();
  const users = useFetch(() => api.get('/users', { params: { isActive: true, limit: 150 } }), []);
  const form = useForm({ userId: '' });

  const available = (users.data?.users || users.data || []).filter(
    u => !existingMemberIds.includes(String(u._id))
  );

  return (
    <FormModal
      open
      onClose={onClose}
      size="sm"
      testId="add-project-member-modal"
      title="Add Team Member"
      submitLabel="Add to Project"
      form={form}
      rules={{ userId: rules.required('User') }}
      onSubmit={async (v) => {
        return api.post(`/projects/${projectId}/members`, { userId: v.userId });
      }}
      onDone={() => {
        toast.success('Member added to project');
        onDone();
      }}
    >
      <SelectField
        {...form.field('userId')}
        label="Select User / Intern"
        required
        placeholder="Choose a colleague..."
        options={available.map(u => ({
          value: u._id,
          label: `${fullName(u)} (${u.role}${u.department ? ` - ${u.department}` : ''})`
        }))}
      />
    </FormModal>
  );
}

function UploadProjectDocModal({ projectId, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({ type: 'PROJECT_SPEC', file: null });

  return (
    <FormModal
      open
      onClose={onClose}
      size="sm"
      testId="upload-project-doc-modal"
      title="Upload Project Document"
      submitLabel="Upload"
      form={form}
      rules={{
        file: (f) => (
          !f ? 'Choose a file' :
          !ALLOWED_DOC_TYPES.includes(f.type) ? 'Unsupported file format' :
          f.size > MAX_FILE_SIZE ? 'File must be smaller than 10 MB' : null
        )
      }}
      onSubmit={async (v) => {
        const body = new FormData();
        body.append('file', v.file);
        body.append('type', v.type);
        body.append('projectId', projectId);
        return api.post('/documents/upload', body);
      }}
      onDone={() => {
        toast.success('Project document uploaded');
        onDone();
      }}
    >
      <SelectField
        {...form.field('type')}
        label="Document Category"
        options={Object.values(DOCUMENT_CATEGORY).map((t) => ({ value: t, label: humanize(t) }))}
      />
      <FileField
        name="file"
        label="File"
        required
        hint="PDF, images, Word or text up to 10 MB."
        error={form.errors.file}
        onChange={(e) => form.set('file', e.target.files?.[0] || null)}
      />
    </FormModal>
  );
}

function ProjectDetail({ id, onClose, onChanged, onEdit }) {
  const { can, user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const state = useFetch(() => api.get(`/projects/${id}`), [id]);
  const docsState = useFetch(() => api.get('/documents', { params: { projectId: id } }), [id]);

  const [activeTab, setActiveTab] = useState('overview');
  const [taskModal, setTaskModal] = useState(null);
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [uploadDocModalOpen, setUploadDocModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);

  const refresh = () => {
    state.reload({ silent: true });
    docsState.reload({ silent: true });
    onChanged();
  };

  const setStatus = async (status) => {
    try {
      await api.patch(`/projects/${id}`, { status });
      toast.success(`Project ${humanize(status).toLowerCase()}`);
      refresh();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleRemoveMember = async (memberId, memberName) => {
    const ok = await confirm({
      title: 'Remove team member?',
      message: `Remove ${memberName} from this project? They will lose access to project workspace documents and tasks.`,
      confirmLabel: 'Remove',
      tone: 'danger'
    });
    if (!ok) return;

    try {
      await api.delete(`/projects/${id}/members/${memberId}`);
      toast.success('Member removed');
      refresh();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleDownloadDoc = async (d) => {
    try {
      await downloadFile(`/documents/${d._id}/download`, d.originalName || `${d.title}.pdf`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      testId="project-detail"
      title={state.data?.project?.name || 'Project Workspace'}
    >
      <StateView state={state}>
        {({ project, tasks, metrics }) => {
          const members = project.members || [];
          const projectDocs = docsState.data?.documents || docsState.data || project.documents || [];

          return (
            <div className="space-y-4">
              {/* Header Status Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-3">
                  <StatusBadge status={project.status} testId="project-status" />
                  <span className="text-xs text-slate-500 font-medium">
                    {members.length} members · {tasks.length} tasks
                  </span>
                </div>
                {can('projects.manage') && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => onEdit(project)} data-testid="project-edit">
                      Edit
                    </Button>
                    {(NEXT[project.status] || []).map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant={s === 'CANCELLED' ? 'danger' : 'outline'}
                        onClick={() => setStatus(s)}
                        data-testid={`project-move-${s}`}
                      >
                        {s === 'COMPLETED' ? 'Mark completed' : s === 'CANCELLED' ? 'Cancel project' : `Set ${humanize(s)}`}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {/* Navigation Tabs */}
              <Tabs
                tabs={[
                  { id: 'overview', label: 'Overview', icon: FolderKanban },
                  { id: 'members', label: `Members (${members.length})`, icon: Users },
                  { id: 'tasks', label: `Tasks (${tasks.length})`, icon: CheckSquare },
                  { id: 'documents', label: `Documents (${projectDocs.length})`, icon: FileText },
                  { id: 'chat', label: 'Team Chat', icon: MessageSquare }
                ]}
                active={activeTab}
                onChange={setActiveTab}
              />

              {/* TAB 1: OVERVIEW */}
              <TabPanel id="overview" active={activeTab}>
                <div className="space-y-4 pt-2">
                  <DetailList
                    items={[
                      { label: 'Owner', value: fullName(project.ownerId) },
                      { label: 'Program', value: project.programId?.title || '-' },
                      { label: 'Dates', value: `${fmtDate(project.startDate)} to ${fmtDate(project.endDate)}` },
                      { label: 'Tasks', value: `${metrics.completedTasks} approved of ${metrics.totalTasks}` }
                    ]}
                  />
                  <ProgressBar
                    value={project.progress}
                    label={`Project progress ${project.progress}%`}
                    testId="project-progress"
                  />
                  {project.objective && (
                    <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                      <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">Objective</h4>
                      <p className="text-sm text-slate-800">{project.objective}</p>
                    </div>
                  )}
                  {project.description && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">Description</h4>
                      <p className="text-sm text-slate-700 whitespace-pre-line">{project.description}</p>
                    </div>
                  )}
                  {(project.repositoryUrl || project.documentationUrl) && (
                    <div className="flex flex-wrap gap-4 pt-2">
                      {project.repositoryUrl && (
                        <a
                          href={project.repositoryUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-brand-700 underline"
                        >
                          Source Code Repository &rarr;
                        </a>
                      )}
                      {project.documentationUrl && (
                        <a
                          href={project.documentationUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-brand-700 underline"
                        >
                          Project Documentation &rarr;
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </TabPanel>

              {/* TAB 2: MEMBERS */}
              <TabPanel id="members" active={activeTab}>
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                      Colleagues and interns assigned to this project.
                    </p>
                    {can('projects.manage') && (
                      <Button
                        size="sm"
                        icon={UserPlus}
                        onClick={() => setAddMemberModalOpen(true)}
                        data-testid="add-member-btn"
                      >
                        Add Member
                      </Button>
                    )}
                  </div>

                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                    {members.length === 0 ? (
                      <div className="p-6 text-center text-sm text-slate-500">
                        No assigned members yet.
                      </div>
                    ) : (
                      members.map((m) => {
                        const isOwner = String(project.ownerId?._id || project.ownerId) === String(m._id);
                        return (
                          <div
                            key={m._id}
                            className="p-3 flex items-center justify-between hover:bg-slate-50 transition"
                            data-testid={`project-member-${m._id}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs">
                                {m.firstName?.[0]}{m.lastName?.[0]}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-slate-900 flex items-center gap-2">
                                  {fullName(m)}
                                  {isOwner && (
                                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                                      Project Lead
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs text-slate-500">{m.email} · {m.role}</p>
                              </div>
                            </div>
                            {can('projects.manage') && !isOwner && (
                              <Button
                                size="xs"
                                variant="ghost"
                                icon={Trash2}
                                onClick={() => handleRemoveMember(m._id, fullName(m))}
                                title="Remove member"
                                data-testid={`remove-member-${m._id}`}
                              />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </TabPanel>

              {/* TAB 3: TASKS */}
              <TabPanel id="tasks" active={activeTab}>
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                      Work items tracked against project milestones.
                    </p>
                    {can('tasks.assign') && ['ACTIVE', 'PLANNED'].includes(project.status) && (
                      <Button
                        size="sm"
                        icon={Plus}
                        onClick={() => setTaskModal({ type: 'new' })}
                        data-testid="project-new-task"
                      >
                        Add task
                      </Button>
                    )}
                  </div>
                  <DataTable
                    testId="project-tasks"
                    rows={tasks}
                    caption="Project tasks"
                    emptyTitle="No tasks in this project"
                    columns={[
                      {
                        key: 'title',
                        header: 'Task',
                        render: (t) => (
                          <button
                            type="button"
                            className="text-left font-medium text-brand-800 underline"
                            onClick={() => setTaskModal({ type: 'view', id: t._id })}
                          >
                            {t.title}
                          </button>
                        )
                      },
                      { key: 'assignee', header: 'Assignee', render: (t) => fullName(t.assigneeId) },
                      { key: 'priority', header: 'Priority', render: (t) => <StatusBadge status={t.priority} /> },
                      { key: 'due', header: 'Due', render: (t) => fmtDate(t.dueDate) },
                      { key: 'status', header: 'Status', render: (t) => <StatusBadge status={t.status} /> }
                    ]}
                  />
                </div>
              </TabPanel>

              {/* TAB 4: DOCUMENTS */}
              <TabPanel id="documents" active={activeTab}>
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                      Project documentation, specifications, and architecture blueprints.
                    </p>
                    <Button
                      size="sm"
                      icon={Upload}
                      onClick={() => setUploadDocModalOpen(true)}
                      data-testid="upload-project-doc-btn"
                    >
                      Upload Document
                    </Button>
                  </div>

                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                    {projectDocs.length === 0 ? (
                      <div className="p-8 text-center text-sm text-slate-500">
                        No documents uploaded for this project yet. Upload blueprints, specs, or reports.
                      </div>
                    ) : (
                      projectDocs.map((d) => (
                        <div
                          key={d._id}
                          className="p-3 flex items-center justify-between hover:bg-slate-50 transition"
                          data-testid={`project-doc-item-${d._id}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                              <FileText className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{d.title || d.originalName}</p>
                              <p className="text-xs text-slate-500">
                                {humanize(d.type)} · {fileSize(d.size)} · {fmtDateTime(d.createdAt)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="xs"
                              variant="outline"
                              icon={Eye}
                              onClick={() => setPreviewDoc(d)}
                              data-testid={`preview-project-doc-${d._id}`}
                            >
                              Preview
                            </Button>
                            <Button
                              size="xs"
                              variant="ghost"
                              icon={Download}
                              onClick={() => handleDownloadDoc(d)}
                              data-testid={`download-project-doc-${d._id}`}
                            >
                              Download
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </TabPanel>

              {/* TAB 5: CHAT */}
              <TabPanel id="chat" active={activeTab}>
                <div className="pt-2">
                  <ChatPanel projectId={id} className="h-[480px]" />
                </div>
              </TabPanel>
            </div>
          );
        }}
      </StateView>

      {taskModal?.type === 'new' && (
        <TaskFormModal
          defaultProjectId={id}
          onClose={() => setTaskModal(null)}
          onDone={() => {
            setTaskModal(null);
            refresh();
          }}
        />
      )}
      {taskModal?.type === 'view' && (
        <TaskDetailModal
          taskId={taskModal.id}
          onClose={() => setTaskModal(null)}
          onChanged={refresh}
        />
      )}
      {addMemberModalOpen && (
        <AddMemberModal
          projectId={id}
          existingMemberIds={(state.data?.project?.members || []).map((m) => String(m._id || m))}
          onClose={() => setAddMemberModalOpen(false)}
          onDone={() => {
            setAddMemberModalOpen(false);
            refresh();
          }}
        />
      )}
      {uploadDocModalOpen && (
        <UploadProjectDocModal
          projectId={id}
          onClose={() => setUploadDocModalOpen(false)}
          onDone={() => {
            setUploadDocModalOpen(false);
            refresh();
          }}
        />
      )}
      {previewDoc && (
        <DocumentPreviewModal
          doc={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </Modal>
  );
}

export function ProjectsPage() {
  const { can } = useAuth();
  const state = useFetch(() => api.get('/projects'), []);
  const [modal, setModal] = useState(null); // { type:'new'|'edit'|'view', project?, id? }
  const done = () => {
    setModal(null);
    state.reload({ silent: true });
  };

  const cols = [
    {
      key: 'name',
      header: 'Project',
      render: (p) => (
        <button
          type="button"
          className="text-left font-medium text-brand-800 underline"
          onClick={() => setModal({ type: 'view', id: p._id })}
          data-testid={`project-open-${p._id}`}
        >
          {p.name}
        </button>
      )
    },
    { key: 'owner', header: 'Owner', render: (p) => fullName(p.ownerId) },
    {
      key: 'members',
      header: 'Team',
      render: (p) => `${p.members?.length || 0} members`
    },
    { key: 'dates', header: 'Timeline', render: (p) => `${fmtDate(p.startDate)} to ${fmtDate(p.endDate)}` },
    {
      key: 'progress',
      header: 'Progress',
      render: (p) => (
        <div className="w-32">
          <ProgressBar value={p.progress} label={`${p.name} progress`} />
          <span className="text-xs text-slate-700">{p.progress}%</span>
        </div>
      )
    },
    { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> }
  ];

  return (
    <>
      <PageHeader
        title="Projects & Workspaces"
        description="Collaborative project workspaces connecting tasks, team members, documents, and real-time chat."
        actions={
          can('projects.manage') && (
            <Button
              icon={Plus}
              onClick={() => setModal({ type: 'new' })}
              data-testid="new-project"
            >
              New project
            </Button>
          )
        }
      />
      <DataTable
        testId="projects-table"
        columns={cols}
        rows={state.data || []}
        loading={state.loading}
        error={state.error}
        onRetry={state.reload}
        caption="Projects"
        emptyTitle="No projects yet"
        emptyDescription="Create a project workspace to assign interns, share documents, and collaborate."
      />
      {modal?.type === 'new' && <ProjectFormModal onClose={() => setModal(null)} onDone={done} />}
      {modal?.type === 'edit' && (
        <ProjectFormModal project={modal.project} onClose={() => setModal(null)} onDone={done} />
      )}
      {modal?.type === 'view' && (
        <ProjectDetail
          id={modal.id}
          onClose={() => setModal(null)}
          onChanged={() => state.reload({ silent: true })}
          onEdit={(project) => setModal({ type: 'edit', project })}
        />
      )}
    </>
  );
}

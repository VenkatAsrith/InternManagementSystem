import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Users, Calendar, QrCode, ArrowRight, CheckCircle2, AlertCircle, Building2, Eye } from 'lucide-react';
import api from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useForm, rules } from '../../hooks/useForm';
import { fmtDate, fmtDateTime } from '../../lib/format';
import { Button, DataTable, FilterBar, FormGrid, FormModal, Modal, PageHeader, SectionCard, SelectField, StatCard, StatusBadge, TextField, InlineAlert, useConfirm } from '../../components/ui';
import { BootcampPreviewModal } from '../../components/domain/BootcampPreviewModal';
import { PassPreviewModal } from '../../components/domain/PassPreviewModal';

function CreateBootcampModal({ onClose, onDone }) {
  const toast = useToast();
  const form = useForm({
    title: '',
    description: '',
    date: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10),
    venue: 'TechMecha Torque Virtual Campus',
    totalCapacity: 30,
    slotName: 'Morning Cohort',
    startTime: '10:00 AM',
    endTime: '01:00 PM'
  });
  const f = form.field;

  const handleSubmit = async (v) => {
    const res = await api.post('/growth/bootcamps', {
      title: v.title.trim(),
      description: v.description.trim(),
      date: v.date,
      venue: v.venue.trim(),
      totalCapacity: Number(v.totalCapacity),
      slots: [{
        slotName: v.slotName.trim() || 'Morning Cohort',
        startTime: v.startTime,
        endTime: v.endTime,
        capacity: Number(v.totalCapacity),
        bookedCount: 0,
        checkedInCount: 0
      }]
    });
    return res;
  };

  return (
    <FormModal
      open
      onClose={onClose}
      size="lg"
      testId="create-bootcamp-modal"
      title="Create New Bootcamp"
      description="Set up an educational acquisition bootcamp with slot capacity and schedule."
      submitLabel="Create Bootcamp"
      form={form}
      rules={{
        title: [rules.required('Title'), rules.min(3, 'Title')],
        date: rules.required('Date'),
        totalCapacity: [rules.required('Capacity'), (v) => (Number(v) < 1 ? 'Capacity must be at least 1' : null)]
      }}
      onSubmit={handleSubmit}
      onDone={() => {
        toast.success('Bootcamp created successfully');
        onDone();
      }}
    >
      <FormGrid>
        <TextField {...f('title')} label="Bootcamp Title" required placeholder="Full Stack Web & Cloud Bootcamp" className="sm:col-span-2" />
        <TextField {...f('date')} label="Event Date" type="date" required />
        <TextField {...f('totalCapacity')} label="Total Capacity" type="number" required min={1} />
        <TextField {...f('venue')} label="Venue / Platform" placeholder="TechMecha Virtual Hall" className="sm:col-span-2" />
        <TextField {...f('description')} label="Description" placeholder="Overview of curriculum and hands-on track" className="sm:col-span-2" />

        <div className="sm:col-span-2 border-t border-slate-200 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Initial Slot</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <TextField {...f('slotName')} label="Slot Name" placeholder="Morning Cohort" />
            <TextField {...f('startTime')} label="Start Time" placeholder="10:00 AM" />
            <TextField {...f('endTime')} label="End Time" placeholder="01:00 PM" />
          </div>
        </div>
      </FormGrid>
    </FormModal>
  );
}

function RegisterPassModal({ bootcamp, onClose, onDone }) {
  const toast = useToast();
  const [createdPass, setCreatedPass] = useState(null);
  const form = useForm({ candidateName: '', candidateEmail: '', candidatePhone: '' });
  const f = form.field;

  if (createdPass) {
    return (
      <Modal open onClose={onDone} size="md" testId="pass-created-modal" title="Pass Generated" footer={<Button onClick={onDone}>Done</Button>}>
        <div className="space-y-4">
          <InlineAlert tone="success">
            Pass successfully issued for <strong>{createdPass.candidateName}</strong>!
          </InlineAlert>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pass Code</p>
            <p className="font-mono text-2xl font-bold text-brand-800" data-testid="generated-pass-code">{createdPass.passCode}</p>
            <p className="text-xs text-slate-600">HMAC Token: <span className="font-mono">{createdPass.hmacToken?.slice(0, 16)}...</span></p>
          </div>
        </div>
      </Modal>
    );
  }

  const handleRegister = async (v) => {
    const res = await api.post(`/growth/bootcamps/${bootcamp._id}/register`, {
      candidateName: v.candidateName.trim(),
      candidateEmail: v.candidateEmail.trim(),
      candidatePhone: v.candidatePhone.trim(),
      slotId: bootcamp.slots?.[0]?._id
    });
    setCreatedPass(res.data);
    toast.success('Pass generated');
  };

  return (
    <FormModal
      open
      onClose={onClose}
      size="md"
      testId="register-pass-modal"
      title={`Register for ${bootcamp.title}`}
      description="Book a seat and generate an authenticated HMAC entrance pass."
      submitLabel="Generate Pass"
      form={form}
      rules={{
        candidateName: rules.required('Candidate name'),
        candidateEmail: [rules.required('Email'), rules.email('Email')]
      }}
      onSubmit={handleRegister}
      onDone={() => {}}
    >
      <FormGrid>
        <TextField {...f('candidateName')} label="Full Name" required placeholder="Arun Kumar" className="sm:col-span-2" />
        <TextField {...f('candidateEmail')} label="Email Address" type="email" required placeholder="arun@example.com" className="sm:col-span-2" />
        <TextField {...f('candidatePhone')} label="Phone Number" placeholder="+91 98765 43210" className="sm:col-span-2" />
      </FormGrid>
    </FormModal>
  );
}

function CheckInModal({ onClose, onDone }) {
  const toast = useToast();
  const form = useForm({ passCode: '' });
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleCheckIn = async (v) => {
    setErrorMsg(null);
    try {
      const res = await api.post('/growth/passes/check-in', { passCode: v.passCode.trim() });
      setResult(res.data);
      toast.success('Check-in verified successfully');
      if (onDone) onDone();
    } catch (err) {
      setErrorMsg(err.message || 'Check-in failed');
    }
  };

  return (
    <FormModal
      open
      onClose={onClose}
      size="md"
      testId="checkin-pass-modal"
      title="Scan / Check-in Pass"
      description="Enter the candidate's Pass Code to verify admission."
      submitLabel="Verify & Check In"
      form={form}
      rules={{ passCode: rules.required('Pass Code') }}
      onSubmit={handleCheckIn}
      onDone={() => {}}
    >
      <TextField {...form.field('passCode')} label="Pass Code" required placeholder="TMT-PASS-XXXXXX-XXXX" autoFocus />

      {errorMsg && (
        <InlineAlert tone="error" className="mt-3" testId="checkin-error">
          {errorMsg}
        </InlineAlert>
      )}

      {result && (
        <InlineAlert tone="success" className="mt-3" testId="checkin-success">
          Checked in: <strong>{result.candidateName}</strong> at {fmtDateTime(result.checkedInAt)}!
        </InlineAlert>
      )}
    </FormModal>
  );
}

export function BootcampsPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [modal, setModal] = useState(null);
  const state = useFetch(() => api.get('/growth/bootcamps'), []);
  const bootcamps = state.data || [];

  const totalCap = bootcamps.reduce((sum, b) => sum + (b.totalCapacity || 0), 0);
  const totalBooked = bootcamps.reduce((sum, b) => sum + (b.slots?.reduce((s, slot) => s + (slot.bookedCount || 0), 0) || 0), 0);
  const totalCheckedIn = bootcamps.reduce((sum, b) => sum + (b.slots?.reduce((s, slot) => s + (slot.checkedInCount || 0), 0) || 0), 0);

  const columns = [
    {
      key: 'title',
      header: 'Bootcamp',
      render: (b) => (
        <div>
          <div className="flex items-center gap-2">
            <Link to={`/admin/bootcamps/${b._id}`} className="font-semibold text-slate-900 hover:text-brand-800" data-testid={`bootcamp-link-${b._id}`}>
              {b.title}
            </Link>
            {b.googleForm?.formUrl && (
              <span className="inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200" title="Google Forms Connected">
                Google Form
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">{b.venue || 'Virtual'}</p>
        </div>
      )
    },
    {
      key: 'date',
      header: 'Date',
      render: (b) => fmtDate(b.date)
    },
    {
      key: 'capacity',
      header: 'Capacity & Bookings',
      render: (b) => {
        const booked = b.slots?.reduce((sum, s) => sum + (s.bookedCount || 0), 0) || 0;
        const cap = b.totalCapacity || 1;
        const pct = Math.min(100, Math.round((booked / cap) * 100));
        return (
          <div className="w-36 space-y-1">
            <div className="flex justify-between text-xs text-slate-700">
              <span>{booked} / {cap}</span>
              <span className="font-medium">{pct}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
              <div className={`h-full ${pct >= 100 ? 'bg-amber-600' : 'bg-brand-600'}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      }
    },
    {
      key: 'checkedIn',
      header: 'Checked In',
      render: (b) => {
        const count = b.slots?.reduce((sum, s) => sum + (s.checkedInCount || 0), 0) || 0;
        return <span className="font-semibold text-slate-800">{count}</span>;
      }
    },
    {
      key: 'status',
      header: 'Status',
      render: (b) => <StatusBadge status={b.status || 'SCHEDULED'} />
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (b) => (
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={Eye}
            onClick={() => setModal({ type: 'preview', b })}
            data-testid={`preview-bootcamp-${b._id}`}
          >
            Preview
          </Button>
          <Button size="sm" variant="outline" onClick={() => setModal({ type: 'register', b })} data-testid={`register-btn-${b._id}`}>
            Register
          </Button>
          <Button size="sm" variant="primary" onClick={() => navigate(`/admin/bootcamps/${b._id}`)} data-testid={`view-bootcamp-${b._id}`}>
            Manage Slots
          </Button>
        </div>
      )
    }
  ];

  return (
    <>
      <PageHeader
        title="Bootcamps & Cohorts"
        description="Educational acquisition bootcamps, capacity control, and entrance pass verification."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" icon={QrCode} onClick={() => setModal({ type: 'checkin' })} data-testid="open-checkin-modal">
              Check-In Pass
            </Button>
            {can('bootcamps.manage') && (
              <Button icon={Plus} onClick={() => setModal({ type: 'new' })} data-testid="create-bootcamp-btn">
                New Bootcamp
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4" data-testid="bootcamp-kpis">
        <StatCard label="Total Bootcamps" value={bootcamps.length} />
        <StatCard label="Total Capacity" value={totalCap} />
        <StatCard label="Total Booked" value={totalBooked} hint={`${totalCap > 0 ? Math.round((totalBooked / totalCap) * 100) : 0}% booked`} />
        <StatCard label="Total Checked In" value={totalCheckedIn} hint={`${totalBooked > 0 ? Math.round((totalCheckedIn / totalBooked) * 100) : 0}% attendance`} />
      </div>

      <SectionCard title="Active & Upcoming Bootcamps">
        <DataTable
          testId="bootcamps-table"
          columns={columns}
          rows={bootcamps}
          loading={state.loading}
          error={state.error}
          onRetry={state.reload}
          caption="Bootcamps list"
          emptyTitle="No bootcamps scheduled"
          emptyDescription="Create a new bootcamp cohort to begin educational acquisition."
        />
      </SectionCard>

      {modal?.type === 'preview' && (
        <BootcampPreviewModal
          bootcamp={modal.b}
          onClose={() => setModal(null)}
          onRegister={(b) => setModal({ type: 'register', b })}
          onCheckIn={() => setModal({ type: 'checkin' })}
        />
      )}
      {modal?.type === 'new' && <CreateBootcampModal onClose={() => setModal(null)} onDone={() => { setModal(null); state.reload(); }} />}
      {modal?.type === 'register' && <RegisterPassModal bootcamp={modal.b} onClose={() => setModal(null)} onDone={() => { setModal(null); state.reload(); }} />}
      {modal?.type === 'checkin' && <CheckInModal onClose={() => setModal(null)} onDone={() => state.reload()} />}
    </>
  );
}

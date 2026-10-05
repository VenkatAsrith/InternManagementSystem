import React from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '../../lib/http';
import { useFetch } from '../../hooks/useFetch';
import { PageHeader, SectionCard, StateView, EmptyState } from '../../components/ui';

const COLORS = ['#475569', '#0369a1', '#b45309', '#047857'];

/** Chart + a real table with the same numbers, so the data is available without seeing the graphic. */
function DataAlt({ rows, cols }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-xs font-medium text-slate-700">View as table</summary>
      <table className="mt-2 w-full text-left text-xs">
        <thead><tr>{cols.map((c) => <th key={c.key} scope="col" className="py-1 pr-4 font-semibold text-slate-800">{c.label}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-slate-100">{cols.map((c) => <td key={c.key} className="py-1 pr-4 text-slate-800">{r[c.key]}</td>)}</tr>)}</tbody>
      </table>
    </details>
  );
}

export function AnalyticsPage() {
  const state = useFetch(() => api.get('/analytics/dashboard'), []);
  return (
    <>
      <PageHeader title="Analytics" description="Recruitment funnel, intern lifecycle and delivery, from live data." />
      <StateView state={state} loadingLabel="Loading analytics...">
        {(d) => {
          const empty = d.recruitment.totalApplications === 0 && d.interns.total === 0 && d.tasks.total === 0;
          if (empty) return <EmptyState title="No data to chart yet" description="Charts appear once applications, interns or tasks exist." testId="analytics-empty" />;
          const funnel = d.recruitment.funnel.map((s) => ({ stage: s.stage, count: s.count }));
          const tasks = d.tasks.breakdown.filter((t) => t.value > 0);
          const interns = d.interns.byStatus.map((s) => ({ status: s.status.replace(/_/g, ' '), count: s.count }));
          return (
            <div className="grid gap-6 lg:grid-cols-2" data-testid="analytics-loaded">
              <SectionCard title="Application pipeline" testId="chart-pipeline">
                <div role="img" aria-label={`Bar chart of applications per stage. ${funnel.map((f) => `${f.stage}: ${f.count}`).join(', ')}`} className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={funnel} layout="vertical" margin={{ left: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis type="category" dataKey="stage" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#475569" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <DataAlt rows={funnel} cols={[{ key: 'stage', label: 'Stage' }, { key: 'count', label: 'Applications' }]} />
              </SectionCard>

              <SectionCard title="Task status" testId="chart-tasks">
                {tasks.length === 0 ? <p className="text-sm text-slate-600">No tasks yet.</p> : (
                  <>
                    <div role="img" aria-label={`Pie chart of tasks by status. ${tasks.map((t) => `${t.name}: ${t.value}`).join(', ')}`} className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={tasks} dataKey="value" nameKey="name" outerRadius={90} label isAnimationActive={false}>
                            {tasks.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Legend /><Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <DataAlt rows={tasks} cols={[{ key: 'name', label: 'Status' }, { key: 'value', label: 'Tasks' }]} />
                  </>
                )}
              </SectionCard>

              <SectionCard title="Interns by status" testId="chart-interns" className="lg:col-span-2">
                {interns.length === 0 ? <p className="text-sm text-slate-600">No interns yet.</p> : (
                  <>
                    <div role="img" aria-label={`Bar chart of interns by status. ${interns.map((f) => `${f.status}: ${f.count}`).join(', ')}`} className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={interns}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="status" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={70} />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="count" fill="#0369a1" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <DataAlt rows={interns} cols={[{ key: 'status', label: 'Status' }, { key: 'count', label: 'Interns' }]} />
                  </>
                )}
              </SectionCard>
            </div>
          );
        }}
      </StateView>
    </>
  );
}

import { Project } from './project.model.js';
import { Task } from '../tasks/task.model.js';
import { TASK_STATUS } from '../../../../shared/constants.js';

/**
 * Project progress = approved tasks / non-cancelled tasks. Stored on the project so lists are cheap, and
 * recomputed after every task mutation (never on a GET, never from the browser).
 */
export async function recomputeProjectProgress(projectId) {
  if (!projectId) return null;
  const counts = await Task.aggregate([
    { $match: { projectId, status: { $ne: TASK_STATUS.CANCELLED } } },
    { $group: { _id: '$status', n: { $sum: 1 } } }
  ]);
  const total = counts.reduce((s, c) => s + c.n, 0);
  const done = counts.find(c => c._id === TASK_STATUS.APPROVED)?.n || 0;
  const progress = total ? Math.round(done / total * 100) : 0;
  await Project.updateOne({ _id: projectId }, { $set: { progress } });
  return { total, done, progress };
}

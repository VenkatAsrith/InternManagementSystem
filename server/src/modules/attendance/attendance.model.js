import mongoose from 'mongoose';
import { ATTENDANCE_STATUS, ATTENDANCE_MODE } from '../../../../shared/constants.js';

const WORKED = [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE, ATTENDANCE_STATUS.HALF_DAY];

const attendanceRecordSchema = new mongoose.Schema({
  internId: { type: mongoose.Schema.Types.ObjectId, ref: 'Intern', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  // Local (organisation-timezone) midnight of the attendance day.
  date: { type: Date, required: true },
  // Only days that were actually worked have a check-in. LEAVE / HOLIDAY / ABSENT placeholders do not.
  checkIn: { type: Date, required: function() { return WORKED.includes(this.status); } },
  checkOut: { type: Date },
  breakDurationMinutes: { type: Number, default: 0, min: 0 },
  totalHours: { type: Number, default: 0, min: 0 },
  lateFlag: { type: Boolean, default: false },
  status: {
    type: String,
    enum: Object.values(ATTENDANCE_STATUS),
    default: ATTENDANCE_STATUS.PRESENT,
    index: true
  },
  mode: {
    type: String,
    enum: Object.values(ATTENDANCE_MODE),
    default: ATTENDANCE_MODE.WEB
  },
  leaveId: { type: mongoose.Schema.Types.ObjectId, ref: 'Leave' },
  ipAddress: { type: String },
  notes: { type: String, default: '' },
  correctedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  correctionReason: { type: String }
}, { timestamps: true });

// One record per intern per day, enforced by the database (this is what stops double check-ins under a race).
attendanceRecordSchema.index({ internId: 1, date: 1 }, { unique: true });

export const AttendanceRecord = mongoose.models.AttendanceRecord || mongoose.model('AttendanceRecord', attendanceRecordSchema);
export const WORKED_STATUSES = WORKED;

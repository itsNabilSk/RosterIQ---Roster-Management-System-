import mongoose from 'mongoose';

const rosterEntrySchema = new mongoose.Schema(
  {
    rosterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Roster',
      required: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['WORKING', 'WEEKLY_OFF', 'LEAVE', 'COMP_OFF', 'HOLIDAY'],
      default: 'WORKING',
    },
    source: {
      type: String,
      enum: ['AUTO', 'MANUAL'],
      default: 'AUTO',
    },
    note: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

rosterEntrySchema.index({ rosterId: 1, employeeId: 1, date: 1 }, { unique: true });
rosterEntrySchema.index({ rosterId: 1, date: 1 });

export const RosterEntry = mongoose.model('RosterEntry', rosterEntrySchema);
export default RosterEntry;


import mongoose from 'mongoose';

const rosterSchema = new mongoose.Schema(
  {
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
      min: 2020,
      max: 2050,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'PUBLISHED'],
      default: 'DRAFT',
    },
    strategy: {
      type: String,
      enum: ['BALANCED', 'FAIR_DISTRIBUTION', 'PREFERENCE_FIRST', 'OPERATIONS_FIRST'],
      default: 'BALANCED',
    },
    publishedBy: {
      type: String,
      default: null,
    },
    publishOverrideReason: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

rosterSchema.index({ month: 1, year: 1 }, { unique: true });

export const Roster = mongoose.model('Roster', rosterSchema);
export default Roster;


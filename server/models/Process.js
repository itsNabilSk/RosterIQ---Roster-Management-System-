
import mongoose from 'mongoose';

const processSchema = new mongoose.Schema(
  {
    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Brand',
      required: true,
    },
    type: {
      type: String,
      enum: ['CS', 'ACC', 'RETENTION', 'NDR', 'CUSTOM'],
      required: true,
    },
    calendarRule: {
      type: {
        type: String,
        enum: ['ALL_365', 'ALL_EXCEPT_HOLIDAYS', 'MON_SAT', 'MON_FRI', 'CUSTOM'],
        default: 'ALL_EXCEPT_HOLIDAYS',
      },
      weekdays: {
        type: [String],
        enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      },
      holidayPolicy: {
        type: String,
        enum: ['SKIP', 'WORK'],
        default: 'SKIP',
      },
    },
    minStaffDefault: {
      type: Number,
      default: 1,
      min: 0,
    },
    minStaffByWeekday: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  { timestamps: true }
);

processSchema.index({ brandId: 1, type: 1 }, { unique: true });

export const Process = mongoose.model('Process', processSchema);
export default Process;

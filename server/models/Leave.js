import mongoose from 'mongoose';

const leaveSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    type: {
      type: String,
      enum: ['PLANNED', 'COMP_OFF'],
      default: 'PLANNED',
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED'],
      default: 'PENDING',
    },
  },
  { timestamps: true }
);

leaveSchema.index({ employeeId: 1, date: 1 }, { unique: true });

export const Leave = mongoose.model('Leave', leaveSchema);
export default Leave;


import mongoose from 'mongoose';

const assignmentSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    processId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Process',
      required: true,
    },
    role: {
      type: String,
      enum: ['primary', 'backup'],
      default: 'primary',
    },
    allocationPercent: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },
  },
  { timestamps: true }
);

assignmentSchema.index({ employeeId: 1, processId: 1 }, { unique: true });

export const Assignment = mongoose.model('Assignment', assignmentSchema);
export default Assignment;


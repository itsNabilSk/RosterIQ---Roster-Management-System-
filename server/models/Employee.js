import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    podId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pod',
      default: null,
    },
    isPodLead: {
      type: Boolean,
      default: false,
    },
    weeklyOffPreference: {
      type: [String],
      enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      default: ['Sunday'],
    },
    maxConsecutiveWorkDays: {
      type: Number,
      default: 6,
      min: 1,
      max: 14,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export const Employee = mongoose.model('Employee', employeeSchema);
export default Employee;


import mongoose from 'mongoose';
import { ANGLES } from '../config.js';

const attendanceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    similarity: { type: Number, required: true },
    distance: { type: Number, required: true },
    matchedAngle: { type: String, enum: ANGLES, required: true },
    // The face captured at check-in, kept for auditing.
    imagePath: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

attendanceSchema.index({ createdAt: -1 });

export const Attendance = mongoose.model('Attendance', attendanceSchema);

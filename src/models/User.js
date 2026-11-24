import mongoose from 'mongoose';
import { ANGLES } from '../config.js';
import { toUrl } from '../services/storage.js';

const faceSchema = new mongoose.Schema(
  {
    angle: { type: String, enum: ANGLES, required: true },
    imagePath: { type: String, required: true },
    descriptor: {
      type: [Number],
      required: true,
      validate: { validator: (v) => v.length === 128, message: 'Face descriptor must have 128 values' },
    },
    detectionScore: Number,
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    empId: { type: String, required: true, unique: true, trim: true, uppercase: true },
    faces: {
      type: [faceSchema],
      validate: { validator: (v) => v.length === ANGLES.length, message: 'Front, left and right faces are required' },
    },
  },
  { timestamps: true },
);

/** Shape sent to the client. Never includes face descriptors. */
userSchema.methods.toPublic = function toPublic() {
  return {
    id: this.id,
    username: this.username,
    email: this.email,
    empId: this.empId,
    createdAt: this.createdAt,
    faces: this.faces.map((face) => ({ angle: face.angle, imageUrl: toUrl(face.imagePath) })),
  };
};

export const User = mongoose.model('User', userSchema);

import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

counterSchema.index({ owner: 1, name: 1 }, { unique: true });

export const Counter = mongoose.model('Counter', counterSchema);

export async function nextSequence(owner, name) {
  const counter = await Counter.findOneAndUpdate(
    { owner, name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  return counter.seq;
}

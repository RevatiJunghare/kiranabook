import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    // Outstanding khata (credit) amount the customer owes the shop.
    balance: { type: Number, default: 0 },
  },
  { timestamps: true }
);

customerSchema.index({ owner: 1, phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: 'string' } } });

export const Customer = mongoose.model('Customer', customerSchema);

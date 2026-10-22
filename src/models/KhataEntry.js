import mongoose from 'mongoose';

// Ledger of credit given (CREDIT) and money received (PAYMENT) per customer.
export const KHATA_TYPES = ['CREDIT', 'PAYMENT'];

const khataEntrySchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    type: { type: String, enum: KHATA_TYPES, required: true },
    amount: { type: Number, required: true, min: 0 },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    note: { type: String, trim: true },
  },
  { timestamps: true }
);

khataEntrySchema.index({ owner: 1, customer: 1, createdAt: -1 });

export const KhataEntry = mongoose.model('KhataEntry', khataEntrySchema);

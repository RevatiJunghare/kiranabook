import mongoose from 'mongoose';

export const PAYMENT_MODES = ['CASH', 'UPI', 'CARD', 'CREDIT'];
export const ORDER_STATUSES = ['COMPLETED', 'CANCELLED'];

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    // Name and price are copied at billing time so old bills stay accurate.
    name: { type: String, required: true },
    unit: { type: String },
    quantity: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    billNumber: { type: Number, required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    items: { type: [orderItemSchema], validate: (v) => v.length > 0 },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    paymentMode: { type: String, enum: PAYMENT_MODES, required: true },
    status: { type: String, enum: ORDER_STATUSES, default: 'COMPLETED' },
    note: { type: String, trim: true },
  },
  { timestamps: true }
);

orderSchema.index({ owner: 1, billNumber: 1 }, { unique: true });
orderSchema.index({ owner: 1, createdAt: -1 });

export const Order = mongoose.model('Order', orderSchema);

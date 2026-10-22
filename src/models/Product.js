import mongoose from 'mongoose';

export const UNITS = ['PCS', 'KG', 'GRAM', 'LITRE', 'ML', 'PACKET', 'DOZEN'];

const productSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true },
    barcode: { type: String, trim: true },
    category: { type: String, trim: true, default: 'General' },
    unit: { type: String, enum: UNITS, default: 'PCS' },
    price: { type: Number, required: true, min: 0 },
    costPrice: { type: Number, min: 0, default: 0 },
    stock: { type: Number, min: 0, default: 0 },
    lowStockThreshold: { type: Number, min: 0, default: 5 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ owner: 1, sku: 1 }, { unique: true, partialFilterExpression: { sku: { $type: 'string' } } });
productSchema.index({ owner: 1, category: 1 });

export const Product = mongoose.model('Product', productSchema);

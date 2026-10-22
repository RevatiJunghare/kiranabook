import { Product } from '../../models/index.js';
import { requireUser } from '../../utils/auth.js';
import { cached, invalidate } from '../../utils/cache.js';
import { assertId, badInput, clampLimit, escapeRegex, notFound } from '../../utils/helpers.js';

const PRODUCT_CACHE_TTL = 300;

export const productResolvers = {
  Query: {
    async products(_, args, ctx) {
      const user = requireUser(ctx);
      const { search, category, lowStock } = args;
      const limit = clampLimit(args.limit);
      const offset = Math.max(args.offset ?? 0, 0);

      const filter = { owner: user._id, isActive: true };
      if (search) {
        const term = search.trim();
        filter.$or = [{ name: new RegExp(escapeRegex(term), 'i') }, { sku: term }, { barcode: term }];
      }
      if (category) filter.category = category;
      if (lowStock) filter.$expr = { $lte: ['$stock', '$lowStockThreshold'] };

      const key = JSON.stringify({ search, category, lowStock, limit, offset });
      return cached(user.id, 'products', key, PRODUCT_CACHE_TTL, async () => {
        const [items, total] = await Promise.all([
          Product.find(filter).sort({ name: 1 }).skip(offset).limit(limit).lean(),
          Product.countDocuments(filter),
        ]);
        return { items, total };
      });
    },

    async product(_, { id }, ctx) {
      const user = requireUser(ctx);
      assertId(id, 'Product');
      return Product.findOne({ _id: id, owner: user._id }).exec();
    },

    async categories(_, __, ctx) {
      const user = requireUser(ctx);
      return cached(user.id, 'products', 'categories', PRODUCT_CACHE_TTL, async () =>
        (await Product.distinct('category', { owner: user._id, isActive: true })).sort()
      );
    },
  },

  Mutation: {
    async createProduct(_, { input }, ctx) {
      const user = requireUser(ctx);
      const product = await Product.create({ ...input, owner: user._id });
      await invalidate(user.id, 'products', 'dashboard');
      return product;
    },

    async updateProduct(_, { id, input }, ctx) {
      const user = requireUser(ctx);
      assertId(id, 'Product');
      const product = await Product.findOneAndUpdate(
        { _id: id, owner: user._id },
        { $set: input },
        { returnDocument: 'after', runValidators: true }
      );
      if (!product) throw notFound('Product');
      await invalidate(user.id, 'products', 'dashboard');
      return product;
    },

    // Soft delete: old bills still reference the product.
    async deleteProduct(_, { id }, ctx) {
      const user = requireUser(ctx);
      assertId(id, 'Product');
      const res = await Product.updateOne({ _id: id, owner: user._id }, { $set: { isActive: false } });
      if (!res.matchedCount) throw notFound('Product');
      await invalidate(user.id, 'products', 'dashboard');
      return true;
    },

    async adjustStock(_, { id, quantity }, ctx) {
      const user = requireUser(ctx);
      assertId(id, 'Product');
      if (quantity === 0) throw badInput('Quantity must not be zero');

      const filter = { _id: id, owner: user._id };
      if (quantity < 0) filter.stock = { $gte: -quantity };

      const product = await Product.findOneAndUpdate(filter, { $inc: { stock: quantity } }, { returnDocument: 'after' });
      if (!product) {
        if (await Product.exists({ _id: id, owner: user._id })) throw badInput('Not enough stock to remove');
        throw notFound('Product');
      }
      await invalidate(user.id, 'products', 'dashboard');
      return product;
    },
  },

  Product: {
    isLowStock: (p) => p.stock <= p.lowStockThreshold,
  },
};

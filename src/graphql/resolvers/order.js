import { Customer, KhataEntry, Order, Product, nextSequence } from '../../models/index.js';
import { requireUser } from '../../utils/auth.js';
import { invalidate } from '../../utils/cache.js';
import { assertId, badInput, clampLimit, notFound, round2 } from '../../utils/helpers.js';

const parseDate = (value, name) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw badInput(`Invalid date for "${name}"`);
  return date;
};

// Combine repeated lines for the same product and validate quantities.
function normalizeItems(items) {
  const merged = new Map();
  for (const { productId, quantity } of items) {
    assertId(productId, 'Product');
    if (!(quantity > 0)) throw badInput('Quantity must be greater than zero');
    merged.set(productId, (merged.get(productId) ?? 0) + quantity);
  }
  return [...merged].map(([productId, quantity]) => ({ productId, quantity }));
}

const restoreStock = (lines) =>
  lines.length
    ? Product.bulkWrite(
        lines.map(({ productId, quantity }) => ({
          updateOne: { filter: { _id: productId }, update: { $inc: { stock: quantity } } },
        }))
      )
    : null;

export const orderResolvers = {
  Query: {
    async orders(_, args, ctx) {
      const user = requireUser(ctx);
      const filter = { owner: user._id };
      if (args.customerId) filter.customer = assertId(args.customerId, 'Customer');
      if (args.from || args.to) {
        filter.createdAt = {};
        if (args.from) filter.createdAt.$gte = parseDate(args.from, 'from');
        if (args.to) filter.createdAt.$lte = parseDate(args.to, 'to');
      }

      const limit = clampLimit(args.limit);
      const offset = Math.max(args.offset ?? 0, 0);
      const [items, total] = await Promise.all([
        Order.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit),
        Order.countDocuments(filter),
      ]);
      return { items, total };
    },

    async order(_, { id }, ctx) {
      const user = requireUser(ctx);
      assertId(id, 'Order');
      return Order.findOne({ _id: id, owner: user._id }).exec();
    },
  },

  Mutation: {
    async createOrder(_, { input }, ctx) {
      const user = requireUser(ctx);
      if (!input.items.length) throw badInput('A bill needs at least one item');
      const items = normalizeItems(input.items);

      let customer = null;
      if (input.customerId) {
        assertId(input.customerId, 'Customer');
        customer = await Customer.findOne({ _id: input.customerId, owner: user._id });
        if (!customer) throw notFound('Customer');
      }
      if (input.paymentMode === 'CREDIT' && !customer) {
        throw badInput('Credit (khata) bills need a customer');
      }

      const products = await Product.find({
        _id: { $in: items.map((i) => i.productId) },
        owner: user._id,
        isActive: true,
      });
      const byId = new Map(products.map((p) => [p.id, p]));
      const missing = items.find((i) => !byId.has(i.productId));
      if (missing) throw badInput(`Product ${missing.productId} not found`);

      // Standalone MongoDB has no multi-document transactions, so stock is
      // decremented with conditional updates and rolled back on failure.
      const reserved = [];
      let order;
      try {
        for (const item of items) {
          const ok = await Product.updateOne(
            { _id: item.productId, owner: user._id, stock: { $gte: item.quantity } },
            { $inc: { stock: -item.quantity } }
          );
          if (!ok.modifiedCount) {
            const p = byId.get(item.productId);
            throw badInput(`Not enough stock for ${p.name} (available: ${p.stock})`);
          }
          reserved.push(item);
        }

        const lines = items.map(({ productId, quantity }) => {
          const p = byId.get(productId);
          return { product: p._id, name: p.name, unit: p.unit, quantity, price: p.price, total: round2(p.price * quantity) };
        });
        const subtotal = round2(lines.reduce((sum, l) => sum + l.total, 0));
        const discount = round2(input.discount ?? 0);
        if (discount < 0 || discount > subtotal) throw badInput('Discount must be between 0 and the subtotal');

        order = await Order.create({
          owner: user._id,
          billNumber: await nextSequence(user._id, 'bill'),
          customer: customer?._id,
          items: lines,
          subtotal,
          discount,
          total: round2(subtotal - discount),
          paymentMode: input.paymentMode,
          note: input.note,
        });
      } catch (err) {
        await restoreStock(reserved);
        throw err;
      }

      if (order.paymentMode === 'CREDIT') {
        await Customer.updateOne({ _id: customer._id }, { $inc: { balance: order.total } });
        await KhataEntry.create({
          owner: user._id,
          customer: customer._id,
          type: 'CREDIT',
          amount: order.total,
          order: order._id,
          note: `Bill #${order.billNumber}`,
        });
      }

      await invalidate(user.id, 'products', 'dashboard');
      return order;
    },

    async cancelOrder(_, { id }, ctx) {
      const user = requireUser(ctx);
      assertId(id, 'Order');

      // The status condition makes cancellation idempotent under concurrent requests.
      const order = await Order.findOneAndUpdate(
        { _id: id, owner: user._id, status: 'COMPLETED' },
        { $set: { status: 'CANCELLED' } },
        { returnDocument: 'after' }
      );
      if (!order) {
        if (await Order.exists({ _id: id, owner: user._id })) throw badInput('Order is already cancelled');
        throw notFound('Order');
      }

      await restoreStock(order.items.map((i) => ({ productId: i.product, quantity: i.quantity })));

      if (order.paymentMode === 'CREDIT' && order.customer) {
        await Customer.updateOne({ _id: order.customer }, { $inc: { balance: -order.total } });
        await KhataEntry.create({
          owner: user._id,
          customer: order.customer,
          type: 'PAYMENT',
          amount: order.total,
          order: order._id,
          note: `Bill #${order.billNumber} cancelled`,
        });
      }

      await invalidate(user.id, 'products', 'dashboard');
      return order;
    },
  },

  Order: {
    customer: (o) => (o.customer ? Customer.findById(o.customer).exec() : null),
  },

  OrderItem: {
    productId: (i) => String(i.product),
    product: (i) => Product.findById(i.product).exec(),
  },
};

import { Customer, KhataEntry, Order } from '../../models/index.js';
import { requireUser } from '../../utils/auth.js';
import { invalidate } from '../../utils/cache.js';
import { assertId, badInput, escapeRegex, notFound, round2 } from '../../utils/helpers.js';

export const customerResolvers = {
  Query: {
    async customers(_, { search, withDue }, ctx) {
      const user = requireUser(ctx);
      const filter = { owner: user._id };
      if (search) {
        const re = new RegExp(escapeRegex(search.trim()), 'i');
        filter.$or = [{ name: re }, { phone: re }];
      }
      if (withDue) filter.balance = { $gt: 0 };
      return Customer.find(filter).sort({ name: 1 }).exec();
    },

    async customer(_, { id }, ctx) {
      const user = requireUser(ctx);
      assertId(id, 'Customer');
      return Customer.findOne({ _id: id, owner: user._id }).exec();
    },

    async khata(_, { customerId }, ctx) {
      const user = requireUser(ctx);
      assertId(customerId, 'Customer');
      if (!(await Customer.exists({ _id: customerId, owner: user._id }))) throw notFound('Customer');
      return KhataEntry.find({ owner: user._id, customer: customerId }).sort({ createdAt: -1 }).exec();
    },
  },

  Mutation: {
    async createCustomer(_, { input }, ctx) {
      const user = requireUser(ctx);
      return Customer.create({ ...input, owner: user._id });
    },

    async updateCustomer(_, { id, input }, ctx) {
      const user = requireUser(ctx);
      assertId(id, 'Customer');
      const customer = await Customer.findOneAndUpdate(
        { _id: id, owner: user._id },
        { $set: input },
        { returnDocument: 'after', runValidators: true }
      );
      if (!customer) throw notFound('Customer');
      return customer;
    },

    async recordPayment(_, { customerId, amount, note }, ctx) {
      const user = requireUser(ctx);
      assertId(customerId, 'Customer');
      amount = round2(amount);
      if (!(amount > 0)) throw badInput('Amount must be greater than zero');

      const customer = await Customer.findOneAndUpdate(
        { _id: customerId, owner: user._id },
        { $inc: { balance: -amount } },
        { returnDocument: 'after' }
      );
      if (!customer) throw notFound('Customer');

      await KhataEntry.create({ owner: user._id, customer: customer._id, type: 'PAYMENT', amount, note });
      await invalidate(user.id, 'dashboard');
      return customer;
    },
  },

  Customer: {
    balance: (c) => round2(c.balance),
  },

  KhataEntry: {
    customer: (k) => Customer.findById(k.customer).exec(),
    order: (k) => (k.order ? Order.findById(k.order).exec() : null),
  },
};

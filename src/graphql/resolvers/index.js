import { authResolvers } from './auth.js';
import { productResolvers } from './product.js';
import { customerResolvers } from './customer.js';
import { orderResolvers } from './order.js';
import { dashboardResolvers } from './dashboard.js';

// Works for mongoose documents, lean objects and JSON from the Redis cache.
const common = {
  id: (doc) => String(doc._id ?? doc.id),
  createdAt: (doc) => new Date(doc.createdAt).toISOString(),
};

const parts = [authResolvers, productResolvers, customerResolvers, orderResolvers, dashboardResolvers];

const merge = (key) => Object.assign({}, ...parts.map((p) => p[key] ?? {}));

export const resolvers = {
  Query: { health: () => 'ok', ...merge('Query') },
  Mutation: merge('Mutation'),
  User: { ...common },
  Product: {
    ...common,
    updatedAt: (doc) => new Date(doc.updatedAt).toISOString(),
    ...productResolvers.Product,
  },
  Customer: { ...common, ...customerResolvers.Customer },
  Order: { ...common, ...orderResolvers.Order },
  OrderItem: orderResolvers.OrderItem,
  KhataEntry: { ...common, ...customerResolvers.KhataEntry },
};

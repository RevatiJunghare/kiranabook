import { Customer, Order, Product } from '../../models/index.js';
import { requireUser } from '../../utils/auth.js';
import { cached } from '../../utils/cache.js';
import { round2 } from '../../utils/helpers.js';

const DASHBOARD_CACHE_TTL = 60;

export const dashboardResolvers = {
  Query: {
    async dashboard(_, __, ctx) {
      const user = requireUser(ctx);
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      // The key includes the date so the cache rolls over at midnight.
      const key = String(startOfDay.getTime());
      return cached(user.id, 'dashboard', key, DASHBOARD_CACHE_TTL, async () => {
        const [[sales], totalProducts, lowStockCount, [credit]] = await Promise.all([
          Order.aggregate([
            { $match: { owner: user._id, status: 'COMPLETED', createdAt: { $gte: startOfDay } } },
            { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
          ]),
          Product.countDocuments({ owner: user._id, isActive: true }),
          Product.countDocuments({
            owner: user._id,
            isActive: true,
            $expr: { $lte: ['$stock', '$lowStockThreshold'] },
          }),
          Customer.aggregate([
            { $match: { owner: user._id, balance: { $gt: 0 } } },
            { $group: { _id: null, total: { $sum: '$balance' } } },
          ]),
        ]);

        return {
          todaySales: round2(sales?.total ?? 0),
          todayOrders: sales?.count ?? 0,
          totalProducts,
          lowStockCount,
          totalCreditDue: round2(credit?.total ?? 0),
        };
      });
    },
  },
};

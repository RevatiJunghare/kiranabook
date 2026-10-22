import { GraphQLError } from 'graphql';
import { User } from '../../models/index.js';
import { signToken } from '../../utils/auth.js';
import { isRateLimited } from '../../utils/cache.js';
import { badInput } from '../../utils/helpers.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const authResolvers = {
  Query: {
    me: (_, __, ctx) => ctx.user,
  },

  Mutation: {
    async register(_, { input }) {
      const email = input.email.trim().toLowerCase();
      if (!EMAIL_RE.test(email)) throw badInput('Invalid email address');
      if (input.password.length < 6) throw badInput('Password must be at least 6 characters');
      if (await User.exists({ email })) throw badInput('An account with this email already exists');

      const user = await User.create({ ...input, email });
      return { token: signToken(user), user };
    },

    async login(_, { email, password }) {
      email = email.trim().toLowerCase();
      if (await isRateLimited(`login:${email}`, 10, 15 * 60)) {
        throw new GraphQLError('Too many login attempts, try again later', {
          extensions: { code: 'TOO_MANY_REQUESTS' },
        });
      }

      const user = await User.findOne({ email }).select('+password');
      if (!user || !(await user.comparePassword(password))) {
        throw new GraphQLError('Invalid email or password', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      return { token: signToken(user), user };
    },
  },
};

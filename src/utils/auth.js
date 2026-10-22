import jwt from 'jsonwebtoken';
import { GraphQLError } from 'graphql';
import { config } from '../config/index.js';
import { User } from '../models/index.js';

export const signToken = (user) =>
  jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

// Resolves the logged-in user from an "Authorization: Bearer <token>" header.
// Returns null for missing/invalid tokens; resolvers decide whether auth is required.
export async function getUserFromHeader(header) {
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const { sub } = jwt.verify(header.slice(7), config.jwtSecret);
    return await User.findById(sub);
  } catch {
    return null;
  }
}

export function requireUser(ctx) {
  if (!ctx.user) {
    throw new GraphQLError('You must be logged in', { extensions: { code: 'UNAUTHENTICATED' } });
  }
  return ctx.user;
}

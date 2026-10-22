import mongoose from 'mongoose';
import { GraphQLError } from 'graphql';

export const round2 = (n) => Math.round(n * 100) / 100;

export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const badInput = (message) =>
  new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });

export const notFound = (what) =>
  new GraphQLError(`${what} not found`, { extensions: { code: 'NOT_FOUND' } });

export function assertId(id, what = 'Record') {
  if (!mongoose.isValidObjectId(id)) throw notFound(what);
  return id;
}

export const clampLimit = (limit, max = 100) => Math.min(Math.max(limit ?? 20, 1), max);

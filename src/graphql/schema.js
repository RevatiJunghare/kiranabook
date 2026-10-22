import { unwrapResolverError } from '@apollo/server/errors';
import { isProd } from '../config/index.js';
import { typeDefs } from './typeDefs.js';
import { resolvers } from './resolvers/index.js';

export { typeDefs, resolvers };

// Turn database errors into friendly messages and hide internals in production.
export function formatError(formatted, error) {
  const original = unwrapResolverError(error);

  if (original?.code === 11000) {
    const field = Object.keys(original.keyPattern ?? {}).find((k) => k !== 'owner') ?? 'value';
    return { message: `A record with this ${field} already exists`, extensions: { code: 'BAD_USER_INPUT' } };
  }
  if (original?.name === 'ValidationError') {
    return { message: original.message, extensions: { code: 'BAD_USER_INPUT' } };
  }
  if (isProd && formatted.extensions?.code === 'INTERNAL_SERVER_ERROR') {
    console.error(original);
    return { message: 'Internal server error', extensions: { code: 'INTERNAL_SERVER_ERROR' } };
  }
  return formatted;
}

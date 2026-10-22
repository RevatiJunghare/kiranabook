import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET ??= 'test-secret';

const { ApolloServer } = await import('@apollo/server');
const { typeDefs, resolvers, formatError } = await import('../src/graphql/schema.js');

const server = new ApolloServer({ typeDefs, resolvers, formatError });

test('schema builds and answers the health query', async () => {
  const res = await server.executeOperation({ query: '{ health }' });
  assert.equal(res.body.singleResult.errors, undefined);
  assert.equal(res.body.singleResult.data.health, 'ok');
});

test('protected queries require authentication', async () => {
  const res = await server.executeOperation({ query: '{ dashboard { todaySales } }' }, { contextValue: { user: null } });
  assert.equal(res.body.singleResult.errors[0].extensions.code, 'UNAUTHENTICATED');
});

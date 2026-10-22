import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { expressMiddleware } from '@as-integrations/express5';

import { config } from './config/index.js';
import { connectMongo, disconnectMongo, isMongoUp } from './config/db.js';
import { redis, connectRedis, isRedisUp } from './config/redis.js';
import { typeDefs, resolvers, formatError } from './graphql/schema.js';
import { getUserFromHeader } from './utils/auth.js';

async function main() {
  connectRedis();
  await connectMongo();

  const app = express();
  const httpServer = http.createServer(app);

  const apollo = new ApolloServer({
    typeDefs,
    resolvers,
    formatError,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  });
  await apollo.start();

  app.get('/health', (_req, res) => {
    const mongo = isMongoUp();
    const ok = mongo; // Redis is optional (cache only), Mongo is not.
    res.status(ok ? 200 : 503).json({
      status: ok ? 'ok' : 'degraded',
      mongo: mongo ? 'up' : 'down',
      redis: isRedisUp() ? 'up' : 'down',
      uptime: Math.round(process.uptime()),
    });
  });

  app.use(
    '/graphql',
    cors({ origin: config.corsOrigin }),
    express.json({ limit: '1mb' }),
    expressMiddleware(apollo, {
      context: async ({ req }) => ({ user: await getUserFromHeader(req.headers.authorization) }),
    })
  );

  await new Promise((resolve) => httpServer.listen(config.port, resolve));
  console.log(`🚀 KiranaBook API ready at http://localhost:${config.port}/graphql`);

  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down...`);
    await apollo.stop();
    await Promise.allSettled([disconnectMongo(), redis.quit()]);
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

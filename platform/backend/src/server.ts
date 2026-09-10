import Fastify from 'fastify';
import cookie from '@fastify/cookie';

const app = Fastify({ logger: true });
app.register(cookie, { secret: process.env.COOKIE_SECRET });

app.get('/health', async () => ({ status: 'ok', service: 'indian-election-data-api' }));

app.get('/api/v1/elections', async () => ({
  data: [],
  message: 'Connect Prisma/PostgreSQL to return published elections.'
}));

app.get('/api/v1/search', async (request) => {
  const { q = '' } = request.query as { q?: string };
  return { query: q, data: [] };
});

app.get('/api/v1/constituencies/:id/history', async (request) => {
  const { id } = request.params as { id: string };
  return { constituencyId: id, elections: [] };
});

const port = Number(process.env.PORT || 4000);
app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});

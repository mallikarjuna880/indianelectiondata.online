const base = `http://127.0.0.1:${process.env.PORT || 4000}/api/v1`;
async function get(path: string) { const r = await fetch(`${base}${path}`); if (!r.ok) throw new Error(`${path}: HTTP ${r.status} ${await r.text()}`); return r.json() as Promise<any>; }
const health = await (await fetch(`http://127.0.0.1:${process.env.PORT || 4000}/health`)).json() as any;
if (health.apiVersion !== 'v1') throw new Error('v1 health marker missing');
const spec = await get('/openapi.json');
for (const path of ['/states','/elections','/search?q=india','/docs']) if (!(path in spec.paths) && path !== '/docs') throw new Error(`OpenAPI missing ${path}`);
const states = await get('/states?page=1&pageSize=10');
if (!states.pagination || !Array.isArray(states.data)) throw new Error('states pagination contract failed');
const elections = await get('/elections?page=1&pageSize=10');
if (!elections.pagination || !Array.isArray(elections.data)) throw new Error('elections pagination contract failed');
const search = await get('/search?q=india&page=1&pageSize=10');
if (!search.pagination || !Array.isArray(search.data)) throw new Error('search pagination contract failed');
if (elections.data[0]) {
  const id = elections.data[0].id;
  const summary = await get(`/elections/${id}`);
  const results = await get(`/elections/${id}/results?page=1&pageSize=10`);
  if (!summary.data?.election || !Array.isArray(results.data)) throw new Error('election result contract failed');
}
console.log('Phase 4 API smoke test passed');

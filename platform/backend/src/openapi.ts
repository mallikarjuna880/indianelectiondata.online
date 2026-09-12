export const openapi = {
  openapi: '3.0.3', info: { title: 'Indian Election Data API', version: '1.0.0', description: 'Public election results, constituency history, candidate analytics, party performance, election dashboards and search.' },
  servers: [{ url: '/api/v1' }],
  paths: {
    '/elections': { get: { summary: 'List published elections', parameters: pageParams(), responses: { '200': jsonResponse() } } },
    '/elections/{id}': { get: { summary: 'Election summary', parameters: [idParam()], responses: { '200': jsonResponse(), '404': jsonResponse() } } },
    '/elections/{id}/dashboard': { get: { summary: 'Election dashboard analytics', parameters: [idParam()], responses: { '200': jsonResponse(), '404': jsonResponse() } } },
    '/elections/{id}/results': { get: { summary: 'Election-wise candidate results', parameters: [idParam(), ...pageParams(), { name: 'constituencyVersionId', in: 'query', schema: { type: 'string' } }, { name: 'partyId', in: 'query', schema: { type: 'string' } }], responses: { '200': jsonResponse() } } },
    '/candidates/{id}': { get: { summary: 'Candidate profile and published election history', parameters: [idParam(), ...pageParams(), { name: 'year', in: 'query', schema: { type: 'integer' } }, { name: 'electionType', in: 'query', schema: { type: 'string' } }], responses: { '200': jsonResponse(), '404': jsonResponse() } } },
    '/states': { get: { summary: 'List states', parameters: [...pageParams(), { name: 'q', in: 'query', schema: { type: 'string' } }], responses: { '200': jsonResponse() } } },
    '/states/{stateId}/constituencies': { get: { summary: 'List constituencies in a state', parameters: [idParam('stateId'), ...pageParams(), { name: 'q', in: 'query', schema: { type: 'string' } }], responses: { '200': jsonResponse() } } },
    '/constituencies/{id}': { get: { summary: 'Constituency detail and election versions', parameters: [idParam()], responses: { '200': jsonResponse(), '404': jsonResponse() } } },
    '/constituencies/{id}/results': { get: { summary: 'Constituency results by election', parameters: [idParam(), { name: 'electionId', in: 'query', schema: { type: 'string' } }], responses: { '200': jsonResponse() } } },
    '/constituencies/{id}/history': { get: { summary: 'Historical winner, runner-up, margin, turnout and NOTA', parameters: [idParam()], responses: { '200': jsonResponse() } } },
    '/parties/{id}/performance': { get: { summary: 'Party performance across elections', parameters: [idParam(), ...pageParams(), { name: 'year', in: 'query', schema: { type: 'integer' } }, { name: 'electionType', in: 'query', schema: { type: 'string' } }], responses: { '200': jsonResponse() } } },
    '/search': { get: { summary: 'Search states, constituencies, candidates and parties', parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string', minLength: 2 } }, ...pageParams()], responses: { '200': jsonResponse() } } }
  }
};
function idParam(name = 'id') { return { name, in: 'path', required: true, schema: { type: 'string' } }; }
function pageParams() { return [{ name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } }, { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 } }]; }
function jsonResponse() { return { description: 'JSON response', content: { 'application/json': { schema: { type: 'object' } } } }; }

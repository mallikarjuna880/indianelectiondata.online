const API_BASE = window.IED_API_BASE || '/api/v1';
const demo = electionData.lokSabha2024;
const body = document.getElementById('resultsBody');
const search = document.getElementById('search');
const electionSelect = document.getElementById('electionSelect');
const statusEl = document.querySelector('.live-dot');
let currentElectionId = '';
let currentPage = 1;
const pageSize = 25;

function fmt(n) { return new Intl.NumberFormat('en-IN').format(Number(n || 0)); }
function esc(value) { return String(value ?? '').replace(/[&<>\'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function setStatus(text, live = false) { if (statusEl) statusEl.textContent = live ? `● ${text}` : text; }
async function api(path) { const response = await fetch(`${API_BASE}${path}`, { headers: { Accept: 'application/json' } }); if (!response.ok) throw new Error(`API ${response.status}`); return response.json(); }

function renderDemo(query = '') {
  const q = query.trim().toLowerCase();
  const rows = demo.results.filter(r => !q || [r.constituency,r.state,r.winner,r.party].some(v => v.toLowerCase().includes(q)));
  body.innerHTML = rows.length ? rows.map(r => `<tr><td><strong>${esc(r.constituency)}</strong></td><td>${esc(r.state)}</td><td>${esc(r.winner)}</td><td><span class="party-pill">${esc(r.party)}</span></td><td>${fmt(r.votes)}</td><td>${fmt(r.margin)}</td></tr>`).join('') : '<tr><td colspan="6" class="empty">No matching records found.</td></tr>';
  renderParties(demo.parties); renderStates(demo.states); setStatus('Demo fallback');
}
function renderParties(parties) {
  const max = Math.max(...parties.map(p => Number(p.seats || 0)), 1);
  document.getElementById('partyCards').innerHTML = parties.map(p => `<article class="party-card"><div class="top"><h3>${esc(p.name)}</h3><span class="party-pill">Seats</span></div><div class="seats">${fmt(p.seats)}</div><div class="bar"><span style="width:${(Number(p.seats || 0) / max) * 100}%"></span></div></article>`).join('');
}
function renderStates(states) {
  document.getElementById('stateCards').innerHTML = states.map(s => `<article class="state-card"><div class="top"><h3>${esc(s.name)}</h3><span class="party-pill">${fmt(s.seats)} seats</span></div><p>Explore constituency-level data for ${esc(s.name)}.</p><p><strong>Leading:</strong> ${esc(s.leading || 'See results')}</p></article>`).join('');
}
function renderApiResults(payload) {
  const rows = payload.data || [];
  body.innerHTML = rows.length ? rows.map(r => { const cv = r.constituencyVersion?.constituency; const winner = r.position === 1 || r.isWinner === true; return `<tr><td><strong>${esc(cv?.name || r.constituencyVersion?.name || 'Constituency')}</strong></td><td>${esc(cv?.state?.name || '—')}</td><td>${esc(r.candidate?.name || '—')}</td><td><span class="party-pill">${esc(r.party?.abbreviation || r.party?.name || '—')}</span></td><td>${fmt(r.votes)}</td><td>${winner ? 'Winner' : `Position ${esc(r.position || '—')}`}</td></tr>`; }).join('') : '<tr><td colspan="6" class="empty">No published results found.</td></tr>';
  renderPagination(payload.pagination);
}
function renderPagination(meta) {
  let el = document.getElementById('pagination');
  if (!el) { el = document.createElement('div'); el.id = 'pagination'; el.className = 'pagination'; body.closest('.table-wrap').after(el); }
  if (!meta || meta.totalPages <= 1) { el.innerHTML = ''; return; }
  el.innerHTML = `<button ${meta.page <= 1 ? 'disabled' : ''} data-page="${meta.page - 1}">Previous</button><span>Page ${meta.page} of ${meta.totalPages}</span><button ${meta.page >= meta.totalPages ? 'disabled' : ''} data-page="${meta.page + 1}">Next</button>`;
  el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { currentPage = Number(b.dataset.page); loadResults(); }));
}
async function loadResults() {
  if (!currentElectionId) return renderDemo(search.value);
  try { const q = search.value.trim(); const path = `/elections/${encodeURIComponent(currentElectionId)}/results?page=${currentPage}&pageSize=${pageSize}${q ? `&q=${encodeURIComponent(q)}` : ''}`; renderApiResults(await api(path)); setStatus('Live API', true); }
  catch { renderDemo(search.value); }
}
async function loadStatesFromApi() {
  try { const payload = await api('/states?page=1&pageSize=12'); const states = payload.data || []; if (states.length) renderStates(states.map(s => ({ name:s.name, seats:s._count?.constituencies || 0, leading:'Explore results' }))); }
  catch { /* keep demo cards */ }
}
async function loadElections() {
  try { const payload = await api('/elections?page=1&pageSize=50'); const elections = payload.data || []; if (!elections.length) throw new Error('No published elections'); electionSelect.innerHTML = elections.map(e => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join(''); currentElectionId = elections[0].id; await loadResults(); await loadStatesFromApi(); setStatus('Live API', true); }
  catch { renderDemo(); }
}

electionSelect?.addEventListener('change', e => { currentElectionId = e.target.value; currentPage = 1; loadResults(); });
search?.addEventListener('input', () => { currentPage = 1; loadResults(); });
loadElections();

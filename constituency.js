const API_BASE = window.IED_API_BASE || '/api/v1';
const id = new URLSearchParams(window.location.search).get('id');
const $ = selector => document.querySelector(selector);
function esc(value) { return String(value ?? '').replace(/[&<>\'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function fmt(value) { return new Intl.NumberFormat('en-IN').format(Number(value || 0)); }
function pct(value) { return value == null || Number.isNaN(Number(value)) ? '—' : `${Number(value).toFixed(2)}%`; }
async function api(path) { const r = await fetch(`${API_BASE}${path}`, { headers: { Accept: 'application/json' } }); if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); }
function stat(label, value) { return `<div class="detail-stat"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`; }
function showError(message) { $('#detailStatus').textContent = 'Unable to load constituency'; $('#detailError').hidden = false; $('#detailError').textContent = message; }
function renderHeader(c) {
  document.title = `${c.name} Results | Indian Election Data`;
  $('#detailHeader').innerHTML = `<div class="detail-heading"><div><div class="eyebrow">CONSTITUENCY</div><h1>${esc(c.name)}</h1><p>${esc(c.state?.name || 'India')}${c.versions?.[0]?.reservedCategory ? ` · Reserved: ${esc(c.versions[0].reservedCategory)}` : ''}</p></div><div class="constituency-number">${c.versions?.[0]?.constituencyNumber ? `No. ${esc(c.versions[0].constituencyNumber)}` : ''}</div></div>`;
}
function renderLatest(version) {
  if (!version) { $('#latest').innerHTML = ''; return; }
  const results = [...(version.results || [])].sort((a,b) => Number(a.position || 999) - Number(b.position || 999));
  const winner = results[0]; const runner = results[1];
  const margin = winner && runner ? Number(winner.votes || 0) - Number(runner.votes || 0) : null;
  $('#latest').innerHTML = `<div class="section-head"><div><div class="eyebrow">LATEST PUBLISHED RESULT</div><h2>${esc(version.election?.name || 'Election result')}</h2></div></div><div class="winner-card"><div><span class="winner-label">WINNER</span><h3>${esc(winner?.candidate?.name || 'No winner recorded')}</h3><p>${esc(winner?.party?.abbreviation || winner?.party?.name || '—')} · ${fmt(winner?.votes)} votes</p></div><div class="winner-side"><span>Margin</span><strong>${margin == null ? '—' : fmt(margin)}</strong>${runner ? `<small>Runner-up: ${esc(runner.candidate?.name || '—')}</small>` : ''}</div></div>`;
}
function renderStats(version) {
  const s = version?.statistics?.[0]; if (!s) { $('#statistics').innerHTML = ''; return; }
  $('#statistics').innerHTML = `<div class="detail-grid">${stat('Electors', fmt(s.electors))}${stat('Votes polled', fmt(s.votesPolled))}${stat('Valid votes', fmt(s.validVotes))}${stat('NOTA votes', fmt(s.notaVotes))}${stat('Turnout', pct(s.turnoutPercentage))}</div>`;
}
function renderCandidates(version) {
  const results = [...(version?.results || [])].sort((a,b) => Number(a.position || 999) - Number(b.position || 999));
  const validVotes = Number(version?.statistics?.[0]?.validVotes || 0);
  $('#candidates').innerHTML = `<div class="section-head"><div><div class="eyebrow">CANDIDATES</div><h2>Candidate performance</h2></div></div><div class="table-wrap"><table><thead><tr><th>Pos.</th><th>Candidate</th><th>Party</th><th>Votes</th><th>Vote share</th></tr></thead><tbody>${results.length ? results.map(r => { const share = r.voteShare != null ? Number(r.voteShare) : (validVotes ? Number(r.votes || 0) / validVotes * 100 : null); return `<tr><td><strong>${esc(r.position ?? '—')}</strong></td><td>${esc(r.candidate?.name || '—')}${r.isWinner === true || Number(r.position) === 1 ? ' <span class="winner-badge">Winner</span>' : ''}</td><td><span class="party-pill">${esc(r.party?.abbreviation || r.party?.name || '—')}</span></td><td>${fmt(r.votes)}</td><td>${pct(share)}</td></tr>`; }).join('') : '<tr><td colspan="5" class="empty">No candidate results recorded.</td></tr>'}</tbody></table></div>`;
}
function renderHistory(rows) {
  const history = [...(rows || [])].sort((a,b) => Number(b.election?.year || 0) - Number(a.election?.year || 0));
  $('#history').innerHTML = `<div class="section-head history-head"><div><div class="eyebrow">HISTORY</div><h2>Election history</h2></div></div><div class="table-wrap"><table><thead><tr><th>Election</th><th>Winner</th><th>Party</th><th>Votes</th><th>Runner-up</th><th>Margin</th></tr></thead><tbody>${history.length ? history.map(r => `<tr><td><strong>${esc(r.election?.name || r.election?.year || '—')}</strong></td><td>${esc(r.winner?.candidate?.name || '—')}</td><td><span class="party-pill">${esc(r.winner?.party?.abbreviation || r.winner?.party?.name || '—')}</span></td><td>${fmt(r.winner?.votes)}</td><td>${esc(r.runnerUp?.candidate?.name || '—')}</td><td>${r.margin == null ? '—' : fmt(r.margin)}</td></tr>`).join('') : '<tr><td colspan="6" class="empty">No election history available.</td></tr>'}</tbody></table></div>`;
}
async function load() {
  if (!id) return showError('No constituency ID was supplied. Open this page from the public results explorer.');
  try {
    const [detail, results, history] = await Promise.all([api(`/constituencies/${encodeURIComponent(id)}`), api(`/constituencies/${encodeURIComponent(id)}/results`), api(`/constituencies/${encodeURIComponent(id)}/history`)]);
    if (!detail) throw new Error('Constituency not found');
    renderHeader(detail);
    const versions = [...(results || [])].sort((a,b) => Number(b.election?.year || 0) - Number(a.election?.year || 0));
    renderLatest(versions[0]); renderStats(versions[0]); renderCandidates(versions[0]); renderHistory(history);
    $('#detailStatus').textContent = 'Live published data';
    $('#detailStatus').classList.add('live');
  } catch (error) { showError('The public election API is unavailable or this constituency has no published data yet. Please try again later.'); console.error(error); }
}
load();

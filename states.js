const API_BASE = window.IED_API_BASE || '/api/v1';
const stateDirectory = document.getElementById('stateDirectory');
const stateSearch = document.getElementById('stateSearch');
const statePagination = document.getElementById('statePagination');
const constituencySection = document.getElementById('constituenciesSection');
const constituencyDirectory = document.getElementById('constituencyDirectory');
const constituencySearch = document.getElementById('constituencySearch');
const constituencyPagination = document.getElementById('constituencyPagination');
const selectedStateTitle = document.getElementById('selectedStateTitle');
let statePage = 1, constituencyPage = 1, selectedStateId = '';
const pageSize = 24;
function esc(v){return String(v??'').replace(/[&<>\'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function fmt(v){return new Intl.NumberFormat('en-IN').format(Number(v||0));}
async function api(path){const r=await fetch(API_BASE+path,{headers:{Accept:'application/json'}});if(!r.ok)throw Error('API '+r.status);return r.json();}
function pager(el,meta,load){if(!meta||meta.totalPages<=1){el.innerHTML='';return;}el.innerHTML=`<button ${meta.page<=1?'disabled':''} data-p="${meta.page-1}">Previous</button><span>Page ${meta.page} of ${meta.totalPages}</span><button ${meta.page>=meta.totalPages?'disabled':''} data-p="${meta.page+1}">Next</button>`;el.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{load(Number(b.dataset.p));}));}
async function loadStates(page=1){statePage=page;try{const q=stateSearch.value.trim();const p=await api(`/states?page=${page}&pageSize=${pageSize}${q?'&q='+encodeURIComponent(q):''}`);stateDirectory.innerHTML=p.data.length?p.data.map(s=>`<button class="directory-card" data-state="${esc(s.id)}"><div><h3>${esc(s.name)}</h3><p>${fmt(s._count?.constituencies)} constituencies</p></div><span>→</span></button>`).join(''):'<div class="empty">No states found.</div>';pager(statePagination,p.pagination,loadStates);stateDirectory.querySelectorAll('[data-state]').forEach(b=>b.addEventListener('click',()=>loadConstituencies(b.dataset.state,b.querySelector('h3').textContent)));}catch(e){stateDirectory.innerHTML='<div class="status-card error">The election API is unavailable. Please try again later.</div>';statePagination.innerHTML='';}}
async function loadConstituencies(id,name,page=1){selectedStateId=id;constituencyPage=page;constituencySection.classList.remove('hidden');selectedStateTitle.textContent=name;try{const q=constituencySearch.value.trim();const p=await api(`/states/${encodeURIComponent(id)}/constituencies?page=${page}&pageSize=${pageSize}${q?'&q='+encodeURIComponent(q):''}`);constituencyDirectory.innerHTML=p.data.length?p.data.map(c=>`<a class="directory-card" href="constituency.html?id=${encodeURIComponent(c.id)}"><div><h3>${esc(c.name)}</h3><p>${esc(c.state?.name||name)}${c.constituencyNumber?` • No. ${esc(c.constituencyNumber)}`:''}</p></div><span>→</span></a>`).join(''):'<div class="empty">No constituencies found.</div>';pager(constituencyPagination,p.pagination,p=>loadConstituencies(id,name,p));constituencySection.scrollIntoView({behavior:'smooth',block:'start'});}catch(e){constituencyDirectory.innerHTML='<div class="status-card error">Could not load constituencies.</div>';}}
stateSearch.addEventListener('input',()=>loadStates(1));constituencySearch.addEventListener('input',()=>{if(selectedStateId)loadConstituencies(selectedStateId,selectedStateTitle.textContent,1);});
loadStates();

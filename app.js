const data = electionData.lokSabha2024;
const body = document.getElementById("resultsBody");
const search = document.getElementById("search");

function fmt(n){ return new Intl.NumberFormat("en-IN").format(n); }

function renderResults(query=""){
  const q = query.trim().toLowerCase();
  const rows = data.results.filter(r =>
    !q || [r.constituency,r.state,r.winner,r.party].some(v => v.toLowerCase().includes(q))
  );
  if(!rows.length){
    body.innerHTML = '<tr><td colspan="6" class="empty">No matching records found.</td></tr>';
    return;
  }
  body.innerHTML = rows.map(r => `
    <tr>
      <td><strong>${r.constituency}</strong></td>
      <td>${r.state}</td>
      <td>${r.winner}</td>
      <td><span class="party-pill">${r.party}</span></td>
      <td>${fmt(r.votes)}</td>
      <td>${fmt(r.margin)}</td>
    </tr>`).join("");
}

function renderParties(){
  const max = Math.max(...data.parties.map(p=>p.seats));
  document.getElementById("partyCards").innerHTML = data.parties.map(p => `
    <article class="party-card">
      <div class="top"><h3>${p.name}</h3><span class="party-pill">Seats</span></div>
      <div class="seats">${p.seats}</div>
      <div class="bar"><span style="width:${(p.seats/max)*100}%"></span></div>
    </article>`).join("");
}

function renderStates(){
  document.getElementById("stateCards").innerHTML = data.states.map(s => `
    <article class="state-card">
      <div class="top"><h3>${s.name}</h3><span class="party-pill">${s.seats} seats</span></div>
      <p>Explore constituency-level data for ${s.name}.</p>
      <p><strong>Sample view:</strong> ${s.leading}</p>
    </article>`).join("");
}

search.addEventListener("input", e => renderResults(e.target.value));
renderResults(); renderParties(); renderStates();

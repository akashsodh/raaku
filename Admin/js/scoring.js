/* ============================================
   MPL ADMIN - Live Scoring Engine
   Ball-by-ball scoring with full state management
   ============================================ */

const SC_KEY = 'mpl_scoring_state';

// ---- Global state ----
let SC = null; // full scoring state

// ---- Helper: get current innings object ----
function inn() { return SC.currentInnings === 1 ? SC.innings1 : SC.innings2; }

// ---- Persist / Load ----
function saveState()  { localStorage.setItem(SC_KEY, JSON.stringify(SC)); }
function loadState()  { try { const s = localStorage.getItem(SC_KEY); return s ? JSON.parse(s) : null; } catch { return null; } }
function clearState() { localStorage.removeItem(SC_KEY); }

// ---- Toast ----
function showToast(msg, type = 'success') {
  const ex = document.querySelector('.toast'); if (ex) ex.remove();
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span>${type==='success'?'✅':type==='error'?'❌':'ℹ️'}</span><span>${msg}</span>`;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3000);
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ---- Player helpers ----
function getPlayer(id) { return MPL_STORAGE.getPlayers().find(p => p.id === id) || null; }
function playerName(id) {
  const p = getPlayer(id);
  return p ? escapeHtml(p.name) : 'Unknown';
}
function getTeam(id) { return MPL_STORAGE.getTeams().find(t => t.id === id) || null; }
function teamName(id) { const t = getTeam(id); return t ? escapeHtml(t.name) : 'Team'; }

// ---- Overs/balls formatting ----
function formatOvers(balls) {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

// ---- Show Phase ----
function showPhase(id) {
  document.querySelectorAll('.phase').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ================================================================
// PHASE 1: MATCH SELECTION
// ================================================================
function renderMatchSelection() {
  const matches = MPL_STORAGE.getMatches().filter(m => m.status === 'live' || m.status === 'upcoming');
  const teams   = MPL_STORAGE.getTeams();
  const list    = document.getElementById('matchSelectList');

  // Check if we have a saved scoring state
  const saved = loadState();
  if (saved && saved.matchId) {
    const ongoing = MPL_STORAGE.getMatches().find(m => m.id === saved.matchId);
    if (ongoing) {
      list.innerHTML = `
        <div class="info-card" style="margin-bottom:16px;border-color:var(--warning);background:rgba(255,165,2,0.05);">
          <div class="big-icon">⚡</div>
          <h3 style="color:var(--warning);">SCORING IN PROGRESS</h3>
          <p>Ek match pehle se score ho raha hai. Continue karo ya reset karo.</p>
          <div style="display:flex;gap:10px;justify-content:center;margin-top:16px;flex-wrap:wrap;">
            <button class="btn btn-primary" id="resumeBtn">▶ RESUME SCORING</button>
            <button class="btn btn-danger" id="resetScoringBtn">🗑️ RESET & START NEW</button>
          </div>
        </div>
      `;
      document.getElementById('resumeBtn').onclick = () => { SC = saved; resumeScoring(); };
      document.getElementById('resetScoringBtn').onclick = () => {
        if (confirm('Current scoring state delete karna hai?')) { clearState(); renderMatchSelection(); }
      };
      return;
    }
  }

  if (matches.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="big-icon">🏏</div>
        <h3>NO LIVE/UPCOMING MATCHES</h3>
        <p>Matches page pe jao aur match create karo ya START karo.</p>
        <a href="matches.html" class="btn btn-primary" style="display:inline-flex;margin-top:12px;">📅 GO TO MATCHES</a>
      </div>`;
    return;
  }

  list.innerHTML = matches.map(m => {
    const tA = teams.find(t => t.id === m.teamAId);
    const tB = teams.find(t => t.id === m.teamBId);
    return `
      <div class="match-select-card" onclick="selectMatch('${m.id}')">
        <div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:1.5px;">
            ${tA ? escapeHtml(tA.name) : 'TBD'} <span style="color:var(--gold);font-size:16px;">VS</span> ${tB ? escapeHtml(tB.name) : 'TBD'}
          </div>
          <div style="font-size:12px;color:var(--text-muted);letter-spacing:1px;margin-top:4px;">
            ${m.overs} Overs • Match #${m.matchNumber || '?'}
            ${m.venue ? ' • ' + escapeHtml(m.venue) : ''}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="match-status-badge status-${m.status}" style="font-size:10px;padding:4px 10px;">
            ${m.status === 'live' ? '🔴 LIVE' : '🕐 UPCOMING'}
          </span>
          <button class="btn btn-primary btn-small">▶ SCORE</button>
        </div>
      </div>`;
  }).join('');
}

function selectMatch(matchId) {
  const match = MPL_STORAGE.getMatches().find(m => m.id === matchId);
  if (!match) return;

  // Set match as live
  if (match.status !== 'live') {
    const matches = MPL_STORAGE.getMatches();
    const idx = matches.findIndex(m => m.id === matchId);
    matches[idx].status = 'live';
    matches[idx].startedAt = Date.now();
    MPL_STORAGE.saveMatches(matches);
  }

  // Init scoring state
  SC = {
    matchId,
    currentInnings: 1,
    toss: { winner: null, choice: 'bat' },
    innings1: null,
    innings2: null
  };

  setupTossUI(match);
  showPhase('phaseToss');
}

// ================================================================
// PHASE 2: TOSS & XI SETUP
// ================================================================
function setupTossUI(match) {
  const teams = MPL_STORAGE.getTeams();
  const tA    = teams.find(t => t.id === match.teamAId);
  const tB    = teams.find(t => t.id === match.teamBId);

  const sel = document.getElementById('tossWinner');
  sel.innerHTML = `<option value="">— Select —</option>` +
    [tA, tB].filter(Boolean).map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');

  document.getElementById('tossChoseBat').addEventListener('click', () => {
    document.querySelectorAll('.toss-option').forEach(o => o.classList.remove('selected'));
    document.getElementById('tossChoseBat').classList.add('selected');
    document.getElementById('tossChoice').value = 'bat';
  });
  document.getElementById('tossChoseBowl').addEventListener('click', () => {
    document.querySelectorAll('.toss-option').forEach(o => o.classList.remove('selected'));
    document.getElementById('tossChoseBowl').classList.add('selected');
    document.getElementById('tossChoice').value = 'bowl';
  });

  // Populate XI grids
  renderXIGrid('battingXIGrid', 'battingXICount', match.teamAId);
  renderXIGrid('bowlingXIGrid', 'bowlingXICount', match.teamBId);
}

function renderXIGrid(gridId, countId, teamId) {
  const players = MPL_STORAGE.getPlayers().filter(p => p.teamId === teamId);
  const grid    = document.getElementById(gridId);
  const count   = document.getElementById(countId);

  if (players.length === 0) {
    grid.innerHTML = `<p style="color:var(--text-muted);font-size:13px;">Is team mein koi player nahi. Players page pe add karo.</p>`;
    return;
  }

  grid.innerHTML = players.map(p => `
    <div class="xi-player-chip selected" data-player-id="${p.id}" onclick="toggleXI(this)">
      <div class="xi-jersey">${p.jersey || '#'}</div>
      <span>${escapeHtml(p.name)}</span>
    </div>
  `).join('');

  updateXICount(grid, count);
}

function toggleXI(el) {
  el.classList.toggle('selected');
  const grid  = el.closest('.xi-grid');
  const count = grid.nextElementSibling;
  updateXICount(grid, count);
}

function updateXICount(grid, countEl) {
  const n = grid.querySelectorAll('.xi-player-chip.selected').length;
  countEl.textContent = `${n} selected`;
  countEl.style.color = n >= 11 ? 'var(--success)' : 'var(--text-muted)';
}

function getSelectedXI(gridId) {
  return [...document.querySelectorAll(`#${gridId} .xi-player-chip.selected`)]
    .map(el => el.dataset.playerId);
}

document.getElementById('confirmTossBtn').addEventListener('click', () => {
  const tossWinner = document.getElementById('tossWinner').value;
  const tossChoice = document.getElementById('tossChoice').value;

  if (!tossWinner) { showToast('Toss winner select karo!', 'error'); return; }

  const match    = MPL_STORAGE.getMatches().find(m => m.id === SC.matchId);
  const teams    = MPL_STORAGE.getTeams();
  const tA       = teams.find(t => t.id === match.teamAId);
  const tB       = teams.find(t => t.id === match.teamBId);

  // Determine batting/bowling teams
  const tossTeam     = teams.find(t => t.id === tossWinner);
  const otherTeamId  = match.teamAId === tossWinner ? match.teamBId : match.teamAId;
  const battingTeamId  = tossChoice === 'bat' ? tossWinner : otherTeamId;
  const bowlingTeamId  = tossChoice === 'bat' ? otherTeamId : tossWinner;

  // Get selected XI
  // The first XI grid is for teamA, second for teamB
  // We need to figure out which grid corresponds to batting/bowling team
  const isTeamABatting = match.teamAId === battingTeamId;
  const battingXI  = getSelectedXI(isTeamABatting ? 'battingXIGrid' : 'bowlingXIGrid');
  const bowlingXI  = getSelectedXI(isTeamABatting ? 'bowlingXIGrid' : 'battingXIGrid');

  if (battingXI.length === 0) { showToast('Batting team ke koi players select nahi hue!', 'error'); return; }
  if (bowlingXI.length === 0) { showToast('Bowling team ke koi players select nahi hue!', 'error'); return; }

  SC.toss = { winner: tossWinner, choice: tossChoice, battingTeamId, bowlingTeamId };

  // Init innings1
  const batsmen = {};
  battingXI.forEach(id => {
    batsmen[id] = { runs:0, balls:0, fours:0, sixes:0, status:'yetToBat', howOut:null, bowler:null, fielder:null };
  });
  const bowlers = {};
  bowlingXI.forEach(id => {
    bowlers[id] = { balls:0, runs:0, wickets:0, wides:0, noBalls:0 };
  });

  SC.innings1 = {
    number: 1, battingTeamId, bowlingTeamId,
    battingXI, bowlingXI,
    runs:0, wickets:0, balls:0,
    extras: { wides:0, noBalls:0, legByes:0, byes:0 },
    batsmen, bowlers,
    striker: null, nonStriker: null, currentBowler: null, lastBowler: null,
    completedOvers: [], currentOver: [], fow: []
  };

  saveState();
  setupOpenersUI();
  showPhase('phaseOpeners');
});

// ================================================================
// PHASE 3: OPENERS SELECTION
// ================================================================
function setupOpenersUI() {
  const innings = inn();
  const opts = innings.battingXI.map(id => `<option value="${id}">${playerName(id)}</option>`).join('');
  document.getElementById('openerStriker').innerHTML    = `<option value="">— Select —</option>` + opts;
  document.getElementById('openerNonStriker').innerHTML = `<option value="">— Select —</option>` + opts;

  const bowlerOpts = innings.bowlingXI.map(id => `<option value="${id}">${playerName(id)}</option>`).join('');
  document.getElementById('openerBowler').innerHTML = `<option value="">— Select —</option>` + bowlerOpts;
}

document.getElementById('backToTossBtn').addEventListener('click', () => showPhase('phaseToss'));

document.getElementById('startInningsBtn').addEventListener('click', () => {
  const striker    = document.getElementById('openerStriker').value;
  const nonStriker = document.getElementById('openerNonStriker').value;
  const bowler     = document.getElementById('openerBowler').value;

  if (!striker)    { showToast('Striker select karo!', 'error'); return; }
  if (!nonStriker) { showToast('Non-striker select karo!', 'error'); return; }
  if (striker === nonStriker) { showToast('Dono batsmen alag hone chahiye!', 'error'); return; }
  if (!bowler)     { showToast('Opening bowler select karo!', 'error'); return; }

  const innings = inn();
  innings.striker      = striker;
  innings.nonStriker   = nonStriker;
  innings.currentBowler = bowler;

  innings.batsmen[striker].status    = 'batting';
  innings.batsmen[nonStriker].status = 'batting';

  saveState();
  renderLive();
  showPhase('phaseLive');
});

// ================================================================
// PHASE 4: LIVE SCORING
// ================================================================

// ---- Render the live scoreboard ----
function renderLive() {
  const innings = inn();
  if (!innings) return;

  const match = MPL_STORAGE.getMatches().find(m => m.id === SC.matchId);
  const totalOvers = match ? match.overs : 10;

  // Score display
  document.getElementById('liveBattingTeam').textContent = teamName(innings.battingTeamId);
  document.getElementById('liveScore').textContent = `${innings.runs}/${innings.wickets}`;
  document.getElementById('liveOvers').textContent = `(${formatOvers(innings.balls)})`;

  const overs = innings.balls / 6;
  const crr   = overs > 0 ? (innings.runs / overs).toFixed(2) : '0.00';
  document.getElementById('liveCRR').textContent = crr;
  document.getElementById('liveInningsLabel').textContent = SC.currentInnings === 1 ? '1ST INNINGS' : '2ND INNINGS';

  // Target (innings 2 only)
  if (SC.currentInnings === 2 && SC.innings1) {
    const target    = SC.innings1.runs + 1;
    const need      = target - innings.runs;
    const ballsLeft = (totalOvers * 6) - innings.balls;
    const rrr       = ballsLeft > 0 ? ((need / (ballsLeft / 6)).toFixed(2)) : '—';

    document.getElementById('targetBox').style.display = 'block';
    document.getElementById('liveTarget').textContent  = target;
    document.getElementById('liveNeed').textContent    = Math.max(0, need);
    document.getElementById('liveBallsLeft').textContent = ballsLeft;
    document.getElementById('liveRRR').textContent = rrr;
  } else {
    document.getElementById('targetBox').style.display = 'none';
  }

  // Batsmen
  renderBatsmanCard('striker', innings.striker, innings, true);
  renderBatsmanCard('nonStriker', innings.nonStriker, innings, false);

  // Bowler
  renderBowlerCard(innings.currentBowler, innings);

  // This Over
  renderThisOver(innings.currentOver);

  // Extras
  const ex = innings.extras;
  const totalExtras = ex.wides + ex.noBalls + ex.legByes + ex.byes;
  document.getElementById('extraTotal').textContent = totalExtras;
  document.getElementById('extraWd').textContent  = ex.wides;
  document.getElementById('extraNb').textContent  = ex.noBalls;
  document.getElementById('extraLb').textContent  = ex.legByes;
  document.getElementById('extraB').textContent   = ex.byes;
  document.getElementById('extraFow').textContent = `${innings.wickets}/${innings.runs}`;
}

function renderBatsmanCard(type, playerId, innings, isStriker) {
  if (!playerId) return;
  const name  = playerName(playerId);
  const stats = innings.batsmen[playerId];
  if (!stats) return;

  const sr = stats.balls > 0 ? ((stats.runs / stats.balls) * 100).toFixed(1) : '0.0';
  const fours = stats.fours || 0;
  const sixes = stats.sixes || 0;

  document.getElementById(`${type}Name`).textContent  = name;
  document.getElementById(`${type}Stats`).textContent = `${stats.runs}(${stats.balls})`;
  document.getElementById(`${type}SR`).textContent    = `SR: ${sr} | 4s: ${fours} | 6s: ${sixes}`;
}

function renderBowlerCard(playerId, innings) {
  if (!playerId) return;
  const name  = playerName(playerId);
  const stats = innings.bowlers[playerId];
  if (!stats) return;

  const overs = formatOvers(stats.balls);
  const econ  = stats.balls > 0 ? ((stats.runs / (stats.balls / 6))).toFixed(2) : '0.00';
  document.getElementById('bowlerName').textContent  = name;
  document.getElementById('bowlerStats').textContent = `${overs}-${stats.runs}-${stats.wickets}`;
  document.getElementById('bowlerEcon').textContent  = `Econ: ${econ}`;
}

function renderThisOver(overBalls) {
  const container = document.getElementById('thisOverBalls');
  const legal = overBalls.filter(b => b.type !== 'wide' && b.type !== 'noball').length;
  const slots  = 6;

  container.innerHTML = overBalls.map(b => {
    let cls = '';
    let label = '';
    if (b.isWicket) { cls = 'wicket'; label = 'W'; }
    else if (b.type === 'wide')   { cls = 'wide'; label = `wd${b.totalRuns > 1 ? '+' + (b.totalRuns-1) : ''}`; }
    else if (b.type === 'noball') { cls = 'noball'; label = `nb${b.runs > 0 ? '+' + b.runs : ''}`; }
    else if (b.type === 'legbye') { cls = 'extra'; label = `lb${b.runs}`; }
    else if (b.type === 'bye')    { cls = 'extra'; label = `b${b.runs}`; }
    else if (b.runs === 4)  { cls = 'four';  label = '4'; }
    else if (b.runs === 6)  { cls = 'six';   label = '6'; }
    else if (b.runs === 0)  { cls = 'dot';   label = '•'; }
    else                    { cls = ''; label = String(b.runs); }
    return `<div class="ball-chip ${cls}">${label}</div>`;
  }).join('');

  // Empty slots
  const remaining = slots - legal;
  for (let i = 0; i < remaining; i++) {
    container.innerHTML += `<div class="ball-chip empty"></div>`;
  }
}

// ---- Process a ball ----
function processBall(type, runs, extras = 0) {
  const innings = inn();
  const match   = MPL_STORAGE.getMatches().find(m => m.id === SC.matchId);
  const maxOvers = match ? match.overs : 10;

  // Build ball record
  const ball = {
    type, runs, isWicket: false, wicketType: null,
    batsmanOut: null, fielder: null,
    striker: innings.striker, bowler: innings.currentBowler,
    totalRuns: runs + extras
  };

  // Update team score
  innings.runs += ball.totalRuns;

  // Update extras
  if (type === 'wide')   { innings.extras.wides   += ball.totalRuns; innings.bowlers[innings.currentBowler].wides++; innings.bowlers[innings.currentBowler].runs += ball.totalRuns; }
  if (type === 'noball') { innings.extras.noBalls++; innings.bowlers[innings.currentBowler].noBalls++; innings.bowlers[innings.currentBowler].runs += runs + 1; innings.runs++; ball.totalRuns++; }
  if (type === 'legbye') { innings.extras.legByes += runs; }
  if (type === 'bye')    { innings.extras.byes    += runs; }

  // Update batsman (runs + balls)
  const isLegal = type !== 'wide'; // no balls count for batsman balls
  if (type === 'run' || type === 'noball') {
    innings.batsmen[innings.striker].runs += runs;
    if (runs === 4) innings.batsmen[innings.striker].fours++;
    if (runs === 6) innings.batsmen[innings.striker].sixes++;
  }
  if (isLegal && type === 'run') {
    innings.batsmen[innings.striker].balls++;
  }

  // Update bowler balls (for legal + leg byes + byes)
  const countsBall = type !== 'wide' && type !== 'noball';
  if (countsBall) {
    innings.bowlers[innings.currentBowler].balls++;
    if (type === 'run') innings.bowlers[innings.currentBowler].runs += runs;
    innings.balls++; // innings ball count

    // Rotate strike for odd runs (after legal ball)
    if (ball.totalRuns % 2 === 1) {
      [innings.striker, innings.nonStriker] = [innings.nonStriker, innings.striker];
    }
  } else if (type === 'wide' && runs % 2 === 1) {
    // Wide with odd runs: no rotate (wide doesn't count)
    // Actually on wides, ends change only if overthrows make odd total — simplified: no rotate
  }

  innings.currentOver.push(ball);

  saveState();
  renderLive();

  // Check innings over conditions
  const legalBalls = innings.currentOver.filter(b => b.type !== 'wide' && b.type !== 'noball').length;
  if (legalBalls >= 6) {
    setTimeout(() => completeOver(), 100);
  } else {
    checkInningsComplete();
  }
}

// ---- Wicket Processing ----
function openWicketModal() {
  const innings = inn();
  // Only current batsmen can get out
  const out = document.getElementById('wktBatsmanOut');
  out.innerHTML = [innings.striker, innings.nonStriker].filter(Boolean).map(id =>
    `<option value="${id}">${playerName(id)}</option>`
  ).join('');
  document.getElementById('wicketModal').classList.add('show');
}

document.getElementById('closeWicketModal').addEventListener('click',  () => document.getElementById('wicketModal').classList.remove('show'));
document.getElementById('cancelWicketBtn').addEventListener('click',   () => document.getElementById('wicketModal').classList.remove('show'));

document.getElementById('confirmWicketBtn').addEventListener('click', () => {
  const batsmanOut  = document.getElementById('wktBatsmanOut').value;
  const wicketType  = document.getElementById('wktType').value;
  const fielder     = document.getElementById('wktFielder').value.trim();
  const runs        = parseInt(document.getElementById('wktRuns').value) || 0;

  document.getElementById('wicketModal').classList.remove('show');
  processWicket(batsmanOut, wicketType, fielder, runs);
});

function processWicket(batsmanOut, wicketType, fielder, runs) {
  const innings = inn();

  // Update batsman
  innings.batsmen[batsmanOut].status  = 'out';
  innings.batsmen[batsmanOut].howOut  = wicketType;
  innings.batsmen[batsmanOut].bowler  = innings.currentBowler;
  innings.batsmen[batsmanOut].fielder = fielder || null;
  if (wicketType !== 'runout' && wicketType !== 'retired') {
    innings.batsmen[batsmanOut].balls++;
  }

  // Bowler wicket (not run out)
  if (wicketType !== 'runout') {
    innings.bowlers[innings.currentBowler].wickets++;
    innings.bowlers[innings.currentBowler].runs += runs;
  }

  innings.wickets++;
  innings.runs  += runs;
  innings.balls += (wicketType !== 'runout' ? 1 : 0); // run out doesn't always use a ball

  // FOW
  innings.fow.push({ wicket: innings.wickets, runs: innings.runs, balls: innings.balls, playerId: batsmanOut });

  // Rotate strike if odd runs
  if (batsmanOut === innings.striker) {
    innings.striker = innings.nonStriker; // vacate striker
    innings.nonStriker = null;
  } else {
    innings.nonStriker = null; // vacate non-striker (run out)
  }

  // Record in current over
  innings.currentOver.push({
    type: 'run', runs, isWicket: true, wicketType,
    batsmanOut, fielder: fielder || null,
    striker: batsmanOut, bowler: innings.currentBowler, totalRuns: runs
  });

  // Rotate strike for odd runs
  if (runs % 2 === 1) {
    [innings.striker, innings.nonStriker] = [innings.nonStriker, innings.striker];
  }

  innings.bowlers[innings.currentBowler].balls++;

  saveState();
  renderLive();

  // Check if all out
  const battingXI   = innings.battingXI;
  const outPlayers  = battingXI.filter(id => innings.batsmen[id] && innings.batsmen[id].status === 'out');
  const allOut      = outPlayers.length >= battingXI.length - 1; // last man standing

  if (allOut) {
    // Mark remaining as not out
    battingXI.forEach(id => {
      if (innings.batsmen[id] && innings.batsmen[id].status === 'batting') {
        innings.batsmen[id].status = 'notOut';
      }
    });
    saveState();
    setTimeout(() => endInnings('allOut'), 300);
    return;
  }

  // Check over complete
  const legalBalls = innings.currentOver.filter(b => b.type !== 'wide' && b.type !== 'noball').length;
  if (legalBalls >= 6) {
    setTimeout(() => completeOver(true), 300);
  } else {
    // Need new batsman
    openNewBatsmanModal();
  }
}

// ---- New Batsman ----
function openNewBatsmanModal() {
  const innings = inn();
  const remaining = innings.battingXI.filter(id =>
    innings.batsmen[id] && innings.batsmen[id].status === 'yetToBat'
  );

  if (remaining.length === 0) {
    // No more batsmen
    setTimeout(() => endInnings('allOut'), 200);
    return;
  }

  const listEl = document.getElementById('newBatsmanList');
  listEl.innerHTML = remaining.map(id => `
    <div class="xi-player-chip" style="margin-bottom:8px;" onclick="selectNewBatsman('${id}')">
      <div class="xi-jersey">${getPlayer(id)?.jersey || '#'}</div>
      <span>${playerName(id)}</span>
    </div>
  `).join('');

  document.getElementById('newBatsmanModal').classList.add('show');
}

function selectNewBatsman(id) {
  const innings = inn();
  innings.batsmen[id].status = 'batting';

  // Place at vacant position
  if (!innings.striker) innings.striker = id;
  else innings.nonStriker = id;

  document.getElementById('newBatsmanModal').classList.remove('show');
  saveState();
  renderLive();
}

// ---- Complete Over ----
function completeOver(afterWicket = false) {
  const innings = inn();
  const match   = MPL_STORAGE.getMatches().find(m => m.id === SC.matchId);
  const maxOvers = match ? match.overs : 10;

  // Save over
  innings.completedOvers.push([...innings.currentOver]);
  innings.currentOver = [];

  // Swap strike at end of over
  [innings.striker, innings.nonStriker] = [innings.nonStriker, innings.striker];

  innings.lastBowler = innings.currentBowler;
  innings.currentBowler = null;

  saveState();
  renderLive();

  // Check overs complete
  if (innings.completedOvers.length >= maxOvers || innings.wickets >= innings.battingXI.length - 1) {
    endInnings('oversComplete');
    return;
  }

  // Need new batsman + new bowler if wicket just fell
  if (afterWicket && !innings.striker) {
    openNewBatsmanModal();
  }

  // Always need new bowler
  setTimeout(() => openNewBowlerModal(), afterWicket ? 600 : 200);
}

// ---- New Bowler ----
function openNewBowlerModal() {
  const innings = inn();
  const maxBalls = (MPL_STORAGE.getMatches().find(m => m.id === SC.matchId)?.overs || 10) * 6;

  // Bowlers who bowled last over can't bowl again immediately
  const available = innings.bowlingXI.filter(id => id !== innings.lastBowler);

  const listEl = document.getElementById('newBowlerList');
  listEl.innerHTML = available.map(id => {
    const b    = innings.bowlers[id];
    const info = b ? `${formatOvers(b.balls)} ov, ${b.runs} runs, ${b.wickets} wkts` : 'Not bowled yet';
    return `
      <div class="xi-player-chip" style="margin-bottom:8px;flex-direction:column;align-items:flex-start;gap:2px;" onclick="selectNewBowler('${id}')">
        <div style="display:flex;align-items:center;gap:8px;width:100%;">
          <div class="xi-jersey">${getPlayer(id)?.jersey || '#'}</div>
          <span>${playerName(id)}</span>
        </div>
        <span style="font-size:11px;color:var(--text-muted);padding-left:32px;">${info}</span>
      </div>`;
  }).join('');

  document.getElementById('newBowlerModal').classList.add('show');
}

function selectNewBowler(id) {
  const innings = inn();
  innings.currentBowler = id;
  document.getElementById('newBowlerModal').classList.remove('show');
  saveState();
  renderLive();
}

// ---- Undo Last Ball ----
function undoLastBall() {
  const innings = inn();
  if (!innings) return;

  const lastBall = innings.currentOver.pop();
  if (!lastBall) {
    // Undo from last completed over
    if (innings.completedOvers.length === 0) { showToast('Kuch undo karne ko nahi hai!', 'error'); return; }
    const lastOver = innings.completedOvers.pop();
    innings.currentOver = lastOver;
    // Swap strike back
    [innings.striker, innings.nonStriker] = [innings.nonStriker, innings.striker];
    showToast('Previous over restored!', 'info');
  } else {
    // Reverse the ball effects
    innings.runs -= lastBall.totalRuns;
    if (lastBall.isWicket) {
      innings.wickets--;
      innings.fow.pop();
      if (lastBall.batsmanOut) {
        innings.batsmen[lastBall.batsmanOut].status = 'batting';
        innings.batsmen[lastBall.batsmanOut].howOut = null;
        innings.batsmen[lastBall.batsmanOut].bowler = null;
      }
      innings.bowlers[lastBall.bowler].wickets--;
    }
    if (lastBall.type === 'run') { innings.balls--; innings.batsmen[lastBall.striker].runs -= lastBall.runs; innings.batsmen[lastBall.striker].balls--; innings.bowlers[lastBall.bowler].runs -= lastBall.runs; innings.bowlers[lastBall.bowler].balls--; }
    if (lastBall.type === 'wide')   { innings.extras.wides -= lastBall.totalRuns; innings.bowlers[lastBall.bowler].wides--; innings.bowlers[lastBall.bowler].runs -= lastBall.totalRuns; }
    if (lastBall.type === 'noball') { innings.extras.noBalls--; innings.bowlers[lastBall.bowler].noBalls--; innings.bowlers[lastBall.bowler].runs -= lastBall.runs + 1; innings.runs--; innings.balls--; }
    if (lastBall.type === 'legbye') { innings.extras.legByes -= lastBall.runs; innings.balls--; innings.bowlers[lastBall.bowler].balls--; }
    if (lastBall.type === 'bye')    { innings.extras.byes    -= lastBall.runs; innings.balls--; innings.bowlers[lastBall.bowler].balls--; }

    // Reverse strike rotation
    if (lastBall.totalRuns % 2 === 1) {
      [innings.striker, innings.nonStriker] = [innings.nonStriker, innings.striker];
    }
    showToast('Last ball undone!', 'info');
  }

  saveState();
  renderLive();
}

// ---- End Innings ----
function endInnings(reason) {
  const innings = inn();
  innings.endReason = reason;
  innings.endedAt   = Date.now();

  // Mark remaining batsmen as not out
  innings.battingXI.forEach(id => {
    if (innings.batsmen[id] && innings.batsmen[id].status === 'batting') {
      innings.batsmen[id].status = 'notOut';
    }
  });

  saveState();

  if (SC.currentInnings === 1) {
    // Setup innings 2
    const match = MPL_STORAGE.getMatches().find(m => m.id === SC.matchId);
    const target = innings.runs + 1;

    document.getElementById('inn1FinalScore').textContent =
      `${innings.runs}/${innings.wickets} (${formatOvers(innings.balls)} Ov)`;
    document.getElementById('targetAnnounce').textContent =
      `${teamName(innings.bowlingTeamId)} needs ${target} runs to win`;

    // Swap: innings2 batting = innings1 bowling
    const battingXI  = innings.bowlingXI;
    const bowlingXI  = innings.battingXI;
    const batsmen2   = {};
    battingXI.forEach(id => { batsmen2[id] = { runs:0, balls:0, fours:0, sixes:0, status:'yetToBat', howOut:null, bowler:null, fielder:null }; });
    const bowlers2   = {};
    bowlingXI.forEach(id => { bowlers2[id] = { balls:0, runs:0, wickets:0, wides:0, noBalls:0 }; });

    SC.innings2 = {
      number: 2, battingTeamId: innings.bowlingTeamId, bowlingTeamId: innings.battingTeamId,
      battingXI, bowlingXI, target,
      runs:0, wickets:0, balls:0,
      extras: { wides:0, noBalls:0, legByes:0, byes:0 },
      batsmen: batsmen2, bowlers: bowlers2,
      striker:null, nonStriker:null, currentBowler:null, lastBowler:null,
      completedOvers:[], currentOver:[], fow:[]
    };

    saveState();

    // Populate innings 2 openers
    const opts = battingXI.map(id => `<option value="${id}">${playerName(id)}</option>`).join('');
    document.getElementById('inn2Striker').innerHTML    = `<option value="">— Select —</option>` + opts;
    document.getElementById('inn2NonStriker').innerHTML = `<option value="">— Select —</option>` + opts;
    const bOpts = bowlingXI.map(id => `<option value="${id}">${playerName(id)}</option>`).join('');
    document.getElementById('inn2Bowler').innerHTML = `<option value="">— Select —</option>` + bOpts;

    showPhase('phaseInnings2');
  } else {
    // Match complete
    const inn1 = SC.innings1;
    const inn2 = SC.innings2;
    const target = inn1.runs + 1;

    let result = '';
    let winnerId = null;
    if (inn2.runs >= target) {
      winnerId = inn2.battingTeamId;
      const margin = inn2.battingXI.filter(id => inn2.batsmen[id] && ['batting','notOut','yetToBat'].includes(inn2.batsmen[id].status)).length;
      result = `${teamName(inn2.battingTeamId)} won by ${10 - inn2.wickets} wicket(s)`;
    } else {
      winnerId = inn1.battingTeamId;
      const margin = target - inn2.runs - 1;
      result = `${teamName(inn1.battingTeamId)} won by ${margin} run(s)`;
    }

    if (inn2.wickets >= inn2.battingXI.length - 1 && inn2.runs < target) {
      result = `${teamName(inn1.battingTeamId)} won by ${target - inn2.runs - 1} run(s)`;
      winnerId = inn1.battingTeamId;
    }

    // Save result to match
    const matches = MPL_STORAGE.getMatches();
    const idx = matches.findIndex(m => m.id === SC.matchId);
    if (idx !== -1) {
      matches[idx].status    = 'completed';
      matches[idx].result    = result;
      matches[idx].winnerId  = winnerId;
      matches[idx].endedAt   = Date.now();

      // Update team stats
      const teams = MPL_STORAGE.getTeams();
      [inn1.battingTeamId, inn1.bowlingTeamId].forEach(tid => {
        const ti = teams.findIndex(t => t.id === tid);
        if (ti === -1) return;
        teams[ti].stats.matches = (teams[ti].stats.matches || 0) + 1;
        if (tid === winnerId) {
          teams[ti].stats.wins = (teams[ti].stats.wins || 0) + 1;
          teams[ti].stats.points = (teams[ti].stats.points || 0) + 2;
        } else {
          teams[ti].stats.losses = (teams[ti].stats.losses || 0) + 1;
        }
      });
      MPL_STORAGE.saveTeams(teams);
      MPL_STORAGE.saveMatches(matches);
    }

    clearState();

    document.getElementById('finalResultText').textContent = result;
    document.getElementById('finalScoresText').textContent =
      `${teamName(inn1.battingTeamId)}: ${inn1.runs}/${inn1.wickets} (${formatOvers(inn1.balls)}) | ` +
      `${teamName(inn2.battingTeamId)}: ${inn2.runs}/${inn2.wickets} (${formatOvers(inn2.balls)})`;

    showPhase('phaseComplete');
    showToast('Match complete! Result saved.', 'success');
  }
}

// ---- Scorecard View ----
function renderScorecard() {
  const modal = document.getElementById('scorecardModal');
  const body  = document.getElementById('scorecardBody');
  const inns  = [SC.innings1, SC.innings2].filter(Boolean);

  let html = '';
  inns.forEach(inn => {
    if (!inn) return;
    html += `<h3 style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2px;color:var(--gold);margin-bottom:12px;">
      ${teamName(inn.battingTeamId)} — ${inn.runs}/${inn.wickets} (${formatOvers(inn.balls)})
    </h3>`;

    // Batting table
    html += `<div style="overflow-x:auto;margin-bottom:20px;">
      <table class="scorecard-table">
        <thead><tr>
          <th>Batsman</th><th>How Out</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th>
        </tr></thead><tbody>`;

    inn.battingXI.forEach(id => {
      const s = inn.batsmen[id];
      if (!s) return;
      const isNow = id === inn.striker || id === inn.nonStriker;
      const sr    = s.balls > 0 ? ((s.runs / s.balls) * 100).toFixed(1) : '-';
      const howOut = s.status === 'out' ? (s.howOut === 'runout' ? 'Run Out' : s.howOut) : (s.status === 'batting' || isNow ? 'batting*' : (s.status === 'notOut' ? 'not out' : 'yet to bat'));
      html += `<tr class="${isNow ? 'batting-now' : ''}">
        <td>${playerName(id)}</td><td style="font-size:11px;">${howOut}</td>
        <td>${s.runs}</td><td>${s.balls}</td><td>${s.fours||0}</td><td>${s.sixes||0}</td><td>${sr}</td>
      </tr>`;
    });

    const ex = inn.extras;
    html += `<tr><td colspan="7" style="color:var(--text-muted);font-size:12px;letter-spacing:1px;">
      Extras: ${ex.wides+ex.noBalls+ex.legByes+ex.byes}
      (Wd: ${ex.wides}, Nb: ${ex.noBalls}, Lb: ${ex.legByes}, B: ${ex.byes})
    </td></tr>`;
    html += `</tbody></table></div>`;

    // Bowling table
    html += `<table class="scorecard-table" style="margin-bottom:24px;">
      <thead><tr><th>Bowler</th><th>O</th><th>R</th><th>W</th><th>Econ</th></tr></thead><tbody>`;
    inn.bowlingXI.forEach(id => {
      const b    = inn.bowlers[id];
      if (!b || b.balls === 0) return;
      const econ = b.balls > 0 ? (b.runs / (b.balls / 6)).toFixed(2) : '-';
      html += `<tr><td>${playerName(id)}</td><td>${formatOvers(b.balls)}</td><td>${b.runs}</td><td>${b.wickets}</td><td>${econ}</td></tr>`;
    });
    html += `</tbody></table>`;
  });

  body.innerHTML = html;
  modal.classList.add('show');
}

// ================================================================
// INNINGS 2 SETUP
// ================================================================
document.getElementById('startInnings2Btn').addEventListener('click', () => {
  const striker    = document.getElementById('inn2Striker').value;
  const nonStriker = document.getElementById('inn2NonStriker').value;
  const bowler     = document.getElementById('inn2Bowler').value;

  if (!striker)    { showToast('Striker select karo!', 'error'); return; }
  if (!nonStriker) { showToast('Non-striker select karo!', 'error'); return; }
  if (striker === nonStriker) { showToast('Dono alag hone chahiye!', 'error'); return; }
  if (!bowler)     { showToast('Bowler select karo!', 'error'); return; }

  SC.currentInnings = 2;
  SC.innings2.striker = striker;
  SC.innings2.nonStriker = nonStriker;
  SC.innings2.currentBowler = bowler;
  SC.innings2.batsmen[striker].status = 'batting';
  SC.innings2.batsmen[nonStriker].status = 'batting';

  saveState();
  renderLive();
  showPhase('phaseLive');
});

// ================================================================
// RESUME (if state was saved)
// ================================================================
function resumeScoring() {
  const innings = inn();
  renderLive();
  if (SC.currentInnings === 2 && !SC.innings2) {
    showPhase('phaseInnings2');
  } else {
    showPhase('phaseLive');
  }
}

// ================================================================
// BUTTON EVENT LISTENERS
// ================================================================
document.querySelectorAll('.run-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const runs = parseInt(btn.dataset.runs);
    processBall('run', runs);
  });
});

document.querySelectorAll('.extra-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.extra;
    const runs = parseInt(btn.dataset.runs);
    processBall(type, runs);
  });
});

document.getElementById('wicketBtn').addEventListener('click', openWicketModal);
document.getElementById('undoBtn').addEventListener('click', undoLastBall);

document.getElementById('endInningsBtn').addEventListener('click', () => {
  if (confirm('Innings end karna hai?')) endInnings('manual');
});

document.getElementById('viewScorecardBtn').addEventListener('click', () => renderScorecard());
document.getElementById('closeScorecardModal').addEventListener('click', () =>
  document.getElementById('scorecardModal').classList.remove('show'));
document.getElementById('scorecardModal').addEventListener('click', e => {
  if (e.target.id === 'scorecardModal') document.getElementById('scorecardModal').classList.remove('show');
});

document.getElementById('newScoringBtn').addEventListener('click', () => {
  clearState(); SC = null; renderMatchSelection(); showPhase('phaseSelect');
});

function checkInningsComplete() {
  const innings = inn();
  if (!innings) return;
  const match   = MPL_STORAGE.getMatches().find(m => m.id === SC.matchId);
  const maxOvers = match ? match.overs : 10;

  // Check if target reached in innings 2
  if (SC.currentInnings === 2 && SC.innings1) {
    const target = SC.innings1.runs + 1;
    if (innings.runs >= target) {
      setTimeout(() => endInnings('targetReached'), 300);
    }
  }
}

// ================================================================
// INIT
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
  if (!MPL_AUTH.requireAuth()) return;

  const user = MPL_AUTH.getUser();
  if (user) {
    document.getElementById('userName').textContent   = user.user;
    document.getElementById('userAvatar').textContent = user.user.charAt(0).toUpperCase();
  }

  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  document.getElementById('mobileToggle').addEventListener('click', () => {
    sidebar.classList.toggle('open'); overlay.classList.toggle('open');
  });
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open'); overlay.classList.remove('open');
  });
  document.getElementById('logoutBtn').addEventListener('click', () => {
    if (confirm('Logout karna hai?')) MPL_AUTH.logout();
  });

  // Check URL for match param
  const urlParams = new URLSearchParams(window.location.search);
  const matchParam = urlParams.get('match');

  if (matchParam) {
    selectMatch(matchParam);
  } else {
    renderMatchSelection();
    showPhase('phaseSelect');
  }
});

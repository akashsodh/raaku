/* ================================================
   MPL ADMIN — matches.js
   Handles: Create/Edit/Delete matches + Auto Fixture Generator
   ================================================ */

'use strict';

// ---- State ----
const OVERS_LIST   = [5, 6, 8, 10, 15, 20];
let editMatchId    = null;
let resultMatchId  = null;
let activeTab      = 'all';

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function xh(s) {                      // escapeHtml
  if (!s) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})
       + ' ' + d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
}

function toast(msg, type) {
  type = type || 'success';
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const t = document.createElement('div');
  t.className = 'toast toast-' + type;
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  t.innerHTML = '<span>' + icon + '</span><span>' + msg + '</span>';
  document.body.appendChild(t);
  setTimeout(function(){ t.classList.add('show'); }, 10);
  setTimeout(function(){
    t.classList.remove('show');
    setTimeout(function(){ if (t.parentNode) t.remove(); }, 400);
  }, 3000);
}

function getTeams()   { return MPL_STORAGE.getTeams();   }
function getMatches() { return MPL_STORAGE.getMatches(); }
function teamById(id) { return getTeams().find(function(t){ return t.id === id; }) || null; }
function matchById(id){ return getMatches().find(function(m){ return m.id === id; }) || null; }

/* ─────────────────────────────────────────────
   OVERS GRID renderer (shared by both modals)
───────────────────────────────────────────── */
function buildOversGrid(containerId, hiddenId, selectedOvers) {
  var grid = document.getElementById(containerId);
  if (!grid) return;
  grid.innerHTML = '';
  OVERS_LIST.forEach(function(o) {
    var chip = document.createElement('div');
    chip.className = 'overs-chip' + (o === selectedOvers ? ' picked' : '');
    chip.innerHTML = o + '<br><span style="font-size:10px;letter-spacing:1px;">OV</span>';
    chip.addEventListener('click', function() {
      grid.querySelectorAll('.overs-chip').forEach(function(c){ c.classList.remove('picked'); });
      chip.classList.add('picked');
      var hidden = document.getElementById(hiddenId);
      if (hidden) hidden.value = o;
    });
    grid.appendChild(chip);
  });
}

/* ─────────────────────────────────────────────
   RENDER MATCHES LIST
───────────────────────────────────────────── */
function renderMatches() {
  var all      = getMatches();
  var teams    = getTeams();
  var list     = document.getElementById('matchesList');
  var counter  = document.getElementById('matchCounter');
  if (!list || !counter) return;

  counter.innerHTML = '<span>' + all.length + '</span> Matches';

  var filtered = all;
  if (activeTab !== 'all') {
    filtered = all.filter(function(m){ return m.status === activeTab; });
  }

  if (all.length === 0) {
    list.innerHTML =
      '<div class="empty-state">' +
      '<div class="big-icon">🏏</div>' +
      '<h3>NO MATCHES YET</h3>' +
      '<p>Create your first fixture.</p>' +
      '<button class="btn btn-primary" onclick="openMatchModal()">➕ CREATE FIRST MATCH</button>' +
      '</div>';
    return;
  }

  if (filtered.length === 0) {
    list.innerHTML =
      '<div class="empty-state">' +
      '<div class="big-icon">🔍</div>' +
      '<h3>NO ' + activeTab.toUpperCase() + ' MATCHES</h3>' +
      '<p>Doosra tab check karo.</p>' +
      '</div>';
    return;
  }

  // Sort: live → upcoming → completed, then by match number
  filtered.sort(function(a, b) {
    var order = {live:0, upcoming:1, completed:2};
    var oa = order[a.status] !== undefined ? order[a.status] : 3;
    var ob = order[b.status] !== undefined ? order[b.status] : 3;
    if (oa !== ob) return oa - ob;
    return (parseInt(a.matchNumber)||0) - (parseInt(b.matchNumber)||0);
  });

  var html = '';
  filtered.forEach(function(m) {
    var tA    = teamById(m.teamAId);
    var tB    = teamById(m.teamBId);
    var nameA = tA ? xh(tA.name) : 'Team A';
    var nameB = tB ? xh(tB.name) : 'Team B';
    var colA  = tA ? tA.color : '#F5A623';
    var colB  = tB ? tB.color : '#F5A623';

    var badge = '';
    if (m.status === 'live')
      badge = '<span class="sbadge sbadge-live">🔴 LIVE</span>';
    else if (m.status === 'upcoming')
      badge = '<span class="sbadge sbadge-upcoming">🕐 UPCOMING</span>';
    else
      badge = '<span class="sbadge sbadge-completed">✅ DONE</span>';

    var actions = '';
    if (m.status === 'upcoming') {
      actions =
        '<button class="btn btn-outline btn-small" onclick="openEditMatch(\'' + m.id + '\')">✏️ EDIT</button>' +
        '<button class="btn btn-start btn-small" onclick="startMatch(\'' + m.id + '\')">🔴 START</button>' +
        '<button class="btn btn-danger btn-small" onclick="deleteMatch(\'' + m.id + '\')">🗑️</button>';
    } else if (m.status === 'live') {
      actions =
        '<a href="scoring.html?match=' + m.id + '" class="btn btn-start btn-small">⚡ SCORE</a>' +
        '<button class="btn btn-outline btn-small" onclick="openResultModal(\'' + m.id + '\')">✅ END</button>';
    } else {
      actions =
        '<button class="btn btn-outline btn-small" onclick="openResultModal(\'' + m.id + '\')">✏️ RESULT</button>' +
        '<button class="btn btn-danger btn-small" onclick="deleteMatch(\'' + m.id + '\')">🗑️</button>';
    }

    html +=
      '<div class="match-card ' + m.status + '">' +
        '<div class="match-num">#' + (m.matchNumber || '?') + '</div>' +
        '<div class="match-teams">' +
          '<span class="match-team-name" style="color:' + colA + ';">' + nameA + '</span>' +
          '<span class="match-vs">VS</span>' +
          '<span class="match-team-name" style="color:' + colB + ';">' + nameB + '</span>' +
        '</div>' +
        '<div class="match-meta">' +
          badge +
          '<span class="match-overs">' + m.overs + ' OV</span>' +
          '<span class="match-date">' + fmtDate(m.date) + '</span>' +
          (m.venue ? '<span class="match-date">📍 ' + xh(m.venue) + '</span>' : '') +
          (m.result ? '<span class="match-result">🏆 ' + xh(m.result) + '</span>' : '') +
        '</div>' +
        '<div class="match-actions">' + actions + '</div>' +
      '</div>';
  });

  list.innerHTML = html;
}

/* ─────────────────────────────────────────────
   CREATE / EDIT MATCH MODAL
───────────────────────────────────────────── */
function fillTeamDropdowns(selA, selB) {
  var teams = getTeams();
  var opts  = '<option value="">— Select —</option>';
  teams.forEach(function(t) {
    opts += '<option value="' + t.id + '">' + xh(t.name) + ' (' + t.code + ')</option>';
  });
  document.getElementById('matchTeamA').innerHTML = opts;
  document.getElementById('matchTeamB').innerHTML = opts;
  if (selA) document.getElementById('matchTeamA').value = selA;
  if (selB) document.getElementById('matchTeamB').value = selB;
}

function openMatchModal() {
  editMatchId = null;
  document.getElementById('matchModalTitle').textContent = 'CREATE MATCH';
  fillTeamDropdowns('', '');
  buildOversGrid('matchOversGrid', 'matchOvers', 10);
  document.getElementById('matchDate').value   = '';
  document.getElementById('matchVenue').value  = '';
  var existing = getMatches();
  document.getElementById('matchNumber').value = existing.length + 1;
  document.getElementById('matchModal').classList.add('show');
}

function openEditMatch(id) {
  var m = matchById(id);
  if (!m) return;
  editMatchId = id;
  document.getElementById('matchModalTitle').textContent = 'EDIT MATCH';
  fillTeamDropdowns(m.teamAId, m.teamBId);
  buildOversGrid('matchOversGrid', 'matchOvers', m.overs || 10);
  document.getElementById('matchDate').value   = m.date   ? m.date.substring(0,16) : '';
  document.getElementById('matchVenue').value  = m.venue  || '';
  document.getElementById('matchNumber').value = m.matchNumber || '';
  document.getElementById('matchModal').classList.add('show');
}

function closeMatchModal() {
  document.getElementById('matchModal').classList.remove('show');
  editMatchId = null;
}

function saveMatch(e) {
  e.preventDefault();
  var teamAId = document.getElementById('matchTeamA').value;
  var teamBId = document.getElementById('matchTeamB').value;
  var overs   = parseInt(document.getElementById('matchOvers').value) || 10;
  var date    = document.getElementById('matchDate').value  || null;
  var venue   = document.getElementById('matchVenue').value.trim() || null;
  var matchNo = document.getElementById('matchNumber').value.trim();

  if (!teamAId) { toast('Team A select karo!', 'error'); return; }
  if (!teamBId) { toast('Team B select karo!', 'error'); return; }
  if (teamAId === teamBId) { toast('Dono teams alag honi chahiye!', 'error'); return; }

  var matches = getMatches();
  if (editMatchId) {
    var idx = matches.findIndex(function(m){ return m.id === editMatchId; });
    if (idx !== -1) {
      matches[idx] = Object.assign(matches[idx], {
        teamAId:teamAId, teamBId:teamBId, overs:overs,
        date:date, venue:venue, matchNumber:matchNo || matches[idx].matchNumber,
        updatedAt: Date.now()
      });
      MPL_STORAGE.saveMatches(matches);
      toast('Match updated!', 'success');
    }
  } else {
    matches.push({
      id:          MPL_STORAGE.generateId('match'),
      matchNumber: matchNo || String(matches.length + 1),
      teamAId:teamAId, teamBId:teamBId, overs:overs,
      date:date, venue:venue,
      status:'upcoming', result:null, winnerId:null,
      season: MPL_STORAGE.getCurrentSeason(),
      innings:[], createdAt: Date.now()
    });
    MPL_STORAGE.saveMatches(matches);
    toast('Match created!', 'success');
  }
  closeMatchModal();
  renderMatches();
}

function deleteMatch(id) {
  var m = matchById(id);
  if (!m) return;
  if (!confirm('"Match #' + m.matchNumber + '" delete karna hai?')) return;
  MPL_STORAGE.saveMatches(getMatches().filter(function(x){ return x.id !== id; }));
  toast('Match deleted!', 'success');
  renderMatches();
}

function startMatch(id) {
  if (!confirm('Match ko LIVE mark karna hai?')) return;
  var matches = getMatches();
  var idx     = matches.findIndex(function(m){ return m.id === id; });
  if (idx === -1) return;
  matches[idx].status    = 'live';
  matches[idx].startedAt = Date.now();
  MPL_STORAGE.saveMatches(matches);
  toast('Match is now LIVE!', 'success');
  renderMatches();
}

/* ─────────────────────────────────────────────
   RESULT MODAL
───────────────────────────────────────────── */
function openResultModal(id) {
  var m = matchById(id);
  if (!m) return;
  resultMatchId = id;
  var tA = teamById(m.teamAId);
  var tB = teamById(m.teamBId);
  var opts = '<option value="">— No Result / Tie —</option>';
  if (tA) opts += '<option value="' + tA.id + '">' + xh(tA.name) + '</option>';
  if (tB) opts += '<option value="' + tB.id + '">' + xh(tB.name) + '</option>';
  document.getElementById('winnerTeam').innerHTML = opts;
  document.getElementById('resultText').value  = m.result   || '';
  document.getElementById('winnerTeam').value  = m.winnerId || '';
  document.getElementById('resultModal').classList.add('show');
}

function closeResultModal() {
  document.getElementById('resultModal').classList.remove('show');
  resultMatchId = null;
}

function saveResult() {
  if (!resultMatchId) return;
  var result   = document.getElementById('resultText').value.trim();
  var winnerId = document.getElementById('winnerTeam').value || null;
  if (!result) { toast('Result description daalo!', 'error'); return; }

  var matches = getMatches();
  var idx     = matches.findIndex(function(m){ return m.id === resultMatchId; });
  if (idx === -1) return;

  matches[idx].status    = 'completed';
  matches[idx].result    = result;
  matches[idx].winnerId  = winnerId;
  matches[idx].endedAt   = Date.now();

  if (winnerId) {
    var teams   = getTeams();
    var loserId = matches[idx].teamAId === winnerId ? matches[idx].teamBId : matches[idx].teamAId;
    [winnerId, loserId].forEach(function(tid, i) {
      var ti = teams.findIndex(function(t){ return t.id === tid; });
      if (ti === -1) return;
      teams[ti].stats = teams[ti].stats || {};
      teams[ti].stats.matches = (teams[ti].stats.matches || 0) + 1;
      if (i === 0) {
        teams[ti].stats.wins   = (teams[ti].stats.wins   || 0) + 1;
        teams[ti].stats.points = (teams[ti].stats.points || 0) + 2;
      } else {
        teams[ti].stats.losses = (teams[ti].stats.losses || 0) + 1;
      }
    });
    MPL_STORAGE.saveTeams(teams);
  }

  MPL_STORAGE.saveMatches(matches);
  toast('Result saved!', 'success');
  closeResultModal();
  renderMatches();
}

/* ─────────────────────────────────────────────
   AUTO FIXTURE GENERATOR
   Round-robin: C(n,2) = n*(n-1)/2 matches
───────────────────────────────────────────── */
/* ─────────────────────────────────────────────
   CIRCLE METHOD — Round-Robin Scheduler
   For n teams, produces n-1 rounds, each round
   has n/2 matches. No team plays back-to-back.

   Example for 6 teams [A,B,C,D,E,F]:
   Round 1: AvF, BvE, CvD
   Round 2: AvE, FvD, BvC
   Round 3: AvD, EvC, FvB
   Round 4: AvC, DvB, EvF
   Round 5: AvB, CvF, DvE
───────────────────────────────────────────── */
function circleRoundRobin(teams) {
  var list = teams.slice();        // working copy
  var n    = list.length;
  var odd  = (n % 2 !== 0);
  if (odd) list.push(null);        // add bye-slot for odd count
  var N    = list.length;          // now always even
  var half = N / 2;
  var allPairs = [];               // flat ordered list of [teamA, teamB]

  for (var round = 0; round < N - 1; round++) {
    // Pair up: position i  vs  position (N-1-i)
    for (var i = 0; i < half; i++) {
      var tA = list[i];
      var tB = list[N - 1 - i];
      if (tA !== null && tB !== null) {   // skip bye matches
        allPairs.push([tA, tB]);
      }
    }
    // Rotate: fix list[0], rotate list[1 .. N-1] clockwise
    var last = list[N - 1];
    for (var j = N - 1; j > 1; j--) {
      list[j] = list[j - 1];
    }
    list[1] = last;
  }

  return allPairs;
}

function buildAutoPreview() {
  var teams    = getTeams();
  var existing = getMatches();
  var startNum = parseInt(document.getElementById('autoStartNum').value) || 1;

  // Existing pairs set (to skip duplicates)
  var existPairs = {};
  existing.forEach(function(m) {
    existPairs[[m.teamAId, m.teamBId].sort().join('|')] = true;
  });

  // Use circle method for proper interleaving
  var orderedPairs = circleRoundRobin(teams);

  // Filter out already-existing pairs
  var newPairs = orderedPairs.filter(function(p) {
    return !existPairs[[p[0].id, p[1].id].sort().join('|')];
  });

  var previewEl = document.getElementById('autoPreviewList');
  if (!previewEl) return;

  if (newPairs.length === 0) {
    previewEl.innerHTML =
      '<div style="text-align:center;padding:20px;color:var(--text-dim);font-size:13px;">' +
      'Sab pairs ke matches pehle se exist karte hain!' +
      '</div>';
    return;
  }

  // Group by rounds for display (every teams.length/2 matches = 1 round)
  var teamsCount   = teams.length % 2 === 0 ? teams.length : teams.length + 1;
  var matchPerRound = teamsCount / 2;
  var html = '';
  var roundNum = 1;

  newPairs.forEach(function(p, idx) {
    // Round label
    if (idx % matchPerRound === 0) {
      html +=
        '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:11px;' +
        'letter-spacing:2px;color:var(--gold);padding:6px 0 4px;border-top:' +
        (idx === 0 ? 'none' : '1px solid var(--border)') + ';margin-top:' +
        (idx === 0 ? '0' : '6px') + ';">ROUND ' + roundNum++ + '</div>';
    }
    var tA = p[0], tB = p[1];
    html +=
      '<div class="prev-row">' +
        '<span class="prev-num">#' + (startNum + idx) + '</span>' +
        '<span class="prev-name" style="color:' + tA.color + ';">' + xh(tA.name) + '</span>' +
        '<span class="prev-vs">VS</span>' +
        '<span class="prev-name" style="color:' + tB.color + ';">' + xh(tB.name) + '</span>' +
      '</div>';
  });
  previewEl.innerHTML = html;
}

function openAutoFixtureModal() {
  var teams    = getTeams();
  var existing = getMatches();

  if (teams.length < 2) {
    toast('Auto fixture ke liye pehle 2+ teams add karo!', 'error');
    return;
  }

  var n       = teams.length;
  var total   = (n * (n - 1)) / 2;
  var perTeam = n - 1;

  // Info text
  var infoEl = document.getElementById('autoInfoText');
  if (infoEl) {
    infoEl.innerHTML =
      '<strong style="color:var(--text);">' + n + ' teams</strong> se ' +
      '<strong style="color:var(--gold);">' + total + ' total matches</strong> generate honge ' +
      '(har team ke ' + perTeam + ' matches).';
  }

  // Team pills
  var pillsEl = document.getElementById('autoTeamPills');
  if (pillsEl) {
    var pillHtml = '';
    teams.forEach(function(t) {
      pillHtml +=
        '<div class="team-tag" style="border:1px solid ' + t.color + ';">' +
          '<div class="team-tag-dot" style="background:' + t.color + ';"></div>' +
          xh(t.name) +
          ' <span style="color:var(--text-dim);">(' + t.code + ')</span>' +
        '</div>';
    });
    pillsEl.innerHTML = pillHtml;
  }

  // Overs grid
  buildOversGrid('autoOversGrid', 'autoOvers', 10);

  // Start number = after existing
  var startEl = document.getElementById('autoStartNum');
  if (startEl) startEl.value = existing.length + 1;

  // Venue clear
  var venueEl = document.getElementById('autoVenue');
  if (venueEl) venueEl.value = '';

  // Warn if existing
  var warnEl = document.getElementById('autoWarnBox');
  if (warnEl) warnEl.style.display = existing.length > 0 ? 'block' : 'none';

  // Build preview
  buildAutoPreview();

  // Show modal
  document.getElementById('autoModal').classList.add('show');
}

function closeAutoModal() {
  document.getElementById('autoModal').classList.remove('show');
}

function confirmAutoFixtures() {
  var teams    = getTeams();
  var existing = getMatches();
  var overs    = parseInt(document.getElementById('autoOvers').value) || 10;
  var venue    = (document.getElementById('autoVenue').value || '').trim() || null;
  var startNum = parseInt(document.getElementById('autoStartNum').value) || 1;

  if (teams.length < 2) { toast('2+ teams chahiye!', 'error'); return; }

  // Existing pairs set
  var existPairs = {};
  existing.forEach(function(m) {
    existPairs[[m.teamAId, m.teamBId].sort().join('|')] = true;
  });

  // Use circle method — proper interleaved schedule
  var orderedPairs = circleRoundRobin(teams);

  var newMatches = [];
  var matchNum   = startNum;

  orderedPairs.forEach(function(p) {
    var tA  = p[0], tB = p[1];
    var key = [tA.id, tB.id].sort().join('|');
    if (existPairs[key]) return;   // skip duplicate

    newMatches.push({
      id:          MPL_STORAGE.generateId('match'),
      matchNumber: String(matchNum++),
      teamAId:     tA.id,
      teamBId:     tB.id,
      overs:       overs,
      date:        null,
      venue:       venue,
      status:      'upcoming',
      result:      null,
      winnerId:    null,
      season:      MPL_STORAGE.getCurrentSeason(),
      innings:     [],
      createdAt:   Date.now()
    });
  });

  if (newMatches.length === 0) {
    toast('Sab pairs pehle se exist karte hain!', 'info');
    closeAutoModal();
    return;
  }

  MPL_STORAGE.saveMatches(existing.concat(newMatches));
  closeAutoModal();
  toast(newMatches.length + ' matches generate ho gaye! 🏏', 'success');
  renderMatches();
}

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function() {
  if (!MPL_AUTH.requireAuth()) return;

  // User info
  var user = MPL_AUTH.getUser();
  if (user) {
    document.getElementById('userName').textContent   = user.user;
    document.getElementById('userAvatar').textContent = user.user.charAt(0).toUpperCase();
  }

  // Sidebar
  var sidebar = document.getElementById('sidebar');
  var overlay = document.getElementById('overlay');
  document.getElementById('mobileToggle').addEventListener('click', function() {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  });
  overlay.addEventListener('click', function() {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', function() {
    if (confirm('Logout karna hai?')) MPL_AUTH.logout();
  });

  // Tabs
  document.getElementById('tabBar').addEventListener('click', function(e) {
    var btn = e.target.closest('.tab-btn');
    if (!btn) return;
    document.querySelectorAll('.tab-btn').forEach(function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
    activeTab = btn.dataset.tab;
    renderMatches();
  });

  // Add Match button
  document.getElementById('addMatchBtn').addEventListener('click', function() {
    if (getTeams().length < 2) { toast('Pehle 2 teams add karo!', 'error'); return; }
    openMatchModal();
  });

  // Auto Fixture button
  document.getElementById('autoFixtureBtn').addEventListener('click', function() {
    openAutoFixtureModal();
  });

  // Match Modal listeners
  document.getElementById('closeMatchModal').addEventListener('click', closeMatchModal);
  document.getElementById('cancelMatchBtn').addEventListener('click', closeMatchModal);
  document.getElementById('matchModal').addEventListener('click', function(e) {
    if (e.target.id === 'matchModal') closeMatchModal();
  });
  document.getElementById('matchForm').addEventListener('submit', saveMatch);

  // Result Modal
  document.getElementById('closeResultModal').addEventListener('click', closeResultModal);
  document.getElementById('cancelResultBtn').addEventListener('click', closeResultModal);
  document.getElementById('resultModal').addEventListener('click', function(e) {
    if (e.target.id === 'resultModal') closeResultModal();
  });
  document.getElementById('saveResultBtn').addEventListener('click', saveResult);

  // Auto Modal
  document.getElementById('closeAutoModal').addEventListener('click', closeAutoModal);
  document.getElementById('cancelAutoBtn').addEventListener('click', closeAutoModal);
  document.getElementById('autoModal').addEventListener('click', function(e) {
    if (e.target.id === 'autoModal') closeAutoModal();
  });
  document.getElementById('confirmAutoBtn').addEventListener('click', confirmAutoFixtures);

  // Update preview when start number changes
  document.getElementById('autoStartNum').addEventListener('input', function() {
    buildAutoPreview();
  });

  // Esc key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeMatchModal();
      closeResultModal();
      closeAutoModal();
    }
  });

  // Initial render
  renderMatches();
});

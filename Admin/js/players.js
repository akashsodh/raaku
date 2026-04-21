/* ================================================
   MPL ADMIN — players.js
   Mobile-first Players Management
   ================================================ */

'use strict';

const ROLES = [
  { key:'batsman',      label:'Batsman',       icon:'🏏', cls:'role-bat'  },
  { key:'bowler',       label:'Bowler',        icon:'🎯', cls:'role-bowl' },
  { key:'allrounder',   label:'All-Rounder',   icon:'⭐', cls:'role-ar'   },
  { key:'wicketkeeper', label:'Wicket-Keeper', icon:'🧤', cls:'role-wk'   }
];

let editingId = null;
let filter    = { search:'', teamId:'all', role:'all' };

/* ── Helpers ─────────────────────────────────── */
function xh(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function toast(msg, type) {
  type = type || 'success';
  var old = document.querySelector('.toast'); if (old) old.remove();
  var t = document.createElement('div');
  t.className = 'toast toast-' + type;
  var icon = type==='success' ? '✅' : type==='error' ? '❌' : 'ℹ️';
  t.innerHTML = '<span>'+icon+'</span><span>'+msg+'</span>';
  document.body.appendChild(t);
  setTimeout(function(){ t.classList.add('show'); }, 10);
  setTimeout(function(){ t.classList.remove('show'); setTimeout(function(){ if(t.parentNode)t.remove(); },400); }, 3000);
}

function getRole(key) { return ROLES.find(function(r){return r.key===key;}) || ROLES[0]; }
function getTeam(id)  { return MPL_STORAGE.getTeams().find(function(t){return t.id===id;}) || null; }

/* ── Preview (mini card in sheet) ───────────── */
function updatePreview() {
  var avatarEl = document.getElementById('previewAvatar'); if (!avatarEl) return;
  var name     = (document.getElementById('playerName')  ?.value||'').trim() || 'PLAYER NAME';
  var jersey   = (document.getElementById('playerJersey')?.value||'').trim() || '0';
  var role     = document.getElementById('playerRole')?.value || 'batsman';
  var teamId   = document.getElementById('playerTeam')?.value || '';

  var roleData = getRole(role);
  var team     = getTeam(teamId);
  var initials = name.split(/\s+/).map(function(w){return w.charAt(0);}).join('').toUpperCase().substring(0,2) || 'PN';

  /* FIX: innerHTML preserves jersey-badge child */
  avatarEl.innerHTML = initials + '<div class="jersey-badge" id="previewJersey">'+jersey+'</div>';
  avatarEl.style.borderColor = team ? team.color : '#F5A623';

  var nameEl = document.getElementById('previewPlayerName');
  var roleEl = document.getElementById('previewPlayerRole');
  if (nameEl) nameEl.textContent = name;
  if (roleEl) roleEl.textContent = (team ? team.name : 'No Team') + ' • ' + roleData.label;
}

/* ── Role Grid ───────────────────────────────── */
function initRoleGrid(selectedRole) {
  var grid = document.getElementById('roleGrid'); if (!grid) return;
  grid.querySelectorAll('.role-tile').forEach(function(tile) {
    var r = tile.dataset.role;
    tile.classList.toggle('picked', r === selectedRole);
    tile.onclick = function() {
      grid.querySelectorAll('.role-tile').forEach(function(t){t.classList.remove('picked');});
      tile.classList.add('picked');
      document.getElementById('playerRole').value = r;
      // Auto-enable WK toggle
      if (r === 'wicketkeeper') {
        document.getElementById('playerIsWK').checked = true;
        document.getElementById('wkToggle').classList.add('on');
      }
      updatePreview();
    };
  });
}

/* ── Team Dropdown ──────────────────────────── */
function fillTeamDropdown(selectedId) {
  var teams = MPL_STORAGE.getTeams();
  var sel   = document.getElementById('playerTeam'); if (!sel) return;
  var html  = '<option value="">— No Team —</option>';
  teams.forEach(function(t) {
    html += '<option value="'+t.id+'"'+(t.id===selectedId?' selected':'')+'>'+xh(t.name)+' ('+t.code+')</option>';
  });
  sel.innerHTML = html;
}

/* ── Open Sheet ─────────────────────────────── */
function openPlayerModal(player) {
  player = player || null;
  editingId = player ? player.id : null;

  var title = document.getElementById('sheetTitle');
  if (title) title.textContent = player ? 'EDIT PLAYER' : 'ADD PLAYER';

  /* Fill fields */
  document.getElementById('playerName').value   = player ? player.name        : '';
  document.getElementById('playerAge').value    = player ? (player.age    ||'') : '';
  document.getElementById('playerJersey').value = player ? (player.jersey ||'') : '';
  document.getElementById('playerRole').value   = player ? player.role        : 'batsman';

  var isCap = player ? !!player.isCaptain       : false;
  var isWK  = player ? !!player.isWicketKeeper  : false;
  document.getElementById('playerIsCaptain').checked = isCap;
  document.getElementById('playerIsWK').checked      = isWK;

  /* Sync toggle chips */
  if (typeof syncChips === 'function') syncChips();

  fillTeamDropdown(player ? (player.teamId||'') : '');
  initRoleGrid(player ? player.role : 'batsman');
  updatePreview();

  document.getElementById('playerModal').classList.add('show');
  /* Auto-focus name on desktop */
  setTimeout(function(){ document.getElementById('playerName').focus(); }, 300);
}

/* ── Close Sheet ────────────────────────────── */
function closePlayerModal() {
  document.getElementById('playerModal').classList.remove('show');
  editingId = null;
}

/* ── editPlayer(id) — safe onclick ─────────── */
function editPlayer(id) {
  var p = MPL_STORAGE.getPlayers().find(function(x){return x.id===id;});
  if (p) openPlayerModal(p);
}

/* ── Save Player ────────────────────────────── */
function savePlayer(e) {
  e.preventDefault();

  var name    = document.getElementById('playerName').value.trim();
  var age     = document.getElementById('playerAge').value.trim();
  var jersey  = document.getElementById('playerJersey').value.trim();
  var role    = document.getElementById('playerRole').value;
  var teamId  = document.getElementById('playerTeam').value || null;
  var isCap   = document.getElementById('playerIsCaptain').checked;
  var isWK    = document.getElementById('playerIsWK').checked;

  if (!name) { toast('Player ka naam daalo!', 'error'); return; }
  if (age && (isNaN(+age) || +age<10 || +age>60)) { toast('Age 10–60 ke beech honi chahiye!','error'); return; }
  if (jersey && (isNaN(+jersey)||+jersey<0||+jersey>999)) { toast('Jersey 0–999 ke beech hona chahiye!','error'); return; }

  var players = MPL_STORAGE.getPlayers();

  /* Duplicate jersey */
  if (jersey && teamId) {
    var dup = players.find(function(p){
      return p.teamId===teamId && String(p.jersey)===String(jersey) && p.id!==editingId;
    });
    if (dup) { toast('Jersey #'+jersey+' already used by '+dup.name+'!','error'); return; }
  }

  /* One captain per team */
  if (isCap && teamId) {
    var exCap = players.find(function(p){
      return p.teamId===teamId && p.isCaptain && p.id!==editingId;
    });
    if (exCap) {
      if (!confirm(exCap.name+' already captain hai. Replace karna hai?')) return;
      var ci = players.findIndex(function(p){return p.id===exCap.id;});
      players[ci].isCaptain = false;
    }
  }

  if (editingId) {
    var idx = players.findIndex(function(p){return p.id===editingId;});
    if (idx !== -1) {
      players[idx] = Object.assign(players[idx], {
        name:name, age:age||null, jersey:jersey||null,
        role:role, teamId:teamId, isCaptain:isCap, isWicketKeeper:isWK,
        updatedAt: Date.now()
      });
      MPL_STORAGE.savePlayers(players);
      toast('"'+name+'" updated!', 'success');
    }
  } else {
    var np = {
      id:             MPL_STORAGE.generateId('player'),
      name:name, age:age||null, jersey:jersey||null,
      role:role, teamId:teamId, isCaptain:isCap, isWicketKeeper:isWK,
      season:         MPL_STORAGE.getCurrentSeason(),
      stats: {
        batting:  {matches:0,innings:0,runs:0,balls:0,fours:0,sixes:0,highest:0,notOuts:0,fifties:0,hundreds:0,average:0,strikeRate:0},
        bowling:  {matches:0,innings:0,balls:0,runs:0,wickets:0,bestFigures:'0/0',average:0,economy:0,strikeRate:0,fourWickets:0,fiveWickets:0},
        fielding: {catches:0,stumpings:0,runOuts:0}
      },
      createdAt: Date.now()
    };
    players.push(np);
    MPL_STORAGE.savePlayers(players);

    /* Update team captain field */
    if (isCap && teamId) {
      var teams = MPL_STORAGE.getTeams();
      var ti    = teams.findIndex(function(t){return t.id===teamId;});
      if (ti !== -1) { teams[ti].captain = name; MPL_STORAGE.saveTeams(teams); }
    }
    toast('"'+name+'" added!', 'success');
  }

  closePlayerModal();
  renderTeamSummary();
  renderPlayers();
}

/* ── Delete Player ──────────────────────────── */
function deletePlayer(id) {
  var p = MPL_STORAGE.getPlayers().find(function(x){return x.id===id;});
  if (!p) return;
  if (!confirm('"'+p.name+'" delete karna hai?')) return;
  MPL_STORAGE.savePlayers(MPL_STORAGE.getPlayers().filter(function(x){return x.id!==id;}));
  toast('"'+p.name+'" deleted!', 'success');
  renderTeamSummary();
  renderPlayers();
}

/* ── Team Summary Bar ───────────────────────── */
function renderTeamSummary() {
  var teams   = MPL_STORAGE.getTeams();
  var players = MPL_STORAGE.getPlayers();
  var bar     = document.getElementById('teamSummaryBar'); if (!bar) return;

  var counts = {};
  players.forEach(function(p){ if(p.teamId) counts[p.teamId]=(counts[p.teamId]||0)+1; });
  var unassigned = players.filter(function(p){return !p.teamId;}).length;

  var html =
    '<div class="team-chip all-chip '+(filter.teamId==='all'?'active':'')+'" data-t="all">'+
      '<div class="chip-dot" style="background:var(--gold);"></div>'+
      '<div><div class="chip-code">ALL</div><div class="chip-count">'+players.length+' players</div></div>'+
    '</div>';

  teams.forEach(function(t){
    html +=
      '<div class="team-chip '+(filter.teamId===t.id?'active':'')+'" data-t="'+t.id+'">'+
        '<div class="chip-dot" style="background:'+t.color+';"></div>'+
        '<div><div class="chip-code">'+xh(t.code)+'</div><div class="chip-count">'+(counts[t.id]||0)+' players</div></div>'+
      '</div>';
  });

  if (unassigned > 0) {
    html +=
      '<div class="team-chip '+(filter.teamId==='none'?'active':'')+'" data-t="none">'+
        '<div class="chip-dot" style="background:#FFA502;"></div>'+
        '<div><div class="chip-code">NO TM</div><div class="chip-count">'+unassigned+' players</div></div>'+
      '</div>';
  }

  bar.innerHTML = html;
  bar.querySelectorAll('.team-chip').forEach(function(chip){
    chip.addEventListener('click', function(){
      filter.teamId = chip.dataset.t;
      var sel = document.getElementById('filterTeam'); if(sel) sel.value = filter.teamId;
      renderTeamSummary();
      renderPlayers();
    });
  });
}

/* ── Render Players Grid ─────────────────────── */
function renderPlayers() {
  var all     = MPL_STORAGE.getPlayers();
  var grid    = document.getElementById('playersGrid');    if (!grid) return;
  var counter = document.getElementById('playerCounter');

  var list = all;
  if (filter.search) {
    var s = filter.search.toLowerCase();
    list = list.filter(function(p){return p.name.toLowerCase().includes(s);});
  }
  if (filter.teamId === 'none') {
    list = list.filter(function(p){return !p.teamId;});
  } else if (filter.teamId !== 'all') {
    list = list.filter(function(p){return p.teamId===filter.teamId;});
  }
  if (filter.role !== 'all') {
    list = list.filter(function(p){return p.role===filter.role;});
  }

  if (counter) counter.innerHTML = '<span>'+list.length+'</span> / '+all.length+' Players';

  if (all.length === 0) {
    grid.innerHTML =
      '<div class="empty-state">'+
      '<div class="big-icon">👥</div>'+
      '<h3>NO PLAYERS YET</h3>'+
      '<p>Add button se players add karo.</p>'+
      '<button class="btn btn-primary" onclick="openPlayerModal()">➕ ADD FIRST PLAYER</button>'+
      '</div>';
    return;
  }
  if (list.length === 0) {
    grid.innerHTML =
      '<div class="empty-state">'+
      '<div class="big-icon">🔍</div>'+
      '<h3>NO PLAYERS FOUND</h3>'+
      '<p>Filters clear karo.</p>'+
      '<button class="btn btn-outline" onclick="resetFilters()">CLEAR FILTERS</button>'+
      '</div>';
    return;
  }

  list.sort(function(a,b){
    if (a.teamId!==b.teamId){
      if(!a.teamId)return 1; if(!b.teamId)return -1;
      return a.teamId.localeCompare(b.teamId);
    }
    return (parseInt(a.jersey)||999)-(parseInt(b.jersey)||999);
  });

  var html = '';
  list.forEach(function(p){
    var team     = getTeam(p.teamId);
    var roleData = getRole(p.role);
    var initials = p.name.split(/\s+/).map(function(w){return w.charAt(0);}).join('').toUpperCase().substring(0,2);
    var color    = team ? team.color : '#F5A623';

    html +=
      '<div class="player-card" style="--team-color:'+color+';">'+
        '<div class="player-card-top">'+
          '<div class="p-avatar">'+
            initials+
            (p.jersey ? '<div class="p-jersey">'+p.jersey+'</div>' : '')+
          '</div>'+
          '<div class="p-info">'+
            '<div class="p-name">'+
              xh(p.name)+
              (p.isCaptain     ? '<span class="badge-c">C</span>'  : '')+
              (p.isWicketKeeper? '<span class="badge-c badge-wk">WK</span>' : '')+
            '</div>'+
            '<span class="p-badge '+roleData.cls+'">'+roleData.icon+' '+roleData.label+'</span>'+
          '</div>'+
        '</div>'+
        '<div class="player-card-body">'+
          '<div class="p-team-row">'+
            (team
              ? '<div class="p-dot" style="background:'+team.color+';"></div><span>'+xh(team.name)+'</span>'
              : '<span class="p-no-team">⚠️ NO TEAM</span>'
            )+
          '</div>'+
          '<div class="p-stats">'+
            '<div class="p-stat"><div class="p-stat-n">'+(p.stats?.batting?.matches||0)+'</div><div class="p-stat-l">Matches</div></div>'+
            '<div class="p-stat"><div class="p-stat-n">'+(p.stats?.batting?.runs||0)+'</div><div class="p-stat-l">Runs</div></div>'+
            '<div class="p-stat"><div class="p-stat-n">'+(p.stats?.bowling?.wickets||0)+'</div><div class="p-stat-l">Wickets</div></div>'+
          '</div>'+
          '<div class="p-actions">'+
            '<button class="btn btn-outline btn-small" onclick="editPlayer(\''+p.id+'\')">✏️ EDIT</button>'+
            '<button class="btn btn-danger btn-small" onclick="deletePlayer(\''+p.id+'\')">🗑️</button>'+
          '</div>'+
        '</div>'+
      '</div>';
  });
  grid.innerHTML = html;
}

/* ── Reset Filters ──────────────────────────── */
function resetFilters() {
  filter = {search:'', teamId:'all', role:'all'};
  var s = document.getElementById('searchInput');  if(s) s.value = '';
  var t = document.getElementById('filterTeam');   if(t) t.value = 'all';
  var r = document.getElementById('filterRole');   if(r) r.value = 'all';
  renderTeamSummary();
  renderPlayers();
}

/* ── INIT ───────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function() {
  if (!MPL_AUTH.requireAuth()) return;

  /* User info */
  var user = MPL_AUTH.getUser();
  if (user) {
    document.getElementById('userName').textContent   = user.user;
    document.getElementById('userAvatar').textContent = user.user.charAt(0).toUpperCase();
  }

  /* Sidebar */
  var sidebar = document.getElementById('sidebar');
  var ovl     = document.getElementById('overlay');
  document.getElementById('mobileToggle').addEventListener('click', function(){
    sidebar.classList.toggle('open'); ovl.classList.toggle('open');
  });
  ovl.addEventListener('click', function(){
    sidebar.classList.remove('open'); ovl.classList.remove('open');
  });

  /* Logout */
  document.getElementById('logoutBtn').addEventListener('click', function(){
    if (confirm('Logout karna hai?')) MPL_AUTH.logout();
  });

  /* Teams check */
  var teams = MPL_STORAGE.getTeams();
  if (teams.length === 0) {
    var warn = document.getElementById('noTeamsWarning'); if (warn) warn.style.display = 'flex';
    var ab   = document.getElementById('addPlayerBtn');
    if (ab) { ab.disabled = true; ab.style.opacity = '0.5'; ab.style.cursor = 'not-allowed'; }
    var fab  = document.getElementById('fabAddPlayer');
    if (fab) { fab.disabled = true; fab.style.opacity = '0.5'; }
  }

  /* Fill filter team dropdown */
  var ftEl = document.getElementById('filterTeam');
  if (ftEl) {
    var opts = '<option value="all">All Teams</option>';
    teams.forEach(function(t){ opts += '<option value="'+t.id+'">'+xh(t.name)+'</option>'; });
    opts += '<option value="none">⚠️ No Team</option>';
    ftEl.innerHTML = opts;
  }

  /* Open sheet buttons */
  function tryOpen() {
    if (MPL_STORAGE.getTeams().length === 0) { toast('Pehle teams add karo!','error'); return; }
    openPlayerModal();
  }
  var ab2 = document.getElementById('addPlayerBtn');   if (ab2) ab2.addEventListener('click', tryOpen);
  var fab2 = document.getElementById('fabAddPlayer'); if (fab2) fab2.addEventListener('click', tryOpen);

  /* Close sheet */
  document.getElementById('closeSheet').addEventListener('click', closePlayerModal);
  document.getElementById('cancelSheet').addEventListener('click', closePlayerModal);
  document.getElementById('playerModal').addEventListener('click', function(e){
    if (e.target.id === 'playerModal') closePlayerModal();
  });

  /* Form submit */
  document.getElementById('playerForm').addEventListener('submit', savePlayer);

  /* Live preview inputs */
  document.getElementById('playerName').addEventListener('input', updatePreview);
  document.getElementById('playerJersey').addEventListener('input', updatePreview);
  document.getElementById('playerTeam').addEventListener('change', updatePreview);

  /* Filter listeners */
  document.getElementById('searchInput').addEventListener('input', function(e){
    filter.search = e.target.value;
    renderPlayers();
  });
  if (ftEl) {
    ftEl.addEventListener('change', function(e){
      filter.teamId = e.target.value;
      renderTeamSummary();
      renderPlayers();
    });
  }
  document.getElementById('filterRole').addEventListener('change', function(e){
    filter.role = e.target.value;
    renderPlayers();
  });
  document.getElementById('resetFilters').addEventListener('click', resetFilters);

  /* Esc */
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') closePlayerModal();
  });

  /* Initial render */
  renderTeamSummary();
  renderPlayers();
});

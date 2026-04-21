/* ============================================
   MPL ADMIN - Teams Management
   BUG FIX: editTeam(id) replaces JSON.stringify onclick
   ============================================ */

const TEAM_COLORS = [
  { name:'Red',    value:'#E63946', gradient:'linear-gradient(135deg,#E63946 0%,#8B0000 100%)' },
  { name:'Blue',   value:'#1D4ED8', gradient:'linear-gradient(135deg,#1D4ED8 0%,#0C2D6B 100%)' },
  { name:'Gold',   value:'#F5A623', gradient:'linear-gradient(135deg,#F5A623 0%,#B8791A 100%)' },
  { name:'Green',  value:'#10B981', gradient:'linear-gradient(135deg,#10B981 0%,#065F46 100%)' },
  { name:'Purple', value:'#8B5CF6', gradient:'linear-gradient(135deg,#8B5CF6 0%,#4C1D95 100%)' },
  { name:'Orange', value:'#F97316', gradient:'linear-gradient(135deg,#F97316 0%,#9A3412 100%)' },
  { name:'Pink',   value:'#EC4899', gradient:'linear-gradient(135deg,#EC4899 0%,#831843 100%)' },
  { name:'Cyan',   value:'#06B6D4', gradient:'linear-gradient(135deg,#06B6D4 0%,#155E75 100%)' },
  { name:'Maroon', value:'#9F1239', gradient:'linear-gradient(135deg,#9F1239 0%,#4C0519 100%)' },
  { name:'Teal',   value:'#14B8A6', gradient:'linear-gradient(135deg,#14B8A6 0%,#134E4A 100%)' },
  { name:'Indigo', value:'#6366F1', gradient:'linear-gradient(135deg,#6366F1 0%,#312E81 100%)' },
  { name:'Lime',   value:'#84CC16', gradient:'linear-gradient(135deg,#84CC16 0%,#365314 100%)' }
];

let editingTeamId = null;

// ---------- Toast ----------
function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

// ---------- Escape HTML ----------
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// ---------- Get gradient from color ----------
function getGradient(colorValue) {
  const found = TEAM_COLORS.find(c => c.value === colorValue);
  return found ? found.gradient : `linear-gradient(135deg,${colorValue} 0%,#222 100%)`;
}

// ============================================================
// BUG FIX: editTeam(id) — safe alternative to inline JSON
// ============================================================
function editTeam(id) {
  const team = MPL_STORAGE.getTeams().find(t => t.id === id);
  if (team) openTeamModal(team);
}

// ---------- Render Color Picker ----------
function renderColorPicker(selectedColor) {
  const picker = document.getElementById('colorPicker');
  picker.innerHTML = '';

  TEAM_COLORS.forEach(c => {
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    swatch.style.background = c.gradient;
    swatch.dataset.color = c.value;
    swatch.title = c.name;
    if (c.value === selectedColor) swatch.classList.add('selected');

    swatch.addEventListener('click', () => {
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      swatch.classList.add('selected');
      document.getElementById('teamColor').value = c.value;
      updatePreview();
    });

    picker.appendChild(swatch);
  });
}

// ---------- Update Preview ----------
function updatePreview() {
  const name  = document.getElementById('teamName').value.trim()  || 'TEAM NAME';
  const owner = document.getElementById('teamOwner').value.trim() || 'Owner Name';
  const code  = document.getElementById('teamCode').value.trim().toUpperCase() || 'TN';
  const color = document.getElementById('teamColor').value;

  const preview = document.getElementById('teamPreview');
  preview.style.background = getGradient(color);
  document.getElementById('previewLogo').textContent  = code.substring(0, 3);
  document.getElementById('previewName').textContent  = name;
  document.getElementById('previewOwner').textContent = `Owner: ${owner}`;
}

// ---------- Auto generate code from name ----------
function autoGenerateCode() {
  const name      = document.getElementById('teamName').value.trim();
  const codeInput = document.getElementById('teamCode');
  if (!codeInput.dataset.manual) {
    codeInput.value = name.split(/\s+/).map(w => w.charAt(0)).join('').toUpperCase().substring(0, 3);
  }
  updatePreview();
}

// ---------- Open Modal ----------
function openTeamModal(team = null) {
  editingTeamId = team ? team.id : null;
  document.getElementById('modalTitle').textContent    = team ? 'EDIT TEAM' : 'ADD NEW TEAM';
  document.getElementById('teamName').value    = team ? team.name    : '';
  document.getElementById('teamOwner').value   = team ? team.owner   : '';
  document.getElementById('teamCode').value    = team ? team.code    : '';
  document.getElementById('teamCaptain').value = team ? (team.captain || '') : '';
  document.getElementById('teamColor').value   = team ? team.color   : TEAM_COLORS[0].value;

  document.getElementById('teamCode').dataset.manual = team ? '1' : '';
  renderColorPicker(team ? team.color : TEAM_COLORS[0].value);
  updatePreview();

  document.getElementById('teamModal').classList.add('show');
  setTimeout(() => document.getElementById('teamName').focus(), 100);
}

// ---------- Close Modal ----------
function closeTeamModal() {
  document.getElementById('teamModal').classList.remove('show');
  editingTeamId = null;
}

// ---------- Save Team ----------
function saveTeam(e) {
  e.preventDefault();

  const name    = document.getElementById('teamName').value.trim();
  const owner   = document.getElementById('teamOwner').value.trim();
  const code    = document.getElementById('teamCode').value.trim().toUpperCase();
  const captain = document.getElementById('teamCaptain').value.trim();
  const color   = document.getElementById('teamColor').value;

  if (!name)  return showToast('Team ka naam daalo!', 'error');
  if (!owner) return showToast('Owner ka naam daalo!', 'error');
  if (!code || code.length < 2 || code.length > 4) {
    return showToast('Team code 2-4 letters ka hona chahiye!', 'error');
  }

  const teams = MPL_STORAGE.getTeams();
  const dup   = teams.find(t => t.code === code && t.id !== editingTeamId);
  if (dup) return showToast(`Code "${code}" already used by ${dup.name}!`, 'error');

  if (!editingTeamId && teams.length >= 6) {
    return showToast('Max 6 teams allowed!', 'error');
  }

  if (editingTeamId) {
    const idx = teams.findIndex(t => t.id === editingTeamId);
    if (idx !== -1) {
      teams[idx] = { ...teams[idx], name, owner, code, captain, color, updatedAt: Date.now() };
      MPL_STORAGE.saveTeams(teams);
      showToast(`"${name}" updated!`, 'success');
    }
  } else {
    const newTeam = {
      id: MPL_STORAGE.generateId('team'),
      name, owner, code, captain, color,
      season: MPL_STORAGE.getCurrentSeason(),
      stats: { matches:0, wins:0, losses:0, nr:0, points:0, nrr:0 },
      createdAt: Date.now()
    };
    teams.push(newTeam);
    MPL_STORAGE.saveTeams(teams);
    showToast(`"${name}" added!`, 'success');
  }

  closeTeamModal();
  renderTeams();
}

// ---------- Delete Team ----------
function deleteTeam(id) {
  const teams  = MPL_STORAGE.getTeams();
  const team   = teams.find(t => t.id === id);
  if (!team) return;

  const players  = MPL_STORAGE.getPlayers();
  const assigned = players.filter(p => p.teamId === id);

  let msg = `"${team.name}" delete karna hai?`;
  if (assigned.length > 0) {
    msg += `\n\n⚠️ Warning: ${assigned.length} player(s) is team mein hain. Unka team removed ho jayega.`;
  }
  if (!confirm(msg)) return;

  MPL_STORAGE.saveTeams(teams.filter(t => t.id !== id));
  if (assigned.length > 0) {
    MPL_STORAGE.savePlayers(players.map(p => p.teamId === id ? { ...p, teamId: null } : p));
  }

  showToast(`"${team.name}" deleted!`, 'success');
  renderTeams();
}

// ---------- Render Teams ----------
function renderTeams() {
  const teams   = MPL_STORAGE.getTeams();
  const grid    = document.getElementById('teamsGrid');
  const counter = document.getElementById('teamCounter');

  counter.innerHTML = `<span>${teams.length}</span> / 6 Teams`;

  if (teams.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="big-icon">🛡️</div>
        <h3>NO TEAMS YET</h3>
        <p>Start by adding your first team. You need 6 teams for MPL.</p>
        <button class="btn btn-primary" onclick="openTeamModal()">➕ ADD FIRST TEAM</button>
      </div>`;
    return;
  }

  const players      = MPL_STORAGE.getPlayers();
  const playerCounts = {};
  players.forEach(p => {
    if (p.teamId) playerCounts[p.teamId] = (playerCounts[p.teamId] || 0) + 1;
  });

  // ✅ FIX: Use editTeam(id) instead of JSON.stringify inline
  grid.innerHTML = teams.map(team => `
    <div class="admin-team-card">
      <div class="team-card-banner" style="background:${getGradient(team.color)};">
        <div class="team-logo-circle">${team.code}</div>
      </div>
      <div class="team-card-body">
        <h3 class="team-card-title">${escapeHtml(team.name)}</h3>
        <div class="team-card-owner-row">
          <span>👤 Owner:</span>
          <strong>${escapeHtml(team.owner)}</strong>
        </div>
        ${team.captain ? `
          <div class="team-card-owner-row" style="margin-top:-10px;">
            <span>🎯 Captain:</span>
            <strong>${escapeHtml(team.captain)}</strong>
          </div>` : ''}
        <div class="team-card-meta">
          <div class="meta-item">
            <div class="meta-num">${playerCounts[team.id] || 0}</div>
            <div class="meta-label">Players</div>
          </div>
          <div class="meta-item">
            <div class="meta-num">${team.stats?.wins || 0}</div>
            <div class="meta-label">Wins</div>
          </div>
          <div class="meta-item">
            <div class="meta-num">${team.stats?.points || 0}</div>
            <div class="meta-label">Points</div>
          </div>
        </div>
        <div class="team-card-actions">
          <button class="btn btn-outline btn-small" onclick="editTeam('${team.id}')">
            ✏️ EDIT
          </button>
          <button class="btn btn-danger btn-small" onclick="deleteTeam('${team.id}')">
            🗑️ DELETE
          </button>
        </div>
      </div>
    </div>`).join('');
}

// ---------- Init ----------
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
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  });
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    if (confirm('Logout karna hai?')) MPL_AUTH.logout();
  });

  document.getElementById('addTeamBtn').addEventListener('click', () => openTeamModal());

  document.getElementById('closeModal').addEventListener('click', closeTeamModal);
  document.getElementById('cancelBtn').addEventListener('click', closeTeamModal);
  document.getElementById('teamModal').addEventListener('click', e => {
    if (e.target.id === 'teamModal') closeTeamModal();
  });

  document.getElementById('teamForm').addEventListener('submit', saveTeam);
  document.getElementById('teamName').addEventListener('input', autoGenerateCode);
  document.getElementById('teamOwner').addEventListener('input', updatePreview);
  document.getElementById('teamCode').addEventListener('input', e => {
    e.target.dataset.manual = '1';
    e.target.value = e.target.value.toUpperCase();
    updatePreview();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeTeamModal();
  });

  renderTeams();
});

/* ============================================================
   MPL — storage.js  v2.0
   Hybrid: localStorage (primary) + Google Sheets (cloud sync)
   ============================================================ */

var MPL_STORAGE = (function () {
  'use strict';

  var KEYS = {
    AUTH:     'mpl_auth',
    TEAMS:    'mpl_teams',
    PLAYERS:  'mpl_players',
    MATCHES:  'mpl_matches',
    BALLS:    'mpl_balls',
    SEASON:   'mpl_current_season',
    SETTINGS: 'mpl_settings',
    POTM:     'mpl_potm'          // Player of the Match records
  };

  /* ── Generic localStorage helpers ─────────── */
  function get(key, def) {
    try {
      var d = localStorage.getItem(key);
      return d ? JSON.parse(d) : (def !== undefined ? def : null);
    } catch (e) { console.error('Storage read:', e); return def !== undefined ? def : null; }
  }

  function set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { console.error('Storage write:', e); return false; }
  }

  function remove(key) { localStorage.removeItem(key); }

  /* ── Sync helper: save locally + queue Sheets push ─── */
  function saveAndSync(key, collection, value) {
    set(key, value);
    // Push to Sheets asynchronously (non-blocking)
    if (typeof SHEETS_API !== 'undefined' && SHEETS_API.isConfigured()) {
      setTimeout(function () {
        SHEETS_API.push(collection, value);
      }, 100);
    }
  }

  /* ── Public API ─────────────────────────────── */
  var api = {

    KEYS: KEYS,

    get: get,
    set: set,
    remove: remove,

    /* ── TEAMS ── */
    getTeams:  function ()      { return get(KEYS.TEAMS,   []); },
    saveTeams: function (teams) { saveAndSync(KEYS.TEAMS, 'teams', teams); },

    /* ── PLAYERS ── */
    getPlayers:  function ()        { return get(KEYS.PLAYERS, []); },
    savePlayers: function (players) { saveAndSync(KEYS.PLAYERS, 'players', players); },

    /* ── MATCHES ── */
    getMatches:  function ()        { return get(KEYS.MATCHES, []); },
    saveMatches: function (matches) { saveAndSync(KEYS.MATCHES, 'matches', matches); },

    /* ── BALL-BY-BALL ── */
    getBalls: function (matchId) {
      var all = get(KEYS.BALLS, {});
      return all[matchId] || [];
    },
    saveBalls: function (matchId, balls) {
      var all = get(KEYS.BALLS, {});
      all[matchId] = balls;
      set(KEYS.BALLS, all);
      // Balls data is large — don't sync to Sheets automatically
    },

    /* ── SEASON ── */
    getCurrentSeason: function ()      { return get(KEYS.SEASON, 1); },
    setCurrentSeason: function (s)     { saveAndSync(KEYS.SEASON, 'season', s); },

    /* ── SETTINGS ── */
    getSettings: function ()     { return get(KEYS.SETTINGS, {}); },
    saveSettings: function (s)   { saveAndSync(KEYS.SETTINGS, 'settings', s); },

    /* ── POTM (Player of the Match) ── */
    getPOTMRecords: function ()      { return get(KEYS.POTM, []); },
    savePOTMRecord: function (record) {
      var records = api.getPOTMRecords();
      // Remove existing record for same match
      records = records.filter(function (r) { return r.matchId !== record.matchId; });
      records.push(record);
      set(KEYS.POTM, records);
    },

    /* ── PHOTO STORAGE ── */
    savePhoto: function (entityId, base64) {
      // Resize + compress before storing
      var photos = get('mpl_photos', {});
      photos[entityId] = base64;
      set('mpl_photos', photos);
    },
    getPhoto: function (entityId) {
      var photos = get('mpl_photos', {});
      return photos[entityId] || null;
    },
    deletePhoto: function (entityId) {
      var photos = get('mpl_photos', {});
      delete photos[entityId];
      set('mpl_photos', photos);
    },

    /* ── Generate unique ID ── */
    generateId: function (prefix) {
      prefix = prefix || 'id';
      return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    },

    /* ── Dashboard stats ── */
    getDashboardStats: function () {
      var teams   = api.getTeams();
      var players = api.getPlayers();
      var matches = api.getMatches();
      return {
        totalTeams:       teams.length,
        totalPlayers:     players.length,
        totalMatches:     matches.length,
        completedMatches: matches.filter(function (m) { return m.status === 'completed'; }).length,
        upcomingMatches:  matches.filter(function (m) { return m.status === 'upcoming';  }).length,
        liveMatches:      matches.filter(function (m) { return m.status === 'live';       }).length,
        currentSeason:    api.getCurrentSeason()
      };
    },

    /* ── Points Table with NRR ── */
    getPointsTable: function () {
      var teams   = api.getTeams();
      var matches = api.getMatches().filter(function (m) { return m.status === 'completed'; });

      var table = {};
      teams.forEach(function (t) {
        table[t.id] = {
          team:     t,
          played:   0,
          won:      0,
          lost:     0,
          nr:       0,
          points:   0,
          runsFor:  0,
          ballsFor: 0,
          runsAgainst:  0,
          ballsAgainst: 0,
          nrr:      0,
          lastFive: []
        };
      });

      matches.forEach(function (m) {
        var rowA = table[m.teamAId];
        var rowB = table[m.teamBId];
        if (!rowA || !rowB) return;

        rowA.played++;
        rowB.played++;

        // Innings data (saved by scoring engine)
        var inn1 = m.innings1Summary; // {runs, balls, wickets}
        var inn2 = m.innings2Summary;

        if (inn1 && inn2) {
          // Team A batted first
          rowA.runsFor     += inn1.runs;
          rowA.ballsFor    += inn1.balls;
          rowA.runsAgainst += inn2.runs;
          rowA.ballsAgainst += inn2.balls;

          rowB.runsFor     += inn2.runs;
          rowB.ballsFor    += inn2.balls;
          rowB.runsAgainst += inn1.runs;
          rowB.ballsAgainst += inn1.balls;
        }

        var result = m.winnerId === m.teamAId ? 'W' : m.winnerId === m.teamBId ? 'L' : 'NR';

        if (m.winnerId === m.teamAId) {
          rowA.won++;    rowA.points += 2; rowA.lastFive.push('W');
          rowB.lost++;                     rowB.lastFive.push('L');
        } else if (m.winnerId === m.teamBId) {
          rowB.won++;    rowB.points += 2; rowB.lastFive.push('W');
          rowA.lost++;                     rowA.lastFive.push('L');
        } else {
          rowA.nr++; rowA.points++; rowA.lastFive.push('NR');
          rowB.nr++; rowB.points++; rowB.lastFive.push('NR');
        }
      });

      // Calculate NRR
      Object.keys(table).forEach(function (id) {
        var r = table[id];
        var rpo_for     = r.ballsFor     > 0 ? (r.runsFor     / (r.ballsFor     / 6)) : 0;
        var rpo_against = r.ballsAgainst > 0 ? (r.runsAgainst / (r.ballsAgainst / 6)) : 0;
        r.nrr = (rpo_for - rpo_against).toFixed(3);
        // Keep only last 5
        r.lastFive = r.lastFive.slice(-5);
      });

      // Sort: points DESC → NRR DESC → wins DESC
      return Object.values(table).sort(function (a, b) {
        if (b.points !== a.points) return b.points - a.points;
        if (parseFloat(b.nrr) !== parseFloat(a.nrr)) return parseFloat(b.nrr) - parseFloat(a.nrr);
        return b.won - a.won;
      });
    },

    /* ── Orange Cap (Top batsmen) ── */
    getOrangeCap: function () {
      return api.getPlayers()
        .filter(function (p) { return p.stats && p.stats.batting && p.stats.batting.runs > 0; })
        .map(function (p) {
          var b = p.stats.batting;
          return {
            player:     p,
            runs:       b.runs || 0,
            innings:    b.innings || 0,
            balls:      b.balls || 0,
            fours:      b.fours || 0,
            sixes:      b.sixes || 0,
            highest:    b.highest || 0,
            average:    b.innings > 0 ? (b.runs / (b.innings - (b.notOuts || 0)) || b.runs).toFixed(1) : '—',
            strikeRate: b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0',
            fifties:    b.fifties || 0,
            hundreds:   b.hundreds || 0
          };
        })
        .sort(function (a, b) { return b.runs - a.runs; });
    },

    /* ── Purple Cap (Top bowlers) ── */
    getPurpleCap: function () {
      return api.getPlayers()
        .filter(function (p) { return p.stats && p.stats.bowling && p.stats.bowling.wickets > 0; })
        .map(function (p) {
          var b = p.stats.bowling;
          var overs = b.balls > 0 ? (Math.floor(b.balls / 6) + '.' + (b.balls % 6)) : '0';
          return {
            player:      p,
            wickets:     b.wickets || 0,
            overs:       overs,
            runs:        b.runs || 0,
            economy:     b.balls > 0 ? (b.runs / (b.balls / 6)).toFixed(2) : '—',
            average:     b.wickets > 0 ? (b.runs / b.wickets).toFixed(1) : '—',
            best:        b.bestFigures || '0/0',
            fourWickets: b.fourWickets || 0,
            fiveWickets: b.fiveWickets || 0
          };
        })
        .sort(function (a, b) {
          if (b.wickets !== a.wickets) return b.wickets - a.wickets;
          return parseFloat(a.economy) - parseFloat(b.economy);
        });
    },

    /* ── Head-to-Head between two teams ── */
    getHeadToHead: function (teamAId, teamBId) {
      var matches = api.getMatches().filter(function (m) {
        return m.status === 'completed' && (
          (m.teamAId === teamAId && m.teamBId === teamBId) ||
          (m.teamAId === teamBId && m.teamBId === teamAId)
        );
      });

      var winsA = matches.filter(function (m) { return m.winnerId === teamAId; }).length;
      var winsB = matches.filter(function (m) { return m.winnerId === teamBId; }).length;
      var nr    = matches.filter(function (m) { return !m.winnerId; }).length;

      return { matches: matches, winsA: winsA, winsB: winsB, nr: nr };
    },

    /* ── Player form (last 5 innings) ── */
    getPlayerForm: function (playerId) {
      var matches = api.getMatches().filter(function (m) { return m.status === 'completed'; });
      var form    = [];

      matches.slice(-10).forEach(function (m) {
        if (!m.innings1Summary && !m.innings2Summary) return;
        // Check if player batted in this match (from POTM or ballData)
        var potm = api.getPOTMRecords().find(function (r) { return r.matchId === m.id; });
        if (potm && potm.topPerformers) {
          var pf = potm.topPerformers.find(function (p) { return p.playerId === playerId; });
          if (pf) {
            form.push({
              matchId:    m.id,
              matchNum:   m.matchNumber,
              runs:       pf.runs || 0,
              wickets:    pf.wickets || 0,
              balls:      pf.balls || 0,
              result:     m.winnerId
            });
          }
        }
      });

      return form.slice(-5);
    },

    /* ── Reset all (danger) ── */
    resetAll: function () {
      var keys = Object.values(KEYS);
      keys.forEach(function (k) {
        if (k !== KEYS.AUTH) remove(k);
      });
      remove('mpl_photos');
      remove('mpl_sync_queue');
    }
  };

  return api;
})();

window.MPL_STORAGE = MPL_STORAGE;

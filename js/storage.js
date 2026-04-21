/* ============================================================
   MPL PUBLIC STORAGE — js/storage.js
   Public website pages ke liye read-only data access
   Admin panel wala data (localStorage) yahan se read hota hai
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
    POTM:     'mpl_potm'
  };

  /* ── Generic read ── */
  function get(key, defaultVal) {
    try {
      var d = localStorage.getItem(key);
      return d ? JSON.parse(d) : (defaultVal !== undefined ? defaultVal : null);
    } catch (e) {
      return defaultVal !== undefined ? defaultVal : null;
    }
  }

  /* ── Generic write (admin pages ke liye, public ignore kar sakta hai) ── */
  function set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }

  var api = {

    KEYS: KEYS,
    get: get,
    set: set,

    /* ── TEAMS ── */
    getTeams: function () { return get(KEYS.TEAMS, []); },
    saveTeams: function (t) { return set(KEYS.TEAMS, t); },

    /* ── PLAYERS ── */
    getPlayers: function () { return get(KEYS.PLAYERS, []); },
    savePlayers: function (p) { return set(KEYS.PLAYERS, p); },

    /* ── MATCHES ── */
    getMatches: function () { return get(KEYS.MATCHES, []); },
    saveMatches: function (m) { return set(KEYS.MATCHES, m); },

    /* ── BALLS ── */
    getBalls: function (matchId) {
      var all = get(KEYS.BALLS, {});
      return all[matchId] || [];
    },

    /* ── SEASON ── */
    getCurrentSeason: function () { return get(KEYS.SEASON, 1); },
    setCurrentSeason: function (s) { return set(KEYS.SEASON, s); },

    /* ── SETTINGS ── */
    getSettings: function () { return get(KEYS.SETTINGS, {}); },

    /* ── POTM ── */
    getPOTMRecords: function () { return get(KEYS.POTM, []); },

    /* ── PHOTO ── */
    getPhoto: function (entityId) {
      var photos = get('mpl_photos', {});
      return photos[entityId] || null;
    },

    /* ── Generate ID ── */
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
        liveMatches:      matches.filter(function (m) { return m.status === 'live';      }).length,
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
          team: t,
          played: 0, won: 0, lost: 0, nr: 0, points: 0,
          runsFor: 0, ballsFor: 0, runsAgainst: 0, ballsAgainst: 0,
          nrr: '0.000', lastFive: []
        };
      });

      matches.forEach(function (m) {
        var rowA = table[m.teamAId];
        var rowB = table[m.teamBId];
        if (!rowA || !rowB) return;

        rowA.played++;
        rowB.played++;

        // Innings summary data (saved by scoring engine)
        var inn1 = m.inn1Data;
        var inn2 = m.inn2Data;

        if (inn1 && inn2) {
          rowA.runsFor      += inn1.runs   || 0;
          rowA.ballsFor     += inn1.balls  || 0;
          rowA.runsAgainst  += inn2.runs   || 0;
          rowA.ballsAgainst += inn2.balls  || 0;

          rowB.runsFor      += inn2.runs   || 0;
          rowB.ballsFor     += inn2.balls  || 0;
          rowB.runsAgainst  += inn1.runs   || 0;
          rowB.ballsAgainst += inn1.balls  || 0;
        }

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

      /* Calculate NRR */
      Object.keys(table).forEach(function (id) {
        var r   = table[id];
        var rFor    = r.ballsFor     > 0 ? (r.runsFor     / (r.ballsFor     / 6)) : 0;
        var rAgainst= r.ballsAgainst > 0 ? (r.runsAgainst / (r.ballsAgainst / 6)) : 0;
        r.nrr = (rFor - rAgainst).toFixed(3);
        r.lastFive = r.lastFive.slice(-5);
      });

      return Object.values(table).sort(function (a, b) {
        if (b.points !== a.points) return b.points - a.points;
        if (parseFloat(b.nrr) !== parseFloat(a.nrr)) return parseFloat(b.nrr) - parseFloat(a.nrr);
        return b.won - a.won;
      });
    },

    /* ── Orange Cap ── */
    getOrangeCap: function () {
      return api.getPlayers()
        .filter(function (p) { return p.stats && p.stats.batting && p.stats.batting.runs > 0; })
        .map(function (p) {
          var b = p.stats.batting;
          var notOuts = b.notOuts || 0;
          var dismissals = (b.innings || 0) - notOuts;
          return {
            player:     p,
            runs:       b.runs || 0,
            innings:    b.innings || 0,
            balls:      b.balls || 0,
            fours:      b.fours || 0,
            sixes:      b.sixes || 0,
            highest:    b.highest || 0,
            average:    dismissals > 0 ? (b.runs / dismissals).toFixed(1) : (b.runs > 0 ? b.runs + '*' : '—'),
            strikeRate: b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0',
            fifties:    b.fifties  || 0,
            hundreds:   b.hundreds || 0
          };
        })
        .sort(function (a, b) { return b.runs - a.runs; });
    },

    /* ── Purple Cap ── */
    getPurpleCap: function () {
      return api.getPlayers()
        .filter(function (p) { return p.stats && p.stats.bowling && p.stats.bowling.wickets > 0; })
        .map(function (p) {
          var b = p.stats.bowling;
          return {
            player:      p,
            wickets:     b.wickets || 0,
            overs:       b.balls > 0 ? (Math.floor(b.balls / 6) + '.' + (b.balls % 6)) : '0',
            runs:        b.runs || 0,
            economy:     b.balls > 0 ? (b.runs / (b.balls / 6)).toFixed(2) : '—',
            average:     b.wickets > 0 ? (b.runs / b.wickets).toFixed(1) : '—',
            best:        b.bestFigures || '0/0',
            fiveWickets: b.fiveWickets || 0
          };
        })
        .sort(function (a, b) {
          if (b.wickets !== a.wickets) return b.wickets - a.wickets;
          return parseFloat(a.economy || 99) - parseFloat(b.economy || 99);
        });
    },

    /* ── Head-to-Head ── */
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

    /* ── Player Form ── */
    getPlayerForm: function (playerId) {
      var potmRecords = api.getPOTMRecords();
      var matches     = api.getMatches().filter(function (m) { return m.status === 'completed'; });
      var form        = [];

      matches.slice(-10).forEach(function (m) {
        var potm = potmRecords.find(function (r) { return r.matchId === m.id; });
        if (potm && potm.topPerformers) {
          var pf = potm.topPerformers.find(function (p) { return p.playerId === playerId; });
          if (pf) {
            form.push({
              matchId:  m.id,
              matchNum: m.matchNumber,
              runs:     pf.runs    || 0,
              wickets:  pf.wickets || 0,
              balls:    pf.balls   || 0,
              result:   m.winnerId
            });
          }
        }
      });
      return form.slice(-5);
    },

    /* ── Reset (admin only, keep here for compatibility) ── */
    resetAll: function () {
      Object.values(KEYS).forEach(function (k) {
        if (k !== KEYS.AUTH) localStorage.removeItem(k);
      });
      localStorage.removeItem('mpl_photos');
    }
  };

  return api;
})();

window.MPL_STORAGE = MPL_STORAGE;

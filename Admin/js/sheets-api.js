/* ============================================================
   MPL — sheets-api.js
   Google Apps Script se communicate karta hai
   Hybrid mode: localStorage primary, Sheets backup/sync
   ============================================================ */

var SHEETS_API = (function () {
  'use strict';

  var SETTINGS_KEY  = 'mpl_sheets_url';
  var SYNC_LOG_KEY  = 'mpl_sync_log';
  var SYNC_QUEUE    = 'mpl_sync_queue';

  /* ── Public API ──────────────────────────── */
  return {

    /* Get saved script URL */
    getUrl: function () {
      return localStorage.getItem(SETTINGS_KEY) || '';
    },

    /* Save script URL */
    setUrl: function (url) {
      localStorage.setItem(SETTINGS_KEY, url.trim());
    },

    /* Check if Sheets is configured */
    isConfigured: function () {
      return !!this.getUrl();
    },

    /* ── Test connection ── */
    ping: function (url) {
      url = url || this.getUrl();
      if (!url) return Promise.reject('URL not set');
      return fetch(url + '?action=ping', { method: 'GET' })
        .then(function (r) { return r.json(); })
        .catch(function () { return { success: false, error: 'Network error' }; });
    },

    /* ── Fetch ALL data from Sheets ── */
    fetchAll: function () {
      var url = this.getUrl();
      if (!url) return Promise.resolve(null);

      return fetch(url + '?action=all&t=' + Date.now())
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res.success && res.data) {
            // Merge into localStorage
            var d = res.data;
            if (d.teams   && Array.isArray(d.teams))   localStorage.setItem('mpl_teams',   JSON.stringify(d.teams));
            if (d.players && Array.isArray(d.players)) localStorage.setItem('mpl_players', JSON.stringify(d.players));
            if (d.matches && Array.isArray(d.matches)) localStorage.setItem('mpl_matches', JSON.stringify(d.matches));
            if (d.settings) localStorage.setItem('mpl_settings', JSON.stringify(d.settings));
            if (d.season !== undefined) localStorage.setItem('mpl_current_season', JSON.stringify(d.season));

            SHEETS_API._logSync('pull', 'success');
            return d;
          }
          return null;
        })
        .catch(function (err) {
          console.warn('Sheets fetch failed:', err);
          SHEETS_API._logSync('pull', 'failed: ' + err);
          return null;
        });
    },

    /* ── Push ONE collection to Sheets ── */
    push: function (collection, data) {
      var url = this.getUrl();
      if (!url) {
        // Add to offline queue
        this._addToQueue(collection, data);
        return Promise.resolve({ success: false, reason: 'offline' });
      }

      return fetch(url, {
        method: 'POST',
        body: JSON.stringify({ collection: collection, data: data }),
        headers: { 'Content-Type': 'text/plain' }  // Apps Script needs text/plain to avoid preflight
      })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res.success) {
            SHEETS_API._logSync('push:' + collection, 'success');
            // Clear from queue if it was there
            SHEETS_API._removeFromQueue(collection);
          } else {
            SHEETS_API._addToQueue(collection, data);
          }
          return res;
        })
        .catch(function (err) {
          console.warn('Sheets push failed:', err);
          SHEETS_API._addToQueue(collection, data);
          SHEETS_API._logSync('push:' + collection, 'failed: ' + err);
          return { success: false, error: err.toString() };
        });
    },

    /* ── Push ALL collections ── */
    pushAll: function () {
      var self = this;
      var collections = {
        teams:   JSON.parse(localStorage.getItem('mpl_teams')   || '[]'),
        players: JSON.parse(localStorage.getItem('mpl_players') || '[]'),
        matches: JSON.parse(localStorage.getItem('mpl_matches') || '[]'),
        settings: JSON.parse(localStorage.getItem('mpl_settings') || '{}'),
        season:  JSON.parse(localStorage.getItem('mpl_current_season') || '1')
      };

      var promises = Object.keys(collections).map(function (col) {
        return self.push(col, collections[col]);
      });

      return Promise.all(promises);
    },

    /* ── Retry offline queue ── */
    flushQueue: function () {
      var queue = this._getQueue();
      if (!Object.keys(queue).length) return;

      var self = this;
      Object.keys(queue).forEach(function (col) {
        self.push(col, queue[col]).then(function (res) {
          if (res.success) console.log('Flushed queue:', col);
        });
      });
    },

    /* ── Sync status ── */
    getStatus: function () {
      var log   = JSON.parse(localStorage.getItem(SYNC_LOG_KEY) || '[]');
      var queue = this._getQueue();
      return {
        lastSync: log.length ? log[log.length - 1] : null,
        queuedItems: Object.keys(queue).length,
        isConfigured: this.isConfigured(),
        log: log.slice(-10)
      };
    },

    /* ── Private: Sync log ── */
    _logSync: function (action, status) {
      var log = JSON.parse(localStorage.getItem(SYNC_LOG_KEY) || '[]');
      log.push({ action: action, status: status, time: new Date().toISOString() });
      if (log.length > 50) log = log.slice(-50);
      localStorage.setItem(SYNC_LOG_KEY, JSON.stringify(log));
    },

    /* ── Private: Offline queue ── */
    _getQueue: function () {
      try { return JSON.parse(localStorage.getItem(SYNC_QUEUE) || '{}'); } catch (e) { return {}; }
    },
    _addToQueue: function (col, data) {
      var q = this._getQueue();
      q[col] = data;
      localStorage.setItem(SYNC_QUEUE, JSON.stringify(q));
    },
    _removeFromQueue: function (col) {
      var q = this._getQueue();
      delete q[col];
      localStorage.setItem(SYNC_QUEUE, JSON.stringify(q));
    }
  };
})();

window.SHEETS_API = SHEETS_API;

/* ── Auto-flush queue when online ── */
window.addEventListener('online', function () {
  console.log('Back online — flushing sync queue...');
  SHEETS_API.flushQueue();
});

/* ── Photo resize+compress helper ── */
window.MPL_PHOTO = {
  /**
   * File input se image leke compressed base64 return karta hai
   * Max 150x150px, JPEG quality 0.7
   */
  processFile: function (file) {
    return new Promise(function (resolve, reject) {
      if (!file || !file.type.startsWith('image/')) {
        reject('Only image files allowed');
        return;
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          var canvas  = document.createElement('canvas');
          var MAX     = 150;
          var ratio   = Math.min(MAX / img.width, MAX / img.height, 1);
          canvas.width  = Math.round(img.width  * ratio);
          canvas.height = Math.round(img.height * ratio);
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
};

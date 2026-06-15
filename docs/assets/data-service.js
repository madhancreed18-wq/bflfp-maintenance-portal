/* ============================================
   BFLFP — Data Service
   Single wrapper around all SharePoint Power Automate flows.
   - Caches each dataset for the session.
   - Falls back to local JSON file if a flow URL is empty or unreachable.
   - Normalizes flow responses to match the JSON-file shape so existing
     page code (assets.js, checklists, etc.) doesn't need to know.
   ============================================ */
window.BFLFP = window.BFLFP || {};

BFLFP.data = (function () {
    'use strict';

    // ---- Flow URLs ----------------------------------------------------
    // Paste each flow's GET/POST URL here as you build them.
    // Empty string = not built yet; data-service falls back to local JSON.
    var URLS = {
        // Sprint 1
        assets:       'https://defaulte622a082d0bb441ea36413f5c69121.59.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/c5eb22368d4f43c59b82f771c7c49714/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=5Y4iD21wt9kSSsu3DC3Cjtg-g7QdWQo4VJnQVY7aKSE',

        // Sprint 2 — live now
        checklists:   'https://defaulte622a082d0bb441ea36413f5c69121.59.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/9f7a0e7376104728a7a8fd10784fe656/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=Y1Ypytw_FHEb2r_8CzqKIz7Yeyu_EAUxNib0EaCVGa0',
        aliases:      'https://defaulte622a082d0bb441ea36413f5c69121.59.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/68c72da9f563430db1cc56020fc8007b/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=ZWP7BBEl-MuaXoAlx2nTVq-Q9V2OmgyyYS4XyMMt_lU',

        // Sprint 3 — live now
        completions:  'https://defaulte622a082d0bb441ea36413f5c69121.59.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/cf60b0c3a232429da729d79de5de69f7/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=eqh_cgYFJHbkdU9hDDJZ9SNdhifRKpPzZUkBN9Ua_Xg',
        submitPM:     'https://defaulte622a082d0bb441ea36413f5c69121.59.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/2ba009492d984906af510b7dd6d1ae86/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=rrg1nULOvqfEKQVm3IaPLSUCu4L_oBknyOkIybB4jCw',
        technicians:  'https://defaulte622a082d0bb441ea36413f5c69121.59.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/478e21df7fc54bb3a382da71e7aab95a/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=lzU0kALGSschT35Not53xXyz4D3LiIneiR4UNKXzeKc',
        upsertAsset:  'https://defaulte622a082d0bb441ea36413f5c69121.59.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/30da43192fbe4095885855691a5fbf90/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=om6k5ouNRbE7233QYGxVjyQwltiMlgP7biLNG16kyBc',
        upsertSheet:  'https://defaulte622a082d0bb441ea36413f5c69121.59.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/492c95be835d4876991bfa976c18bacf/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=WtIydZqBqdGvFfYQdpjmbQ3eryXYxG-LqVjbbZTGU5A',
        upsertAlias:  'https://defaulte622a082d0bb441ea36413f5c69121.59.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/d11615ac848b42958f1f1f093b24d4d6/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=xNj94EShm05ZxGJfXrv4yP1_8SpDYyW2j6ASUsF2nlo',

        // Sprint 17 — MaintenanceLog (the canonical source for Daily / Repair / History reports)
        // Existing flow — same one maintenance-log.js / dashboard.js / reports.js use.
        maintenanceLog: 'https://e3f3e42aeed8e8578b8fbeb256cd05.92.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/761fb5647d804b62a867d1ce49124311/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=B3DKRO5DG6GO3A6Ldjfet5kNncZV1rE4geWQhCKtSEs'
    };

    // ---- Local JSON fallbacks ----------------------------------------
    // Path prefix depends on whether we're at site root (./) or in /print/ subfolder (../)
    var _rootPrefix = (location.pathname.indexOf('/print/') >= 0) ? '../' : './';
    var FALLBACK = {
        assets:         _rootPrefix + 'data/assets.json',
        checklists:     _rootPrefix + 'data/checklists.json',
        aliases:        _rootPrefix + 'data/asset_aliases.json',
        completions:    _rootPrefix + 'data/pm_completions.json',
        maintenanceLog: _rootPrefix + 'data/maintenance-log-sample.json'
    };

    // ---- Session cache ----------------------------------------------
    var cache = {};

    function timestamp() { return new Date().toISOString().slice(0, 19) + 'Z'; }

    function logSource(key, source) {
        console.log('%c[BFLFP.data] ' + key + ' loaded from ' + source,
            'color:' + (source === 'flow' ? '#16A34A' : '#F97316'));
    }

    // Normalize the flow response so it matches the JSON-file shape.
    // Power Automate Select+Response returns a plain array; assets.json
    // wraps it in {version, count, assets:[...]}.
    function normalize(key, raw) {
        if (key === 'assets') {
            if (Array.isArray(raw)) {
                return { version: 'live', generated: timestamp(), count: raw.length, assets: raw };
            }
            return raw; // already in wrapper shape
        }
        if (key === 'aliases') {
            if (Array.isArray(raw)) {
                // Flow returns [{alias, asset_id, is_ignored}, ...].
                // We split into: mappings + ignore_exact entries based on is_ignored flag.
                var m = {};
                var ignoreExact = [];
                raw.forEach(function (r) {
                    if (!r.alias) return;
                    var ignored = (r.is_ignored === true || r.is_ignored === 'true' || r.is_ignored === 'True');
                    if (ignored) {
                        ignoreExact.push(r.alias);
                    } else if (r.asset_id) {
                        m[r.alias] = r.asset_id;
                    }
                });
                return {
                    version: 'live',
                    generated: timestamp(),
                    count: raw.length,
                    aliases: m,
                    ignore_exact: ignoreExact,
                    ignore_patterns: []  // patterns still live in local JSON if needed; not exposed to SharePoint
                };
            }
            return raw;
        }
        if (key === 'completions') {
            if (Array.isArray(raw)) {
                return { version: 'live', generated: timestamp(), count: raw.length, completions: raw };
            }
            return raw;
        }
        if (key === 'maintenanceLog') {
            // Flow returns plain array of MaintenanceLog rows.
            // JSON fallback wraps them in { _meta, items:[...] }. Unify here.
            var rows = [];
            if (Array.isArray(raw)) rows = raw;
            else if (raw && Array.isArray(raw.items)) rows = raw.items;
            else if (raw && Array.isArray(raw.value)) rows = raw.value;  // OData-style envelope
            // Field aliasing: flow rows use `Machine`, sample JSON uses `MachineID`.
            // Fill whichever is missing so every page sees both.
            rows.forEach(function (r) {
                if (!r || typeof r !== 'object') return;
                if (!r.MachineID && r.Machine) r.MachineID = r.Machine;
                if (!r.Machine && r.MachineID) r.Machine = r.MachineID;
                if (!r.Title && r.Machine) r.Title = r.Machine;
            });
            return rows;
        }
        if (key === 'checklists') {
            // Flow returns: { checklists:[], tasks_flat:[], asset_to_sheets_raw:[], ... }
            // We need:     { checklists:[ {tasks:[...], ...} ], asset_to_sheets:{aid:[sheets]}, ... }
            if (!raw || typeof raw !== 'object') return raw;
            var sheets = raw.checklists || [];
            var tasks  = raw.tasks_flat || raw.tasks || [];
            var maps   = raw.asset_to_sheets_raw || [];

            // Normalize each task — frequencies handling needs to be robust because
            // Power Automate may serialize the split() result in multiple shapes:
            //   "W,M"          (plain CSV)
            //   "['W','M']"    (string with single quotes)
            //   "[\"W\",\"M\"]" (string with double quotes)
            //   ["W","M"]      (real array — ideal)
            function cleanFreqs(input) {
                var arr;
                if (Array.isArray(input)) {
                    arr = input;
                } else if (typeof input === 'string') {
                    arr = input
                        .replace(/[\[\]"'\\]/g, '')   // strip brackets and quotes
                        .split(',');
                } else {
                    arr = [];
                }
                return arr
                    .map(function (s) { return String(s).trim().toUpperCase(); })
                    .filter(Boolean)
                    .filter(function (s) { return /^[WMQSA]$/.test(s); }); // only valid codes
            }
            tasks.forEach(function (t) {
                t.frequencies = cleanFreqs(t.frequencies);
                if (typeof t.task_no === 'string') t.task_no = parseInt(t.task_no, 10) || null;
                // Trim sheet name to avoid trailing-whitespace lookup failures
                if (typeof t.sheet === 'string') t.sheet = t.sheet.trim();
            });

            // Group tasks by sheet name
            var tasksBySheet = {};
            tasks.forEach(function (t) {
                var sn = t.sheet;
                if (!sn) return;
                if (!tasksBySheet[sn]) tasksBySheet[sn] = [];
                tasksBySheet[sn].push(t);
            });
            // Sort each sheet's tasks by task_no
            Object.keys(tasksBySheet).forEach(function (sn) {
                tasksBySheet[sn].sort(function (a, b) { return (a.task_no || 0) - (b.task_no || 0); });
            });

            // Attach tasks to each sheet + normalize assets_covered.
            // Trim sheet_name + class_label to avoid trailing-whitespace lookup bugs.
            sheets.forEach(function (s) {
                if (typeof s.sheet_name === 'string')  s.sheet_name  = s.sheet_name.trim();
                if (typeof s.class_label === 'string') s.class_label = s.class_label.trim();
                s.tasks = tasksBySheet[s.sheet_name] || [];
                if (typeof s.assets_covered === 'string') {
                    s.assets_covered = s.assets_covered.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
                } else if (!Array.isArray(s.assets_covered)) {
                    s.assets_covered = [];
                }
                if (typeof s.task_count === 'string') s.task_count = parseInt(s.task_count, 10) || s.tasks.length;
                if (!s.task_count) s.task_count = s.tasks.length;
            });

            // Build asset_to_sheets map: array of {asset_id, sheet} -> {asset_id: [sheets...]}
            // Trim each sheet name to avoid trailing-whitespace mismatch with ChecklistSheets.
            var assetToSheets = {};
            maps.forEach(function (m) {
                var aid = m.asset_id ? String(m.asset_id).trim() : '';
                if (!aid) return;
                var sn = m.sheet ? String(m.sheet).trim() : '';
                if (!sn) return;
                if (!assetToSheets[aid]) assetToSheets[aid] = [];
                if (assetToSheets[aid].indexOf(sn) < 0) assetToSheets[aid].push(sn);
            });

            return {
                version: raw.version || 3,
                source: raw.source || 'SharePoint',
                doc_code: raw.doc_code || 'F-SP-ENG02-01 Rev.01',
                logo_url: raw.logo_url || 'img/bluefalo-r1.png',
                generated: raw.generated || timestamp(),
                checklist_count: sheets.length,
                task_count_total: tasks.length,
                checklists: sheets,
                asset_to_sheets: assetToSheets
            };
        }
        return raw;
    }

    function fetchRemote(url) {
        // credentials:'omit' + mode:'cors' prevents Edge/Chrome from auto-injecting
        // a Microsoft Entra Bearer token on *.powerplatform.com requests.
        // GET first; if the flow trigger is POST-only (400/405), retry as POST
        // with an empty body (same strategy as maintenance-log.js).
        return fetch(url, {
            method: 'GET',
            credentials: 'omit',
            mode: 'cors'
        }).then(function (r) {
            if (r.ok) return r.json();
            if (r.status === 400 || r.status === 405) {
                return fetch(url, {
                    method: 'POST',
                    credentials: 'omit',
                    mode: 'cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: '{}'
                }).then(function (r2) {
                    if (!r2.ok) throw new Error('HTTP ' + r2.status);
                    return r2.json();
                });
            }
            throw new Error('HTTP ' + r.status);
        });
    }
    function fetchLocal(path) {
        return fetch(path).then(function (r) {
            if (!r.ok) throw new Error('Local ' + path + ' HTTP ' + r.status);
            return r.json();
        });
    }

    function get(key) {
        if (cache[key]) return cache[key];

        var url = URLS[key];
        var fallback = FALLBACK[key];
        var p;

        if (url) {
            // Try flow first, fall back to local JSON on failure.
            p = fetchRemote(url)
                .then(function (raw) {
                    logSource(key, 'flow');
                    return normalize(key, raw);
                })
                .catch(function (err) {
                    console.warn('[BFLFP.data] flow ' + key + ' failed (' + err.message + '), falling back to local JSON');
                    if (!fallback) throw err;
                    return fetchLocal(fallback).then(function (raw) {
                        logSource(key, 'local fallback');
                        return raw;
                    });
                });
        } else if (fallback) {
            p = fetchLocal(fallback).then(function (raw) {
                logSource(key, 'local (no flow URL set)');
                return raw;
            });
        } else {
            p = Promise.reject(new Error('No flow URL and no local fallback for: ' + key));
        }

        cache[key] = p;
        return p;
    }

    // ---- Write methods (Sprint 1+) -------------------------------------
    function post(key, payload) {
        var url = URLS[key];
        if (!url) {
            return Promise.reject(new Error('Write flow ' + key + ' is not configured yet'));
        }
        return fetch(url, {
            method: 'POST',
            credentials: 'omit',     // prevent Edge/Chrome auto-Bearer injection
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload || {})
        }).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json().catch(function () { return { ok: true }; });
        }).then(function (resp) {
            // Invalidate the cached read so the next read picks up the change
            if (key === 'upsertAsset')      delete cache.assets;
            if (key === 'upsertSheet')      delete cache.checklists;
            if (key === 'upsertAlias')      delete cache.aliases;
            if (key === 'submitPM')         delete cache.completions;
            return resp;
        });
    }

    // ---- Public API ----------------------------------------------------
    return {
        // Reads
        assets:         function () { return get('assets'); },
        checklists:     function () { return get('checklists'); },
        completions:    function () { return get('completions'); },
        aliases:        function () { return get('aliases'); },
        maintenanceLog: function () { return get('maintenanceLog'); },
        technicians: function () {
            // No local JSON fallback — fall back to a hard-coded list if the flow fails
            if (cache.technicians) return cache.technicians;
            var url = URLS.technicians;
            var p = url
                ? fetchRemote(url).then(function(raw){
                    logSource('technicians', 'flow');
                    return Array.isArray(raw) ? raw : [];
                  }).catch(function(err){
                    console.warn('[BFLFP.data] technicians flow failed (' + err.message + '), falling back to default list');
                    return [
                        {name:'ธนพัฒน์'}, {name:'Madhan'}, {name:'ทัศน์พล'},
                        {name:'ณัฐพล'},  {name:'ณรงค์'},  {name:'ศิริโชค'}
                    ];
                  })
                : Promise.resolve([
                    {name:'ธนพัฒน์'}, {name:'Madhan'}, {name:'ทัศน์พล'},
                    {name:'ณัฐพล'},  {name:'ณรงค์'},  {name:'ศิริโชค'}
                ]);
            cache.technicians = p;
            return p;
        },

        // Writes
        upsertAsset: function (rec) { return post('upsertAsset', rec); },
        upsertSheet: function (rec) { return post('upsertSheet', rec); },
        upsertAlias: function (rec) { return post('upsertAlias', rec); },
        submitPM:    function (rec) { return post('submitPM',    rec); },

        // Utilities
        invalidate: function (key) { delete cache[key]; },
        clearCache: function ()    { cache = {}; },
        config:     function ()    { return { urls: URLS, fallback: FALLBACK, cached: Object.keys(cache) }; }
    };
})();

/* Backward-compat alias — some pages (home.js, daily-report.js, history.js,
   repair-reports.js) reference window.BFLFP_Data instead of BFLFP.data. */
window.BFLFP_Data = window.BFLFP.data;

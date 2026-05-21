/* ============================================
   BFLFP MAINTENANCE LOG — JS
   Live data from Power Automate flow
   + Asset Resolver integration (canonical names)
   + Map-to-Asset edit mode (localhost or ?edit=1)
   ============================================ */

(function() {
    'use strict';

    var DATA_URL = 'https://e3f3e42aeed8e8578b8fbeb256cd05.92.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/761fb5647d804b62a867d1ce49124311/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=B3DKRO5DG6GO3A6Ldjfet5kNncZV1rE4geWQhCKtSEs';

    var STATE = {
        raw: [],
        filtered: [],
        page: 1,
        pageSize: 50,
        sortKey: 'StartTime',
        sortDir: 'desc',
        resolved: false
    };

    function isEditMode() {
        var h = location.hostname;
        if (h === 'localhost' || h === '127.0.0.1' || h === '') return true;
        return /[?&]edit=1\b/.test(location.search);
    }
    var EDIT_MODE = isEditMode();
    var aliasMapTarget = null;

    function $(id) { return document.getElementById(id); }
    function safeText(v) { return (v === null || v === undefined) ? '' : String(v); }
    function escapeHTML(s) { return String(s).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
    function unique(arr) {
        var seen = {}; var out = [];
        for (var i=0;i<arr.length;i++) { if (arr[i] && !seen[arr[i]]) { seen[arr[i]] = 1; out.push(arr[i]); } }
        return out.sort();
    }
    function hours(start, end) {
        if (!start || !end) return null;
        var a = new Date(start).getTime(), b = new Date(end).getTime();
        if (isNaN(a) || isNaN(b)) return null;
        return Math.max(0, (b - a) / 3600000);
    }
    function fmtHours(h) {
        if (h === null || h === undefined || isNaN(h)) return '—';
        if (h < 1) return (h * 60).toFixed(0) + 'm';
        if (h < 24) return h.toFixed(1) + 'h';
        return (h / 24).toFixed(1) + 'd';
    }
    function fmtDate(s) {
        if (!s) return '—';
        var d = new Date(s);
        if (isNaN(d)) return safeText(s);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    function fmtDateTime(s) {
        if (!s) return '—';
        var d = new Date(s);
        if (isNaN(d)) return safeText(s);
        return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    function normStatus(s) {
        var x = (s || '').toString().toLowerCase().trim();
        if (x === 'done' || x === 'closed' || x === 'completed') return 'Done';
        if (x === 'open' || x === 'new') return 'Open';
        if (x.indexOf('progress') >= 0) return 'In Progress';
        if (x === 'pending' || x === 'waiting') return 'Pending';
        if (x === 'cancelled' || x === 'canceled') return 'Cancelled';
        return s || '—';
    }
    function priorityClass(p) {
        var x = (p || '').toString().toLowerCase();
        if (x === 'high' || x === 'critical' || x === 'urgent') return 'pill-pri-high';
        if (x === 'medium' || x === 'normal') return 'pill-pri-medium';
        if (x === 'low') return 'pill-pri-low';
        return 'pill-pri-default';
    }
    function statusClass(s) {
        var n = normStatus(s).toLowerCase();
        if (n === 'done') return 'pill-st-done';
        if (n === 'open') return 'pill-st-open';
        if (n === 'in progress') return 'pill-st-progress';
        return 'pill-st-default';
    }

    function ensureResolver() {
        if (window.BFLFP_Resolver) return Promise.resolve();
        return new Promise(function(resolve, reject){
            if (document.querySelector('script[data-bflfp-resolver]')) {
                var tries = 0;
                var poll = setInterval(function(){
                    if (window.BFLFP_Resolver) { clearInterval(poll); resolve(); }
                    else if (++tries > 50) { clearInterval(poll); reject(new Error('Resolver load timeout')); }
                }, 100);
                return;
            }
            var s = document.createElement('script');
            s.src = 'assets/asset-resolver.js?v=' + Date.now();
            s.dataset.bflfpResolver = '1';
            s.onload = function(){ resolve(); };
            s.onerror = function(){ reject(new Error('Failed to load asset-resolver.js')); };
            document.head.appendChild(s);
        });
    }
    function loadResolverData() {
        return ensureResolver().then(function(){
            return window.BFLFP_Resolver.load('./data');
        }).then(function(stats){
            STATE.resolved = true;
            console.log('[MaintenanceLog] Resolver loaded:', stats);
        }).catch(function(err){
            console.warn('[MaintenanceLog] Resolver unavailable:', err);
            STATE.resolved = false;
        });
    }
    function resolveMachine(raw) {
        if (!STATE.resolved || !window.BFLFP_Resolver) {
            return { status: 'unknown', asset_id: null, canonical_name: null, raw: raw };
        }
        return window.BFLFP_Resolver.resolve(raw);
    }

    function normalizePayload(p) {
        if (!p) return [];
        if (typeof p === 'string') { try { p = JSON.parse(p); } catch (e) { return []; } }
        if (Array.isArray(p)) return p;
        if (typeof p === 'object' && (p.JobID || p.jobID)) return [p];
        var keys = ['response','Response','value','jobs','data','results','items','records','body','Body','Result','output','payload'];
        for (var i=0;i<keys.length;i++) {
            var v = p[keys[i]];
            if (Array.isArray(v)) return v;
            if (typeof v === 'string') {
                try {
                    var parsed = JSON.parse(v);
                    if (Array.isArray(parsed)) return parsed;
                    if (parsed && typeof parsed === 'object') {
                        var inner = normalizePayload(parsed);
                        if (inner.length) return inner;
                    }
                } catch (_) {}
            }
            if (v && typeof v === 'object') {
                var nested = normalizePayload(v);
                if (nested.length) return nested;
            }
        }
        function find(obj, depth) {
            if (!obj || depth > 4) return null;
            if (Array.isArray(obj)) {
                if (!obj.length) return null;
                var f = obj[0];
                if (f && typeof f === 'object') {
                    var ks = Object.keys(f).map(function(k){ return k.toLowerCase(); });
                    if (ks.indexOf('jobid') >= 0 || ks.indexOf('machine') >= 0) return obj;
                }
                return null;
            }
            if (typeof obj === 'object') {
                for (var k in obj) {
                    if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
                    var found = find(obj[k], depth + 1);
                    if (found) return found;
                }
            }
            return null;
        }
        return find(p, 0) || [];
    }

    function show(which) {
        $('mlog-loading').style.display = (which === 'loading') ? 'block' : 'none';
        $('mlog-error').style.display   = (which === 'error')   ? 'block' : 'none';
        $('mlog-main').style.display    = (which === 'ready')   ? 'block' : 'none';
    }

    function fetchData() {
        show('loading');
        function p() { return fetch(DATA_URL, { method: 'POST', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }, body: '{}' }); }
        function g() { return fetch(DATA_URL, { method: 'GET', headers: { 'Accept': 'application/json' } }); }
        Promise.all([
            loadResolverData(),
            p().then(function(r){
                if (r.ok) return r;
                if (r.status === 400 || r.status === 405) return g();
                throw new Error('HTTP ' + r.status);
            }).then(function(r){
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
        ]).then(function(both){
            STATE.raw = normalizePayload(both[1]);
            if (!STATE.raw.length) throw new Error('No records returned from flow.');
            populateFilters();
            applyFilters();
            show('ready');
        }).catch(function(err){
            console.error('[MaintenanceLog]', err);
            $('mlog-error-msg').textContent = 'Could not load data: ' + err.message;
            show('error');
        });
    }

    function populateFilters() {
        function fill(id, values) {
            var sel = $(id);
            if (!sel) return;
            var current = sel.value;
            sel.length = 1;
            values.forEach(function(v){
                var o = document.createElement('option');
                o.value = v; o.textContent = v;
                sel.appendChild(o);
            });
            if (current && values.indexOf(current) >= 0) sel.value = current;
        }
        fill('mlog-status',   unique(STATE.raw.map(function(j){ return normStatus(j.Status); })));
        fill('mlog-jobtype',  unique(STATE.raw.map(function(j){ return j.JobType; })));
        fill('mlog-priority', unique(STATE.raw.map(function(j){ return j.Priority; })));

        var canonicals = {};
        var otherCount = 0;
        STATE.raw.forEach(function(j){
            var r = resolveMachine(j.Machine);
            if (r.status === 'matched') canonicals[r.canonical_name] = true;
            else if (r.status === 'other') otherCount += 1;
        });
        fill('mlog-machine', Object.keys(canonicals).sort());
        if (otherCount > 0) {
            var o = document.createElement('option');
            o.value = '__OTHER__';
            o.textContent = '⚠ Other / Unmapped (' + otherCount + ')';
            $('mlog-machine').appendChild(o);
        }

        var otherPill = $('mlog-other-count');
        if (otherPill) {
            if (otherCount > 0) {
                otherPill.style.display = '';
                otherPill.textContent = '⚠ ' + otherCount + ' unmapped';
            } else {
                otherPill.style.display = 'none';
            }
        }
    }

    function readFilters() {
        return {
            search: ($('mlog-search').value || '').trim().toLowerCase(),
            status: $('mlog-status').value,
            jobtype: $('mlog-jobtype').value,
            priority: $('mlog-priority').value,
            machine: $('mlog-machine').value,
            mapstatus: ($('mlog-mapstatus') ? $('mlog-mapstatus').value : ''),
            from: $('mlog-datefrom').value,
            to:   $('mlog-dateto').value
        };
    }

    function applyFilters() {
        var f = readFilters();
        var fromT = f.from ? new Date(f.from).getTime() : null;
        var toT   = f.to   ? new Date(f.to).getTime() + 86400000 - 1 : null;
        STATE.filtered = STATE.raw.filter(function(j){
            var r = resolveMachine(j.Machine);
            if (f.status && normStatus(j.Status) !== f.status) return false;
            if (f.jobtype && j.JobType !== f.jobtype) return false;
            if (f.priority && j.Priority !== f.priority) return false;
            if (f.machine === '__OTHER__') {
                if (r.status !== 'other') return false;
            } else if (f.machine) {
                if (r.canonical_name !== f.machine) return false;
            }
            if (f.mapstatus && r.status !== f.mapstatus) return false;
            var ref = j.StartTime || j.Created;
            if (fromT && ref) { var t = new Date(ref).getTime(); if (isNaN(t) || t < fromT) return false; }
            if (toT && ref)   { var t2 = new Date(ref).getTime(); if (isNaN(t2) || t2 > toT) return false; }
            if (f.search) {
                var blob = [j.JobID, j.Machine, r.canonical_name, j.RootCause, j.Solution, j.Problem, j.ActionBy, j.AssignedTo, j.JobType, j.Priority]
                    .map(safeText).join(' ').toLowerCase();
                if (blob.indexOf(f.search) < 0) return false;
            }
            return true;
        });
        STATE.page = 1;
        renderActiveFilters(f);
        renderTable();
    }

    function renderActiveFilters(f) {
        var el = $('mlog-active-filters'); if (!el) return;
        var chips = [];
        if (f.search) chips.push(chip('Search: "' + f.search + '"'));
        if (f.status) chips.push(chip('Status: ' + f.status));
        if (f.jobtype) chips.push(chip('Type: ' + f.jobtype));
        if (f.priority) chips.push(chip('Priority: ' + f.priority));
        if (f.machine) chips.push(chip('Machine: ' + (f.machine === '__OTHER__' ? 'Other / Unmapped' : f.machine)));
        if (f.mapstatus) chips.push(chip('Map Status: ' + f.mapstatus));
        if (f.from) chips.push(chip('From: ' + f.from));
        if (f.to)   chips.push(chip('To: ' + f.to));
        el.innerHTML = chips.length ? '<span style="font-weight:500">Active filters:</span> ' + chips.join('') : '';
    }
    function chip(text) { return '<span class="mlog-active-chip">' + escapeHTML(text) + '</span>'; }

    function clearFilters() {
        ['mlog-status','mlog-jobtype','mlog-priority','mlog-machine','mlog-mapstatus','mlog-datefrom','mlog-dateto','mlog-search'].forEach(function(id){
            var el = $(id); if (el) el.value = '';
        });
        applyFilters();
    }

    function sortData() {
        var key = STATE.sortKey;
        var dir = STATE.sortDir === 'asc' ? 1 : -1;
        STATE.filtered.sort(function(a, b){
            var va, vb;
            if (key === 'Downtime') {
                va = hours(a.StartTime, a.EndTime) || 0;
                vb = hours(b.StartTime, b.EndTime) || 0;
            } else if (key === 'StartTime') {
                va = new Date(a.StartTime || a.Created || 0).getTime();
                vb = new Date(b.StartTime || b.Created || 0).getTime();
            } else if (key === 'Machine') {
                va = (resolveMachine(a.Machine).canonical_name || safeText(a.Machine)).toLowerCase();
                vb = (resolveMachine(b.Machine).canonical_name || safeText(b.Machine)).toLowerCase();
            } else {
                va = safeText(a[key]).toLowerCase();
                vb = safeText(b[key]).toLowerCase();
            }
            if (va < vb) return -1 * dir;
            if (va > vb) return 1 * dir;
            return 0;
        });
    }

    function machineCellHTML(j) {
        var r = resolveMachine(j.Machine);
        var raw = safeText(j.Machine);
        var pill, display, mapBtn = '';
        if (r.status === 'matched') {
            pill = '<span class="mlog-mappill mp-ok" title="Resolved via ' + r.via + '">✓</span>';
            display = '<strong>' + escapeHTML(r.canonical_name) + '</strong>' +
                      ' <code class="mlog-code">' + escapeHTML(r.asset_id) + '</code>';
            if (r.via && r.via.indexOf('alias') === 0) {
                display += ' <em class="mlog-raw" title="Raw SharePoint value">"' + escapeHTML(raw) + '"</em>';
            }
        } else if (r.status === 'ignored') {
            pill = '<span class="mlog-mappill mp-ig" title="Ignored (' + r.via + ')">⛔</span>';
            display = '<span class="mlog-other">' + escapeHTML(raw || '—') + '</span>';
        } else if (r.status === 'other') {
            pill = '<span class="mlog-mappill mp-other" title="Not in asset registry">⚠</span>';
            display = '<span class="mlog-other">' + escapeHTML(raw || '—') + '</span>';
            if (EDIT_MODE) {
                mapBtn = ' <button class="mlog-map-btn" data-map-raw="' + escapeHTML(raw) + '" title="Map to asset">✏️ Map</button>';
            }
        } else if (r.status === 'empty') {
            pill = '<span class="mlog-mappill mp-empty">·</span>';
            display = '<span class="mlog-other">—</span>';
        } else {
            pill = '';
            display = escapeHTML(raw || '—');
        }
        return pill + ' ' + display + mapBtn;
    }

    function renderTable() {
        sortData();
        var tbody = document.querySelector('#mlog-table tbody');
        var total = STATE.filtered.length;
        $('mlog-count').textContent = total + ' rows';

        document.querySelectorAll('#mlog-table th.sortable').forEach(function(th){
            th.classList.remove('sort-asc','sort-desc');
            if (th.dataset.sort === STATE.sortKey) {
                th.classList.add(STATE.sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
            }
        });

        if (!total) {
            tbody.innerHTML = '<tr><td colspan="10" class="mlog-empty">No jobs match the current filters · ไม่พบข้อมูล</td></tr>';
            $('mlog-page-info').textContent = '0 of 0';
            $('mlog-page-current').textContent = 'Page 0 / 0';
            ['mlog-first','mlog-prev','mlog-next','mlog-last'].forEach(function(id){ $(id).disabled = true; });
            return;
        }

        var totalPages = Math.max(1, Math.ceil(total / STATE.pageSize));
        if (STATE.page > totalPages) STATE.page = totalPages;
        var start = (STATE.page - 1) * STATE.pageSize;
        var rows = STATE.filtered.slice(start, start + STATE.pageSize);

        tbody.innerHTML = rows.map(function(j, idx){
            var dt = hours(j.StartTime, j.EndTime);
            return '<tr data-idx="' + (start + idx) + '">' +
                '<td>' + escapeHTML(safeText(j.JobID)) + '</td>' +
                '<td>' + machineCellHTML(j) + '</td>' +
                '<td class="col-truncate" title="' + escapeHTML(safeText(j.RootCause)) + '">' + escapeHTML(safeText(j.RootCause) || '—') + '</td>' +
                '<td class="col-truncate" title="' + escapeHTML(safeText(j.Solution))  + '">' + escapeHTML(safeText(j.Solution)  || '—') + '</td>' +
                '<td><span class="mlog-pill pill-type">' + escapeHTML(safeText(j.JobType) || '—') + '</span></td>' +
                '<td><span class="mlog-pill ' + priorityClass(j.Priority) + '">' + escapeHTML(safeText(j.Priority) || '—') + '</span></td>' +
                '<td><span class="mlog-pill ' + statusClass(j.Status) + '">' + escapeHTML(normStatus(j.Status)) + '</span></td>' +
                '<td>' + (dt === null ? '—' : fmtHours(dt)) + '</td>' +
                '<td>' + escapeHTML(safeText(j.ActionBy) || safeText(j.AssignedTo) || '—') + '</td>' +
                '<td>' + fmtDate(j.StartTime || j.Created) + '</td>' +
                '</tr>';
        }).join('');

        Array.prototype.forEach.call(tbody.querySelectorAll('tr'), function(tr){
            tr.addEventListener('click', function(e){
                var btn = e.target.closest('.mlog-map-btn');
                if (btn) {
                    e.stopPropagation();
                    openMapModal(btn.getAttribute('data-map-raw'));
                    return;
                }
                var idx = parseInt(tr.dataset.idx, 10);
                if (!isNaN(idx) && STATE.filtered[idx]) openDetail(STATE.filtered[idx]);
            });
        });

        $('mlog-page-info').textContent = (start + 1) + '–' + Math.min(start + STATE.pageSize, total) + ' of ' + total;
        $('mlog-page-current').textContent = 'Page ' + STATE.page + ' / ' + totalPages;
        $('mlog-first').disabled = STATE.page <= 1;
        $('mlog-prev').disabled  = STATE.page <= 1;
        $('mlog-next').disabled  = STATE.page >= totalPages;
        $('mlog-last').disabled  = STATE.page >= totalPages;
    }

    function openDetail(j) {
        var r = resolveMachine(j.Machine);
        var titleMachine = r.status === 'matched' ? (r.canonical_name + ' (' + r.asset_id + ')') : (safeText(j.Machine) + (r.status === 'other' ? ' — ⚠ unmapped' : ''));
        $('modal-eyebrow').textContent = safeText(j.JobType) || 'Job';
        $('modal-title').textContent = safeText(j.JobID) + ' — ' + titleMachine;
        var machineCell = r.status === 'matched'
            ? '<strong>' + escapeHTML(r.canonical_name) + '</strong> <code class="mlog-code">' + escapeHTML(r.asset_id) + '</code>' +
              '<br><small style="color:#94A3B8">SharePoint raw: "' + escapeHTML(safeText(j.Machine)) + '"</small>'
            : '<span class="mlog-other">' + escapeHTML(safeText(j.Machine) || '—') + '</span>' +
              ' <span class="mlog-mappill mp-other">⚠ unmapped</span>';
        var rows = [
            ['Job ID', escapeHTML(safeText(j.JobID))],
            ['Machine / เครื่องจักร', machineCell],
            ['Status', '<span class="mlog-pill ' + statusClass(j.Status) + '">' + escapeHTML(normStatus(j.Status)) + '</span>'],
            ['Priority', '<span class="mlog-pill ' + priorityClass(j.Priority) + '">' + escapeHTML(safeText(j.Priority) || '—') + '</span>'],
            ['Job Type', escapeHTML(safeText(j.JobType) || '—')],
            ['Job Source', escapeHTML(safeText(j.JobSource) || '—')],
            ['Assigned To', escapeHTML(safeText(j.AssignedTo) || '—')],
            ['Action By', escapeHTML(safeText(j.ActionBy) || '—')],
            ['Due Date', fmtDate(j.DueDate)],
            ['Start Time', fmtDateTime(j.StartTime)],
            ['End Time', fmtDateTime(j.EndTime)],
            ['Downtime', fmtHours(hours(j.StartTime, j.EndTime))],
            ['Created', fmtDateTime(j.Created)],
            ['Modified', fmtDateTime(j.Modified)]
        ];
        var gridHTML = '<div class="mlog-detail-grid">' + rows.map(function(r2){
            return '<div class="mlog-detail-row">' +
                   '<span class="mlog-detail-label">' + escapeHTML(r2[0]) + '</span>' +
                   '<span class="mlog-detail-value">' + r2[1] + '</span>' +
                   '</div>';
        }).join('') + '</div>';
        var textSections = '';
        if (j.Problem)   textSections += '<div class="mlog-detail-section"><h4>Problem · ปัญหา</h4><p>'    + escapeHTML(j.Problem) + '</p></div>';
        if (j.RootCause) textSections += '<div class="mlog-detail-section"><h4>Root Cause · สาเหตุ</h4><p>' + escapeHTML(j.RootCause) + '</p></div>';
        if (j.Solution)  textSections += '<div class="mlog-detail-section"><h4>Solution · วิธีการแก้ไข</h4><p>' + escapeHTML(j.Solution) + '</p></div>';
        $('modal-body').innerHTML = gridHTML + textSections;
        $('mlog-modal-backdrop').style.display = 'flex';
    }
    function closeDetail() { $('mlog-modal-backdrop').style.display = 'none'; }

    function openMapModal(rawValue) {
        if (!EDIT_MODE) return;
        aliasMapTarget = rawValue || '';
        $('mlog-map-raw').textContent = aliasMapTarget || '(empty)';
        $('mlog-map-search').value = '';
        $('mlog-map-error').hidden = true;
        var dl = $('mlog-map-list');
        if (dl && !dl.children.length && window.BFLFP_Resolver) {
            var assets = window.BFLFP_Resolver.getAllAssets();
            dl.innerHTML = assets.map(function(a){
                var label = a.asset_id + ' — ' + (a.name || '') + (a.manufacturer ? ' (' + a.manufacturer + ')' : '');
                return '<option value="' + escapeHTML(label) + '"></option>';
            }).join('');
        }
        $('mlog-map-backdrop').style.display = 'flex';
        setTimeout(function(){ $('mlog-map-search').focus(); }, 50);
    }
    function closeMapModal() {
        $('mlog-map-backdrop').style.display = 'none';
        aliasMapTarget = null;
    }
    function saveMapping() {
        if (!aliasMapTarget) return;
        var input = $('mlog-map-search').value.trim();
        if (!input) {
            $('mlog-map-error').hidden = false;
            $('mlog-map-error').textContent = 'Pick an asset from the list (or type its Asset ID).';
            return;
        }
        var assetId;
        var m = input.match(/^(W\d{2}[A-Z]{1,3}\d{2,3})\b/i);
        if (m) assetId = m[1].toUpperCase();
        else {
            var hit = window.BFLFP_Resolver.getAllAssets().find(function(a){
                return (a.name || '').toLowerCase() === input.toLowerCase();
            });
            if (hit) assetId = hit.asset_id;
        }
        if (!assetId) {
            $('mlog-map-error').hidden = false;
            $('mlog-map-error').textContent = 'No asset matched "' + input + '". Use the format W01AC05 or pick from the dropdown.';
            return;
        }
        var ok = window.BFLFP_Resolver.addAlias(aliasMapTarget, assetId);
        if (!ok) {
            $('mlog-map-error').hidden = false;
            $('mlog-map-error').textContent = 'Could not add mapping. Check the Asset ID exists.';
            return;
        }
        markAliasesDirty();
        closeMapModal();
        populateFilters();
        applyFilters();
    }
    function saveIgnore() {
        if (!aliasMapTarget) return;
        window.BFLFP_Resolver.addIgnoreExact(aliasMapTarget);
        markAliasesDirty();
        closeMapModal();
        populateFilters();
        applyFilters();
    }
    function markAliasesDirty() {
        var btn = $('mlog-edit-download');
        if (!btn) return;
        btn.disabled = false;
        btn.classList.add('mlog-edit-download-active');
    }
    function downloadAliasesJSON() {
        if (!window.BFLFP_Resolver) return;
        var payload = window.BFLFP_Resolver.exportAliasesJSON();
        var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'asset_aliases.json';
        document.body.appendChild(a);
        a.click();
        setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    }

    function exportCSV() {
        if (!STATE.filtered.length) return alert('No rows to export.');
        var cols = ['JobID','Machine_Raw','Machine_Canonical','Asset_ID','Map_Status','JobType','Priority','Status','Problem','RootCause','Solution','AssignedTo','ActionBy','DueDate','StartTime','EndTime','Created','Modified'];
        var lines = [cols.join(',')];
        STATE.filtered.forEach(function(j){
            var r = resolveMachine(j.Machine);
            var row = {
                JobID: j.JobID, Machine_Raw: j.Machine,
                Machine_Canonical: r.canonical_name || '',
                Asset_ID: r.asset_id || '',
                Map_Status: r.status,
                JobType: j.JobType, Priority: j.Priority, Status: j.Status,
                Problem: j.Problem, RootCause: j.RootCause, Solution: j.Solution,
                AssignedTo: j.AssignedTo, ActionBy: j.ActionBy,
                DueDate: j.DueDate, StartTime: j.StartTime, EndTime: j.EndTime,
                Created: j.Created, Modified: j.Modified
            };
            lines.push(cols.map(function(c){
                var v = row[c];
                if (v === null || v === undefined) return '';
                var s = String(v).replace(/"/g, '""');
                return /[",\n]/.test(s) ? '"' + s + '"' : s;
            }).join(','));
        });
        var blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'BFLFP_MaintenanceLog_' + new Date().toISOString().slice(0,10) + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function wire() {
        ['mlog-status','mlog-jobtype','mlog-priority','mlog-machine','mlog-mapstatus','mlog-datefrom','mlog-dateto'].forEach(function(id){
            var el = $(id); if (el) el.addEventListener('change', applyFilters);
        });
        var t;
        $('mlog-search').addEventListener('input', function(){
            clearTimeout(t);
            t = setTimeout(applyFilters, 250);
        });
        $('mlog-clear').addEventListener('click', clearFilters);
        $('mlog-refresh').addEventListener('click', fetchData);
        $('mlog-retry').addEventListener('click', fetchData);
        $('mlog-export').addEventListener('click', exportCSV);

        $('mlog-first').addEventListener('click', function(){ STATE.page = 1; renderTable(); });
        $('mlog-prev').addEventListener('click',  function(){ STATE.page = Math.max(1, STATE.page - 1); renderTable(); });
        $('mlog-next').addEventListener('click',  function(){ STATE.page += 1; renderTable(); });
        $('mlog-last').addEventListener('click',  function(){
            STATE.page = Math.max(1, Math.ceil(STATE.filtered.length / STATE.pageSize));
            renderTable();
        });
        $('mlog-page-size').addEventListener('change', function(){
            STATE.pageSize = parseInt(this.value, 10) || 50;
            STATE.page = 1;
            renderTable();
        });

        document.querySelectorAll('#mlog-table th.sortable').forEach(function(th){
            th.addEventListener('click', function(){
                var k = th.dataset.sort;
                if (STATE.sortKey === k) {
                    STATE.sortDir = STATE.sortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    STATE.sortKey = k;
                    STATE.sortDir = (k === 'StartTime' || k === 'Downtime') ? 'desc' : 'asc';
                }
                renderTable();
            });
        });

        if ($('mlog-modal-close')) $('mlog-modal-close').addEventListener('click', closeDetail);
        if ($('mlog-modal-backdrop')) {
            $('mlog-modal-backdrop').addEventListener('click', function(e){
                if (e.target === this) closeDetail();
            });
        }

        if (EDIT_MODE) {
            var banner = $('mlog-edit-banner');
            if (banner) banner.hidden = false;
            var dl = $('mlog-edit-download');
            if (dl) dl.addEventListener('click', downloadAliasesJSON);
            if ($('mlog-map-close'))  $('mlog-map-close').addEventListener('click', closeMapModal);
            if ($('mlog-map-cancel')) $('mlog-map-cancel').addEventListener('click', closeMapModal);
            if ($('mlog-map-save'))   $('mlog-map-save').addEventListener('click', saveMapping);
            if ($('mlog-map-ignore')) $('mlog-map-ignore').addEventListener('click', saveIgnore);
            if ($('mlog-map-backdrop')) {
                $('mlog-map-backdrop').addEventListener('click', function(e){
                    if (e.target === this) closeMapModal();
                });
            }
            if ($('mlog-map-search')) {
                $('mlog-map-search').addEventListener('keydown', function(e){
                    if (e.key === 'Enter') { e.preventDefault(); saveMapping(); }
                });
            }
        }

        document.addEventListener('keydown', function(e){
            if (e.key === 'Escape') { closeDetail(); closeMapModal(); }
        });
    }

    function init() {
        wire();
        fetchData();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

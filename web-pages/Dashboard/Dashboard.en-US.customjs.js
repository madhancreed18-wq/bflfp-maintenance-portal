/* ============================================
   BFLFP MAINTENANCE CONTROL CENTER — DASHBOARD JS
   Data source: Power Automate flow (anonymous HTTPS trigger)
   Chart library: Chart.js v4 (loaded via CDN in HTML)
   ============================================ */

(function() {
    'use strict';

    // ============================================
    // CONFIG
    // ============================================
    var DATA_URL = 'https://e3f3e42aeed8e8578b8fbeb256cd05.92.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/761fb5647d804b62a867d1ce49124311/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=B3DKRO5DG6GO3A6Ldjfet5kNncZV1rE4geWQhCKtSEs';
    var PAGE_SIZE = 25;

    // Color palette matched to site theme
    var COLORS = {
        primary: '#F97316',
        primaryDark: '#EA580C',
        navy: '#1E293B',
        success: '#22C55E',
        danger: '#EF4444',
        info: '#3B82F6',
        purple: '#A855F7',
        teal: '#14B8A6',
        amber: '#F59E0B',
        grey: '#94A3B8'
    };
    var DONUT_PALETTE = [COLORS.primary, COLORS.navy, COLORS.success, COLORS.info, COLORS.danger, COLORS.purple, COLORS.teal, COLORS.amber, COLORS.grey];

    // ============================================
    // STATE
    // ============================================
    var STATE = {
        rawJobs: [],
        filteredJobs: [],
        page: 1,
        charts: {}
    };

    // ============================================
    // UTILITIES
    // ============================================
    function $(id) { return document.getElementById(id); }
    function safeText(v) { return (v === null || v === undefined) ? '' : String(v); }
    function hours(start, end) {
        if (!start || !end) return null;
        var a = new Date(start).getTime();
        var b = new Date(end).getTime();
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
    function fmtDateShort(s) {
        if (!s) return '—';
        var d = new Date(s);
        if (isNaN(d)) return safeText(s);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    }
    function todayISO() { return new Date().toISOString().slice(0,10); }
    function escapeHTML(s) {
        return String(s).replace(/[&<>"']/g, function(c) {
            return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
        });
    }
    function unique(arr) {
        var seen = Object.create(null);
        var out = [];
        for (var i=0;i<arr.length;i++) {
            var v = arr[i];
            if (v && !seen[v]) { seen[v] = 1; out.push(v); }
        }
        return out.sort();
    }
    function avg(arr) {
        if (!arr.length) return null;
        var s = 0, n = 0;
        for (var i=0;i<arr.length;i++) {
            if (arr[i] !== null && arr[i] !== undefined && !isNaN(arr[i])) { s += arr[i]; n++; }
        }
        return n ? s / n : null;
    }

    // Split AssignedTo or ActionBy comma list into names
    function splitNames(s) {
        if (!s) return [];
        return String(s).split(/[,;|]/).map(function(x){ return x.trim(); }).filter(Boolean);
    }

    // Status / priority normalizers
    function normStatus(s) {
        var x = (s || '').toString().toLowerCase().trim();
        if (x === 'done' || x === 'closed' || x === 'completed') return 'Done';
        if (x === 'open' || x === 'new') return 'Open';
        if (x.indexOf('progress') >= 0 || x === 'in-progress' || x === 'inprogress') return 'In Progress';
        if (x === 'pending' || x === 'waiting') return 'Pending';
        if (x === 'cancelled' || x === 'canceled') return 'Cancelled';
        return s || '—';
    }
    function statusPillClass(s) {
        var n = normStatus(s).toLowerCase();
        if (n === 'done') return 'pill-status-done';
        if (n === 'open') return 'pill-status-open';
        if (n === 'in progress') return 'pill-status-progress';
        return 'pill-status-default';
    }
    function priorityPillClass(p) {
        var x = (p || '').toString().toLowerCase();
        if (x === 'high' || x === 'critical' || x === 'urgent') return 'pill-priority-high';
        if (x === 'medium' || x === 'normal') return 'pill-priority-medium';
        if (x === 'low') return 'pill-priority-low';
        return 'pill-priority-default';
    }

    // ============================================
    // DATA FETCH
    // ============================================
    function showState(which) {
        $('state-loading').style.display = (which === 'loading') ? 'block' : 'none';
        $('state-error').style.display   = (which === 'error')   ? 'block' : 'none';
        $('dash-main').style.display     = (which === 'ready')   ? 'block' : 'none';
    }

    function fetchData() {
        showState('loading');
        // Power Automate "When a HTTP request is received" trigger defaults to POST
        // with a JSON body. We send an empty body that matches any open schema.
        // If POST fails (e.g. trigger is configured for GET only), fall back to GET.
        function tryPost() {
            return fetch(DATA_URL, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: '{}'
            });
        }
        function tryGet() {
            return fetch(DATA_URL, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
        }
        return tryPost()
            .then(function(r) {
                if (r.ok) return r;
                // 400/405 typically means wrong method or schema — try GET as fallback
                if (r.status === 400 || r.status === 405) return tryGet();
                throw new Error('HTTP ' + r.status);
            })
            .then(function(r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function(json) {
                // Diagnostic logging so we can see exactly what the flow returns
                try {
                    console.log('[Dashboard] Raw flow response type:', typeof json, Array.isArray(json) ? '(array)' : '');
                    console.log('[Dashboard] Raw flow response:', json);
                    if (json && typeof json === 'object' && !Array.isArray(json)) {
                        console.log('[Dashboard] Top-level keys:', Object.keys(json));
                    }
                } catch (_) {}

                STATE.rawJobs = normalizePayload(json);

                console.log('[Dashboard] Parsed records count:', STATE.rawJobs.length);
                if (STATE.rawJobs.length) console.log('[Dashboard] First record:', STATE.rawJobs[0]);

                if (!STATE.rawJobs.length) {
                    var preview = '';
                    try {
                        preview = JSON.stringify(json).slice(0, 300);
                    } catch (_) { preview = String(json).slice(0, 300); }
                    throw new Error('No records found in flow response. Response shape: ' + preview);
                }
                onDataReady();
            })
            .catch(function(err) {
                console.error('Dashboard fetch failed:', err);
                $('error-msg').textContent = 'Could not load data: ' + err.message;
                showState('error');
            });
    }

    // Accept many payload shapes, including deeply-nested or string-encoded JSON
    function normalizePayload(p) {
        if (!p) return [];

        // 1) If response was a JSON string, parse it
        if (typeof p === 'string') {
            try { p = JSON.parse(p); } catch (e) { return []; }
        }

        // 2) Direct array
        if (Array.isArray(p)) return p;

        // 3) Single object with job-like fields → wrap as array
        if (typeof p === 'object' && (p.JobID || p.jobID || p.jobid)) return [p];

        // 4) Common Power Automate / SharePoint / OData wrappers
        var commonKeys = ['response','Response','value','jobs','data','results','items','records','body','Body','Result','output','payload'];
        for (var i=0;i<commonKeys.length;i++) {
            var v = p[commonKeys[i]];
            if (Array.isArray(v)) return v;
            // body sometimes itself a string of JSON
            if (typeof v === 'string') {
                try {
                    var parsed = JSON.parse(v);
                    if (Array.isArray(parsed)) return parsed;
                    if (parsed && typeof parsed === 'object') {
                        var inner = normalizePayload(parsed);
                        if (inner.length) return inner;
                    }
                } catch (_) { /* ignore */ }
            }
            // body / output / etc. as nested object → recurse
            if (v && typeof v === 'object') {
                var nested = normalizePayload(v);
                if (nested.length) return nested;
            }
        }

        // 5) Deep search: find the first array of objects that look like jobs
        function findJobArray(obj, depth) {
            if (!obj || depth > 4) return null;
            if (Array.isArray(obj)) {
                if (obj.length === 0) return null;
                var first = obj[0];
                if (first && typeof first === 'object') {
                    var keys = Object.keys(first).map(function(k){ return k.toLowerCase(); });
                    if (keys.indexOf('jobid') >= 0 || keys.indexOf('machine') >= 0 || keys.indexOf('status') >= 0) {
                        return obj;
                    }
                }
                return null;
            }
            if (typeof obj === 'object') {
                for (var k in obj) {
                    if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
                    var found = findJobArray(obj[k], depth + 1);
                    if (found) return found;
                }
            }
            return null;
        }
        var deep = findJobArray(p, 0);
        return deep || [];
    }

    // ============================================
    // ON DATA READY — populate filters, draw all
    // ============================================
    function onDataReady() {
        populateFilters(STATE.rawJobs);
        applyFilters(); // first render
        showState('ready');
        updateClock();
        $('dash-last-updated').textContent = 'Last updated: ' + new Date().toLocaleString('en-GB');
    }

    // ============================================
    // FILTERS
    // ============================================
    function populateFilters(jobs) {
        function fill(id, values) {
            var sel = $(id);
            if (!sel) return;
            // Preserve existing selection
            var current = sel.value;
            sel.innerHTML = '<option value="">All</option>';
            values.forEach(function(v) {
                var opt = document.createElement('option');
                opt.value = v;
                opt.textContent = v;
                sel.appendChild(opt);
            });
            sel.value = current && values.indexOf(current) >= 0 ? current : '';
        }
        fill('f-status',   unique(jobs.map(function(j){ return normStatus(j.Status); })));
        fill('f-jobtype',  unique(jobs.map(function(j){ return j.JobType; })));
        fill('f-priority', unique(jobs.map(function(j){ return j.Priority; })));
        fill('f-machine',  unique(jobs.map(function(j){ return j.Machine; })));

        // Technician list = union of AssignedTo split + ActionBy
        var techs = [];
        jobs.forEach(function(j) {
            splitNames(j.AssignedTo).forEach(function(n){ techs.push(n); });
            if (j.ActionBy) techs.push(String(j.ActionBy).trim());
        });
        fill('f-tech', unique(techs));
    }

    function readFilters() {
        return {
            status:   $('f-status').value,
            jobtype:  $('f-jobtype').value,
            priority: $('f-priority').value,
            machine:  $('f-machine').value,
            tech:     $('f-tech').value,
            from:     $('f-datefrom').value,
            to:       $('f-dateto').value,
            search:   ($('f-search').value || '').trim().toLowerCase()
        };
    }

    function applyFilters() {
        var f = readFilters();
        var fromT = f.from ? new Date(f.from).getTime() : null;
        var toT   = f.to   ? new Date(f.to).getTime() + 86400000 - 1 : null;

        STATE.filteredJobs = STATE.rawJobs.filter(function(j) {
            if (f.status && normStatus(j.Status) !== f.status) return false;
            if (f.jobtype && j.JobType !== f.jobtype) return false;
            if (f.priority && j.Priority !== f.priority) return false;
            if (f.machine && j.Machine !== f.machine) return false;
            if (f.tech) {
                var pool = splitNames(j.AssignedTo).concat(j.ActionBy ? [String(j.ActionBy).trim()] : []);
                if (pool.indexOf(f.tech) < 0) return false;
            }
            var refDate = j.StartTime || j.Created || j.DueDate;
            if (fromT && refDate) {
                var t = new Date(refDate).getTime();
                if (isNaN(t) || t < fromT) return false;
            }
            if (toT && refDate) {
                var t2 = new Date(refDate).getTime();
                if (isNaN(t2) || t2 > toT) return false;
            }
            if (f.search) {
                var blob = [j.JobID, j.Machine, j.RootCause, j.Solution, j.Problem, j.ActionBy, j.AssignedTo, j.JobType, j.Priority]
                    .map(safeText).join(' ').toLowerCase();
                if (blob.indexOf(f.search) < 0) return false;
            }
            return true;
        });

        STATE.page = 1;
        render();
    }

    function clearFilters() {
        ['f-status','f-jobtype','f-priority','f-machine','f-tech'].forEach(function(id){ $(id).value = ''; });
        ['f-datefrom','f-dateto'].forEach(function(id){ $(id).value = ''; });
        $('f-search').value = '';
        applyFilters();
    }

    // ============================================
    // KPI COMPUTATION
    // ============================================
    function computeKPIs(jobs) {
        var done = jobs.filter(function(j){ return normStatus(j.Status) === 'Done'; });
        var open = jobs.filter(function(j){ return normStatus(j.Status) !== 'Done'; });
        var today = todayISO();
        var overdue = open.filter(function(j){ return j.DueDate && j.DueDate < today; });

        // MTTR (hours): EndTime - StartTime for Done jobs
        var mttrSamples = done.map(function(j){ return hours(j.StartTime, j.EndTime); }).filter(function(v){ return v !== null && v > 0; });
        var mttr = avg(mttrSamples);

        // MTBF (hours): average gap between failure events per machine — for Repair/Breakdown jobs
        var failuresByMachine = {};
        jobs.forEach(function(j) {
            var t = (j.JobType || '').toLowerCase();
            if (t.indexOf('repair') < 0 && t.indexOf('breakdown') < 0 && t.indexOf('corrective') < 0) return;
            var when = j.StartTime || j.Created;
            if (!when || !j.Machine) return;
            var key = j.Machine;
            (failuresByMachine[key] = failuresByMachine[key] || []).push(new Date(when).getTime());
        });
        var gaps = [];
        Object.keys(failuresByMachine).forEach(function(k) {
            var arr = failuresByMachine[k].sort(function(a,b){ return a - b; });
            for (var i=1;i<arr.length;i++) gaps.push((arr[i] - arr[i-1]) / 3600000);
        });
        var mtbf = avg(gaps);

        // PM Compliance: % of Preventive (PM) jobs done on or before DueDate
        var pmJobs = jobs.filter(function(j) {
            var t = (j.JobType || '').toLowerCase();
            return t.indexOf('preventive') >= 0 || t === 'pm';
        });
        var pmOnTime = pmJobs.filter(function(j) {
            if (normStatus(j.Status) !== 'Done') return false;
            if (!j.DueDate || !j.EndTime) return false;
            var end = new Date(j.EndTime).getTime();
            var due = new Date(j.DueDate + 'T23:59:59').getTime();
            return end <= due;
        });
        var pmPct = pmJobs.length ? (pmOnTime.length / pmJobs.length * 100) : null;

        // FTFR: % of Done jobs with single ActionBy / not reopened (proxy)
        var ftfrEligible = done;
        var ftfrFirst = done.filter(function(j) {
            var names = splitNames(j.ActionBy);
            return names.length === 1;
        });
        var ftfr = ftfrEligible.length ? (ftfrFirst.length / ftfrEligible.length * 100) : null;

        // Avg response time: Created → StartTime
        var respSamples = jobs.map(function(j){ return hours(j.Created, j.StartTime); }).filter(function(v){ return v !== null && v >= 0; });
        var avgResp = avg(respSamples);

        return {
            mttr: mttr,
            mtbf: mtbf,
            pmPct: pmPct,
            pmCount: pmJobs.length,
            ftfr: ftfr,
            ftfrCount: ftfrEligible.length,
            avgResp: avgResp,
            total: jobs.length,
            openCount: open.length,
            overdueCount: overdue.length,
            doneCount: done.length,
            openJobs: open,
            overdueJobs: overdue,
            doneJobs: done
        };
    }

    function renderKPIs(k) {
        $('kpi-mttr').textContent = k.mttr === null ? '—' : fmtHours(k.mttr);
        $('kpi-mttr-sub').textContent = 'avg from ' + k.doneCount + ' completed jobs';

        $('kpi-mtbf').textContent = k.mtbf === null ? '—' : fmtHours(k.mtbf);
        $('kpi-mtbf-sub').textContent = 'between repair/breakdown events';

        $('kpi-pm').textContent = k.pmPct === null ? '—' : k.pmPct.toFixed(1) + '%';
        $('kpi-pm-sub').textContent = k.pmCount + ' preventive job' + (k.pmCount === 1 ? '' : 's') + ' tracked';

        $('kpi-ftfr').textContent = k.ftfr === null ? '—' : k.ftfr.toFixed(1) + '%';
        $('kpi-ftfr-sub').textContent = 'of ' + k.ftfrCount + ' closed jobs';

        $('kpi-total').textContent = k.total;
        $('kpi-open').textContent = k.openCount;
        $('kpi-overdue').textContent = k.overdueCount;
        $('kpi-resp').textContent = k.avgResp === null ? '—' : fmtHours(k.avgResp);

        $('filter-summary').innerHTML = 'Showing <strong>' + k.total + '</strong> of <strong>' +
            STATE.rawJobs.length + '</strong> jobs' +
            ' · ' + k.openCount + ' open · ' + k.overdueCount + ' overdue · ' + k.doneCount + ' done';
    }

    // ============================================
    // CHART HELPERS
    // ============================================
    function destroyChart(key) {
        if (STATE.charts[key]) {
            STATE.charts[key].destroy();
            delete STATE.charts[key];
        }
    }
    function groupBy(jobs, key) {
        var out = {};
        jobs.forEach(function(j){
            var k = (key === 'Status') ? normStatus(j[key]) : (j[key] || '—');
            out[k] = (out[k] || 0) + 1;
        });
        return out;
    }

    function renderDonut(canvasId, dataObj, key) {
        if (typeof Chart === 'undefined') return;
        destroyChart(key);
        var labels = Object.keys(dataObj);
        var data   = labels.map(function(l){ return dataObj[l]; });
        var ctx = $(canvasId);
        if (!ctx) return;
        STATE.charts[key] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: labels.map(function(_,i){ return DONUT_PALETTE[i % DONUT_PALETTE.length]; }),
                    borderColor: '#FFFFFF',
                    borderWidth: 2,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '62%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { boxWidth: 10, font: { family: 'Inter', size: 11 }, color: '#475569' }
                    },
                    tooltip: {
                        backgroundColor: '#1E293B',
                        padding: 10,
                        titleFont: { family: 'Prompt', size: 12 },
                        bodyFont: { family: 'Inter', size: 12 }
                    }
                }
            }
        });
    }

    function renderTrend(jobs) {
        if (typeof Chart === 'undefined') return;
        destroyChart('trend');
        // Build daily buckets over the last 30 days (or full range)
        var byDay = {}, byDayBreakdown = {};
        jobs.forEach(function(j) {
            var when = j.StartTime || j.Created;
            if (!when) return;
            var d = new Date(when);
            if (isNaN(d)) return;
            var key = d.toISOString().slice(0,10);
            byDay[key] = (byDay[key] || 0) + 1;
            var t = (j.JobType || '').toLowerCase();
            if (t.indexOf('breakdown') >= 0 || t.indexOf('repair') >= 0 || t.indexOf('corrective') >= 0) {
                byDayBreakdown[key] = (byDayBreakdown[key] || 0) + 1;
            }
        });
        var days = Object.keys(byDay).sort();
        // Take last 30 days if more
        if (days.length > 30) days = days.slice(-30);
        var labels = days.map(function(d){ return fmtDateShort(d); });
        var totals = days.map(function(d){ return byDay[d] || 0; });
        var bds = days.map(function(d){ return byDayBreakdown[d] || 0; });

        var ctx = $('chart-trend');
        if (!ctx) return;
        STATE.charts.trend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Total Jobs',
                        data: totals,
                        borderColor: COLORS.primary,
                        backgroundColor: 'rgba(249,115,22,0.12)',
                        borderWidth: 2.5,
                        fill: true,
                        tension: 0.35,
                        pointRadius: 3,
                        pointBackgroundColor: COLORS.primary
                    },
                    {
                        label: 'Breakdowns',
                        data: bds,
                        borderColor: COLORS.danger,
                        backgroundColor: 'rgba(239,68,68,0.08)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.35,
                        pointRadius: 3,
                        pointBackgroundColor: COLORS.danger,
                        borderDash: [4,3]
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1E293B',
                        titleFont: { family: 'Prompt', size: 12 },
                        bodyFont: { family: 'Inter', size: 12 }
                    }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 10 }, color: '#94A3B8' } },
                    y: { beginAtZero: true, grid: { color: '#F1F5F9' }, ticks: { font: { family: 'Inter', size: 10 }, color: '#94A3B8', precision: 0 } }
                }
            }
        });
    }

    function renderBar(canvasId, dataObj, key, color, label) {
        if (typeof Chart === 'undefined') return;
        destroyChart(key);
        var entries = Object.keys(dataObj).map(function(k){ return [k, dataObj[k]]; });
        entries.sort(function(a,b){ return b[1] - a[1]; });
        entries = entries.slice(0, 8);
        var labels = entries.map(function(e){ return e[0]; });
        var data   = entries.map(function(e){ return e[1]; });
        var ctx = $(canvasId);
        if (!ctx) return;
        STATE.charts[key] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: data,
                    backgroundColor: color,
                    borderRadius: 6,
                    barThickness: 'flex',
                    maxBarThickness: 28
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1E293B',
                        titleFont: { family: 'Prompt', size: 12 },
                        bodyFont: { family: 'Inter', size: 12 }
                    }
                },
                scales: {
                    x: { beginAtZero: true, grid: { color: '#F1F5F9' }, ticks: { font: { family: 'Inter', size: 10 }, color: '#94A3B8' } },
                    y: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 11 }, color: '#475569' } }
                }
            }
        });
    }

    // ============================================
    // TABLES
    // ============================================
    function renderOpenTable(open) {
        var tbody = document.querySelector('#tbl-open tbody');
        $('count-open').textContent = open.length;
        if (!open.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="dash-table-empty">No open jobs — great work! / ไม่มีงานคงค้าง</td></tr>';
            return;
        }
        // Sort by priority then due date
        var pOrder = { 'high':0, 'critical':0, 'medium':1, 'normal':1, 'low':2 };
        open.sort(function(a,b){
            var pa = pOrder[(a.Priority||'').toLowerCase()] !== undefined ? pOrder[(a.Priority||'').toLowerCase()] : 3;
            var pb = pOrder[(b.Priority||'').toLowerCase()] !== undefined ? pOrder[(b.Priority||'').toLowerCase()] : 3;
            if (pa !== pb) return pa - pb;
            return (a.DueDate || '').localeCompare(b.DueDate || '');
        });
        tbody.innerHTML = open.slice(0, 30).map(function(j){
            return '<tr>' +
                '<td>' + escapeHTML(safeText(j.JobID)) + '</td>' +
                '<td>' + escapeHTML(safeText(j.Machine)) + '</td>' +
                '<td class="col-truncate" title="' + escapeHTML(safeText(j.RootCause || j.Problem)) + '">' + escapeHTML(safeText(j.RootCause || j.Problem) || '—') + '</td>' +
                '<td><span class="pill pill-type">' + escapeHTML(safeText(j.JobType) || '—') + '</span></td>' +
                '<td><span class="pill ' + priorityPillClass(j.Priority) + '">' + escapeHTML(safeText(j.Priority) || '—') + '</span></td>' +
                '<td><span class="pill ' + statusPillClass(j.Status) + '">' + escapeHTML(normStatus(j.Status)) + '</span></td>' +
                '<td>' + fmtDate(j.DueDate) + '</td>' +
                '<td>' + escapeHTML(safeText(j.AssignedTo) || safeText(j.ActionBy) || '—') + '</td>' +
                '</tr>';
        }).join('');
    }

    function renderOverdueTable(overdue) {
        var tbody = document.querySelector('#tbl-overdue tbody');
        $('count-overdue').textContent = overdue.length;
        if (!overdue.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="dash-table-empty">No overdue jobs · ไม่มีงานเกินกำหนด</td></tr>';
            return;
        }
        var today = new Date(todayISO()).getTime();
        overdue.sort(function(a,b){ return (a.DueDate || '').localeCompare(b.DueDate || ''); });
        tbody.innerHTML = overdue.slice(0, 30).map(function(j){
            var daysOver = j.DueDate ? Math.floor((today - new Date(j.DueDate).getTime()) / 86400000) : '—';
            return '<tr>' +
                '<td>' + escapeHTML(safeText(j.JobID)) + '</td>' +
                '<td>' + escapeHTML(safeText(j.Machine)) + '</td>' +
                '<td><span class="pill ' + priorityPillClass(j.Priority) + '">' + escapeHTML(safeText(j.Priority) || '—') + '</span></td>' +
                '<td><span class="pill ' + statusPillClass(j.Status) + '">' + escapeHTML(normStatus(j.Status)) + '</span></td>' +
                '<td>' + fmtDate(j.DueDate) + '</td>' +
                '<td class="cell-overdue">' + daysOver + ' day' + (daysOver === 1 ? '' : 's') + '</td>' +
                '<td>' + escapeHTML(safeText(j.AssignedTo) || safeText(j.ActionBy) || '—') + '</td>' +
                '</tr>';
        }).join('');
    }

    function renderFullTable(jobs) {
        var tbody = document.querySelector('#tbl-full tbody');
        $('count-total').textContent = jobs.length;
        if (!jobs.length) {
            tbody.innerHTML = '<tr><td colspan="11" class="dash-table-empty">No jobs match the current filters / ไม่พบข้อมูลที่ตรงกับตัวกรอง</td></tr>';
            $('full-pager-info').textContent = '0 rows';
            $('pg-info').textContent = 'Page 0 / 0';
            $('pg-prev').disabled = true;
            $('pg-next').disabled = true;
            return;
        }
        // Sort by Created/StartTime descending
        var sorted = jobs.slice().sort(function(a,b){
            var ta = new Date(a.Created || a.StartTime || 0).getTime();
            var tb = new Date(b.Created || b.StartTime || 0).getTime();
            return tb - ta;
        });

        var totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
        if (STATE.page > totalPages) STATE.page = totalPages;
        var start = (STATE.page - 1) * PAGE_SIZE;
        var pageRows = sorted.slice(start, start + PAGE_SIZE);

        tbody.innerHTML = pageRows.map(function(j){
            var dt = hours(j.StartTime, j.EndTime);
            var rt = hours(j.Created, j.StartTime);
            return '<tr>' +
                '<td>' + escapeHTML(safeText(j.JobID)) + '</td>' +
                '<td>' + escapeHTML(safeText(j.Machine)) + '</td>' +
                '<td class="col-truncate" title="' + escapeHTML(safeText(j.RootCause)) + '">' + escapeHTML(safeText(j.RootCause) || '—') + '</td>' +
                '<td class="col-truncate" title="' + escapeHTML(safeText(j.Solution)) + '">' + escapeHTML(safeText(j.Solution) || '—') + '</td>' +
                '<td><span class="pill pill-type">' + escapeHTML(safeText(j.JobType) || '—') + '</span></td>' +
                '<td><span class="pill ' + priorityPillClass(j.Priority) + '">' + escapeHTML(safeText(j.Priority) || '—') + '</span></td>' +
                '<td><span class="pill ' + statusPillClass(j.Status) + '">' + escapeHTML(normStatus(j.Status)) + '</span></td>' +
                '<td>' + (dt === null ? '—' : fmtHours(dt)) + '</td>' +
                '<td>' + (rt === null ? '—' : fmtHours(rt)) + '</td>' +
                '<td>' + escapeHTML(safeText(j.ActionBy) || safeText(j.AssignedTo) || '—') + '</td>' +
                '<td>' + fmtDate(j.StartTime || j.Created) + '</td>' +
                '</tr>';
        }).join('');

        $('full-pager-info').textContent = sorted.length + ' rows · showing ' + (start + 1) + '–' + Math.min(start + PAGE_SIZE, sorted.length);
        $('pg-info').textContent = 'Page ' + STATE.page + ' / ' + totalPages;
        $('pg-prev').disabled = (STATE.page <= 1);
        $('pg-next').disabled = (STATE.page >= totalPages);
    }

    // ============================================
    // MASTER RENDER
    // ============================================
    function render() {
        var jobs = STATE.filteredJobs;
        var k = computeKPIs(jobs);
        renderKPIs(k);
        renderTrend(jobs);
        renderDonut('chart-status',   groupBy(jobs, 'Status'),   'status');
        renderDonut('chart-jobtype',  groupBy(jobs, 'JobType'),  'jobtype');
        renderDonut('chart-priority', groupBy(jobs, 'Priority'), 'priority');

        renderBar('chart-machines', groupBy(jobs, 'Machine'), 'machines', COLORS.primary, 'Issues');

        // Downtime by Machine
        var dtByMachine = {};
        jobs.forEach(function(j){
            var h = hours(j.StartTime, j.EndTime);
            if (h !== null && j.Machine) dtByMachine[j.Machine] = (dtByMachine[j.Machine] || 0) + h;
        });
        // Round for display
        Object.keys(dtByMachine).forEach(function(k){ dtByMachine[k] = +(dtByMachine[k].toFixed(1)); });
        renderBar('chart-downtime', dtByMachine, 'downtime', COLORS.navy, 'Downtime (h)');

        // Technician Workload
        var techWork = {};
        jobs.forEach(function(j){
            var names = splitNames(j.AssignedTo);
            if (!names.length && j.ActionBy) names = [String(j.ActionBy).trim()];
            names.forEach(function(n){ techWork[n] = (techWork[n] || 0) + 1; });
        });
        renderBar('chart-tech', techWork, 'tech', COLORS.success, 'Jobs');

        renderOpenTable(k.openJobs);
        renderOverdueTable(k.overdueJobs);
        renderFullTable(jobs);

        renderPMKPIMatrix();
    }

    // ============================================
    // PM KPI DASHBOARD — Monthly Matrix
    // Builds a 13-row × 12-month matrix for the selected year.
    // Auto-fills 6 KPIs from maintenance jobs.
    // The remaining 6 require external data sources and render as
    // empty cells with a clear "needs source" placeholder.
    // ============================================
    var PMKPI_ROWS = [
        // id, English label, Thai label, target text, auto-compute key, target type, target value
        ['pm_compliance', 'PM Compliance Rate (%)', null,
            '≥ 95%', 'pm_compliance', 'gte', 95],

        ['pm_planned',    'PM ', 'ที่วางแผน (จำนวน)',
            '—', 'pm_planned', 'none', null],

        ['pm_done',       'PM ', 'ที่ทำแล้ว (จำนวน)',
            '—', 'pm_done', 'none', null],

        ['unplanned_dt',  'Unplanned Downtime (hrs)', null,
            '< 2% ของเวลาเดิน', null, 'none', null],

        ['breakdown',     'Breakdown ', 'ครั้ง (ทั้งโรงงาน)',
            'ลดลง YOY', 'breakdown', 'yoy_down', null],

        ['mtbf',          'MTBF — Machine ', 'หลัก (hrs)',
            'เพิ่มขึ้น YOY', 'mtbf', 'yoy_up', null],

        ['mttr',          'MTTR ', 'เฉลี่ย (hrs)',
            'ลดลง YOY', 'mttr', 'yoy_down', null],

        ['oee',           'OEE Line A (%)', null,
            '≥ 85%', null, 'none', null],

        ['it_backup',     'IT: Backup Success Rate (%)', null,
            '100%', null, 'none', null],

        ['it_avail',      'IT: System Availability (%)', null,
            '≥ 99.5%', null, 'none', null],

        ['pm_cm_cost',    'PM vs CM Cost Ratio (%)', null,
            'PM > 70%', null, 'none', null],

        ['overdue_pm',    'Overdue PM Tasks (Count)', null,
            '0', 'overdue_pm', 'eq', 0]
    ];

    function pmkpiAvailableYears() {
        var years = {};
        STATE.rawJobs.forEach(function(j) {
            var ref = j.StartTime || j.Created || j.DueDate;
            if (!ref) return;
            var y = new Date(ref).getFullYear();
            if (!isNaN(y)) years[y] = 1;
        });
        var arr = Object.keys(years).map(Number).sort(function(a,b){ return b - a; });
        var thisYear = new Date().getFullYear();
        if (arr.indexOf(thisYear) < 0) arr.unshift(thisYear);
        return arr;
    }

    function pmkpiInitYearSelect() {
        var sel = $('pmkpi-year');
        if (!sel) return;
        if (sel.dataset.initialised === '1') return;
        var years = pmkpiAvailableYears();
        sel.innerHTML = years.map(function(y){
            return '<option value="' + y + '">' + y + '</option>';
        }).join('');
        var thisYear = new Date().getFullYear();
        if (years.indexOf(thisYear) >= 0) sel.value = thisYear;
        sel.dataset.initialised = '1';
        sel.addEventListener('change', renderPMKPIMatrix);
    }

    // Compute one KPI for a given month window
    function pmkpiCompute(jobs, key, mStart, mEnd) {
        // jobs already filtered to year by caller? we pass all rawJobs, filter here.
        function inWindow(t) {
            if (!t) return false;
            var x = new Date(t).getTime();
            return !isNaN(x) && x >= mStart && x <= mEnd;
        }
        var isPM = function(j) {
            var t = (j.JobType || '').toLowerCase();
            return t.indexOf('preventive') >= 0 || t === 'pm';
        };
        var isBD = function(j) {
            var t = (j.JobType || '').toLowerCase();
            return t.indexOf('repair') >= 0 || t.indexOf('breakdown') >= 0 || t.indexOf('corrective') >= 0;
        };

        if (key === 'pm_planned') {
            // PM jobs whose DueDate falls in this month
            return jobs.filter(function(j){ return isPM(j) && j.DueDate && inWindow(j.DueDate); }).length;
        }
        if (key === 'pm_done') {
            // PM jobs Done with EndTime in this month
            return jobs.filter(function(j){
                return isPM(j) && normStatus(j.Status) === 'Done' && inWindow(j.EndTime || j.Modified);
            }).length;
        }
        if (key === 'pm_compliance') {
            var pm = jobs.filter(function(j){ return isPM(j) && j.DueDate && inWindow(j.DueDate); });
            if (!pm.length) return null;
            var onTime = pm.filter(function(j){
                if (normStatus(j.Status) !== 'Done') return false;
                if (!j.EndTime) return false;
                var end = new Date(j.EndTime).getTime();
                var due = new Date(j.DueDate + 'T23:59:59').getTime();
                return end <= due;
            }).length;
            return (onTime / pm.length) * 100;
        }
        if (key === 'breakdown') {
            return jobs.filter(function(j){
                return isBD(j) && inWindow(j.StartTime || j.Created);
            }).length;
        }
        if (key === 'mttr') {
            var done = jobs.filter(function(j){
                return normStatus(j.Status) === 'Done' && inWindow(j.EndTime);
            });
            var samples = done.map(function(j){ return hours(j.StartTime, j.EndTime); })
                              .filter(function(v){ return v !== null && v > 0; });
            return samples.length ? avg(samples) : null;
        }
        if (key === 'mtbf') {
            // gaps between breakdown events in this month, per machine
            var byMachine = {};
            jobs.forEach(function(j){
                if (!isBD(j)) return;
                var t = j.StartTime || j.Created;
                if (!inWindow(t) || !j.Machine) return;
                (byMachine[j.Machine] = byMachine[j.Machine] || []).push(new Date(t).getTime());
            });
            var gaps = [];
            Object.keys(byMachine).forEach(function(k){
                var arr = byMachine[k].sort(function(a,b){ return a - b; });
                for (var i=1;i<arr.length;i++) gaps.push((arr[i] - arr[i-1]) / 3600000);
            });
            return gaps.length ? avg(gaps) : null;
        }
        if (key === 'overdue_pm') {
            // PM jobs with DueDate in this month that are NOT Done as of month end
            return jobs.filter(function(j){
                if (!isPM(j) || !j.DueDate) return false;
                if (!inWindow(j.DueDate)) return false;
                if (normStatus(j.Status) === 'Done') {
                    if (!j.EndTime) return true;
                    var endT = new Date(j.EndTime).getTime();
                    var dueT = new Date(j.DueDate + 'T23:59:59').getTime();
                    return endT > dueT;
                }
                return true;
            }).length;
        }
        return null;
    }

    function pmkpiFormatValue(key, v) {
        if (v === null || v === undefined) return '—';
        if (key === 'pm_compliance') return v.toFixed(1) + '%';
        if (key === 'mttr' || key === 'mtbf') return v < 100 ? v.toFixed(1) : Math.round(v);
        return Math.round(v);
    }

    function pmkpiClassify(row, value, prevYearValue) {
        // Returns css class: pmkpi-cell-good / -warn / -bad / '' (neutral)
        if (value === null || value === undefined) return '';
        var ttype = row[5];     // target type
        var tval  = row[6];     // target value
        if (ttype === 'gte') {
            if (value >= tval) return 'pmkpi-cell-good';
            if (value >= tval * 0.9) return 'pmkpi-cell-warn';
            return 'pmkpi-cell-bad';
        }
        if (ttype === 'eq') {
            if (value === tval) return 'pmkpi-cell-good';
            if (value <= tval + 2) return 'pmkpi-cell-warn';
            return 'pmkpi-cell-bad';
        }
        if (ttype === 'yoy_down') {
            if (prevYearValue === null || prevYearValue === undefined) return '';
            if (value < prevYearValue) return 'pmkpi-cell-good';
            if (value === prevYearValue) return 'pmkpi-cell-warn';
            return 'pmkpi-cell-bad';
        }
        if (ttype === 'yoy_up') {
            if (prevYearValue === null || prevYearValue === undefined) return '';
            if (value > prevYearValue) return 'pmkpi-cell-good';
            if (value === prevYearValue) return 'pmkpi-cell-warn';
            return 'pmkpi-cell-bad';
        }
        return '';
    }

    function renderPMKPIMatrix() {
        pmkpiInitYearSelect();
        var sel = $('pmkpi-year');
        if (!sel) return;
        var year = parseInt(sel.value, 10) || new Date().getFullYear();
        var prevYear = year - 1;

        var todayMonth = (new Date().getFullYear() === year) ? new Date().getMonth() : 11;

        // Build month windows for this year and previous year
        function windows(y) {
            var arr = [];
            for (var m=0;m<12;m++) {
                var s = new Date(y, m, 1).getTime();
                var e = new Date(y, m+1, 1).getTime() - 1;
                arr.push([s, e]);
            }
            return arr;
        }
        var ws = windows(year);
        var pws = windows(prevYear);

        var tbody = document.querySelector('#pmkpi-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        var autoCount = 0;

        PMKPI_ROWS.forEach(function(row) {
            var key = row[4];
            var tr = document.createElement('tr');

            // KPI name cell (supports inline Thai second-part)
            var nameHTML = escapeHTML(row[1]);
            if (row[2]) nameHTML += '<span class="pmkpi-kpi-th">' + escapeHTML(row[2]) + '</span>';
            tr.innerHTML = '<td class="pmkpi-kpi-name">' + nameHTML + '</td>' +
                           '<td class="pmkpi-target">' + escapeHTML(row[3]) + '</td>';

            for (var m=0;m<12;m++) {
                var td = document.createElement('td');
                if (!key) {
                    td.className = 'pmkpi-cell-empty';
                    td.textContent = '';
                    td.title = 'Requires additional data source';
                } else {
                    var v = pmkpiCompute(STATE.rawJobs, key, ws[m][0], ws[m][1]);
                    var pv = (row[5] === 'yoy_down' || row[5] === 'yoy_up')
                        ? pmkpiCompute(STATE.rawJobs, key, pws[m][0], pws[m][1])
                        : null;
                    var cls = pmkpiClassify(row, v, pv);
                    if (m > todayMonth && v === null) {
                        td.className = 'pmkpi-cell-future';
                        td.textContent = '—';
                    } else {
                        td.className = cls;
                        td.textContent = (v === null) ? '—' : pmkpiFormatValue(key, v);
                        if (pv !== null && pv !== undefined && (row[5] === 'yoy_down' || row[5] === 'yoy_up')) {
                            td.title = 'YoY: ' + pmkpiFormatValue(key, pv) + ' → ' + pmkpiFormatValue(key, v);
                        }
                    }
                    if (v !== null) autoCount++;
                }
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        });

        var meta = $('pmkpi-section-meta');
        if (meta) {
            meta.textContent = year + ' · ' + autoCount + ' auto-computed values · 6 of 12 KPIs sourced from maintenance jobs';
        }
    }

    // ============================================
    // CSV EXPORT
    // ============================================
    function exportCSV() {
        var jobs = STATE.filteredJobs;
        if (!jobs.length) return alert('No rows to export.');
        var cols = ['JobID','Machine','JobType','Priority','Status','Problem','RootCause','Solution',
                    'AssignedTo','ActionBy','DueDate','StartTime','EndTime','Created','Modified'];
        var csv = [cols.join(',')];
        jobs.forEach(function(j){
            csv.push(cols.map(function(c){
                var v = j[c];
                if (v === null || v === undefined) return '';
                var s = String(v).replace(/"/g, '""');
                return /[",\n]/.test(s) ? '"' + s + '"' : s;
            }).join(','));
        });
        var blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'BFLFP_Maintenance_' + new Date().toISOString().slice(0,10) + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ============================================
    // CLOCK
    // ============================================
    function updateClock() {
        var el = $('dash-clock-time');
        if (!el) return;
        function tick() {
            var d = new Date();
            el.textContent = d.toLocaleTimeString('en-GB');
        }
        tick();
        setInterval(tick, 1000);
    }

    // ============================================
    // EVENT WIRING
    // ============================================
    function wireEvents() {
        ['f-status','f-jobtype','f-priority','f-machine','f-tech','f-datefrom','f-dateto'].forEach(function(id){
            var el = $(id);
            if (el) el.addEventListener('change', applyFilters);
        });
        var search = $('f-search');
        if (search) {
            var t;
            search.addEventListener('input', function(){
                clearTimeout(t);
                t = setTimeout(applyFilters, 250);
            });
        }
        var clr = $('btn-clear');
        if (clr) clr.addEventListener('click', clearFilters);
        var rf = $('btn-refresh');
        if (rf) rf.addEventListener('click', fetchData);
        var rt = $('btn-retry');
        if (rt) rt.addEventListener('click', fetchData);
        var ex = $('btn-export');
        if (ex) ex.addEventListener('click', exportCSV);

        var prev = $('pg-prev');
        var next = $('pg-next');
        if (prev) prev.addEventListener('click', function(){ STATE.page = Math.max(1, STATE.page - 1); renderFullTable(STATE.filteredJobs); });
        if (next) next.addEventListener('click', function(){ STATE.page = STATE.page + 1; renderFullTable(STATE.filteredJobs); });
    }

    // ============================================
    // INIT
    // ============================================
    function init() {
        try { wireEvents(); } catch (e) { console.warn('wireEvents:', e); }
        try { fetchData(); } catch (e) { console.warn('fetchData:', e); }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

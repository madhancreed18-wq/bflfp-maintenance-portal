/* ============================================
   BFLFP REPORTS — JS
   Live data, Chart.js charts, CSV exports
   ============================================ */

(function() {
    'use strict';

    var DATA_URL = 'https://e3f3e42aeed8e8578b8fbeb256cd05.92.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/761fb5647d804b62a867d1ce49124311/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=B3DKRO5DG6GO3A6Ldjfet5kNncZV1rE4geWQhCKtSEs';

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
    var PALETTE = [COLORS.primary, COLORS.navy, COLORS.success, COLORS.info, COLORS.danger, COLORS.purple, COLORS.teal, COLORS.amber, COLORS.grey];

    var STATE = {
        raw: [],
        scoped: [],
        charts: {}
    };

    function $(id) { return document.getElementById(id); }
    function safeText(v) { return (v === null || v === undefined) ? '' : String(v); }
    function escapeHTML(s) { return String(s).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
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
    function avg(arr) {
        if (!arr.length) return null;
        var s = 0, n = 0;
        for (var i=0;i<arr.length;i++) { if (arr[i] !== null && !isNaN(arr[i])) { s += arr[i]; n++; } }
        return n ? s / n : null;
    }
    function normStatus(s) {
        var x = (s || '').toString().toLowerCase().trim();
        if (x === 'done' || x === 'closed' || x === 'completed') return 'Done';
        if (x === 'open' || x === 'new') return 'Open';
        if (x.indexOf('progress') >= 0) return 'In Progress';
        return s || '—';
    }
    function splitNames(s) {
        if (!s) return [];
        return String(s).split(/[,;|]/).map(function(x){ return x.trim(); }).filter(Boolean);
    }
    function isBD(j) {
        var t = (j.JobType || '').toLowerCase();
        return t.indexOf('repair') >= 0 || t.indexOf('breakdown') >= 0 || t.indexOf('corrective') >= 0;
    }
    function isPM(j) {
        var t = (j.JobType || '').toLowerCase();
        return t.indexOf('preventive') >= 0 || t === 'pm';
    }

    // NORMALIZER
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
        return [];
    }

    function show(which) {
        $('rep-loading').style.display = (which === 'loading') ? 'block' : 'none';
        $('rep-error').style.display = (which === 'error') ? 'block' : 'none';
        $('rep-main').style.display = (which === 'ready') ? 'block' : 'none';
    }

    function fetchData() {
        show('loading');
        function p() { return fetch(DATA_URL, { method: 'POST', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }, body: '{}' }); }
        function g() { return fetch(DATA_URL, { method: 'GET', headers: { 'Accept': 'application/json' } }); }
        p().then(function(r){
            if (r.ok) return r;
            if (r.status === 400 || r.status === 405) return g();
            throw new Error('HTTP ' + r.status);
        }).then(function(r){
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        }).then(function(json){
            STATE.raw = normalizePayload(json);
            if (!STATE.raw.length) throw new Error('No records returned from flow.');
            scopeAndRender();
            show('ready');
        }).catch(function(err){
            console.error('[Reports]', err);
            $('rep-error-msg').textContent = 'Could not load data: ' + err.message;
            show('error');
        });
    }

    // PERIOD SCOPING
    function getPeriodWindow(value) {
        var now = new Date();
        var start, end = new Date(now.getTime() + 86400000);
        switch (value) {
            case 'this_month':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'last_month':
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                end = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'this_quarter':
                start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
                break;
            case 'ytd':
                start = new Date(now.getFullYear(), 0, 1);
                break;
            case 'last_12':
                start = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1);
                break;
            case 'all':
            default:
                return { start: null, end: null, label: 'All Time' };
        }
        var label = start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' → ' + new Date(end.getTime() - 86400000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        return { start: start.getTime(), end: end.getTime(), label: label };
    }

    function scopeAndRender() {
        var period = $('rep-period').value;
        var w = getPeriodWindow(period);
        if (w.start === null) {
            STATE.scoped = STATE.raw.slice();
        } else {
            STATE.scoped = STATE.raw.filter(function(j){
                var ref = j.StartTime || j.Created;
                if (!ref) return false;
                var t = new Date(ref).getTime();
                return !isNaN(t) && t >= w.start && t < w.end;
            });
        }
        $('rep-meta-period').textContent = 'Period: ' + w.label;
        $('rep-meta-records').textContent = STATE.scoped.length + ' records';
        $('rep-meta-updated').textContent = 'Updated: ' + new Date().toLocaleString('en-GB');
        renderAll();
    }

    // SUMMARY CARDS
    function renderSummary() {
        var jobs = STATE.scoped;
        var done = jobs.filter(function(j){ return normStatus(j.Status) === 'Done'; });
        var bd = jobs.filter(isBD);

        var totalDowntime = 0;
        jobs.forEach(function(j){ var h = hours(j.StartTime, j.EndTime); if (h !== null) totalDowntime += h; });

        var mttrSamples = done.map(function(j){ return hours(j.StartTime, j.EndTime); }).filter(function(v){ return v !== null && v > 0; });
        var mttr = avg(mttrSamples);

        var pmJobs = jobs.filter(isPM);
        var pmOnTime = pmJobs.filter(function(j){
            if (normStatus(j.Status) !== 'Done') return false;
            if (!j.DueDate || !j.EndTime) return false;
            return new Date(j.EndTime).getTime() <= new Date(j.DueDate + 'T23:59:59').getTime();
        });
        var pmPct = pmJobs.length ? (pmOnTime.length / pmJobs.length * 100) : null;

        $('sum-total').textContent = jobs.length;
        $('sum-total-sub').textContent = 'In selected period';
        $('sum-done').textContent = done.length;
        $('sum-done-sub').textContent = jobs.length ? ((done.length / jobs.length * 100).toFixed(1) + '% complete rate') : '— complete rate';
        $('sum-downtime').textContent = totalDowntime > 0 ? fmtHours(totalDowntime) : '—';
        $('sum-bd').textContent = bd.length;
        $('sum-mttr').textContent = mttr === null ? '—' : fmtHours(mttr);
        $('sum-pm').textContent = pmPct === null ? '—' : pmPct.toFixed(1) + '%';
        $('sum-pm-sub').textContent = pmJobs.length + ' PM job' + (pmJobs.length === 1 ? '' : 's');
    }

    // CHARTS
    function destroyChart(k) { if (STATE.charts[k]) { STATE.charts[k].destroy(); delete STATE.charts[k]; } }

    function renderMonthlyTrend() {
        if (typeof Chart === 'undefined') return;
        destroyChart('monthly');

        // Last 12 months including current
        var now = new Date();
        var months = [];
        for (var i = 11; i >= 0; i--) {
            var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push({
                key: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'),
                label: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
                start: d.getTime(),
                end: new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()
            });
        }

        var totals = months.map(function(m){
            return STATE.raw.filter(function(j){
                var ref = j.StartTime || j.Created;
                if (!ref) return false;
                var t = new Date(ref).getTime();
                return t >= m.start && t < m.end;
            }).length;
        });
        var bds = months.map(function(m){
            return STATE.raw.filter(function(j){
                if (!isBD(j)) return false;
                var ref = j.StartTime || j.Created;
                if (!ref) return false;
                var t = new Date(ref).getTime();
                return t >= m.start && t < m.end;
            }).length;
        });
        var pms = months.map(function(m){
            return STATE.raw.filter(function(j){
                if (!isPM(j)) return false;
                var ref = j.StartTime || j.Created;
                if (!ref) return false;
                var t = new Date(ref).getTime();
                return t >= m.start && t < m.end;
            }).length;
        });

        STATE.charts.monthly = new Chart($('rep-chart-monthly'), {
            type: 'bar',
            data: {
                labels: months.map(function(m){ return m.label; }),
                datasets: [
                    { label: 'Total Jobs', data: totals, backgroundColor: COLORS.primary, borderRadius: 4 },
                    { label: 'Breakdowns', data: bds, backgroundColor: COLORS.danger, borderRadius: 4 },
                    { label: 'Preventive', data: pms, backgroundColor: COLORS.success, borderRadius: 4 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 12 }, color: '#475569', boxWidth: 12 } },
                    tooltip: { backgroundColor: '#1E293B', titleFont: { family: 'Prompt', size: 12 }, bodyFont: { family: 'Inter', size: 12 } }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 11 }, color: '#94A3B8' } },
                    y: { beginAtZero: true, grid: { color: '#F1F5F9' }, ticks: { font: { family: 'Inter', size: 11 }, color: '#94A3B8', precision: 0 } }
                }
            }
        });
    }

    function groupCount(jobs, getKey) {
        var out = {};
        jobs.forEach(function(j){
            var k = getKey(j);
            if (!k) return;
            out[k] = (out[k] || 0) + 1;
        });
        return out;
    }

    function renderBarTop(canvasId, key, data, color, topN) {
        if (typeof Chart === 'undefined') return;
        destroyChart(key);
        var entries = Object.keys(data).map(function(k){ return [k, data[k]]; });
        entries.sort(function(a,b){ return b[1] - a[1]; });
        entries = entries.slice(0, topN || 10);
        STATE.charts[key] = new Chart($(canvasId), {
            type: 'bar',
            data: {
                labels: entries.map(function(e){ return e[0]; }),
                datasets: [{ data: entries.map(function(e){ return e[1]; }), backgroundColor: color, borderRadius: 5, maxBarThickness: 24 }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { backgroundColor: '#1E293B', titleFont: { family: 'Prompt', size: 12 }, bodyFont: { family: 'Inter', size: 12 } }
                },
                scales: {
                    x: { beginAtZero: true, grid: { color: '#F1F5F9' }, ticks: { font: { family: 'Inter', size: 11 }, color: '#94A3B8' } },
                    y: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 11 }, color: '#475569' } }
                }
            }
        });
    }

    function renderDonut(canvasId, key, data) {
        if (typeof Chart === 'undefined') return;
        destroyChart(key);
        var labels = Object.keys(data);
        STATE.charts[key] = new Chart($(canvasId), {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: labels.map(function(l){ return data[l]; }),
                    backgroundColor: labels.map(function(_,i){ return PALETTE[i % PALETTE.length]; }),
                    borderColor: '#FFFFFF',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '62%',
                plugins: {
                    legend: { position: 'right', labels: { boxWidth: 10, font: { family: 'Inter', size: 11 }, color: '#475569' } },
                    tooltip: { backgroundColor: '#1E293B', titleFont: { family: 'Prompt', size: 12 }, bodyFont: { family: 'Inter', size: 12 } }
                }
            }
        });
    }

    // TABLES
    function renderRootCauseTable() {
        var jobs = STATE.scoped;
        var grouped = {};
        jobs.forEach(function(j){
            var rc = (j.RootCause || '').trim();
            if (!rc) return;
            if (!grouped[rc]) grouped[rc] = { count: 0, downtime: 0, machines: {} };
            grouped[rc].count++;
            var h = hours(j.StartTime, j.EndTime);
            if (h !== null) grouped[rc].downtime += h;
            if (j.Machine) grouped[rc].machines[j.Machine] = (grouped[rc].machines[j.Machine] || 0) + 1;
        });
        var arr = Object.keys(grouped).map(function(k){ return [k, grouped[k]]; })
            .sort(function(a,b){ return b[1].count - a[1].count; }).slice(0, 10);

        var tbody = document.querySelector('#rep-table-rootcause tbody');
        if (!arr.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="rep-table-empty">No root cause data in this period</td></tr>';
            return;
        }
        tbody.innerHTML = arr.map(function(row, i){
            var topMachine = Object.keys(row[1].machines).sort(function(a,b){ return row[1].machines[b] - row[1].machines[a]; })[0] || '—';
            return '<tr>' +
                '<td>' + (i + 1) + '</td>' +
                '<td>' + escapeHTML(row[0]) + '</td>' +
                '<td>' + row[1].count + '</td>' +
                '<td>' + (row[1].downtime > 0 ? row[1].downtime.toFixed(1) : '—') + '</td>' +
                '<td>' + escapeHTML(topMachine) + '</td>' +
                '</tr>';
        }).join('');
    }

    function renderTechTable() {
        var jobs = STATE.scoped;
        var techs = {};
        jobs.forEach(function(j){
            var names = splitNames(j.AssignedTo);
            if (!names.length && j.ActionBy) names = [String(j.ActionBy).trim()];
            names.forEach(function(n){
                if (!techs[n]) techs[n] = { handled: 0, done: 0, mttrSamples: [], downtime: 0 };
                techs[n].handled++;
                if (normStatus(j.Status) === 'Done') {
                    techs[n].done++;
                    var h = hours(j.StartTime, j.EndTime);
                    if (h !== null && h > 0) {
                        techs[n].mttrSamples.push(h);
                        techs[n].downtime += h;
                    }
                }
            });
        });
        var arr = Object.keys(techs).map(function(k){ return [k, techs[k]]; })
            .sort(function(a,b){ return b[1].handled - a[1].handled; });

        var tbody = document.querySelector('#rep-table-techs tbody');
        if (!arr.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="rep-table-empty">No technician data in this period</td></tr>';
            return;
        }
        tbody.innerHTML = arr.map(function(row){
            var d = row[1];
            var mt = avg(d.mttrSamples);
            return '<tr>' +
                '<td style="font-weight:600;color:#1E293B;text-align:left">' + escapeHTML(row[0]) + '</td>' +
                '<td>' + d.handled + '</td>' +
                '<td>' + d.done + '</td>' +
                '<td>' + (mt === null ? '—' : fmtHours(mt)) + '</td>' +
                '<td>' + (d.downtime > 0 ? d.downtime.toFixed(1) : '—') + '</td>' +
                '</tr>';
        }).join('');
    }

    function renderAll() {
        renderSummary();
        renderMonthlyTrend();

        var jobs = STATE.scoped;
        var machineCount = groupCount(jobs, function(j){ return j.Machine; });
        renderBarTop('rep-chart-machines', 'machines', machineCount, COLORS.primary, 10);

        var downtimeByMachine = {};
        jobs.forEach(function(j){
            var h = hours(j.StartTime, j.EndTime);
            if (h !== null && j.Machine) downtimeByMachine[j.Machine] = (downtimeByMachine[j.Machine] || 0) + h;
        });
        Object.keys(downtimeByMachine).forEach(function(k){ downtimeByMachine[k] = +downtimeByMachine[k].toFixed(1); });
        renderBarTop('rep-chart-downtime', 'downtime', downtimeByMachine, COLORS.navy, 10);

        renderDonut('rep-chart-status', 'status', groupCount(jobs, function(j){ return normStatus(j.Status); }));
        renderDonut('rep-chart-jobtype', 'jobtype', groupCount(jobs, function(j){ return j.JobType; }));
        renderDonut('rep-chart-priority', 'priority', groupCount(jobs, function(j){ return j.Priority; }));

        renderRootCauseTable();
        renderTechTable();
    }

    // CSV EXPORTS
    function downloadCSV(filename, headers, rows) {
        var lines = [headers.join(',')];
        rows.forEach(function(r){
            lines.push(r.map(function(v){
                if (v === null || v === undefined) return '';
                var s = String(v).replace(/"/g, '""');
                return /[",\n]/.test(s) ? '"' + s + '"' : s;
            }).join(','));
        });
        var blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function exportFor(kind) {
        var datestamp = new Date().toISOString().slice(0,10);
        if (kind === 'monthly') {
            // Last 12 months totals
            var now = new Date();
            var rows = [];
            for (var i = 11; i >= 0; i--) {
                var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                var start = d.getTime();
                var end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
                var monthJobs = STATE.raw.filter(function(j){
                    var ref = j.StartTime || j.Created;
                    if (!ref) return false;
                    var t = new Date(ref).getTime();
                    return t >= start && t < end;
                });
                rows.push([
                    d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
                    monthJobs.length,
                    monthJobs.filter(isBD).length,
                    monthJobs.filter(isPM).length
                ]);
            }
            downloadCSV('BFLFP_MonthlyTrend_' + datestamp + '.csv', ['Month','Total Jobs','Breakdowns','Preventive'], rows);
        } else if (kind === 'machines') {
            var byMachine = groupCount(STATE.scoped, function(j){ return j.Machine; });
            var rows = Object.keys(byMachine).map(function(k){ return [k, byMachine[k]]; }).sort(function(a,b){ return b[1] - a[1]; });
            downloadCSV('BFLFP_TopMachines_' + datestamp + '.csv', ['Machine','Issues'], rows);
        } else if (kind === 'downtime') {
            var dt = {};
            STATE.scoped.forEach(function(j){
                var h = hours(j.StartTime, j.EndTime);
                if (h !== null && j.Machine) dt[j.Machine] = (dt[j.Machine] || 0) + h;
            });
            var rows = Object.keys(dt).map(function(k){ return [k, dt[k].toFixed(2)]; }).sort(function(a,b){ return parseFloat(b[1]) - parseFloat(a[1]); });
            downloadCSV('BFLFP_DowntimeByMachine_' + datestamp + '.csv', ['Machine','Total Downtime (hrs)'], rows);
        } else if (kind === 'rootcause') {
            var grouped = {};
            STATE.scoped.forEach(function(j){
                var rc = (j.RootCause || '').trim();
                if (!rc) return;
                grouped[rc] = (grouped[rc] || 0) + 1;
            });
            var rows = Object.keys(grouped).map(function(k){ return [k, grouped[k]]; }).sort(function(a,b){ return b[1] - a[1]; });
            downloadCSV('BFLFP_RootCauses_' + datestamp + '.csv', ['Root Cause','Count'], rows);
        } else if (kind === 'techs') {
            var techs = {};
            STATE.scoped.forEach(function(j){
                var names = splitNames(j.AssignedTo);
                if (!names.length && j.ActionBy) names = [String(j.ActionBy).trim()];
                names.forEach(function(n){
                    if (!techs[n]) techs[n] = { handled: 0, done: 0 };
                    techs[n].handled++;
                    if (normStatus(j.Status) === 'Done') techs[n].done++;
                });
            });
            var rows = Object.keys(techs).map(function(k){ return [k, techs[k].handled, techs[k].done]; }).sort(function(a,b){ return b[1] - a[1]; });
            downloadCSV('BFLFP_Technicians_' + datestamp + '.csv', ['Technician','Jobs Handled','Jobs Completed'], rows);
        }
    }

    function wire() {
        $('rep-period').addEventListener('change', scopeAndRender);
        $('rep-refresh').addEventListener('click', fetchData);
        $('rep-retry').addEventListener('click', fetchData);
        document.querySelectorAll('.rep-card-export').forEach(function(btn){
            btn.addEventListener('click', function(){
                exportFor(btn.dataset.export);
            });
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

/* ============================================
   BFLFP MAINTENANCE CONTROL CENTER — HOME JS
   Live data: fetches from the same Power Automate flow as Dashboard
   ============================================ */

(function() {
    'use strict';

    // ============================================
    // CONFIG — shared with Dashboard
    // ============================================
    var DATA_URL = 'https://e3f3e42aeed8e8578b8fbeb256cd05.92.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/761fb5647d804b62a867d1ce49124311/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=B3DKRO5DG6GO3A6Ldjfet5kNncZV1rE4geWQhCKtSEs';

    // ============================================
    // UTILITIES
    // ============================================
    function $(id) { return document.getElementById(id); }
    function safeText(v) { return (v === null || v === undefined) ? '' : String(v); }
    function escapeHTML(s) {
        return String(s).replace(/[&<>"']/g, function(c){
            return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
        });
    }
    function hours(start, end) {
        if (!start || !end) return null;
        var a = new Date(start).getTime();
        var b = new Date(end).getTime();
        if (isNaN(a) || isNaN(b)) return null;
        return Math.max(0, (b - a) / 3600000);
    }
    function normStatus(s) {
        var x = (s || '').toString().toLowerCase().trim();
        if (x === 'done' || x === 'closed' || x === 'completed') return 'Done';
        if (x === 'open' || x === 'new') return 'Open';
        if (x.indexOf('progress') >= 0 || x === 'in-progress' || x === 'inprogress') return 'In Progress';
        if (x === 'pending' || x === 'waiting') return 'Pending';
        return s || '—';
    }
    function splitNames(s) {
        if (!s) return [];
        return String(s).split(/[,;|]/).map(function(x){ return x.trim(); }).filter(Boolean);
    }
    function fmtDate(s) {
        if (!s) return '—';
        var d = new Date(s);
        if (isNaN(d)) return safeText(s);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    function avg(arr) {
        if (!arr.length) return null;
        var s = 0, n = 0;
        for (var i=0;i<arr.length;i++) {
            if (arr[i] !== null && arr[i] !== undefined && !isNaN(arr[i])) { s += arr[i]; n++; }
        }
        return n ? s / n : null;
    }

    // ============================================
    // PAYLOAD NORMALIZER (same logic as Dashboard)
    // ============================================
    function normalizePayload(p) {
        if (!p) return [];
        if (typeof p === 'string') {
            try { p = JSON.parse(p); } catch (e) { return []; }
        }
        if (Array.isArray(p)) return p;
        if (typeof p === 'object' && (p.JobID || p.jobID || p.jobid)) return [p];

        var commonKeys = ['response','Response','value','jobs','data','results','items','records','body','Body','Result','output','payload'];
        for (var i=0;i<commonKeys.length;i++) {
            var v = p[commonKeys[i]];
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

        function findArr(obj, depth) {
            if (!obj || depth > 4) return null;
            if (Array.isArray(obj)) {
                if (!obj.length) return null;
                var first = obj[0];
                if (first && typeof first === 'object') {
                    var keys = Object.keys(first).map(function(k){ return k.toLowerCase(); });
                    if (keys.indexOf('jobid') >= 0 || keys.indexOf('machine') >= 0 || keys.indexOf('status') >= 0) return obj;
                }
                return null;
            }
            if (typeof obj === 'object') {
                for (var k in obj) {
                    if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
                    var found = findArr(obj[k], depth + 1);
                    if (found) return found;
                }
            }
            return null;
        }
        return findArr(p, 0) || [];
    }

    // ============================================
    // FETCH
    // ============================================
    function fetchJobs() {
        function tryPost() {
            return fetch(DATA_URL, {
                method: 'POST',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                body: '{}'
            });
        }
        function tryGet() {
            return fetch(DATA_URL, { method: 'GET', headers: { 'Accept': 'application/json' } });
        }
        return tryPost()
            .then(function(r){
                if (r.ok) return r;
                if (r.status === 400 || r.status === 405) return tryGet();
                throw new Error('HTTP ' + r.status);
            })
            .then(function(r){
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function(json){
                var jobs = normalizePayload(json);
                if (!jobs.length) console.warn('[Home] No records returned from flow');
                return jobs;
            })
            .catch(function(err){
                console.warn('[Home] Live data fetch failed:', err.message);
                return [];
            });
    }

    // ============================================
    // COUNT-UP ANIMATION
    // ============================================
    function animateCount(el, target, duration, suffix, decimals) {
        if (!el || target === null || target === undefined || isNaN(target)) {
            if (el) el.textContent = '—';
            return;
        }
        suffix = suffix || '';
        decimals = decimals || 0;
        duration = duration || 1400;
        var start = 0;
        var startTime = null;
        function step(ts) {
            if (!startTime) startTime = ts;
            var progress = Math.min((ts - startTime) / duration, 1);
            var eased = 1 - Math.pow(1 - progress, 3);
            var current = start + (target - start) * eased;
            el.textContent = (decimals ? current.toFixed(decimals) : Math.floor(current)) + suffix;
            if (progress < 1) requestAnimationFrame(step);
            else el.textContent = (decimals ? target.toFixed(decimals) : Math.round(target)) + suffix;
        }
        requestAnimationFrame(step);
    }

    // ============================================
    // POPULATE STATS STRIP + KPI CARDS FROM LIVE DATA
    // ============================================
    function populateLiveStats(jobs) {
        var statTotal = $('stat-total-jobs');
        var statMach  = $('stat-machines');
        var statTech  = $('stat-technicians');
        var statResp  = $('stat-response-time');
        var kpiMttr   = $('kpi-mttr');
        var kpiPm     = $('kpi-pm');
        var kpiBd     = $('kpi-bd');

        // Fallback values if live data is unavailable
        if (!jobs || !jobs.length) {
            setTimeout(function(){ if (statTotal) statTotal.textContent = '0'; }, 100);
            setTimeout(function(){ if (statMach) statMach.textContent = '0'; }, 200);
            setTimeout(function(){ if (statTech) statTech.textContent = '0'; }, 300);
            setTimeout(function(){ if (statResp) statResp.textContent = '—'; }, 400);
            setTimeout(function(){ if (kpiMttr) kpiMttr.textContent = '—'; }, 500);
            setTimeout(function(){ if (kpiPm) kpiPm.textContent = '—'; }, 600);
            setTimeout(function(){ if (kpiBd) kpiBd.textContent = '0'; }, 700);
            return;
        }

        var now = new Date();
        var monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        var monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime() - 1;

        // Jobs this month (by StartTime, fall back to Created)
        var thisMonth = jobs.filter(function(j){
            var ref = j.StartTime || j.Created;
            if (!ref) return false;
            var t = new Date(ref).getTime();
            return t >= monthStart && t <= monthEnd;
        });
        var totalThisMonth = thisMonth.length;

        // Unique machines (across all jobs)
        var machineSet = {};
        jobs.forEach(function(j){ if (j.Machine) machineSet[j.Machine] = 1; });
        var machineCount = Object.keys(machineSet).length;

        // Unique technicians (union of AssignedTo split + ActionBy)
        var techSet = {};
        jobs.forEach(function(j){
            splitNames(j.AssignedTo).forEach(function(n){ techSet[n] = 1; });
            if (j.ActionBy) techSet[String(j.ActionBy).trim()] = 1;
        });
        var techCount = Object.keys(techSet).length;

        // Avg response time: Created → StartTime in hours
        var respSamples = jobs.map(function(j){ return hours(j.Created, j.StartTime); })
                              .filter(function(v){ return v !== null && v >= 0; });
        var avgResp = avg(respSamples);

        // KPI MTTR: avg(EndTime - StartTime) for Done jobs
        var done = jobs.filter(function(j){ return normStatus(j.Status) === 'Done'; });
        var mttrSamples = done.map(function(j){ return hours(j.StartTime, j.EndTime); })
                              .filter(function(v){ return v !== null && v > 0; });
        var mttr = avg(mttrSamples);

        // KPI PM Compliance: % of Preventive jobs done by DueDate
        var pmJobs = jobs.filter(function(j){
            var t = (j.JobType || '').toLowerCase();
            return t.indexOf('preventive') >= 0 || t === 'pm';
        });
        var pmOnTime = pmJobs.filter(function(j){
            if (normStatus(j.Status) !== 'Done') return false;
            if (!j.DueDate || !j.EndTime) return false;
            return new Date(j.EndTime).getTime() <= new Date(j.DueDate + 'T23:59:59').getTime();
        });
        var pmPct = pmJobs.length ? (pmOnTime.length / pmJobs.length * 100) : null;

        // KPI Breakdowns: count of repair/breakdown jobs this month
        var bdThisMonth = thisMonth.filter(function(j){
            var t = (j.JobType || '').toLowerCase();
            return t.indexOf('repair') >= 0 || t.indexOf('breakdown') >= 0 || t.indexOf('corrective') >= 0;
        });

        // Staggered animations
        setTimeout(function(){ animateCount(statTotal, totalThisMonth, 1500); }, 100);
        setTimeout(function(){ animateCount(statMach, machineCount, 1500); }, 200);
        setTimeout(function(){ animateCount(statTech, techCount, 1200); }, 300);
        setTimeout(function(){
            if (statResp) statResp.textContent = (avgResp === null) ? '—' : avgResp.toFixed(1) + 'h';
        }, 400);
        setTimeout(function(){
            if (kpiMttr) kpiMttr.textContent = (mttr === null) ? '—' : mttr.toFixed(1) + 'h';
        }, 500);
        setTimeout(function(){
            if (kpiPm) kpiPm.textContent = (pmPct === null) ? '—' : pmPct.toFixed(1) + '%';
        }, 600);
        setTimeout(function(){ animateCount(kpiBd, bdThisMonth.length, 1400); }, 700);
    }

    // ============================================
    // POPULATE MACHINE STATUS GRID FROM LIVE DATA
    // ============================================
    function populateMachineGrid(jobs) {
        var grid = document.querySelector('.machine-grid');
        if (!grid) return;
        if (!jobs || !jobs.length) return; // keep existing static cards as fallback

        // Determine latest job per machine
        var byMachine = {};
        jobs.forEach(function(j){
            if (!j.Machine) return;
            var ref = new Date(j.Modified || j.EndTime || j.StartTime || j.Created || 0).getTime();
            if (!byMachine[j.Machine] || ref > byMachine[j.Machine]._t) {
                byMachine[j.Machine] = { job: j, _t: ref };
            }
        });

        // Build sorted list (most recent activity first)
        var machines = Object.keys(byMachine).map(function(m){
            return { name: m, job: byMachine[m].job, _t: byMachine[m]._t };
        }).sort(function(a,b){ return b._t - a._t; });

        // Show up to 6 machines on the home page
        machines = machines.slice(0, 6);

        function statusFor(job) {
            var s = normStatus(job.Status);
            if (s === 'Done') return { label: 'Running', cls: 'status-running' };
            if (s === 'In Progress' || s === 'Open' || s === 'Pending') return { label: 'Under Maintenance', cls: 'status-maintenance' };
            return { label: 'Standby', cls: 'status-standby' };
        }

        function lastPMDate(machineName) {
            // Most recent Preventive job EndTime for this machine
            var latest = null;
            jobs.forEach(function(j){
                if (j.Machine !== machineName) return;
                var t = (j.JobType || '').toLowerCase();
                if (t.indexOf('preventive') < 0 && t !== 'pm') return;
                if (normStatus(j.Status) !== 'Done') return;
                var when = j.EndTime || j.Modified;
                if (!when) return;
                var ts = new Date(when).getTime();
                if (!latest || ts > latest) latest = ts;
            });
            return latest ? fmtDate(new Date(latest)) : '—';
        }

        var iconSvg = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

        grid.innerHTML = machines.map(function(m){
            var st = statusFor(m.job);
            var pmDate = lastPMDate(m.name);
            return '<div class="machine-card">' +
                '<div class="machine-card-top">' +
                    '<div class="machine-icon">' + iconSvg + '</div>' +
                    '<span class="status-badge ' + st.cls + '">' + st.label + '</span>' +
                '</div>' +
                '<h3 class="machine-name">' + escapeHTML(m.name) + '</h3>' +
                '<p class="machine-th">Last job: ' + escapeHTML(safeText(m.job.JobID) || '—') + '</p>' +
                '<div class="machine-meta"><span>Last PM:</span><strong>' + pmDate + '</strong></div>' +
            '</div>';
        }).join('');
    }

    // ============================================
    // POPULATE RECENT JOBS TABLE FROM LIVE DATA
    // ============================================
    function populateRecentJobs(jobs) {
        var table = $('recent-jobs-table');
        if (!table) return;
        var tbody = table.querySelector('tbody');
        if (!tbody) return;
        if (!jobs || !jobs.length) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:#64748B">No live data available · ไม่มีข้อมูล</td></tr>';
            return;
        }

        function priorityClass(p) {
            var x = (p || '').toLowerCase();
            if (x === 'high' || x === 'critical' || x === 'urgent') return 'priority-high';
            if (x === 'medium' || x === 'normal') return 'priority-medium';
            return 'priority-low';
        }
        function statusClass(s) {
            var n = normStatus(s);
            if (n === 'Done') return 'status-closed';
            if (n === 'In Progress') return 'status-progress';
            return 'status-open';
        }

        // Sort by Created/StartTime descending, take 5
        var recent = jobs.slice().sort(function(a,b){
            var ta = new Date(a.Created || a.StartTime || 0).getTime();
            var tb = new Date(b.Created || b.StartTime || 0).getTime();
            return tb - ta;
        }).slice(0, 5);

        tbody.innerHTML = '';
        recent.forEach(function(j, idx){
            var row = document.createElement('tr');
            row.style.opacity = '0';
            row.style.transform = 'translateY(8px)';
            row.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
            row.innerHTML =
                '<td>' + escapeHTML(safeText(j.JobID)) + '</td>' +
                '<td>' + escapeHTML(safeText(j.Machine)) + '</td>' +
                '<td><span class="type-pill">' + escapeHTML(safeText(j.JobType) || '—') + '</span></td>' +
                '<td><span class="priority-pill ' + priorityClass(j.Priority) + '">' + escapeHTML(safeText(j.Priority) || '—') + '</span></td>' +
                '<td><span class="status-pill ' + statusClass(j.Status) + '">' + escapeHTML(normStatus(j.Status)) + '</span></td>' +
                '<td>' + escapeHTML(safeText(j.ActionBy) || safeText(j.AssignedTo) || '—') + '</td>' +
                '<td>' + fmtDate(j.StartTime || j.Created) + '</td>';
            tbody.appendChild(row);
            setTimeout(function(){
                row.style.opacity = '1';
                row.style.transform = 'translateY(0)';
            }, 100 + idx * 100);
        });
    }

    // ============================================
    // NAV / UI HELPERS (kept from previous version)
    // ============================================
    function initNavToggle() {
        var toggle = $('nav-toggle');
        var links = $('nav-links');
        if (!toggle || !links) return;
        toggle.addEventListener('click', function(){
            var isOpen = links.classList.toggle('open');
            toggle.classList.toggle('open', isOpen);
        });
        document.addEventListener('click', function(e){
            if (!links.contains(e.target) && !toggle.contains(e.target)) {
                links.classList.remove('open');
                toggle.classList.remove('open');
            }
        });
    }
    function initSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(function(link){
            link.addEventListener('click', function(e){
                var hash = this.getAttribute('href');
                if (hash.length <= 1) return;
                var target = document.querySelector(hash);
                if (target) { e.preventDefault(); target.scrollIntoView({behavior:'smooth', block:'start'}); }
            });
        });
    }
    function initActiveNav() {
        var path = (window.location.pathname || '/').toLowerCase().replace(/\/$/, '') || '/';
        var links = document.querySelectorAll('.nav-links a');
        var best = null, bestLen = -1;
        links.forEach(function(a){
            var href = (a.getAttribute('href') || '').toLowerCase().replace(/\/$/, '') || '/';
            if (href === path && href.length > bestLen) { best = a; bestLen = href.length; }
            else if (href !== '/' && path.indexOf(href) === 0 && href.length > bestLen) { best = a; bestLen = href.length; }
        });
        if (best) {
            links.forEach(function(a){ a.classList.remove('active'); });
            best.classList.add('active');
        } else if (path === '/' || path === '') {
            var home = document.querySelector('.nav-links a[href="/"]');
            if (home) { links.forEach(function(a){ a.classList.remove('active'); }); home.classList.add('active'); }
        }
    }
    function initSiteClock() {
        var el = $('site-clock');
        if (!el) return;
        function tick() {
            var d = new Date();
            el.textContent = d.toLocaleTimeString('en-GB');
        }
        tick();
        setInterval(tick, 1000);
    }
    function initRevealOnScroll() {
        if (!('IntersectionObserver' in window)) return;
        var items = document.querySelectorAll('.kpi-card, .machine-card, .how-step, .stat-card');
        items.forEach(function(el){
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        });
        var io = new IntersectionObserver(function(entries){
            entries.forEach(function(entry, idx){
                if (entry.isIntersecting) {
                    var el = entry.target;
                    setTimeout(function(){
                        el.style.opacity = '1';
                        el.style.transform = 'translateY(0)';
                    }, idx * 60);
                    io.unobserve(el);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
        items.forEach(function(el){ io.observe(el); });
    }

    // ============================================
    // INIT
    // ============================================
    function init() {
        try { initNavToggle(); } catch (e) { console.warn('navToggle:', e); }
        try { initSmoothScroll(); } catch (e) { console.warn('smoothScroll:', e); }
        try { initActiveNav(); } catch (e) { console.warn('activeNav:', e); }
        try { initSiteClock(); } catch (e) { console.warn('siteClock:', e); }
        try { initRevealOnScroll(); } catch (e) { console.warn('reveal:', e); }

        // Fetch live data and populate dynamic sections
        fetchJobs().then(function(jobs){
            try { populateLiveStats(jobs); } catch (e) { console.warn('liveStats:', e); }
            try { populateMachineGrid(jobs); } catch (e) { console.warn('machineGrid:', e); }
            try { populateRecentJobs(jobs); } catch (e) { console.warn('recentJobs:', e); }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

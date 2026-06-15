/* ============================================
   BFLFP — PM Live Compliance
   Self-contained module that runs on the Dashboard page.
   Reads Assets + PMCompletions via BFLFP.data, computes per-frequency
   "Did this period's PMs happen?" status, renders tiles + tables.
   Mon-Sun ISO week. Period definitions:
     Weekly:    current Mon–Sun
     Monthly:   current calendar month
     Quarterly: current calendar quarter
     Bi-Annual: current half-year (Jan–Jun or Jul–Dec)
     Annual:    current calendar year
   ============================================ */
(function () {
    'use strict';
    if (window.BFLFP_PMLive) return;

    var FREQS = [
        { code: 'W', label: 'Weekly',    th: 'รายสัปดาห์',  match: 'Weekly'    },
        { code: 'M', label: 'Monthly',   th: 'รายเดือน',    match: 'Monthly'   },
        { code: 'Q', label: 'Quarterly', th: 'ราย 3 เดือน',  match: 'Quarterly' },
        { code: 'S', label: 'Bi-Annual', th: 'ราย 6 เดือน',  match: 'Bi-Annual' },
        { code: 'A', label: 'Annual',    th: 'รายปี',       match: 'Annual'    }
    ];

    function $(id) { return document.getElementById(id); }

    function fmtDate(d) {
        if (!d) return '—';
        var dd = new Date(d);
        if (isNaN(dd)) return String(d).slice(0, 10);
        return dd.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    }
    function fmtDateLong(d) {
        if (!d) return '—';
        var dd = new Date(d);
        if (isNaN(dd)) return String(d);
        return dd.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    function esc(s) {
        return (s == null ? '' : String(s))
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // Mon-Sun week. Returns Date at midnight.
    function startOfWeekMon(d) {
        var dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        var day = dt.getDay(); // 0=Sun..6=Sat
        var diff = day === 0 ? -6 : 1 - day;
        dt.setDate(dt.getDate() + diff);
        return dt;
    }
    function addDays(d, n) {
        var x = new Date(d); x.setDate(x.getDate() + n); return x;
    }

    function periodBounds(freqCode, now) {
        now = now || new Date();
        var start, end;
        if (freqCode === 'W') {
            start = startOfWeekMon(now);
            end   = addDays(start, 7);
        } else if (freqCode === 'M') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end   = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        } else if (freqCode === 'Q') {
            var qStart = Math.floor(now.getMonth() / 3) * 3;
            start = new Date(now.getFullYear(), qStart, 1);
            end   = new Date(now.getFullYear(), qStart + 3, 1);
        } else if (freqCode === 'S') {
            var hStart = now.getMonth() < 6 ? 0 : 6;
            start = new Date(now.getFullYear(), hStart, 1);
            end   = new Date(now.getFullYear(), hStart + 6, 1);
        } else if (freqCode === 'A') {
            start = new Date(now.getFullYear(), 0, 1);
            end   = new Date(now.getFullYear() + 1, 0, 1);
        }
        return { start: start, end: end };
    }
    function periodLabel(freqCode, bounds) {
        var s = bounds.start, e = new Date(bounds.end); e.setDate(e.getDate() - 1);
        if (freqCode === 'W') return fmtDate(s) + ' – ' + fmtDate(e);
        if (freqCode === 'M') return s.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        if (freqCode === 'Q') return 'Q' + (Math.floor(s.getMonth()/3) + 1) + ' ' + s.getFullYear();
        if (freqCode === 'S') return (s.getMonth() === 0 ? 'H1' : 'H2') + ' ' + s.getFullYear();
        if (freqCode === 'A') return String(s.getFullYear());
        return '';
    }

    function inPeriod(dateStr, bounds) {
        if (!dateStr) return false;
        var d = new Date(dateStr);
        if (isNaN(d)) return false;
        return d >= bounds.start && d < bounds.end;
    }

    function statusClassFromPct(pct) {
        if (pct >= 90) return 'pmlive-status-ok';
        if (pct >= 70) return 'pmlive-status-warn';
        if (pct > 0)   return 'pmlive-status-bad';
        return 'pmlive-status-none';
    }
    function statusTextFromPct(pct) {
        if (pct >= 90) return 'On track';
        if (pct >= 70) return 'Behind';
        if (pct > 0)   return 'Critical';
        return 'No data';
    }

    function daysAgo(dateStr) {
        if (!dateStr) return '—';
        var d = new Date(dateStr);
        if (isNaN(d)) return '—';
        var diff = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
        if (diff < 0) return 'today';
        if (diff === 0) return 'today';
        if (diff === 1) return '1 day';
        return diff + ' days';
    }

    function compute(assets, completions) {
        var now = new Date();
        var byFreq = {};
        var allPending = [];

        FREQS.forEach(function (f) {
            var bounds = periodBounds(f.code, now);
            var matchingAssets = (assets || []).filter(function (a) {
                return a.pm_frequency === f.match && a.status !== 'Scrapped';
            });
            // For each matching asset, find latest PMCompletion (any time, for last-done)
            // and check if any completion falls in current period.
            var byAsset = {};
            (completions || []).forEach(function (c) {
                if (!c.asset_id) return;
                var d = c.pm_date || c.submitted_at;
                if (!d) return;
                if (!byAsset[c.asset_id] || new Date(d) > new Date(byAsset[c.asset_id].pm_date || byAsset[c.asset_id].submitted_at)) {
                    byAsset[c.asset_id] = c;
                }
            });
            var done = 0;
            var pending = [];
            matchingAssets.forEach(function (a) {
                var last = byAsset[a.asset_id];
                var lastDate = last ? (last.pm_date || last.submitted_at) : null;
                var doneThisPeriod = (completions || []).some(function (c) {
                    return c.asset_id === a.asset_id && inPeriod(c.pm_date || c.submitted_at, bounds);
                });
                if (doneThisPeriod) {
                    done++;
                } else {
                    pending.push({
                        asset_id: a.asset_id,
                        name:     a.name || '',
                        class_name: a.class_name || '',
                        frequency: f.code,
                        last_done: lastDate
                    });
                }
            });
            var total = matchingAssets.length;
            var pct = total ? Math.round((done / total) * 100) : 0;
            byFreq[f.code] = {
                code: f.code, label: f.label, th: f.th,
                bounds: bounds, period: periodLabel(f.code, bounds),
                total: total, done: done, pending: pending.length, pct: pct
            };
            // pending tasks accumulate
            allPending = allPending.concat(pending);
        });

        // Recent submissions (last 30 days)
        var cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
        var recent = (completions || []).filter(function (c) {
            var d = new Date(c.pm_date || c.submitted_at);
            return !isNaN(d) && d >= cutoff;
        }).sort(function (a, b) {
            return new Date(b.pm_date || b.submitted_at) - new Date(a.pm_date || a.submitted_at);
        });

        // Sort pending by frequency priority (W, M, Q, S, A) then by last_done (oldest first)
        var freqOrder = { W: 1, M: 2, Q: 3, S: 4, A: 5 };
        allPending.sort(function (a, b) {
            if (freqOrder[a.frequency] !== freqOrder[b.frequency]) {
                return freqOrder[a.frequency] - freqOrder[b.frequency];
            }
            return new Date(a.last_done || 0) - new Date(b.last_done || 0);
        });

        return { byFreq: byFreq, pending: allPending, recent: recent };
    }

    function renderTiles(byFreq) {
        var html = FREQS.map(function (f) {
            var d = byFreq[f.code];
            if (!d.total) {
                return '<div class="pmlive-tile freq-' + f.code + '">' +
                    '<div class="pmlive-tile-freq"><i></i>' + f.label + '</div>' +
                    '<div class="pmlive-tile-value"><span class="pmlive-tile-pct">—</span></div>' +
                    '<div class="pmlive-tile-meta">No assets at this frequency</div>' +
                    '<span class="pmlive-tile-status pmlive-status-none">N/A</span>' +
                    '</div>';
            }
            return '<div class="pmlive-tile freq-' + f.code + '">' +
                '<div class="pmlive-tile-freq"><i></i>' + f.label + ' <small>· ' + esc(f.th) + '</small></div>' +
                '<div class="pmlive-tile-value">' +
                    '<span class="pmlive-tile-pct">' + d.pct + '%</span>' +
                    '<span class="pmlive-tile-frac">' + d.done + ' / ' + d.total + '</span>' +
                '</div>' +
                '<div class="pmlive-tile-meta">' + esc(d.period) + '</div>' +
                '<span class="pmlive-tile-status ' + statusClassFromPct(d.pct) + '">' +
                    statusTextFromPct(d.pct) + '</span>' +
                '</div>';
        }).join('');
        $('pmlive-tiles').innerHTML = html;
    }

    function renderPending(pending) {
        $('pmlive-pending-count').textContent = pending.length;
        var tbody = $('pmlive-pending-table').querySelector('tbody');
        if (!pending.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="pmlive-empty">🎉 All PMs done for the current period — nothing pending!</td></tr>';
            return;
        }
        tbody.innerHTML = pending.slice(0, 200).map(function (p) {
            return '<tr>' +
                '<td><code>' + esc(p.asset_id) + '</code></td>' +
                '<td>' + esc(p.name) + '</td>' +
                '<td>' + esc(p.class_name) + '</td>' +
                '<td><span class="freq-pill ' + p.frequency + '">' + p.frequency + '</span></td>' +
                '<td>' + (p.last_done ? fmtDateLong(p.last_done) : '<em style="color:#94A3B8">never</em>') + '</td>' +
                '<td>' + daysAgo(p.last_done) + '</td>' +
                '</tr>';
        }).join('');
    }

    function renderRecent(recent) {
        $('pmlive-recent-count').textContent = recent.length;
        var tbody = $('pmlive-recent-table').querySelector('tbody');
        if (!recent.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="pmlive-empty">No PM completions in the last 30 days.</td></tr>';
            return;
        }
        tbody.innerHTML = recent.slice(0, 100).map(function (r) {
            var resCls = /fail/i.test(r.overall_result) ? 'fail'
                       : /finding/i.test(r.overall_result) ? 'warn' : 'pass';
            var freq = (r.pm_type || '').charAt(0).toUpperCase();
            if (freq === 'B') freq = 'S'; // Bi-Annual short code
            var pct = (r.tasks_passed != null && r.tasks_failed != null)
                ? (Number(r.tasks_passed) + '/' + (Number(r.tasks_passed) + Number(r.tasks_failed||0) + Number(r.tasks_na||0)))
                : '—';
            return '<tr>' +
                '<td>' + fmtDateLong(r.pm_date || r.submitted_at) + '</td>' +
                '<td><code>' + esc(r.asset_id) + '</code></td>' +
                '<td>' + esc(r.asset_name || r.asset_class || '') + '</td>' +
                '<td>' + esc(r.technician || '—') + '</td>' +
                '<td>' + (freq ? '<span class="freq-pill ' + freq + '">' + freq + '</span>' : esc(r.pm_type || '')) + '</td>' +
                '<td><span class="res-pill ' + resCls + '">' + esc(r.overall_result || '—') + '</span></td>' +
                '<td>' + pct + '</td>' +
                '</tr>';
        }).join('');
    }

    function loadAndRender() {
        // Show loading
        if ($('pmlive-tiles')) {
            $('pmlive-tiles').innerHTML = '<div class="pmlive-tile-loading">Loading PM compliance…</div>';
        }
        if (!(window.BFLFP && BFLFP.data)) {
            console.warn('[PMLive] BFLFP.data not available');
            return;
        }
        Promise.all([
            BFLFP.data.assets(),
            BFLFP.data.completions()
        ]).then(function (both) {
            var assets = (both[0] && both[0].assets) || [];
            var completions = (both[1] && both[1].completions) || (Array.isArray(both[1]) ? both[1] : []);
            var result = compute(assets, completions);
            renderTiles(result.byFreq);
            renderPending(result.pending);
            renderRecent(result.recent);
        }).catch(function (err) {
            console.error('[PMLive] load failed:', err);
            if ($('pmlive-tiles')) {
                $('pmlive-tiles').innerHTML = '<div class="pmlive-tile-loading" style="color:#DC2626">⚠ Could not load PM compliance: ' + esc(err.message || err) + '</div>';
            }
        });
    }

    function init() {
        if (!$('pmlive-tiles')) {
            // Section not on this page — exit silently
            return;
        }
        loadAndRender();
        var btn = $('pmlive-refresh');
        if (btn) btn.addEventListener('click', function () {
            BFLFP.data.invalidate('completions');
            BFLFP.data.invalidate('assets');
            loadAndRender();
        });
    }

    window.BFLFP_PMLive = { init: init, loadAndRender: loadAndRender };

    // Auto-init if DOM is ready, otherwise wait
    function safeInit() {
        // Poll briefly for the dashboard fragment to be in DOM (SPA navigation can delay)
        var tries = 0;
        var iv = setInterval(function () {
            if ($('pmlive-tiles')) {
                clearInterval(iv);
                init();
            } else if (++tries > 30) {
                // 3 sec max wait — section not present on this page, give up silently
                clearInterval(iv);
            }
        }, 100);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', safeInit);
    } else {
        safeInit();
    }
    // Re-init on every SPA navigation to #dashboard
    window.addEventListener('hashchange', function () {
        if ((location.hash || '').toLowerCase().indexOf('dashboard') >= 0) {
            safeInit();
        }
    });
})();

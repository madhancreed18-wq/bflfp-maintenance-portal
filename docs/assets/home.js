/* ============================================
   BFLFP — HOME (v2) — data-driven landing
   Reads Assets + Checklists from the shared data-service.
   ============================================ */

(function () {
    'use strict';

    function $(id) { return document.getElementById(id); }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
        });
    }

    // ----- Live clock -----
    function tickClock() {
        var el = $('hp-current-time');
        if (!el) return;
        var d = new Date();
        var dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        var hh = String(d.getHours()).padStart(2, '0');
        var mm = String(d.getMinutes()).padStart(2, '0');
        el.textContent = dayNames[d.getDay()] + ', ' + d.getDate() + ' ' + monthNames[d.getMonth()] + ' ' + d.getFullYear() + ' · ' + hh + ':' + mm;
    }

    // ----- Counting helpers -----
    function countBy(arr, keyFn) {
        var out = {};
        arr.forEach(function (item) {
            var k = keyFn(item) || '(unknown)';
            out[k] = (out[k] || 0) + 1;
        });
        return out;
    }

    function sortedEntries(obj, desc) {
        return Object.keys(obj)
            .map(function (k) { return [k, obj[k]]; })
            .sort(function (a, b) { return desc ? (b[1] - a[1]) : (a[0] < b[0] ? -1 : 1); });
    }

    // ----- Bar renderer -----
    function renderBars(containerId, entries, colorMap, total) {
        var c = $(containerId);
        if (!c) return;
        if (!entries.length) { c.innerHTML = '<div class="hp-bar-empty">No data</div>'; return; }
        var html = '';
        entries.forEach(function (e) {
            var label = e[0], count = e[1];
            var pct = total > 0 ? Math.round((count / total) * 100) : 0;
            var colorCls = colorMap && colorMap[label] ? colorMap[label] : 'hp-color-blue';
            html += '<div class="hp-bar-row">' +
                      '<div class="hp-bar-rail">' +
                        '<div class="hp-bar-fill ' + colorCls + '" data-pct="' + pct + '" style="width:0%"></div>' +
                        '<div class="hp-bar-label">' + esc(label) + ' <span style="opacity:0.7; margin-left:6px; font-weight:400;">' + pct + '%</span></div>' +
                      '</div>' +
                      '<div class="hp-bar-count">' + count + '</div>' +
                    '</div>';
        });
        c.innerHTML = html;
        // Animate fills after a tick so the transition runs
        setTimeout(function () {
            c.querySelectorAll('.hp-bar-fill').forEach(function (b) {
                b.style.width = b.getAttribute('data-pct') + '%';
            });
        }, 50);
    }

    function renderClassList(containerId, entries, max) {
        var c = $(containerId);
        if (!c) return;
        var top = entries.slice(0, max || 12);
        if (!top.length) { c.innerHTML = '<div class="hp-bar-empty">No data</div>'; return; }
        var html = '';
        top.forEach(function (e, i) {
            html += '<div class="hp-class-row">' +
                      '<span class="hp-class-rank">#' + (i + 1) + '</span>' +
                      '<span class="hp-class-name">' + esc(e[0]) + '</span>' +
                      '<span class="hp-class-count">' + e[1] + '</span>' +
                    '</div>';
        });
        c.innerHTML = html;
    }

    function setText(id, txt) {
        var el = $(id);
        if (el) el.textContent = txt;
    }

    // ----- Main render -----
    function render(data) {
        var assets    = (data.assets || []).filter(function (a) { return a && a.asset_id; });
        var checklist = data.checklists || {};
        var sheets    = checklist.sheets || [];
        var tasks     = checklist.tasks || [];
        var maps      = checklist.maps || [];

        // KPI tiles
        setText('hp-count-assets',    assets.length || '—');
        setText('hp-count-templates', sheets.length || '—');
        setText('hp-count-tasks',     tasks.length  || '—');
        setText('hp-count-mappings',  maps.length   || '—');

        // Sub-labels with extra context
        var activeCount = assets.filter(function (a) { return (a.status || 'Active') === 'Active'; }).length;
        setText('hp-count-assets-sub', activeCount + ' active');

        var classesWithSheet = new Set(sheets.map(function (s) { return (s.class || s.class_name || s.name || '').trim(); }));
        classesWithSheet.delete('');
        setText('hp-count-templates-sub', classesWithSheet.size + ' distinct classes covered');

        var avgPerSheet = sheets.length ? Math.round(tasks.length / sheets.length) : 0;
        setText('hp-count-tasks-sub', avgPerSheet + ' avg tasks / sheet');

        var withMap = new Set(maps.map(function (m) { return m.asset_id; })).size;
        setText('hp-count-mappings-sub', withMap + ' assets mapped');

        // Breakdown — by Type
        var byType = countBy(assets, function (a) { return a.type || 'Machine'; });
        var typeEntries = sortedEntries(byType, true);
        renderBars('hp-bars-type', typeEntries, {
            'Machine':   'hp-color-blue',
            'Utilities': 'hp-color-green',
            'IT':        'hp-color-amber'
        }, assets.length);
        setText('hp-type-sub', typeEntries.length + ' categories');

        // Breakdown — by Criticality
        var byCrit = countBy(assets, function (a) {
            var v = (a.criticality || '').trim();
            // Normalise variants ("Critical (A)" -> "Critical (A)", etc.)
            if (/^Critical/i.test(v)) return 'Critical (A)';
            if (/^Major/i.test(v))    return 'Major (B)';
            if (/^Minor/i.test(v))    return 'Minor (C)';
            return v || '(none)';
        });
        var critOrder = ['Critical (A)', 'Major (B)', 'Minor (C)', '(none)'];
        var critEntries = critOrder
            .filter(function (k) { return byCrit[k]; })
            .map(function (k) { return [k, byCrit[k]]; });
        // include any other values
        Object.keys(byCrit).forEach(function (k) {
            if (critOrder.indexOf(k) === -1) critEntries.push([k, byCrit[k]]);
        });
        renderBars('hp-bars-criticality', critEntries, {
            'Critical (A)': 'hp-color-red',
            'Major (B)':    'hp-color-amber',
            'Minor (C)':    'hp-color-green',
            '(none)':       'hp-color-grey'
        }, assets.length);

        // Top classes
        var byClass = countBy(assets, function (a) { return a.class_name || a.class_abbr || '(unknown)'; });
        var topClassEntries = sortedEntries(byClass, true);
        renderClassList('hp-top-classes', topClassEntries, 14);
        setText('hp-top-sub', topClassEntries.length + ' total classes');
    }

    // ----- Boot -----
    function init() {
        tickClock();
        setInterval(tickClock, 30000);

        if (!window.BFLFP_Data) {
            console.warn('BFLFP_Data service not available — Home cannot fetch live counts.');
            setText('hp-count-assets',    '—');
            setText('hp-count-templates', '—');
            setText('hp-count-tasks',     '—');
            setText('hp-count-mappings',  '—');
            return;
        }

        Promise.all([
            window.BFLFP_Data.assets().catch(function () { return []; }),
            window.BFLFP_Data.checklists().catch(function () { return { sheets: [], tasks: [], maps: [] }; })
        ]).then(function (results) {
            // assets() returns {version, count, assets:[]}, unwrap
            var assetsRaw = results[0];
            var assets = Array.isArray(assetsRaw) ? assetsRaw : (assetsRaw && assetsRaw.assets) || [];

            // checklists() may return {checklists:[], tasks_flat:[], asset_to_sheets:{}} OR pre-normalized
            var clRaw = results[1] || {};
            var cl = {
                sheets: clRaw.sheets || clRaw.checklists || [],
                tasks:  clRaw.tasks  || clRaw.tasks_flat  || [],
                maps:   clRaw.maps   || (clRaw.asset_to_sheets ? Object.keys(clRaw.asset_to_sheets).map(function (a) { return { asset_id: a, sheets: clRaw.asset_to_sheets[a] }; }) : [])
            };

            render({ assets: assets, checklists: cl });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

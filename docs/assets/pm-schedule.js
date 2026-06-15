/* ============================================
   BFLFP — PM Schedule  (tabbed: PM Frequency + PM Checklist)
   ============================================ */
(function () {
    'use strict';
    function setup() {
        var tabs = document.querySelectorAll('.pms-tab');
        if (!tabs.length) return;
        var panels = {
            freq:  document.getElementById('pms-panel-freq'),
            check: document.getElementById('pms-panel-check')
        };
        tabs.forEach(function (btn) {
            btn.addEventListener('click', function () {
                tabs.forEach(function (b) { b.classList.remove('is-active'); });
                btn.classList.add('is-active');
                Object.keys(panels).forEach(function (k) {
                    if (panels[k]) panels[k].hidden = (k !== btn.getAttribute('data-tab'));
                });
            });
        });
    }
    setup();
})();

/* ===================== TAB 1: PM FREQUENCY (year matrix) ===================== */
/* ============================================
   BFLFP — PM Schedule (year matrix view)
   ============================================ */
(function() {
    'use strict';

    var DATA_URL = './data/assets.json';
    var allAssets = [];
    var filtered  = [];
    var expandedId = null;   // currently open detail panel

    // Frequency rules: which months a given freq triggers a PM
    function isScheduledMonth(freq, month /* 1-12 */) {
        switch (freq) {
            case 'Weekly':
            case 'Daily':
            case 'Monthly':   return true;                                  // every month
            case 'Quarterly': return [3,6,9,12].indexOf(month) >= 0;
            case 'Bi-Annual': return month === 6 || month === 12;
            case 'Annual':    return month === 6;
            default: return false;
        }
    }
    function freqLetter(freq) {
        return ({Weekly:'W',Monthly:'M',Quarterly:'Q','Bi-Annual':'S',Annual:'A',Daily:'W'})[freq] || '';
    }

    var $tbody = document.getElementById('pms-tbody');
    var $search = document.getElementById('pms-search');
    var $type   = document.getElementById('pms-type');
    var $class  = document.getElementById('pms-class');
    var $freq   = document.getElementById('pms-freq');
    var $month  = document.getElementById('pms-month');
    var $clear  = document.getElementById('pms-clear');
    var $print  = document.getElementById('pms-print-bulk');
    var $count  = document.getElementById('pms-count-note');

    var $sT = document.getElementById('pms-stat-total');
    var $sW = document.getElementById('pms-stat-w');
    var $sM = document.getElementById('pms-stat-m');
    var $sQ = document.getElementById('pms-stat-q');
    var $sS = document.getElementById('pms-stat-s');
    var $sA = document.getElementById('pms-stat-a');

    function esc(s) {
        return (s == null ? '' : String(s))
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }

    function rowHTML(a) {
        var letter = freqLetter(a.pm_frequency);
        var fc = letter ? (' fc-' + letter) : ' fc-none';
        var months = '';
        for (var m = 1; m <= 12; m++) {
            var due = a.pm_frequency && isScheduledMonth(a.pm_frequency, m);
            months += '<td class="col-m' + (due ? (' due' + fc) : '') + '">' + (due ? letter : '') + '</td>';
        }
        var checklistUrl = './print/checklist.html?asset=' + encodeURIComponent(a.asset_id);
        var html = '<tr data-asset="' + esc(a.asset_id) + '" class="' + (a.status==='Scrapped' ? 'row-scrapped' : '') + '">' +
            '<td class="col-id"><code>' + esc(a.asset_id) + '</code></td>' +
            '<td class="col-name"><a class="row-toggle" data-asset-id="' + esc(a.asset_id) + '">' + esc(a.name || '') + '</a></td>' +
            '<td class="col-class">' + esc(a.class_name || '') + '</td>' +
            '<td class="col-freq"><span class="lg-chip' + fc + '">' + (letter||'—') + '</span></td>' +
            months +
            '<td class="col-act">' +
                '<a class="btn-checklist" href="' + checklistUrl + '" target="_blank" rel="noopener">📋 Print</a>' +
            '</td>' +
            '</tr>';
        // Detail panel if expanded
        if (expandedId === a.asset_id) {
            html += '<tr class="detail-row"><td colspan="17"><div class="detail-panel">' +
                '<div class="detail-grid">' +
                    '<div><span class="d-lbl">รหัสเครื่องจักร / Asset ID</span><span class="d-val"><code>' + esc(a.asset_id) + '</code></span></div>' +
                    '<div><span class="d-lbl">ชื่อ Asset / Name</span><span class="d-val">' + esc(a.name||'—') + '</span></div>' +
                    '<div><span class="d-lbl">ประเภท / Type</span><span class="d-val">' + esc(a.type||'—') + '</span></div>' +
                    '<div><span class="d-lbl">กลุ่มเครื่องจักร / Class</span><span class="d-val">' + esc(a.class_name||'—') + '</span></div>' +
                    '<div><span class="d-lbl">ผู้ผลิต / Manufacturer</span><span class="d-val">' + esc(a.manufacturer||'—') + '</span></div>' +
                    '<div><span class="d-lbl">ประเทศ / Country</span><span class="d-val">' + esc(a.country||'—') + '</span></div>' +
                    '<div><span class="d-lbl">ขนาด / Size</span><span class="d-val">' + esc(a.size||'—') + '</span></div>' +
                    '<div><span class="d-lbl">สถานที่ตั้ง / Location</span><span class="d-val">' + esc(a.location||'—') + '</span></div>' +
                    '<div><span class="d-lbl">ชั้นที่ / Floor</span><span class="d-val">' + esc(a.floor||'—') + '</span></div>' +
                    '<div><span class="d-lbl">Criticality</span><span class="d-val">' + esc(a.criticality||'—') + '</span></div>' +
                    '<div><span class="d-lbl">Status</span><span class="d-val">' + esc(a.status||'—') + '</span></div>' +
                    '<div><span class="d-lbl">PM Frequency</span><span class="d-val">' + esc(a.pm_frequency||'—') + '</span></div>' +
                    (a.notes ? '<div class="d-wide"><span class="d-lbl">Notes</span><span class="d-val">' + esc(a.notes) + '</span></div>' : '') +
                '</div>' +
                '<div class="detail-actions">' +
                    '<a class="btn-detail" href="' + checklistUrl + '" target="_blank" rel="noopener">📋 Print PM Checklist</a>' +
                    '<a class="btn-detail-2" href="#maintenance-log">📜 View in Maintenance Log →</a>' +
                '</div>' +
                '</div></td></tr>';
        }
        return html;
    }

    function render() {
        if (!filtered.length) {
            $tbody.innerHTML = '<tr><td colspan="17" class="empty-row">No assets match the current filters.</td></tr>';
        } else {
            $tbody.innerHTML = filtered.map(rowHTML).join('');
        }
        $count.textContent = 'Showing ' + filtered.length + ' of ' + allAssets.length + ' assets';
        if ($print) {
            $print.disabled = (filtered.length === 0);
            $print.textContent = filtered.length > 0
                ? '📋 Print Filtered (' + filtered.length + ')' : '📋 Print Filtered';
        }
    }

    function applyFilters() {
        var q  = ($search.value || '').toLowerCase().trim();
        var tp = $type.value;
        var cl = $class.value;
        var fr = $freq.value;
        var mn = $month.value ? parseInt($month.value, 10) : 0;
        filtered = allAssets.filter(function(a){
            if (tp && a.type !== tp) return false;
            if (cl && a.class_name !== cl) return false;
            if (fr && a.pm_frequency !== fr) return false;
            if (mn) {
                if (!a.pm_frequency || !isScheduledMonth(a.pm_frequency, mn)) return false;
            }
            if (q) {
                var hay = (a.asset_id+' '+(a.name||'')+' '+(a.manufacturer||'')+' '+(a.class_name||'')).toLowerCase();
                if (hay.indexOf(q) === -1) return false;
            }
            return true;
        });
        render();
    }

    function populateClassFilter() {
        var seen = {};
        allAssets.forEach(function(a){ if (a.class_name) seen[a.class_name] = true; });
        var sorted = Object.keys(seen).sort();
        while ($class.options.length > 1) $class.remove(1);
        sorted.forEach(function(c){
            var o = document.createElement('option');
            o.value = c; o.textContent = c;
            $class.appendChild(o);
        });
    }

    function updateStats() {
        var counts = {Weekly:0,Monthly:0,Quarterly:0,'Bi-Annual':0,Annual:0};
        var active = 0;
        allAssets.forEach(function(a){
            if (a.status === 'Scrapped') return;
            active++;
            if (counts[a.pm_frequency] !== undefined) counts[a.pm_frequency]++;
        });
        $sT.textContent = active;
        $sW.textContent = counts.Weekly;
        $sM.textContent = counts.Monthly;
        $sQ.textContent = counts.Quarterly;
        $sS.textContent = counts['Bi-Annual'];
        $sA.textContent = counts.Annual;
    }

    function bindEvents() {
        $search.addEventListener('input', applyFilters);
        $type.addEventListener('change', applyFilters);
        $class.addEventListener('change', applyFilters);
        $freq.addEventListener('change', applyFilters);
        $month.addEventListener('change', applyFilters);
        $clear.addEventListener('click', function(){
            $search.value=''; $type.value=''; $class.value='';
            $freq.value=''; $month.value=''; applyFilters();
        });
        // Row toggle
        $tbody.addEventListener('click', function(e){
            var t = e.target.closest('.row-toggle');
            if (!t) return;
            e.preventDefault();
            var id = t.getAttribute('data-asset-id');
            expandedId = (expandedId === id) ? null : id;
            render();
            // Scroll the expanded row into view
            if (expandedId) {
                var row = $tbody.querySelector('tr[data-asset="' + CSS.escape(id) + '"]');
                if (row) row.scrollIntoView({behavior:'smooth', block:'nearest'});
            }
        });
        // Bulk print (button removed in PM Frequency tab — guard for null)
        if ($print) $print.addEventListener('click', function(){
            if (!filtered.length) return;
            var ids = filtered.map(function(a){return a.asset_id;});
            if (ids.length > 50 && !confirm('Print ' + ids.length + ' checklists?')) return;
            window.open('./print/checklist.html?assets=' + encodeURIComponent(ids.join(',')), '_blank', 'noopener');
        });
    }

    function init() {
        // Prefer SharePoint live data via shared data service; fall back to local JSON.
        var loader = (window.BFLFP && window.BFLFP.data && window.BFLFP.data.assets)
            ? window.BFLFP.data.assets()
            : fetch(DATA_URL).then(function(r){ if (!r.ok) throw new Error('Failed to load assets.json'); return r.json(); });
        loader
            .then(function(data){
                allAssets = (data.assets || []).filter(function(a){return a.status !== 'Scrapped';});
                filtered = allAssets.slice();
                updateStats();
                populateClassFilter();
                bindEvents();
                render();
            })
            .catch(function(err){
                console.error(err);
                $tbody.innerHTML = '<tr><td colspan="17" class="empty-row">Failed to load: ' + (err.message||err) + '</td></tr>';
            });
    }
    init();
})();


/* ===================== TAB 2: PM CHECKLIST (SD-SP-ENG02-02 plan) ===================== */
/* ============================================
   BFLFP — PM Schedule  (SD-SP-ENG02-02 PM Plan view)
   Replaces the old year-matrix. Renders the official
   "แผนการบำรุงรักษาเครื่องจักร/อุปกรณ์" plan per machine group,
   matching PMchecklist.xlsx. Shared renderer: BFLFP_PMPlan.
   ============================================ */
(function () {
    'use strict';

    var ASSETS_URL = './data/assets.json';
    var CHECKS_URL = './data/checklists.json';

    var assetsById = {};
    var sheets = [];           // checklist sheets = machine groups
    var logoUrl = './img/bluefalo-r1.png';

    var $group = document.getElementById('ppl-group');
    var $search = document.getElementById('ppl-search');
    var $print = document.getElementById('ppl-print');
    var $stage = document.getElementById('ppl-stage');
    var $count = document.getElementById('ppl-count');

    function esc(s) { return window.BFLFP_PMPlan ? BFLFP_PMPlan.esc(s) : (s == null ? '' : String(s)); }

    function sheetLabel(s) {
        var g = (s.assets_covered || []).map(function (id) {
            return assetsById[id] ? assetsById[id].class_name : null;
        }).filter(Boolean)[0];
        return (s.class_label || s.sheet_name || '').trim() + (g ? '  (' + g + ')' : '');
    }

    function populateGroups() {
        var opts = ['<option value="__all">ทั้งหมด — All groups (' + sheets.length + ')</option>'];
        sheets.slice().sort(function (a, b) {
            return sheetLabel(a).localeCompare(sheetLabel(b), 'th');
        }).forEach(function (s) {
            opts.push('<option value="' + esc(s.sheet_name) + '">' + esc(sheetLabel(s)) + '</option>');
        });
        $group.innerHTML = opts.join('');
    }

    function selectedSheets() {
        var v = $group.value;
        var list = (v === '__all') ? sheets.slice() : sheets.filter(function (s) { return s.sheet_name === v; });
        var q = ($search.value || '').toLowerCase().trim();
        if (q) {
            list = list.filter(function (s) {
                var hay = (sheetLabel(s) + ' ' + (s.assets_covered || []).join(' ')).toLowerCase();
                return hay.indexOf(q) >= 0;
            });
        }
        return list;
    }

    function render() {
        if (!window.BFLFP_PMPlan) {
            $stage.innerHTML = '<p class="pms-empty">Renderer not loaded.</p>';
            return;
        }
        var list = selectedSheets();
        if (!list.length) {
            $stage.innerHTML = '<p class="pms-empty">No machine group matches.</p>';
            $count.textContent = '';
            return;
        }
        $stage.innerHTML = list.map(function (s) {
            return BFLFP_PMPlan.buildDoc(s, assetsById, logoUrl);
        }).join('');
        $count.textContent = 'Showing ' + list.length + ' of ' + sheets.length + ' machine groups';
    }

    function bind() {
        $group.addEventListener('change', render);
        $search.addEventListener('input', render);
        $print.addEventListener('click', function () {
            var v = $group.value || '__all';
            var q = ($search.value || '').trim();
            var url = './print/pmplan.html?group=' + encodeURIComponent(v) +
                      (q ? '&q=' + encodeURIComponent(q) : '');
            window.open(url, '_blank', 'noopener');
        });
    }

    function init() {
        var D = window.BFLFP && window.BFLFP.data;
        var pAssets = (D && D.assets) ? D.assets()
            : fetch(ASSETS_URL).then(function (r) { return r.json(); });
        var pChecks = (D && D.checklists) ? D.checklists()
            : fetch(CHECKS_URL).then(function (r) { return r.json(); });

        Promise.all([pAssets, pChecks]).then(function (res) {
            var aData = res[0], cData = res[1];
            assetsById = BFLFP_PMPlan.indexAssets(aData.assets || aData || []);
            sheets = (cData.checklists || []).filter(function (s) { return (s.tasks || []).length; });
            if (cData.logo_url) logoUrl = (cData.logo_url.indexOf('http') === 0 ? '' : './') + cData.logo_url;
            populateGroups();
            bind();
            render();
        }).catch(function (err) {
            console.error('[pm-schedule]', err);
            $stage.innerHTML = '<p class="pms-empty">Failed to load: ' + esc(err.message || err) + '</p>';
        });
    }
    init();
})();

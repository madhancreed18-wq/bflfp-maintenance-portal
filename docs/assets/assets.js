/* ============================================
   BFLFP — Assets Page
   Loads docs/data/assets.json, renders filterable table,
   each row links to print/checklist.html?asset=<id>
   ============================================ */

(function() {
    'use strict';

    var DATA_URL = './data/assets.json';
    var allAssets = [];
    var filtered = [];

    var $tbody    = document.getElementById('assets-tbody');
    var $search   = document.getElementById('f-search');
    var $type     = document.getElementById('f-type');
    var $class    = document.getElementById('f-class');
    var $freq     = document.getElementById('f-freq');
    var $clear    = document.getElementById('f-clear');
    var $count    = document.getElementById('assets-count-note');

    var $statTotal = document.getElementById('stat-total');
    var $statMach  = document.getElementById('stat-machine');
    var $statUtil  = document.getElementById('stat-utilities');
    var $statIT    = document.getElementById('stat-it');

    function esc(s) {
        return (s == null ? '' : String(s))
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }

    function critClass(c) {
        if (!c) return '';
        if (c.indexOf('Critical') === 0) return 'crit-a';
        if (c.indexOf('Major') === 0)    return 'crit-b';
        return 'crit-c';
    }
    function freqClass(f) {
        if (!f) return '';
        return 'freq-' + f.toLowerCase().replace(/[^a-z]/g,'');
    }

    function renderRow(a) {
        var checklistUrl = './print/checklist.html?asset=' + encodeURIComponent(a.asset_id);
        return '<tr data-asset="' + esc(a.asset_id) + '">' +
            '<td class="col-id"><code>' + esc(a.asset_id) + '</code></td>' +
            '<td class="col-name">' + esc(a.name || '') + '</td>' +
            '<td class="col-type"><span class="badge badge-' + (a.type || '').toLowerCase() + '">' + esc(a.type || '') + '</span></td>' +
            '<td class="col-class">' + esc(a.class_name || '') + '</td>' +
            '<td class="col-mfr">' + esc(a.manufacturer || '') + '</td>' +
            '<td class="col-loc">' + esc(a.location || '') + '</td>' +
            '<td class="col-crit"><span class="crit ' + critClass(a.criticality) + '">' + esc(a.criticality || '') + '</span></td>' +
            '<td class="col-freq"><span class="freq ' + freqClass(a.pm_frequency) + '">' + esc(a.pm_frequency || '—') + '</span></td>' +
            '<td class="col-status"><span class="status status-' + (a.status || '').toLowerCase() + '">' + esc(a.status || '') + '</span></td>' +
            '<td class="col-action"><a class="btn-checklist" href="' + checklistUrl + '" target="_blank" rel="noopener">📋 Print</a></td>' +
            '</tr>';
    }

    function render() {
        if (!filtered.length) {
            $tbody.innerHTML = '<tr><td colspan="10" class="empty-row">No assets match the current filters.</td></tr>';
        } else {
            $tbody.innerHTML = filtered.map(renderRow).join('');
        }
        $count.textContent = 'Showing ' + filtered.length + ' of ' + allAssets.length + ' assets';
    }

    function applyFilters() {
        var q   = ($search.value || '').toLowerCase().trim();
        var tp  = $type.value;
        var cl  = $class.value;
        var fr  = $freq.value;
        filtered = allAssets.filter(function(a){
            if (tp && a.type !== tp) return false;
            if (cl && a.class_name !== cl) return false;
            if (fr && a.pm_frequency !== fr) return false;
            if (q) {
                var hay = (a.asset_id + ' ' + (a.name||'') + ' ' + (a.manufacturer||'') + ' ' + (a.class_name||'')).toLowerCase();
                if (hay.indexOf(q) === -1) return false;
            }
            return true;
        });
        render();
    }

    function populateClassFilter() {
        var classes = {};
        allAssets.forEach(function(a){ if (a.class_name) classes[a.class_name] = true; });
        var sorted = Object.keys(classes).sort();
        sorted.forEach(function(c){
            var o = document.createElement('option');
            o.value = c; o.textContent = c;
            $class.appendChild(o);
        });
    }

    function updateStats() {
        var counts = { Machine:0, Utilities:0, IT:0 };
        allAssets.forEach(function(a){ if (counts[a.type] !== undefined) counts[a.type]++; });
        $statTotal.textContent = allAssets.length;
        $statMach.textContent  = counts.Machine;
        $statUtil.textContent  = counts.Utilities;
        $statIT.textContent    = counts.IT;
    }

    function bindFilters() {
        $search.addEventListener('input', applyFilters);
        $type.addEventListener('change', applyFilters);
        $class.addEventListener('change', applyFilters);
        $freq.addEventListener('change', applyFilters);
        $clear.addEventListener('click', function(){
            $search.value = ''; $type.value = ''; $class.value = ''; $freq.value = '';
            applyFilters();
        });
    }

    function init() {
        fetch(DATA_URL)
            .then(function(r){ if (!r.ok) throw new Error('Failed to load assets.json'); return r.json(); })
            .then(function(data){
                allAssets = data.assets || [];
                filtered  = allAssets.slice();
                updateStats();
                populateClassFilter();
                bindFilters();
                render();
            })
            .catch(function(err){
                console.error(err);
                $tbody.innerHTML = '<tr><td colspan="10" class="empty-row">Failed to load assets: ' + (err.message||err) + '</td></tr>';
            });
    }

    init();
})();

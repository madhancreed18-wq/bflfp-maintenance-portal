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

    var $group = document.getElementById('pms-group');
    var $search = document.getElementById('pms-search');
    var $print = document.getElementById('pms-print');
    var $stage = document.getElementById('pms-stage');
    var $count = document.getElementById('pms-count');

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

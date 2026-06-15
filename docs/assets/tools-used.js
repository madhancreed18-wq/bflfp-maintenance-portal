/* ============================================
   BFLFP — Tool & Equipment Authorization Form (F-SP-ENG02-04)
   Fillable form with the 8 pre-printed standard tools + room for additions.
   Tech fills "Bring In" before entering production, "Take Out" on exit.
   Saves a draft to localStorage; Print produces an A4 paper copy.
   ============================================ */

(function () {
    'use strict';

    var DRAFT_KEY = 'bflfp.tools-used.draft';

    /* Standard pre-printed tools from the official paper form (row 7-14) */
    var PRESET_TOOLS = [
        'ประแจรวมเบอร์ 8-26',
        'หกเหลี่ยมชุดมิล',
        'หกเหลี่ยมชุดหุล',
        'ค้อน',
        'ประแจรวมเบอร์-32',
        'ชุดลูกบ๊อคเบอร์10-32',
        'ประแจเลื่อน',
        'ไขควงแบนยาว 10 นิ้ว'
    ];

    /* Number of additional blank rows initially shown */
    var BLANK_ROWS = 3;

    function $(id) { return document.getElementById(id); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
    function pad(n) { return String(n).padStart(2, '0'); }
    function fmtISO(d) { return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()); }
    function fmtThaiDate(iso) {
        if (!iso) return '............ / ............ / ............';
        var d = new Date(iso + 'T00:00:00');
        if (isNaN(d.getTime())) return '';
        var months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
        return d.getDate() + ' ' + months[d.getMonth()] + ' ' + (d.getFullYear() + 543);
    }

    var $date    = $('tu-date');
    var $area    = $('tu-area');
    var $shift   = $('tu-shift');
    var $save    = $('tu-save');
    var $clear   = $('tu-clear');
    var $print   = $('tu-print');
    var $tbody   = $('tu-tbody');
    var $docArea = $('tu-doc-area');
    var $docDate = $('tu-doc-date');

    /* ---- Row generation ---- */

    function rowHTML(idx, toolName, isPreset) {
        var rowClass = isPreset ? 'tu-row-preprinted' : 'tu-row-blank';
        var num = idx + 1;
        var toolPlaceholder = isPreset ? '' : ' placeholder="(เพิ่มเครื่องมือใหม่ / add tool)"';
        var toolValue = isPreset ? esc(toolName) : '';
        return (
            '<tr class="' + rowClass + '" data-idx="' + idx + '">' +
              '<td class="rep-cell-center" style="font-weight: 600;">' + num + '</td>' +
              '<td><input class="tu-cell" data-f="importer" type="text"></td>' +
              '<td><input class="tu-cell" data-f="dept" type="text"></td>' +
              '<td><input class="tu-cell tu-tool-label" data-f="tool" type="text" value="' + toolValue + '"' + toolPlaceholder + (isPreset ? '' : '') + '></td>' +
              '<td class="tu-cell-num"><input class="tu-cell" data-f="qty_in" type="text" inputmode="numeric"></td>' +
              '<td class="tu-cond-cell"><span class="tu-cond-pill tu-cond-empty" data-f="cond_in" data-state="">—</span></td>' +
              '<td class="tu-cell-num"><input class="tu-cell" data-f="qty_out" type="text" inputmode="numeric"></td>' +
              '<td class="tu-cond-cell"><span class="tu-cond-pill tu-cond-empty" data-f="cond_out" data-state="">—</span></td>' +
              '<td><input class="tu-cell" data-f="notes" type="text"></td>' +
            '</tr>'
        );
    }

    function buildTable(presetCount, blankCount) {
        var html = '';
        for (var i = 0; i < presetCount; i++) {
            html += rowHTML(i, PRESET_TOOLS[i], true);
        }
        for (var j = 0; j < blankCount; j++) {
            html += rowHTML(presetCount + j, '', false);
        }
        $tbody.innerHTML = html;
        // Add the "+ Add row" button after the table
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tu-add-row-btn no-print';
        btn.innerHTML = '<i class="ti ti-plus"></i> Add another row / เพิ่มแถว';
        btn.addEventListener('click', addBlankRow);
        // Remove existing button if any
        var existing = document.querySelector('.tu-add-row-btn');
        if (existing) existing.parentNode.removeChild(existing);
        $tbody.parentNode.parentNode.appendChild(btn);
    }

    function addBlankRow() {
        var nextIdx = $tbody.children.length;
        $tbody.insertAdjacentHTML('beforeend', rowHTML(nextIdx, '', false));
        wireConditionPills();
        wireCellInputs();
    }

    /* ---- Condition pill toggle (—  →  P  →  X  →  —) ---- */

    function cyclePill(pill) {
        var state = pill.getAttribute('data-state') || '';
        var next = state === '' ? 'P' : (state === 'P' ? 'X' : '');
        pill.setAttribute('data-state', next);
        pill.classList.remove('tu-cond-empty', 'tu-cond-p', 'tu-cond-x');
        pill.classList.add(next === 'P' ? 'tu-cond-p' : (next === 'X' ? 'tu-cond-x' : 'tu-cond-empty'));
        pill.textContent = next || '—';
    }
    function wireConditionPills() {
        document.querySelectorAll('.tu-cond-pill').forEach(function (p) {
            if (p.__wired) return;
            p.__wired = true;
            p.addEventListener('click', function () { cyclePill(p); });
        });
    }
    function wireCellInputs() {
        document.querySelectorAll('.tu-table input.tu-cell').forEach(function (inp) {
            if (inp.__wired) return;
            inp.__wired = true;
            inp.addEventListener('input', updateDocHeader);
        });
    }

    /* ---- Header (area + date) sync ---- */

    function updateDocHeader() {
        $docArea.textContent = ($area.value || '').trim() || '………………………………………';
        var d = $date.value ? fmtThaiDate($date.value) : '………… / ………… / …………';
        var s = $shift.value ? '  (Shift ' + $shift.value + ')' : '';
        $docDate.textContent = d + s;
    }

    /* ---- Draft save / load ---- */

    function snapshot() {
        var rows = [];
        $tbody.querySelectorAll('tr').forEach(function (tr) {
            var row = {};
            tr.querySelectorAll('[data-f]').forEach(function (el) {
                var f = el.getAttribute('data-f');
                if (el.tagName === 'SPAN') row[f] = el.getAttribute('data-state') || '';
                else row[f] = el.value;
            });
            rows.push(row);
        });
        return { date: $date.value, area: $area.value, shift: $shift.value, rows: rows };
    }
    function applySnapshot(snap) {
        if (!snap) return;
        if (snap.date)  $date.value  = snap.date;
        if (snap.area)  $area.value  = snap.area;
        if (snap.shift) $shift.value = snap.shift;
        // Ensure enough rows
        var needed = (snap.rows || []).length;
        var current = $tbody.children.length;
        for (var i = current; i < needed; i++) addBlankRow();
        // Populate
        Array.prototype.forEach.call($tbody.children, function (tr, i) {
            var row = (snap.rows || [])[i] || {};
            tr.querySelectorAll('[data-f]').forEach(function (el) {
                var f = el.getAttribute('data-f');
                if (el.tagName === 'SPAN') {
                    el.setAttribute('data-state', row[f] || '');
                    el.classList.remove('tu-cond-empty','tu-cond-p','tu-cond-x');
                    el.classList.add(row[f] === 'P' ? 'tu-cond-p' : (row[f] === 'X' ? 'tu-cond-x' : 'tu-cond-empty'));
                    el.textContent = row[f] || '—';
                } else {
                    el.value = row[f] || '';
                }
            });
        });
        updateDocHeader();
    }
    function saveDraft() {
        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify(snapshot()));
            flashSaveBtn();
        } catch (e) { console.warn('Draft save failed:', e); }
    }
    function loadDraft() {
        try {
            var raw = localStorage.getItem(DRAFT_KEY);
            if (raw) applySnapshot(JSON.parse(raw));
        } catch (e) { /* ignore */ }
    }
    function flashSaveBtn() {
        if (!$save) return;
        var orig = $save.innerHTML;
        $save.innerHTML = '<i class="ti ti-check"></i> Saved';
        setTimeout(function () { $save.innerHTML = orig; }, 1500);
    }
    function clearForm() {
        if (!confirm('Reset the form? Unsaved changes will be lost.')) return;
        try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
        buildTable(PRESET_TOOLS.length, BLANK_ROWS);
        wireConditionPills();
        wireCellInputs();
        $date.value  = fmtISO(new Date());
        $area.value  = '';
        $shift.value = '';
        updateDocHeader();
    }

    /* ---- Boot ---- */

    function init() {
        $date.value = fmtISO(new Date());
        buildTable(PRESET_TOOLS.length, BLANK_ROWS);
        wireConditionPills();
        wireCellInputs();
        loadDraft();
        updateDocHeader();

        $date.addEventListener('change',  updateDocHeader);
        $area.addEventListener('input',   updateDocHeader);
        $shift.addEventListener('change', updateDocHeader);

        if ($save)  $save.addEventListener('click', saveDraft);
        if ($clear) $clear.addEventListener('click', clearForm);
        if ($print) $print.addEventListener('click', function () { window.print(); });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

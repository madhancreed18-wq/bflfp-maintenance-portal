/* ============================================
   BFLFP — Assets Page
   ============================================ */

(function() {
    'use strict';

    var DATA_URL = './data/assets.json';
    var allAssets = [];
    var filtered  = [];
    var dirty     = false;
    var selectedIds = new Set();
    var meta = { version: 1, generated: new Date().toISOString().slice(0,10) };

    // Permission helpers — prefer BFLFP_User if available, fall back to legacy detection
    function canFill()      { return window.BFLFP_User ? BFLFP_User.can('fill_pm')         : true; }
    function canEditAsset() { return window.BFLFP_User ? BFLFP_User.can('edit_assets')     : isEditMode(); }
    function canAddAsset()  { return window.BFLFP_User ? BFLFP_User.can('add_assets')      : isEditMode(); }
    function canEditList()  { return window.BFLFP_User ? BFLFP_User.can('edit_checklists') : isEditMode(); }
    function canBulkPrint() { return window.BFLFP_User ? BFLFP_User.can('bulk_print')      : true; }
    function isEditMode() {
        var h = location.hostname;
        if (h === 'localhost' || h === '127.0.0.1' || h === '') return true;
        return /[?&]edit=1\b/.test(location.search);
    }
    // EDIT_MODE = "any edit capability" — used as the master toggle for the edit banner
    var EDIT_MODE = canEditAsset() || canEditList() || canAddAsset();

    var $tbody    = document.getElementById('assets-tbody');
    var $search   = document.getElementById('f-search');
    var $type     = document.getElementById('f-type');
    var $class    = document.getElementById('f-class');
    var $freq     = document.getElementById('f-freq');
    var $status   = document.getElementById('f-status');
    var $clear    = document.getElementById('f-clear');
    var $count    = document.getElementById('assets-count-note');
    var $checkAll = document.getElementById('check-all');
    var $btnPrint = document.getElementById('btn-print-bulk');

    var $statTotal = document.getElementById('stat-total');
    var $statMach  = document.getElementById('stat-machine');
    var $statUtil  = document.getElementById('stat-utilities');
    var $statIT    = document.getElementById('stat-it');

    var $editBanner = document.getElementById('edit-mode-banner');
    var $btnAdd     = document.getElementById('btn-add');
    var $btnDownload= document.getElementById('btn-download');
    var $btnDLChecklist = document.getElementById('btn-download-cl');

    var $modal      = document.getElementById('asset-modal');
    var $modalTitle = document.getElementById('modal-title');
    var $modalClose = document.getElementById('modal-close');
    var $modalForm  = document.getElementById('asset-form');
    var $btnCancel  = document.getElementById('btn-cancel');
    var $btnSave    = document.getElementById('btn-save');
    var $formError  = document.getElementById('form-error');
    var $classDL    = document.getElementById('class-list');

    var FIELDS = {
        original_id: document.getElementById('f-original-id'),
        id:        document.getElementById('fld-id'),
        name:      document.getElementById('fld-name'),
        clss:      document.getElementById('fld-class'),
        type:      document.getElementById('fld-type'),
        mfr:       document.getElementById('fld-mfr'),
        country:   document.getElementById('fld-country'),
        size:      document.getElementById('fld-size'),
        spares:    document.getElementById('fld-spares'),
        loc:       document.getElementById('fld-loc'),
        floor:     document.getElementById('fld-floor'),
        crit:      document.getElementById('fld-crit'),
        status:    document.getElementById('fld-status'),
        freq:      document.getElementById('fld-freq'),
        notes:     document.getElementById('fld-notes'),
    };

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
    function classAbbrFromId(id) {
        if (!id) return '';
        var m = id.match(/^W\d{2}([A-Z]{1,3})\d{2,3}$/);
        return m ? m[1] : '';
    }
    function classAbbrFromName(className) {
        if (!className) return '';
        var firstWord = String(className).trim().split(/\s+/)[0];
        return firstWord.substring(0,2).toUpperCase();
    }
    function suggestNextId(className) {
        var abbr = '';
        for (var i = 0; i < allAssets.length; i++) {
            if (allAssets[i].class_name === className && allAssets[i].asset_id) {
                abbr = classAbbrFromId(allAssets[i].asset_id);
                if (abbr) break;
            }
        }
        if (!abbr) abbr = classAbbrFromName(className);
        if (!abbr) return '';
        var maxSeq = 0;
        var prefix = 'W01' + abbr;
        allAssets.forEach(function(a){
            if (a.asset_id && a.asset_id.indexOf(prefix) === 0) {
                var n = parseInt(a.asset_id.slice(prefix.length), 10);
                if (!isNaN(n) && n > maxSeq) maxSeq = n;
            }
        });
        var next = String(maxSeq + 1).padStart(2, '0');
        return prefix + next;
    }
    function deriveType(abbr) {
        var TYPE = {
            AC:'Utilities', AI:'Utilities', CL:'Utilities', CW:'Utilities',
            DP:'Utilities', FP:'Utilities', RO:'Utilities', SC:'Utilities',
            SS:'Utilities', WP:'Utilities', WT:'Utilities', IT:'IT'
        };
        return TYPE[abbr] || 'Machine';
    }

    function renderRow(a) {
        var checklistUrl = './print/checklist.html?asset=' + encodeURIComponent(a.asset_id);
        var fillUrl = './print/checklist.html?asset=' + encodeURIComponent(a.asset_id) + '&mode=fill';
        var nowD = new Date();
        var reportUrl = './#pm-reports?asset=' + encodeURIComponent(a.asset_id) + '&year=' + nowD.getFullYear() + '&month=' + (nowD.getMonth() + 1);
        var actionCell = '<div class="action-group">' +
            '<a class="btn-action is-print" href="' + checklistUrl + '" target="_blank" rel="noopener" aria-label="Print checklist" title="Print PM checklist">📋</a>';
        if (canFill()) {
            actionCell += '<a class="btn-action is-fill" href="' + fillUrl + '" target="_blank" rel="noopener" aria-label="Fill checklist" title="Fill PM checklist" data-need="fill_pm">📝</a>';
        }
        actionCell += '<a class="btn-action is-report" href="' + reportUrl + '" aria-label="Monthly PM Report" title="Monthly PM Report (this month)">📊</a>';
        if (canEditList()) {
            actionCell += '<button class="btn-action is-checklist" data-edit-checklist="' + esc(a.asset_id) + '" aria-label="Edit checklist sheet" title="Edit / Create PM checklist sheet" data-need="edit_checklists">⚙️</button>';
        }
        if (canEditAsset()) {
            actionCell += '<button class="btn-action is-edit" data-edit-id="' + esc(a.asset_id) + '" aria-label="Edit asset details" title="Edit asset details" data-need="edit_assets">✏️</button>';
        }
        actionCell += '</div>';
        var checked = selectedIds.has(a.asset_id) ? ' checked' : '';
        return '<tr data-asset="' + esc(a.asset_id) + '" class="' + (a.status==='Scrapped' ? 'row-scrapped' : '') + '">' +
            '<td class="col-check"><input type="checkbox" class="row-check" data-id="' + esc(a.asset_id) + '"' + checked + '></td>' +
            '<td class="col-id"><code>' + esc(a.asset_id) + '</code></td>' +
            '<td class="col-name">' + esc(a.name || '') + '</td>' +
            '<td class="col-type"><span class="badge badge-' + (a.type || '').toLowerCase() + '">' + esc(a.type || '') + '</span></td>' +
            '<td class="col-class">' + esc(a.class_name || '') + '</td>' +
            '<td class="col-mfr">' + esc(a.manufacturer || '') + '</td>' +
            '<td class="col-loc">' + esc(a.location || '') + '</td>' +
            '<td class="col-crit"><span class="crit ' + critClass(a.criticality) + '">' + esc(a.criticality || '') + '</span></td>' +
            '<td class="col-freq"><span class="freq ' + freqClass(a.pm_frequency) + '">' + esc(a.pm_frequency || '—') + '</span></td>' +
            '<td class="col-status"><span class="status status-' + (a.status || '').toLowerCase().replace(/\s+/g,'-') + '">' + esc(a.status || '') + '</span></td>' +
            '<td class="col-action">' + actionCell + '</td>' +
            '</tr>';
    }

    function updatePrintButton() {
        var filteredIds = filtered.map(function(a){return a.asset_id;});
        var selectedInFiltered = filteredIds.filter(function(id){return selectedIds.has(id);});
        var n = selectedInFiltered.length;
        var f = filtered.length;
        if (n > 0) {
            $btnPrint.textContent = '📋 Print Selected (' + n + ')';
            $btnPrint.disabled = false;
            $btnPrint.dataset.mode = 'selected';
        } else if (f > 0) {
            $btnPrint.textContent = '📋 Print All Filtered (' + f + ')';
            $btnPrint.disabled = false;
            $btnPrint.dataset.mode = 'filtered';
        } else {
            $btnPrint.textContent = '📋 Print';
            $btnPrint.disabled = true;
            $btnPrint.dataset.mode = '';
        }
        // sync "select all" header checkbox state
        if ($checkAll) {
            $checkAll.checked = (n > 0 && n === f);
            $checkAll.indeterminate = (n > 0 && n < f);
        }
    }

    function render() {
        if (!filtered.length) {
            $tbody.innerHTML = '<tr><td colspan="11" class="empty-row">No assets match the current filters.</td></tr>';
        } else {
            $tbody.innerHTML = filtered.map(renderRow).join('');
        }
        $count.textContent = 'Showing ' + filtered.length + ' of ' + allAssets.length + ' assets' +
                             (selectedIds.size > 0 ? '  •  ' + selectedIds.size + ' selected' : '') +
                             (dirty ? '  •  unsaved changes' : '');
        updatePrintButton();
    }

    function applyFilters() {
        var q   = ($search.value || '').toLowerCase().trim();
        var tp  = $type.value;
        var cl  = $class.value;
        var fr  = $freq.value;
        var st  = $status.value;
        filtered = allAssets.filter(function(a){
            if (tp && a.type !== tp) return false;
            if (cl && a.class_name !== cl) return false;
            if (fr && a.pm_frequency !== fr) return false;
            if (st && a.status !== st) return false;
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
        while ($class.options.length > 1) $class.remove(1);
        sorted.forEach(function(c){
            var o = document.createElement('option');
            o.value = c; o.textContent = c;
            $class.appendChild(o);
        });
        $classDL.innerHTML = '';
        sorted.forEach(function(c){
            var o = document.createElement('option');
            o.value = c;
            $classDL.appendChild(o);
        });
    }

    function updateStats() {
        var counts = { Machine:0, Utilities:0, IT:0 };
        allAssets.forEach(function(a){
            if (a.status === 'Scrapped') return;
            if (counts[a.type] !== undefined) counts[a.type]++;
        });
        var activeTotal = allAssets.filter(function(a){return a.status!=='Scrapped';}).length;
        $statTotal.textContent = activeTotal;
        $statMach.textContent  = counts.Machine;
        $statUtil.textContent  = counts.Utilities;
        $statIT.textContent    = counts.IT;
    }

    // BULK PRINT
    function bulkPrint() {
        var mode = $btnPrint.dataset.mode;
        var ids;
        if (mode === 'selected') {
            ids = filtered.filter(function(a){return selectedIds.has(a.asset_id);}).map(function(a){return a.asset_id;});
        } else if (mode === 'filtered') {
            ids = filtered.map(function(a){return a.asset_id;});
        } else {
            return;
        }
        if (!ids.length) return;
        if (ids.length > 50) {
            if (!confirm('You are about to print ' + ids.length + ' checklists. Continue?')) return;
        }
        var url = './print/checklist.html?assets=' + encodeURIComponent(ids.join(','));
        window.open(url, '_blank', 'noopener');
    }

    function openModal(mode, asset) {
        $modal.hidden = false;
        $formError.hidden = true; $formError.textContent = '';
        FIELDS.original_id.value = (asset && asset.asset_id) || '';
        if (mode === 'add') {
            $modalTitle.textContent = 'Add Asset';
            $btnSave.textContent = 'Add Asset';
            FIELDS.id.value = ''; FIELDS.id.readOnly = false;
            FIELDS.name.value = ''; FIELDS.clss.value = ''; FIELDS.type.value = 'Machine';
            FIELDS.mfr.value = ''; FIELDS.country.value = ''; FIELDS.size.value = '';
            FIELDS.spares.value = ''; FIELDS.loc.value = ''; FIELDS.floor.value = '';
            FIELDS.crit.value = 'Major (B)'; FIELDS.status.value = 'Active';
            FIELDS.freq.value = ''; FIELDS.notes.value = '';
        } else {
            $modalTitle.textContent = 'Edit Asset — ' + (asset.asset_id || '');
            $btnSave.textContent = 'Save Changes';
            FIELDS.id.value = asset.asset_id || ''; FIELDS.id.readOnly = true;
            FIELDS.name.value = asset.name || '';
            FIELDS.clss.value = asset.class_name || '';
            FIELDS.type.value = asset.type || 'Machine';
            FIELDS.mfr.value = asset.manufacturer || '';
            FIELDS.country.value = asset.country || '';
            FIELDS.size.value = asset.size || '';
            FIELDS.spares.value = asset.spares || '';
            FIELDS.loc.value = asset.location || '';
            FIELDS.floor.value = asset.floor || '';
            FIELDS.crit.value = asset.criticality || 'Major (B)';
            FIELDS.status.value = asset.status || 'Active';
            FIELDS.freq.value = asset.pm_frequency || '';
            FIELDS.notes.value = asset.notes || '';
        }
        setTimeout(function(){ (mode === 'add' ? FIELDS.clss : FIELDS.name).focus(); }, 50);
    }
    function closeModal() { $modal.hidden = true; }
    function validateForm() {
        $formError.hidden = true; $formError.textContent = '';
        var id = FIELDS.id.value.trim().toUpperCase();
        var name = FIELDS.name.value.trim();
        var clss = FIELDS.clss.value.trim();
        if (!/^W\d{2}[A-Z]{1,3}\d{2,3}$/.test(id)) return 'Asset ID must match format W##XX## (e.g. W01AC05).';
        if (!name) return 'Name is required.';
        if (!clss) return 'Class is required.';
        var orig = FIELDS.original_id.value;
        if (id !== orig && allAssets.some(function(a){ return a.asset_id === id; })) {
            return 'Asset ID "' + id + '" already exists.';
        }
        return null;
    }
    function saveForm() {
        var err = validateForm();
        if (err) { $formError.hidden = false; $formError.textContent = err; return; }
        var id = FIELDS.id.value.trim().toUpperCase();
        var orig = FIELDS.original_id.value;
        var rec = {
            asset_id: id, class_abbr: classAbbrFromId(id),
            name: FIELDS.name.value.trim(), type: FIELDS.type.value,
            class_name: FIELDS.clss.value.trim(),
            manufacturer: FIELDS.mfr.value.trim() || null,
            country: FIELDS.country.value.trim() || null,
            size: FIELDS.size.value.trim() || null,
            spares: FIELDS.spares.value.trim() || null,
            location: FIELDS.loc.value.trim() || null,
            floor: FIELDS.floor.value.trim() || null,
            department: '',
            criticality: FIELDS.crit.value, status: FIELDS.status.value,
            pm_frequency: FIELDS.freq.value || null, pm_mix: '',
            notes: FIELDS.notes.value.trim() || ''
        };
        var D = { 'IT':'IT','Utilities':'Maintenance','Machine':'Production' };
        rec.department = D[rec.type] || 'Production';
        // Preserve existing pm_mix if not being edited (form has no pm_mix field today)
        if (orig) {
            var existingPre = allAssets.find(function(a){ return a.asset_id === orig; });
            if (existingPre && existingPre.pm_mix && !rec.pm_mix) rec.pm_mix = existingPre.pm_mix;
        }

        // ---- Try SharePoint write via flow; fall back to local-only on failure ----
        var hasFlow = !!(window.BFLFP && BFLFP.data && BFLFP.data.upsertAsset);
        var origBtnText = $btnSave.textContent;
        $btnSave.disabled = true;
        $btnSave.textContent = hasFlow ? '⏳ Saving to SharePoint…' : '⏳ Saving…';
        $formError.hidden = true;

        var savePromise = hasFlow
            ? BFLFP.data.upsertAsset(rec)
            : Promise.resolve({ ok: true, action: orig ? 'updated' : 'created', _local: true });

        savePromise
            .then(function(resp){
                // Update local in-memory copy on success
                if (orig) {
                    var idx = allAssets.findIndex(function(a){ return a.asset_id === orig; });
                    if (idx >= 0) allAssets[idx] = rec;
                } else {
                    allAssets.push(rec);
                    allAssets.sort(function(a,b){ return a.asset_id.localeCompare(b.asset_id); });
                }
                // Only mark dirty if we couldn't go to SharePoint — so the manual Download still works as fallback
                if (resp && resp._local) markDirty();

                populateClassFilter();
                updateStats();
                applyFilters();

                $btnSave.textContent = '✓ Saved';
                $btnSave.style.background = '#16A34A';
                setTimeout(function(){
                    $btnSave.disabled = false;
                    $btnSave.textContent = origBtnText;
                    $btnSave.style.background = '';
                    closeModal();
                }, 700);
            })
            .catch(function(err){
                console.error('[Assets] upsertAsset failed:', err);
                $btnSave.disabled = false;
                $btnSave.textContent = origBtnText;
                $btnSave.style.background = '';
                $formError.hidden = false;
                $formError.textContent = '❌ Save failed: ' + (err.message || err) +
                    ' — your changes were NOT written to SharePoint. ' +
                    'Check the flow URL in data-service.js or your network connection.';
            });
    }
    function markDirty() { dirty = true; $btnDownload.disabled = false; $btnDownload.classList.add('btn-download-active'); }
    function downloadJSON() {
        var payload = { version: meta.version || 1, generated: new Date().toISOString().slice(0,10), count: allAssets.length, assets: allAssets };
        var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a'); a.href = url; a.download = 'assets.json';
        document.body.appendChild(a); a.click();
        setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    }

    function bindFilters() {
        $search.addEventListener('input', applyFilters);
        $type.addEventListener('change', applyFilters);
        $class.addEventListener('change', applyFilters);
        $freq.addEventListener('change', applyFilters);
        $status.addEventListener('change', applyFilters);
        $clear.addEventListener('click', function(){
            $search.value=''; $type.value=''; $class.value='';
            $freq.value=''; $status.value=''; applyFilters();
        });
    }

    function bindRowSelection() {
        $tbody.addEventListener('change', function(e){
            var cb = e.target.closest('.row-check');
            if (!cb) return;
            var id = cb.getAttribute('data-id');
            if (cb.checked) selectedIds.add(id);
            else            selectedIds.delete(id);
            updatePrintButton();
            // update footer text without full re-render
            $count.textContent = 'Showing ' + filtered.length + ' of ' + allAssets.length + ' assets' +
                                 (selectedIds.size > 0 ? '  •  ' + selectedIds.size + ' selected' : '') +
                                 (dirty ? '  •  unsaved changes' : '');
        });
        if ($checkAll) {
            $checkAll.addEventListener('change', function(){
                if ($checkAll.checked) {
                    filtered.forEach(function(a){ selectedIds.add(a.asset_id); });
                } else {
                    filtered.forEach(function(a){ selectedIds.delete(a.asset_id); });
                }
                render();
            });
        }
        if ($btnPrint) $btnPrint.addEventListener('click', bulkPrint);
    }

    // ---- Checklist Editor lazy loader ----
    var _editorLoading = null;
    function loadChecklistEditor() {
        if (window.BFLFP_ChecklistEditor) return Promise.resolve();
        if (_editorLoading) return _editorLoading;
        function loadScript(src) {
            return new Promise(function(resolve, reject){
                var s = document.createElement('script');
                s.src = src + '?v=' + Date.now();
                s.onload = resolve;
                s.onerror = function(){ reject(new Error('Failed to load ' + src)); };
                document.head.appendChild(s);
            });
        }
        _editorLoading = loadScript('./assets/checklist-store.js')
            .then(function(){ return loadScript('./assets/checklist-editor.js'); });
        return _editorLoading;
    }
    function openChecklistEditor(asset) {
        loadChecklistEditor().then(function(){
            window.BFLFP_ChecklistEditor.open(asset);
        }).catch(function(err){
            alert('Could not load checklist editor: ' + (err.message || err));
        });
    }
    function downloadChecklistsJSON() {
        if (!window.BFLFP_ChecklistStore) {
            loadChecklistEditor().then(function(){
                window.BFLFP_ChecklistStore.load().then(function(){
                    window.BFLFP_ChecklistStore.downloadMergedJSON();
                });
            });
        } else {
            window.BFLFP_ChecklistStore.downloadMergedJSON();
        }
    }
    function refreshChecklistDirty() {
        if (!$btnDLChecklist) return;
        var dirty = window.BFLFP_ChecklistStore && window.BFLFP_ChecklistStore.hasOverrides();
        $btnDLChecklist.disabled = !dirty;
        $btnDLChecklist.classList.toggle('active', !!dirty);
        if (dirty) {
            var s = window.BFLFP_ChecklistStore.overrideSummary();
            $btnDLChecklist.textContent = '📑 Download updated checklists.json (' + s.sheets + ' sheet' + (s.sheets===1?'':'s') + ' edited)';
        } else {
            $btnDLChecklist.textContent = '📑 Download updated checklists.json';
        }
    }

    function bindEditMode() {
        if (!EDIT_MODE) return;
        $editBanner.hidden = false;
        $btnAdd.hidden = false;
        $btnAdd.addEventListener('click', function(){ openModal('add', null); });
        $btnDownload.addEventListener('click', downloadJSON);
        if ($btnDLChecklist) $btnDLChecklist.addEventListener('click', downloadChecklistsJSON);

        // After saving a sheet, refresh dirty indicator + check for existing overrides on load
        document.addEventListener('bflfp:checklist-saved', refreshChecklistDirty);
        // Pre-warm the store so we can show overrides count on page load
        loadChecklistEditor().then(function(){
            return window.BFLFP_ChecklistStore.load();
        }).then(refreshChecklistDirty).catch(function(){ /* offline ok */ });

        $tbody.addEventListener('click', function(e){
            var clBtn = e.target.closest('[data-edit-checklist]');
            if (clBtn) {
                var aid = clBtn.getAttribute('data-edit-checklist');
                var assetCl = allAssets.find(function(a){ return a.asset_id === aid; });
                if (assetCl) openChecklistEditor(assetCl);
                return;
            }
            var btn = e.target.closest('[data-edit-id]');
            if (!btn) return;
            var id = btn.getAttribute('data-edit-id');
            var asset = allAssets.find(function(a){ return a.asset_id === id; });
            if (asset) openModal('edit', asset);
        });
        $modalClose.addEventListener('click', closeModal);
        $btnCancel.addEventListener('click', closeModal);
        $modal.addEventListener('click', function(e){ if (e.target === $modal) closeModal(); });
        document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && !$modal.hidden) closeModal(); });
        $modalForm.addEventListener('submit', function(e){ e.preventDefault(); saveForm(); });
        FIELDS.clss.addEventListener('change', function(){
            if (FIELDS.id.readOnly) return;
            var clss = FIELDS.clss.value.trim();
            if (!clss) return;
            var suggested = suggestNextId(clss);
            if (suggested && !FIELDS.id.value.trim()) {
                FIELDS.id.value = suggested;
                FIELDS.type.value = deriveType(classAbbrFromId(suggested));
            }
        });
        window.addEventListener('beforeunload', function(e){
            if (dirty) { e.preventDefault(); e.returnValue = ''; }
        });
    }

    function init() {
        // Read via shared data service (SharePoint flow first, local JSON fallback)
        var loader = (window.BFLFP && BFLFP.data && BFLFP.data.assets)
            ? BFLFP.data.assets()
            : fetch(DATA_URL).then(function(r){ if (!r.ok) throw new Error('Failed to load assets.json'); return r.json(); });

        loader
            .then(function(data){
                allAssets = data.assets || [];
                if (data.version) meta.version = data.version;
                filtered  = allAssets.slice();
                updateStats();
                populateClassFilter();
                bindFilters();
                bindRowSelection();
                bindEditMode();
                render();
            })
            .catch(function(err){
                console.error(err);
                $tbody.innerHTML = '<tr><td colspan="11" class="empty-row">Failed to load assets: ' + (err.message||err) + '</td></tr>';
            });
    }

    init();
})();

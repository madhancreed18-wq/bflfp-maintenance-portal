/* ============================================
   BFLFP — Checklist Editor (modal)
   Mounted on the Assets page. Edit / create a PM checklist sheet
   bound to a given asset. Photos embedded as base64 data URLs.
   Loaded lazily on demand by assets.js.
   ============================================ */
(function() {
    'use strict';

    if (window.BFLFP_ChecklistEditor) return; // load once

    var state = {
        assetId: null,
        asset: null,
        sheetName: null,
        sheet: null,          // working copy under edit
        isNew: false,         // true if creating brand-new sheet
        dirty: false
    };

    // Use single-letter codes (W/M/Q/S/A) — matches the rest of the system + CSV imports.
    var FREQ_LIST = [
        { code:'W', short:'W', label:'Weekly / สัปดาห์',     swatch:'#F4B084' },
        { code:'M', short:'M', label:'Monthly / 1 เดือน',    swatch:'#9DC3E6' },
        { code:'Q', short:'Q', label:'Quarterly / 3 เดือน',  swatch:'#FFD966' },
        { code:'S', short:'S', label:'Bi-Annual / 6 เดือน',  swatch:'#A9D08E' },
        { code:'A', short:'A', label:'Annual / ปี',          swatch:'#B4A7D6' }
    ];

    function esc(s) {
        return (s == null ? '' : String(s))
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }

    // ----------------------------------------------------
    // Build the modal DOM (once, on first open)
    // ----------------------------------------------------
    function buildModal() {
        if (document.getElementById('cle-modal')) return;
        var m = document.createElement('div');
        m.id = 'cle-modal';
        m.className = 'cle-overlay';
        m.hidden = true;
        m.innerHTML =
            '<div class="cle-panel" role="dialog" aria-labelledby="cle-title">' +
              '<header class="cle-header">' +
                '<div>' +
                  '<h2 id="cle-title">Edit Checklist</h2>' +
                  '<div class="cle-sub" id="cle-sub"></div>' +
                '</div>' +
                '<button class="cle-close" id="cle-close" aria-label="Close">×</button>' +
              '</header>' +
              '<div class="cle-meta">' +
                '<label class="cle-field"><span>Sheet Name</span>' +
                  '<input type="text" id="cle-sheet-name" placeholder="e.g. AIR COMPRESSOR" />' +
                '</label>' +
                '<label class="cle-field"><span>Primary PM Frequency</span>' +
                  '<select id="cle-primary-freq">' +
                    '<option value="">— select —</option>' +
                    '<option>Weekly</option><option>Monthly</option><option>Quarterly</option>' +
                    '<option>Bi-Annual</option><option>Annual</option><option>Daily</option>' +
                  '</select>' +
                '</label>' +
                '<label class="cle-field cle-field-bind"><span>Bind sheet to this asset</span>' +
                  '<input type="checkbox" id="cle-bind" checked />' +
                '</label>' +
                '<div class="cle-counts" id="cle-counts"></div>' +
              '</div>' +
              '<div class="cle-body" id="cle-body">' +
                '<div class="cle-empty" id="cle-empty">No tasks yet — click <strong>+ Add Task</strong> to start building the checklist.</div>' +
                '<div class="cle-tasks" id="cle-tasks"></div>' +
              '</div>' +
              '<div class="cle-error" id="cle-error" hidden></div>' +
              '<footer class="cle-footer">' +
                '<button type="button" class="cle-btn-add" id="cle-add">+ Add Task</button>' +
                '<div class="cle-spacer"></div>' +
                '<button type="button" class="cle-btn-secondary" id="cle-cancel">Cancel</button>' +
                '<button type="button" class="cle-btn-primary" id="cle-save">💾 Save Sheet</button>' +
              '</footer>' +
            '</div>';
        document.body.appendChild(m);

        document.getElementById('cle-close').addEventListener('click', close);
        document.getElementById('cle-cancel').addEventListener('click', close);
        document.getElementById('cle-add').addEventListener('click', addTask);
        document.getElementById('cle-save').addEventListener('click', save);
        m.addEventListener('click', function(e){ if (e.target === m) close(); });
        document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && !m.hidden) close(); });

        // delegated handlers for task rows
        document.getElementById('cle-tasks').addEventListener('input', onTaskInput);
        document.getElementById('cle-tasks').addEventListener('change', onTaskChange);
        document.getElementById('cle-tasks').addEventListener('click', onTaskClick);
    }

    // ----------------------------------------------------
    // Open the editor for a given asset
    // ----------------------------------------------------
    function open(asset) {
        buildModal();
        state.assetId = asset.asset_id;
        state.asset   = asset;
        state.dirty   = false;

        window.BFLFP_ChecklistStore.load().then(function(){
            var sheetName = window.BFLFP_ChecklistStore.getSheetNameForAsset(asset.asset_id);
            var sheet     = sheetName ? window.BFLFP_ChecklistStore.getSheet(sheetName) : null;

            if (!sheet) {
                state.isNew    = true;
                state.sheetName = (asset.class_name || asset.asset_id || 'NEW SHEET').toUpperCase();
                state.sheet    = {
                    sheet_name:        state.sheetName,
                    primary_frequency: asset.pm_frequency || 'Monthly',
                    tasks:             []
                };
            } else {
                state.isNew    = false;
                state.sheetName = sheetName;
                state.sheet    = JSON.parse(JSON.stringify(sheet)); // work on a copy
                state.sheet.tasks = state.sheet.tasks || [];
            }
            paint();
            document.getElementById('cle-modal').hidden = false;
        }).catch(function(err){
            alert('Could not load checklists.json: ' + (err.message || err));
        });
    }

    function close() {
        if (state.dirty) {
            if (!confirm('Discard unsaved changes?')) return;
        }
        document.getElementById('cle-modal').hidden = true;
        state.assetId = null;
        state.asset   = null;
        state.sheet   = null;
        state.dirty   = false;
    }

    // ----------------------------------------------------
    // Paint the whole modal from current state
    // ----------------------------------------------------
    function paint() {
        var s = state.sheet;
        document.getElementById('cle-title').textContent = state.isNew
            ? 'Create Checklist for ' + state.assetId
            : 'Edit Checklist — ' + state.sheetName;
        document.getElementById('cle-sub').textContent =
            state.asset.name + '  •  Class: ' + (state.asset.class_name || '—') + '  •  ' +
            (state.isNew ? 'NEW SHEET' : 'Editing existing sheet');
        document.getElementById('cle-sheet-name').value   = s.sheet_name || '';
        document.getElementById('cle-primary-freq').value = s.primary_frequency || '';
        document.getElementById('cle-bind').checked       = true;
        paintCounts();
        paintTasks();
    }

    function paintCounts() {
        var s = state.sheet;
        document.getElementById('cle-counts').textContent = (s.tasks || []).length + ' tasks';
    }

    function paintTasks() {
        var s = state.sheet;
        var tasks = s.tasks || [];
        document.getElementById('cle-empty').style.display = tasks.length ? 'none' : '';
        document.getElementById('cle-tasks').innerHTML = tasks.map(renderTask).join('');
    }

    function renderTask(t, idx) {
        var freqs = t.frequencies || [];
        var freqHtml = FREQ_LIST.map(function(f){
            var on = freqs.indexOf(f.code) >= 0;
            return '<label class="cle-freq-chip ' + (on ? 'on' : '') + '" style="--sw:' + f.swatch + '">' +
                '<input type="checkbox" data-act="freq" data-freq="' + f.code + '" ' + (on ? 'checked' : '') + '>' +
                '<span>' + f.short + '</span></label>';
        }).join('');

        var imgPreview = t.image_url
            ? '<img class="cle-img-preview" src="' + esc(relImg(t.image_url)) + '" alt="task ' + (idx+1) + '">'
            : '<div class="cle-img-placeholder">No image</div>';

        return '<div class="cle-task" data-idx="' + idx + '">' +
                 '<div class="cle-task-head">' +
                   '<span class="cle-task-num">#' + (t.task_no || (idx+1)) + '</span>' +
                   '<div class="cle-task-actions">' +
                     '<button type="button" data-act="up" title="Move up">▲</button>' +
                     '<button type="button" data-act="down" title="Move down">▼</button>' +
                     '<button type="button" class="cle-del" data-act="del" title="Delete task">✕</button>' +
                   '</div>' +
                 '</div>' +
                 '<div class="cle-task-grid">' +
                   '<div class="cle-img-cell">' +
                     imgPreview +
                     '<label class="cle-img-btn">' +
                       '<input type="file" data-act="img" accept="image/*" hidden>' +
                       '📷 Upload / Replace' +
                     '</label>' +
                     (t.image_url ? '<button type="button" class="cle-img-clear" data-act="img-clear">Remove image</button>' : '') +
                   '</div>' +
                   '<div class="cle-fields">' +
                     '<label><span>Description (รายการตรวจเช็ค) *</span>' +
                       '<textarea data-act="desc" rows="2" placeholder="What to check...">' + esc(t.description || '') + '</textarea>' +
                     '</label>' +
                     '<label><span>Acceptance Criteria (สถานะปกติ)</span>' +
                       '<textarea data-act="std" rows="2" placeholder="What \'normal\' looks like...">' + esc(t.standard || '') + '</textarea>' +
                     '</label>' +
                     '<div class="cle-row">' +
                       '<label class="cle-method"><span>Method (วิธีการ)</span>' +
                         '<input type="text" data-act="method" placeholder="เช็ค / Visual / Measure" value="' + esc(t.method || '') + '">' +
                       '</label>' +
                       '<div class="cle-freq-group"><span>Frequencies</span>' +
                         '<div class="cle-freq-chips">' + freqHtml + '</div>' +
                       '</div>' +
                     '</div>' +
                   '</div>' +
                 '</div>' +
               '</div>';
    }

    // image_url may already be a data URL (new uploads) or a relative path
    // (e.g. "img/checklist/W01AC/task01.jpeg" — preview from the print/ folder)
    function relImg(u) {
        if (!u) return '';
        if (/^data:/i.test(u) || /^https?:/i.test(u)) return u;
        // baseline paths are relative to print/ — resolve to docs root
        if (u.indexOf('img/') === 0) return './' + u;
        return u;
    }

    // ----------------------------------------------------
    // Task row event delegation
    // ----------------------------------------------------
    function getTask(idx) { return state.sheet.tasks[idx]; }
    function markDirty()  { state.dirty = true; }

    function onTaskInput(e) {
        var row = e.target.closest('.cle-task');
        if (!row) return;
        var idx = parseInt(row.dataset.idx, 10);
        var t   = getTask(idx);
        var act = e.target.dataset.act;
        if (act === 'desc')   t.description = e.target.value;
        else if (act === 'std') t.standard  = e.target.value;
        else if (act === 'method') t.method = e.target.value;
        else return;
        markDirty();
    }

    function onTaskChange(e) {
        var row = e.target.closest('.cle-task');
        if (!row) return;
        var idx = parseInt(row.dataset.idx, 10);
        var t   = getTask(idx);
        var act = e.target.dataset.act;

        if (act === 'freq') {
            var f = e.target.dataset.freq;
            t.frequencies = t.frequencies || [];
            var i = t.frequencies.indexOf(f);
            if (e.target.checked && i < 0) t.frequencies.push(f);
            else if (!e.target.checked && i >= 0) t.frequencies.splice(i, 1);
            // toggle chip class
            var chip = e.target.closest('.cle-freq-chip');
            if (chip) chip.classList.toggle('on', e.target.checked);
            markDirty();
            return;
        }

        if (act === 'img') {
            var file = e.target.files && e.target.files[0];
            if (!file) return;
            window.BFLFP_ChecklistStore.fileToDataURL(file, 600, 0.82)
                .then(function(dataUrl){
                    t.image_url = dataUrl;
                    markDirty();
                    paintTasks();
                })
                .catch(function(err){
                    alert('Image upload failed: ' + (err.message || err));
                });
        }
    }

    function onTaskClick(e) {
        var row = e.target.closest('.cle-task');
        if (!row) return;
        var btn = e.target.closest('button');
        if (!btn) return;
        var act = btn.dataset.act;
        var idx = parseInt(row.dataset.idx, 10);
        var tasks = state.sheet.tasks;

        if (act === 'del') {
            if (!confirm('Delete task #' + (tasks[idx].task_no || (idx+1)) + '?')) return;
            tasks.splice(idx, 1);
            renumber();
            paintTasks(); paintCounts(); markDirty();
        } else if (act === 'up' && idx > 0) {
            var tmp = tasks[idx-1]; tasks[idx-1] = tasks[idx]; tasks[idx] = tmp;
            renumber(); paintTasks(); markDirty();
        } else if (act === 'down' && idx < tasks.length - 1) {
            var tmp2 = tasks[idx+1]; tasks[idx+1] = tasks[idx]; tasks[idx] = tmp2;
            renumber(); paintTasks(); markDirty();
        } else if (act === 'img-clear') {
            getTask(idx).image_url = null;
            paintTasks(); markDirty();
        }
    }

    function renumber() {
        (state.sheet.tasks || []).forEach(function(t, i){ t.task_no = i + 1; });
    }

    function addTask() {
        state.sheet.tasks = state.sheet.tasks || [];
        var nextNo = state.sheet.tasks.length + 1;
        state.sheet.tasks.push({
            task_no: nextNo,
            description: '',
            standard: '',
            method: '',
            frequencies: [],
            image_url: null
        });
        markDirty();
        paintTasks(); paintCounts();
        // focus the new task
        setTimeout(function(){
            var rows = document.querySelectorAll('.cle-task');
            var last = rows[rows.length - 1];
            if (last) {
                last.scrollIntoView({ behavior:'smooth', block:'center' });
                var ta = last.querySelector('textarea[data-act="desc"]');
                if (ta) ta.focus();
            }
        }, 40);
    }

    // ----------------------------------------------------
    // Save
    // ----------------------------------------------------
    function save() {
        var err = document.getElementById('cle-error');
        err.hidden = true; err.textContent = '';

        var sheetName = (document.getElementById('cle-sheet-name').value || '').trim();
        var primary   = document.getElementById('cle-primary-freq').value || '';
        var bind      = document.getElementById('cle-bind').checked;

        if (!sheetName)            { showErr('Sheet name is required.'); return; }
        if (!state.sheet.tasks || !state.sheet.tasks.length) {
            showErr('Add at least one task before saving.'); return;
        }
        for (var i = 0; i < state.sheet.tasks.length; i++) {
            var t = state.sheet.tasks[i];
            if (!(t.description || '').trim()) {
                showErr('Task #' + (i+1) + ' is missing a description.'); return;
            }
        }

        state.sheet.sheet_name        = sheetName;
        state.sheet.primary_frequency = primary;
        renumber();

        // Disable Save button + show progress
        var $saveBtn = document.getElementById('cle-save');
        var origText = $saveBtn ? $saveBtn.textContent : 'Save Sheet';
        if ($saveBtn) { $saveBtn.disabled = true; $saveBtn.textContent = '⏳ Saving to SharePoint…'; }

        var store = window.BFLFP_ChecklistStore;
        // Prefer cloud sync; falls back to local-only inside syncSheet if flow unconfigured
        var savePromise = (store && store.syncSheet)
            ? store.syncSheet(sheetName, state.sheet)
            : Promise.resolve({ ok: true, cloud: false });

        savePromise.then(function (result) {
            if (bind) {
                store.assignSheetToAsset(state.assetId, sheetName);
            }
            state.dirty = false;
            document.dispatchEvent(new CustomEvent('bflfp:checklist-saved', {
                detail: { assetId: state.assetId, sheetName: sheetName, cloud: !!(result && result.cloud) }
            }));

            if ($saveBtn) {
                $saveBtn.textContent = result && result.cloud ? '✓ Saved to SharePoint' : '✓ Saved locally';
                $saveBtn.style.background = '#16A34A';
            }
            var msg = result && result.cloud
                ? '✓ Saved to SharePoint!\n\nSheet "' + sheetName + '" with ' + state.sheet.tasks.length + ' tasks.\n' +
                  (result.created_tasks ? '(' + result.created_tasks + ' tasks written)' : '')
                : '✓ Saved locally (cloud sync unavailable).\n\nSheet "' + sheetName + '" with ' + state.sheet.tasks.length + ' tasks.\nDownload the updated checklists.json from the Assets toolbar to publish.';
            alert(msg);

            setTimeout(function () {
                if ($saveBtn) { $saveBtn.disabled = false; $saveBtn.textContent = origText; $saveBtn.style.background = ''; }
                document.getElementById('cle-modal').hidden = true;
            }, 700);
        }).catch(function (err) {
            console.error('[ChecklistEditor] save failed:', err);
            if ($saveBtn) { $saveBtn.disabled = false; $saveBtn.textContent = origText; $saveBtn.style.background = ''; }
            showErr('❌ Save failed: ' + (err.message || err) + ' — your changes were NOT written to SharePoint.');
        });
        return; // legacy alert below is no longer reached; keep as guard
        document.getElementById('cle-modal').hidden = true;
    }

    function showErr(msg) {
        var err = document.getElementById('cle-error');
        err.textContent = msg;
        err.hidden = false;
        err.scrollIntoView({ behavior:'smooth', block:'center' });
    }

    // ----------------------------------------------------
    // Public API
    // ----------------------------------------------------
    window.BFLFP_ChecklistEditor = {
        open: open,
        close: close
    };
})();

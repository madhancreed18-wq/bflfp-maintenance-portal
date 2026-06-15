/* ============================================
   BFLFP — Shared Checklist Store
   - Loads docs/data/checklists.json once
   - Layers in localStorage overrides (edited sheets + asset→sheet remaps)
   - Provides save / export-JSON / download helpers
   Key: 'bflfp_checklist_overrides_v1'
   ============================================ */
window.BFLFP_ChecklistStore = (function() {
    'use strict';
    var KEY = 'bflfp_checklist_overrides_v1';
    var DATA_URL = './data/checklists.json';

    var baseline = null;
    var overrides = null;
    var loading  = null;

    function readLocal() {
        try {
            var raw = localStorage.getItem(KEY);
            if (!raw) return { sheets:{}, asset_to_sheets:{} };
            var parsed = JSON.parse(raw);
            return {
                sheets:           parsed.sheets || {},
                asset_to_sheets:  parsed.asset_to_sheets || {}
            };
        } catch (e) {
            console.error('[ChecklistStore] read failed:', e);
            return { sheets:{}, asset_to_sheets:{} };
        }
    }
    function writeLocal() {
        try { localStorage.setItem(KEY, JSON.stringify(overrides)); }
        catch (e) { console.error('[ChecklistStore] write failed:', e); }
    }

    function load() {
        if (baseline) return Promise.resolve(getMerged());
        if (loading) return loading;
        // Prefer SharePoint via shared data-service.js; fall back to local JSON file.
        var fetchPromise = (window.BFLFP && window.BFLFP.data && window.BFLFP.data.checklists)
            ? window.BFLFP.data.checklists()
            : fetch(DATA_URL).then(function(r){ if (!r.ok) throw new Error('Failed to load checklists.json'); return r.json(); });
        loading = fetchPromise.then(function(data){
            baseline  = data;
            overrides = readLocal();
            return getMerged();
        });
        return loading;
    }

    // Deep clone (small JSON) — used so callers can mutate freely without affecting cached baseline
    function clone(x) { return JSON.parse(JSON.stringify(x || null)); }

    function getMerged() {
        if (!baseline) return null;
        var merged = clone(baseline);
        merged.checklists = merged.checklists || [];
        // Apply sheet overrides (full replacement of matching sheet, or append if new)
        var bySheet = {};
        merged.checklists.forEach(function(c){ bySheet[c.sheet_name] = c; });
        Object.keys(overrides.sheets || {}).forEach(function(sn){
            var ov = overrides.sheets[sn];
            if (bySheet[sn]) {
                // Replace existing sheet
                var idx = merged.checklists.findIndex(function(c){ return c.sheet_name === sn; });
                merged.checklists[idx] = Object.assign({}, bySheet[sn], ov, { sheet_name: sn });
            } else {
                merged.checklists.push(Object.assign({ sheet_name: sn }, ov));
            }
        });
        // Apply asset-to-sheets overrides
        merged.asset_to_sheets = merged.asset_to_sheets || {};
        Object.keys(overrides.asset_to_sheets || {}).forEach(function(aid){
            merged.asset_to_sheets[aid] = overrides.asset_to_sheets[aid];
        });
        return merged;
    }

    function listSheets() {
        var m = getMerged();
        return m ? (m.checklists || []).map(function(c){ return c.sheet_name; }).sort() : [];
    }
    function getSheet(sheetName) {
        var m = getMerged();
        if (!m) return null;
        return (m.checklists || []).find(function(c){ return c.sheet_name === sheetName; }) || null;
    }
    function getSheetForAsset(assetId) {
        var m = getMerged();
        if (!m) return null;
        var sheets = (m.asset_to_sheets || {})[assetId] || [];
        if (!sheets.length) return null;
        return getSheet(sheets[0]);
    }
    function getSheetNameForAsset(assetId) {
        var m = getMerged();
        if (!m) return null;
        var sheets = (m.asset_to_sheets || {})[assetId] || [];
        return sheets.length ? sheets[0] : null;
    }

    function saveSheet(sheetName, sheetData) {
        if (!overrides) overrides = { sheets:{}, asset_to_sheets:{} };
        var existing = getSheet(sheetName) || {};
        overrides.sheets[sheetName] = Object.assign({}, existing, sheetData, { sheet_name: sheetName });
        writeLocal();
        return overrides.sheets[sheetName];
    }

    // Sync this sheet to SharePoint via UpsertChecklistSheet flow.
    // Returns a Promise. Resolves with {ok, action, created_tasks, ...} on success.
    // Falls back to localStorage-only if the flow isn't configured.
    function syncSheet(sheetName, sheetData) {
        // Always write local first so we have a snapshot if cloud fails
        saveSheet(sheetName, sheetData);

        if (!(window.BFLFP && BFLFP.data && BFLFP.data.upsertSheet)) {
            return Promise.resolve({ ok: true, cloud: false, reason: 'flow not configured' });
        }

        // Build payload matching the flow's expected schema
        var tasks = (sheetData.tasks || []).map(function (t, idx) {
            var imgFile = '';
            var imgFolder = '';   // empty if no image — don't fabricate a folder name
            if (t.image_url) {
                // image_url may be a SharePoint URL, a local path, or just a filename
                var url = String(t.image_url);
                var lastSlash = url.lastIndexOf('/');
                imgFile = lastSlash >= 0 ? url.substring(lastSlash + 1) : url;
                if (lastSlash >= 0) {
                    var beforeFile = url.substring(0, lastSlash);
                    var prevSlash = beforeFile.lastIndexOf('/');
                    if (prevSlash >= 0) imgFolder = beforeFile.substring(prevSlash + 1);
                }
                // Decode any percent-encoded chars (e.g. %20, %E0%B8...) so the folder
                // name matches what's stored in SharePoint exactly.
                try { imgFolder = decodeURIComponent(imgFolder); } catch (e) { /* keep as-is */ }
                try { imgFile   = decodeURIComponent(imgFile);   } catch (e) { /* keep as-is */ }
            }
            // Normalize frequencies to single-letter codes (W/M/Q/S/A)
            var freqs = (Array.isArray(t.frequencies) ? t.frequencies : [])
                .map(function (f) {
                    f = String(f).trim().toUpperCase();
                    if (f === 'WEEKLY')    return 'W';
                    if (f === 'MONTHLY')   return 'M';
                    if (f === 'QUARTERLY') return 'Q';
                    if (f === 'BI-ANNUAL' || f === 'BIANNUAL' || f === 'SEMI-ANNUAL') return 'S';
                    if (f === 'ANNUAL')    return 'A';
                    if (/^[WMQSA]$/.test(f)) return f;
                    return '';
                })
                .filter(Boolean);
            return {
                task_no:           t.task_no || (idx + 1),
                description:       t.description || '',
                standard:          t.standard || '',
                method:            t.method || '',
                frequencies:       freqs,
                image_file:        imgFile,
                image_folder_path: imgFolder
            };
        });

        var payload = {
            sheet_name:        sheetName,
            class_label:       sheetData.class_label || sheetData.sheet_name || sheetName,
            primary_frequency: sheetData.primary_frequency || '',
            assets_covered:    Array.isArray(sheetData.assets_covered) ? sheetData.assets_covered.join(',') : (sheetData.assets_covered || ''),
            doc_code:          sheetData.doc_code || 'F-SP-ENG02-01 Rev.01',
            tasks:             tasks
        };

        return BFLFP.data.upsertSheet(payload).then(function (resp) {
            // Clear local override since SharePoint now has the canonical copy
            if (overrides && overrides.sheets[sheetName]) {
                delete overrides.sheets[sheetName];
                writeLocal();
            }
            // Invalidate cached checklists read so next page-load pulls fresh data
            BFLFP.data.invalidate('checklists');
            baseline = null; // force reload on next load()
            loading = null;
            return Object.assign({ ok: true, cloud: true }, resp || {});
        }).catch(function (err) {
            console.error('[ChecklistStore] upsertSheet flow failed:', err);
            return { ok: false, cloud: false, error: err.message || String(err) };
        });
    }

    function assignSheetToAsset(assetId, sheetName) {
        if (!overrides) overrides = { sheets:{}, asset_to_sheets:{} };
        overrides.asset_to_sheets[assetId] = [sheetName];
        writeLocal();
    }

    function hasOverrides() {
        if (!overrides) return false;
        return Object.keys(overrides.sheets || {}).length > 0 ||
               Object.keys(overrides.asset_to_sheets || {}).length > 0;
    }
    function overrideSummary() {
        if (!overrides) return { sheets: 0, mappings: 0 };
        return {
            sheets:   Object.keys(overrides.sheets || {}).length,
            mappings: Object.keys(overrides.asset_to_sheets || {}).length
        };
    }
    function clearOverrides() {
        overrides = { sheets:{}, asset_to_sheets:{} };
        writeLocal();
    }

    function exportMergedJSON() {
        var merged = getMerged();
        if (!merged) return null;
        merged.generated = new Date().toISOString().slice(0,10);
        if (merged.checklists) merged.count = merged.checklists.length;
        return merged;
    }
    function downloadMergedJSON(filename) {
        var payload = exportMergedJSON();
        if (!payload) { alert('Baseline not loaded yet — please wait a moment'); return; }
        var blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = filename || 'checklists.json';
        document.body.appendChild(a); a.click();
        setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    }

    // -------- Image helpers ----------
    // Resize an uploaded image File to max-side px and return a data: URL.
    function fileToDataURL(file, maxSide, quality) {
        maxSide = maxSide || 600;
        quality = quality || 0.82;
        return new Promise(function(resolve, reject){
            var fr = new FileReader();
            fr.onerror = function(){ reject(new Error('Failed to read file')); };
            fr.onload  = function(){
                var img = new Image();
                img.onerror = function(){ reject(new Error('Failed to decode image')); };
                img.onload  = function(){
                    var w = img.width, h = img.height;
                    var scale = Math.min(1, maxSide / Math.max(w, h));
                    var cw = Math.round(w * scale), ch = Math.round(h * scale);
                    var canvas = document.createElement('canvas');
                    canvas.width = cw; canvas.height = ch;
                    var ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, cw, ch);
                    ctx.drawImage(img, 0, 0, cw, ch);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.src = fr.result;
            };
            fr.readAsDataURL(file);
        });
    }

    return {
        load: load,
        listSheets: listSheets,
        getSheet: getSheet,
        getSheetForAsset: getSheetForAsset,
        getSheetNameForAsset: getSheetNameForAsset,
        saveSheet: saveSheet,
        syncSheet: syncSheet,
        assignSheetToAsset: assignSheetToAsset,
        hasOverrides: hasOverrides,
        overrideSummary: overrideSummary,
        clearOverrides: clearOverrides,
        exportMergedJSON: exportMergedJSON,
        downloadMergedJSON: downloadMergedJSON,
        fileToDataURL: fileToDataURL,
        getMerged: getMerged
    };
})();

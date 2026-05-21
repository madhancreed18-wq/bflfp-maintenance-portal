/* ============================================
   BFLFP — Asset Resolver (shared utility)

   Compares SharePoint event Machine field with the Asset Registry
   and returns a canonical match.

   Match priority (strict, no fuzzy):
     1. Exact match to Asset ID (W01PK20)
     2. Exact match to asset name (เครื่อง Seal กล่อง TP R2)
     3. Case-insensitive trimmed alias match (tetrapak → W01PK20)
     4. Ignore patterns / exact list → status 'ignored'
     5. None of the above → status 'other'

   Usage:
     await BFLFP_Resolver.load();
     var r = BFLFP_Resolver.resolve('tetrapak');
     // { status: 'matched', asset_id: 'W01PK20',
     //   canonical_name: 'เครื่อง Seal กล่อง TP R2',
     //   raw: 'tetrapak', via: 'alias' }
   ============================================ */
window.BFLFP_Resolver = (function() {
    'use strict';

    var assetsByCode = {};      // 'W01PK20' -> asset record
    var assetsByName = {};      // 'เครื่อง Seal กล่อง TP R2' -> asset record (lowercased key)
    var aliases = {};           // lowercased trimmed key -> asset_id
    var ignorePatterns = [];    // array of lowercased patterns
    var ignoreExact = {};       // lowercased exact -> true
    var loaded = false;
    var assetCount = 0;
    var allAssets = [];         // ordered list — useful for dropdowns
    var aliasesMeta = { version: 1, generated: '' };

    // Edit-time additions (when user maps from the page)
    var sessionAliases = {};    // lowercased key -> asset_id
    var sessionIgnoreExact = {}; // lowercased -> true
    var dirty = false;

    function _norm(s) {
        return (s == null) ? '' : String(s).trim().toLowerCase();
    }

    function load(dataDir) {
        dataDir = dataDir || './data';
        return Promise.all([
            fetch(dataDir + '/assets.json').then(function(r){ return r.json(); }),
            fetch(dataDir + '/asset_aliases.json').then(function(r){
                if (!r.ok) {  // file optional — gracefully degrade
                    return { aliases: {}, ignore_patterns: [], ignore_exact: [] };
                }
                return r.json();
            })
        ]).then(function(both){
            var assetsData = both[0];
            var aliasData  = both[1];
            assetsByCode = {};
            assetsByName = {};
            allAssets = (assetsData.assets || []).slice();
            allAssets.forEach(function(a){
                if (a.asset_id) assetsByCode[a.asset_id.toUpperCase()] = a;
                if (a.name)     assetsByName[_norm(a.name)] = a;
            });
            assetCount = allAssets.length;

            aliases = {};
            Object.keys(aliasData.aliases || {}).forEach(function(k){
                aliases[_norm(k)] = String(aliasData.aliases[k]).toUpperCase();
            });
            ignorePatterns = (aliasData.ignore_patterns || []).map(_norm);
            ignoreExact = {};
            (aliasData.ignore_exact || []).forEach(function(s){ ignoreExact[_norm(s)] = true; });
            aliasesMeta.version = aliasData.version || 1;
            aliasesMeta.generated = aliasData.generated || '';

            loaded = true;
            return { assetCount: assetCount, aliasCount: Object.keys(aliases).length };
        });
    }

    function resolve(raw) {
        var norm = _norm(raw);
        if (!norm) {
            return { status: 'empty', asset_id: null, canonical_name: null, raw: raw || '' };
        }
        // 1. Exact Asset ID
        var byCode = assetsByCode[norm.toUpperCase()];
        if (byCode) {
            return { status: 'matched', via: 'code',
                     asset_id: byCode.asset_id, canonical_name: byCode.name,
                     asset: byCode, raw: raw };
        }
        // 2. Exact name
        var byName = assetsByName[norm];
        if (byName) {
            return { status: 'matched', via: 'name',
                     asset_id: byName.asset_id, canonical_name: byName.name,
                     asset: byName, raw: raw };
        }
        // 3. Session aliases (newest-priority)
        if (sessionAliases[norm]) {
            var code1 = sessionAliases[norm];
            var a1 = assetsByCode[code1];
            if (a1) {
                return { status: 'matched', via: 'alias-session',
                         asset_id: a1.asset_id, canonical_name: a1.name,
                         asset: a1, raw: raw };
            }
        }
        // 4. Persisted aliases
        if (aliases[norm]) {
            var code = aliases[norm];
            var a = assetsByCode[code];
            if (a) {
                return { status: 'matched', via: 'alias',
                         asset_id: a.asset_id, canonical_name: a.name,
                         asset: a, raw: raw };
            }
        }
        // 5. Ignore (exact session)
        if (sessionIgnoreExact[norm] || ignoreExact[norm]) {
            return { status: 'ignored', via: 'exact', asset_id: null, canonical_name: null, raw: raw };
        }
        // 6. Ignore (pattern)
        for (var i = 0; i < ignorePatterns.length; i++) {
            if (norm.indexOf(ignorePatterns[i]) !== -1) {
                return { status: 'ignored', via: 'pattern', asset_id: null, canonical_name: null, raw: raw };
            }
        }
        // 7. Other / unmapped
        return { status: 'other', asset_id: null, canonical_name: null, raw: raw };
    }

    // Editing API — adds an alias in-memory; user must download to persist
    function addAlias(rawValue, assetId) {
        var k = _norm(rawValue);
        if (!k) return false;
        var code = String(assetId).toUpperCase();
        if (!assetsByCode[code]) return false;
        sessionAliases[k] = code;
        dirty = true;
        return true;
    }
    function removeAlias(rawValue) {
        var k = _norm(rawValue);
        if (sessionAliases[k]) delete sessionAliases[k];
        if (aliases[k]) delete aliases[k];
        dirty = true;
        return true;
    }
    function addIgnoreExact(rawValue) {
        var k = _norm(rawValue);
        if (!k) return false;
        sessionIgnoreExact[k] = true;
        dirty = true;
        return true;
    }
    function isDirty() { return dirty; }
    function getAllAssets() { return allAssets.slice(); }
    function getStats() {
        return {
            assetCount: assetCount,
            aliasCount: Object.keys(aliases).length + Object.keys(sessionAliases).length,
            ignorePatternCount: ignorePatterns.length,
            ignoreExactCount: Object.keys(ignoreExact).length + Object.keys(sessionIgnoreExact).length,
        };
    }

    function exportAliasesJSON() {
        // Merge persisted + session
        var merged = {};
        Object.keys(aliases).forEach(function(k){ merged[k] = aliases[k]; });
        Object.keys(sessionAliases).forEach(function(k){ merged[k] = sessionAliases[k]; });
        // Restore original casing where we can — not critical, lowercased keys are fine
        var ignoreExactMerged = {};
        Object.keys(ignoreExact).forEach(function(k){ ignoreExactMerged[k] = true; });
        Object.keys(sessionIgnoreExact).forEach(function(k){ ignoreExactMerged[k] = true; });

        return {
            version: aliasesMeta.version,
            generated: new Date().toISOString().slice(0,10),
            comment: 'Maps free-text Machine values in SharePoint to canonical Asset IDs. Lowercase keys.',
            aliases: merged,
            ignore_patterns: ignorePatterns.slice(),
            ignore_exact: Object.keys(ignoreExactMerged).sort(),
        };
    }

    return {
        load: load,
        resolve: resolve,
        addAlias: addAlias,
        removeAlias: removeAlias,
        addIgnoreExact: addIgnoreExact,
        isDirty: isDirty,
        getAllAssets: getAllAssets,
        getStats: getStats,
        exportAliasesJSON: exportAliasesJSON,
    };
})();

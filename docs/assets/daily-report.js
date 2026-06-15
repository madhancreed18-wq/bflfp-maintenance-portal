/* ============================================
   BFLFP — Daily Maintenance Report viewer (F-SP-ENG02-06)
   Surfaces files the Python script writes to Report/YYYY/MM/DD/.
   Path served by Caddy as /reports/* (see Caddyfile snippet in docs).
   ============================================ */

(function () {
    'use strict';

    var REPORTS_ROOT = './reports';

    function $(id) { return document.getElementById(id); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
    function pad(n) { return String(n).padStart(2, '0'); }
    function fmtDateISO(d) { return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()); }

    var $date     = $('dr-date');
    var $open     = $('dr-open');
    var $print    = $('dr-print');
    var $prev     = $('dr-prev');
    var $next     = $('dr-next');
    var $status   = $('dr-status-bar');
    var $toolbar  = $('dr-toolbar');
    var $toolInfo = $('dr-toolbar-info');
    var $viewWrap = $('dr-viewer-wrap');
    var $iframe   = $('dr-pdf-frame');
    var $openXlsx = $('dr-open-xlsx');
    var $openPdf  = $('dr-open-pdf');
    var $download = $('dr-download');
    var $gallerySection = $('dr-gallery-section');
    var $gallery  = $('dr-gallery');

    function buildPaths(dateISO) {
        var d  = new Date(dateISO + 'T00:00:00');
        var yyyy = d.getFullYear();
        var mm   = pad(d.getMonth() + 1);
        var dd   = pad(d.getDate());
        var ddmm = dd + '-' + mm + '-' + yyyy;
        var folder = REPORTS_ROOT + '/' + yyyy + '/' + mm + '/' + dd;
        return {
            folder:  folder,
            xlsx:    folder + '/MaintenanceReport_' + ddmm + '.xlsx',
            pdf:     folder + '/MaintenanceReport_' + ddmm + '.pdf',
            ddmm:    ddmm
        };
    }

    function checkExists(url) {
        return fetch(url, { method: 'HEAD', cache: 'no-cache' })
            .then(function (r) { return r.ok; })
            .catch(function () { return false; });
    }

    function setStatus(html, cls) {
        $status.innerHTML = '<div class="dr-status ' + (cls || '') + '">' + html + '</div>';
    }

    function setLoading(date) {
        $toolbar.hidden = true;
        $viewWrap.hidden = true;
        $gallerySection.hidden = true;
        setStatus('<i class="ti ti-loader"></i> Looking for the daily report for ' + esc(date) + '...', '');
    }

    function showFound(paths, pdfExists, xlsxExists) {
        setStatus(
            '<i class="ti ti-check"></i> Daily report found for <strong>' + esc(paths.ddmm) + '</strong>. ' +
            (pdfExists ? '' : 'PDF missing - XLSX only. ') +
            (xlsxExists ? '' : 'XLSX missing - PDF only.'),
            'dr-status-ok'
        );

        $toolInfo.innerHTML =
            '<strong>MaintenanceReport_' + esc(paths.ddmm) + '</strong><br>' +
            '<code>' + esc(paths.folder) + '/</code>';

        if (xlsxExists) { $openXlsx.href = paths.xlsx; $openXlsx.style.display = ''; }
        else { $openXlsx.style.display = 'none'; }

        if (pdfExists)  {
            $openPdf.href = paths.pdf;
            $download.href = paths.pdf;
            $openPdf.style.display = '';
            $download.style.display = '';
            $iframe.src = paths.pdf + '#view=FitH&toolbar=1';
            $viewWrap.hidden = false;
        } else {
            $openPdf.style.display = 'none';
            $download.style.display = 'none';
            $viewWrap.hidden = true;
        }

        $toolbar.hidden = false;
    }

    function showMissing(paths) {
        $toolbar.hidden = true;
        $viewWrap.hidden = true;
        setStatus(
            '<i class="ti ti-alert-triangle"></i> ' +
            'No report generated yet for <strong>' + esc(paths.ddmm) + '</strong>. ' +
            'Expected file: <code>' + esc(paths.pdf) + '</code>. ' +
            'This means either (a) no maintenance was logged that day, or (b) the Python script has not run yet.',
            'dr-status-missing'
        );
    }

    function showError(paths, err) {
        $toolbar.hidden = true;
        $viewWrap.hidden = true;
        setStatus(
            '<i class="ti ti-x-circle"></i> Could not reach <code>' + esc(paths.folder) + '</code>. ' +
            'Most likely Caddy is not serving the /reports/ path yet. See the help banner above for the Caddyfile config to add.',
            'dr-status-error'
        );
        console.error('Daily report fetch error:', err);
    }

    function tryListPhotos(folder, ddmm) {
        return fetch(folder + '/', { headers: { 'Accept': 'text/html' } })
            .then(function (r) { return r.ok ? r.text() : ''; })
            .catch(function () { return ''; })
            .then(function (html) {
                if (!html) return [];
                var photos = [];
                var re = /href="([^"]+\.(?:jpe?g|png))"/gi;
                var m;
                while ((m = re.exec(html)) !== null) {
                    var fn = m[1];
                    if (fn.indexOf('/') === 0) fn = fn.split('/').pop();
                    fn = fn.split('?')[0].split('#')[0];
                    if (!fn) continue;
                    var isBefore = /beforeimage/i.test(fn);
                    var isAfter  = /afterimage/i.test(fn);
                    var labelMatch = fn.match(/^([^_]+)_/);
                    var label = labelMatch ? labelMatch[1] : fn;
                    photos.push({
                        url: folder + '/' + fn,
                        name: fn,
                        label: decodeURIComponent(label),
                        kind: isBefore ? 'before' : (isAfter ? 'after' : 'photo')
                    });
                }
                var seen = {};
                return photos.filter(function (p) { if (seen[p.url]) return false; seen[p.url] = true; return true; });
            });
    }

    function renderGallery(photos) {
        if (!photos.length) {
            $gallerySection.hidden = true;
            return;
        }
        photos.sort(function (a, b) {
            var k = { before: 0, after: 1, photo: 2 };
            if (k[a.kind] !== k[b.kind]) return k[a.kind] - k[b.kind];
            return a.label.localeCompare(b.label);
        });

        var html = '';
        photos.forEach(function (p, i) {
            var tagCls  = p.kind === 'before' ? 'dr-photo-tag-before' : 'dr-photo-tag-after';
            var tagText = p.kind === 'before' ? 'Before' : (p.kind === 'after' ? 'After' : '');
            html += '<div class="dr-photo" data-idx="' + i + '">';
            html += '  <img src="' + esc(p.url) + '" alt="' + esc(p.label) + '" loading="lazy">';
            if (tagText) html += '  <span class="dr-photo-tag ' + tagCls + '">' + tagText + '</span>';
            html += '  <div class="dr-photo-label">' + esc(p.label) + '</div>';
            html += '</div>';
        });
        $gallery.innerHTML = html;
        $gallerySection.hidden = false;

        $gallery.querySelectorAll('.dr-photo').forEach(function (el) {
            el.addEventListener('click', function () {
                openLightbox(photos[Number(el.getAttribute('data-idx'))].url);
            });
        });
    }

    function openLightbox(url) {
        var box = document.createElement('div');
        box.className = 'dr-lightbox';
        box.innerHTML =
            '<button class="dr-lightbox-close" aria-label="Close"><i class="ti ti-x"></i></button>' +
            '<img src="' + esc(url) + '">';
        box.addEventListener('click', function () { document.body.removeChild(box); });
        document.body.appendChild(box);
    }

    function generate() {
        var d = $date.value;
        if (!d) {
            setStatus('<i class="ti ti-calendar"></i> Pick a date.', 'dr-status-missing');
            return;
        }
        var paths = buildPaths(d);
        setLoading(d);

        Promise.all([ checkExists(paths.pdf), checkExists(paths.xlsx) ])
            .then(function (results) {
                var pdfOk  = results[0];
                var xlsxOk = results[1];
                if (!pdfOk && !xlsxOk) {
                    showMissing(paths);
                    $gallerySection.hidden = true;
                    return;
                }
                showFound(paths, pdfOk, xlsxOk);
                tryListPhotos(paths.folder, paths.ddmm).then(renderGallery);
            })
            .catch(function (err) { showError(paths, err); });
    }

    /* ============================================
       PRINT RANGE - merge all daily PDFs between From/To into one document
       ============================================ */
    var $from          = $('dr-from');
    var $to            = $('dr-to');
    var $printRange    = $('dr-print-range');
    var $downloadRange = $('dr-download-range');
    var MAX_RANGE_DAYS = 92;

    function loadPdfLib() {
        if (window.PDFLib) return Promise.resolve(window.PDFLib);
        return new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
            s.onload  = function () { resolve(window.PDFLib); };
            s.onerror = function () { reject(new Error('Could not load the PDF merge library (no internet?). Open each day separately instead.')); };
            document.head.appendChild(s);
        });
    }

    function datesInRange(fromISO, toISO) {
        var out = [];
        var d   = new Date(fromISO + 'T00:00:00');
        var end = new Date(toISO + 'T00:00:00');
        while (d <= end) { out.push(fmtDateISO(d)); d.setDate(d.getDate() + 1); }
        return out;
    }

    function fetchDayPdf(iso) {
        var p = buildPaths(iso);
        return fetch(p.pdf, { cache: 'no-cache' })
            .then(function (r) {
                if (!r.ok) return { ddmm: p.ddmm, buf: null };
                return r.arrayBuffer().then(function (buf) { return { ddmm: p.ddmm, buf: buf }; });
            })
            .catch(function () { return { ddmm: p.ddmm, buf: null }; });
    }

    function printRange() {
        var f = $from.value, t = $to.value;
        if (!f || !t) {
            setStatus('<i class="ti ti-calendar"></i> Pick both From and To dates.', 'dr-status-missing');
            return;
        }
        if (f > t) { var tmp = f; f = t; t = tmp; }
        var days = datesInRange(f, t);
        if (days.length > MAX_RANGE_DAYS) {
            setStatus('<i class="ti ti-alert-triangle"></i> Range too long (' + days.length + ' days). Maximum is ' + MAX_RANGE_DAYS + ' days.', 'dr-status-missing');
            return;
        }

        $downloadRange.style.display = 'none';
        setStatus('<i class="ti ti-loader"></i> Collecting daily reports for ' + days.length + ' day(s)...', '');

        loadPdfLib().then(function (PDFLib) {
            var results = [];
            var chain = Promise.resolve();
            days.forEach(function (iso) {
                chain = chain.then(function () {
                    return fetchDayPdf(iso).then(function (r) { results.push(r); });
                });
            });

            return chain.then(function () {
                var found   = results.filter(function (r) { return r.buf; });
                var missing = results.filter(function (r) { return !r.buf; }).map(function (r) { return r.ddmm; });

                if (!found.length) {
                    setStatus('<i class="ti ti-alert-triangle"></i> No daily reports found between ' + esc(f) + ' and ' + esc(t) + '.', 'dr-status-missing');
                    return;
                }

                setStatus('<i class="ti ti-loader"></i> Merging ' + found.length + ' report(s)...', '');

                return PDFLib.PDFDocument.create().then(function (merged) {
                    var seq = Promise.resolve();
                    found.forEach(function (day) {
                        seq = seq.then(function () {
                            return PDFLib.PDFDocument.load(day.buf, { ignoreEncryption: true })
                                .then(function (src) { return merged.copyPages(src, src.getPageIndices()); })
                                .then(function (pages) { pages.forEach(function (pg) { merged.addPage(pg); }); });
                        });
                    });
                    return seq.then(function () { return merged.save(); });
                }).then(function (bytes) {
                    var blob = new Blob([bytes], { type: 'application/pdf' });
                    var url  = URL.createObjectURL(blob);

                    $iframe.src = url + '#view=FitH&toolbar=1';
                    $viewWrap.hidden = false;
                    $toolbar.hidden = true;
                    $gallerySection.hidden = true;

                    $downloadRange.href = url;
                    $downloadRange.download = 'DailyReports_' + f + '_to_' + t + '.pdf';
                    $downloadRange.style.display = '';

                    var w = window.open(url, '_blank');
                    if (w) { try { w.focus(); } catch (e) {} }

                    setStatus(
                        '<i class="ti ti-check"></i> Merged <strong>' + found.length + '</strong> daily report(s) from ' + esc(f) + ' to ' + esc(t) + '. ' +
                        'Print from the new tab (Ctrl+P) or the viewer below.' +
                        (missing.length ? '<br><small>No report for: ' + esc(missing.join(', ')) + '</small>' : ''),
                        'dr-status-ok'
                    );
                });
            });
        }).catch(function (err) {
            setStatus('<i class="ti ti-x-circle"></i> Print range failed: ' + esc(err.message), 'dr-status-error');
            console.error('Print range error:', err);
        });
    }

    function init() {
        if (!$date.value) $date.value = fmtDateISO(new Date());

        if ($from && !$from.value) {
            var weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 6);
            $from.value = fmtDateISO(weekAgo);
        }
        if ($to && !$to.value) $to.value = fmtDateISO(new Date());

        if ($open)  $open.addEventListener('click', generate);
        if ($print) $print.addEventListener('click', function () { window.print(); });
        if ($printRange) $printRange.addEventListener('click', printRange);
        if ($prev)  $prev.addEventListener('click', function () {
            var d = new Date($date.value); d.setDate(d.getDate() - 1);
            $date.value = fmtDateISO(d); generate();
        });
        if ($next)  $next.addEventListener('click', function () {
            var d = new Date($date.value); d.setDate(d.getDate() + 1);
            $date.value = fmtDateISO(d); generate();
        });

        generate();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

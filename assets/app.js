    const VERSION = '0.0.17';
    const STORAGE_KEY = 'april_2026_bill_increase_rows_v1';

    // Percent uplifts are stored as integer numerator/1000 (e.g. 6.9% => 1069/1000) to keep maths pence-safe.
    const SERVICE_TYPES = [
      { id: '', label: 'Select service type' },
      { id: 'wlr', label: 'WLR Line (Single/Multi) – line only (+£12.50)', kind: 'flat' },
      { id: 'isdn', label: 'ISDN2 / ISDN30 – per line (+£12.50)', kind: 'flat' },
      { id: 'maintenance', label: 'Maintenance (+20%)', kind: 'percent', numerator: 1200 },
      { id: 'hosting', label: 'Data Hosting (Co-Location / Rack Space) (+25%)', kind: 'percent', numerator: 1250 },
      { id: 'leased', label: 'Leased Line connectivity (+10%)', kind: 'percent', numerator: 1100 },
      { id: 'other', label: 'Broadband / Voice / Mobile / Other (base +6.9%)', kind: 'percent', numerator: 1069 },
      { id: 'microsoft', label: 'Microsoft Products (Excluded – no increase)', kind: 'none' }
    ];

    const rowsEl = document.getElementById('serviceRows');
    const totalBeforeEl = document.getElementById('totalBefore');
    const totalAfterEl = document.getElementById('totalAfter');
    const totalDiffEl = document.getElementById('totalDiff');
    const annualDiffEl = document.getElementById('annualDiff');
    const totalDiffBoxEl = document.getElementById('totalDiffBox');
    const toastEl = document.getElementById('toast');
    const importBtn = document.getElementById('importLSRBtn');
    const fileInput = document.getElementById('lsrFileInput');
    const tableWrapEl = document.querySelector('.table-wrap');
    const rowWarningsEl = document.getElementById('rowWarnings');
    const breakdownPanelEl = document.getElementById('breakdownPanel');
    const driversPanelEl = document.getElementById('driversPanel');
    const downloadCsvBtn = document.getElementById('btnDownloadCsv');

    const analytics = JSON.parse(localStorage.getItem('billIncreaseAnalytics') || '{}');
    analytics.imports = analytics.imports || 0;
    analytics.rowsProcessed = analytics.rowsProcessed || 0;
    analytics.totalIncrease = analytics.totalIncrease || 0;

    let importedAccountNumber = '';
    let importedCompanyName = '';
    let sortableInstance = null;

    function poundsToPence(str) {
      const cleaned = (str || '').toString().replace(/£|,/g, '').trim();
      if (!cleaned) return null;
      if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
      const numeric = Number.parseFloat(cleaned);
      if (!Number.isFinite(numeric) || numeric > 100000) return null;
      const [whole, frac = ''] = cleaned.split('.');
      const pennies = parseInt((frac + '00').slice(0, 2), 10);
      return (parseInt(whole, 10) * 100) + pennies;
    }

    function parseImportPriceToPence(rawPrice) {
      const cleaned = String(rawPrice ?? '').replace(/[^0-9.\-]/g, '').trim();
      if (!cleaned) return null;

      const numeric = Number.parseFloat(cleaned);
      if (!Number.isFinite(numeric) || numeric <= 0) return null;

      // Round to nearest penny
      return Math.round(numeric * 100);
    }

    function formatGBP(penceInt) {
      const sign = penceInt < 0 ? '-' : '';
      const abs = Math.abs(penceInt);
      const pounds = Math.floor(abs / 100);
      const pence = String(abs % 100).padStart(2, '0');
      return `${sign}£${pounds}.${pence}`;
    }

    function applyRule(oldPence, serviceTypeId) {
      const service = SERVICE_TYPES.find((s) => s.id === serviceTypeId);
      if (!service) return oldPence;
      if (service.kind === 'none') return oldPence;
      if (service.kind === 'flat') return oldPence + 1250;
      // Using numerator/1000 keeps percentages precise in integer pence and avoids floating-point drift.
      return Math.round(oldPence * service.numerator / 1000);
    }

    function createServiceOptions() {
      return SERVICE_TYPES.map((s, i) => `<option value="${s.id}" ${i === 0 ? 'selected' : ''}>${s.label}</option>`).join('');
    }

    function computedCell(value = '—') {
      return `<span class="computed">${value}</span>`;
    }

    function getServiceLabel(serviceId) {
      const service = SERVICE_TYPES.find((s) => s.id === serviceId);
      return service ? service.label : '—';
    }

    function getServiceRuleLabel(serviceTypeId) {
      if (!serviceTypeId) return '—';
      const service = SERVICE_TYPES.find((s) => s.id === serviceTypeId);
      if (!service) return '—';
      if (service.kind === 'none') return 'No increase';
      if (service.kind === 'flat') return '+£12.50';
      if (service.kind === 'percent') {
        const upliftPercent = (service.numerator - 1000) / 10;
        return Number.isInteger(upliftPercent) ? `+${upliftPercent}%` : `+${upliftPercent.toFixed(1)}%`;
      }
      return '—';
    }

    function getShortServiceLabel(serviceId) {
      const label = getServiceLabel(serviceId);
      return label.split(' – ')[0].split(' (')[0];
    }

    function truncateText(text, max = 60) {
      if (text.length <= max) return text;
      return `${text.slice(0, max - 1)}…`;
    }

    function renderRowWarnings(missingTypeCount) {
      if (missingTypeCount > 0) {
        rowWarningsEl.style.display = 'block';
        rowWarningsEl.textContent = `⚠ ${missingTypeCount} row(s) need a service type selecting.`;
        return;
      }
      rowWarningsEl.style.display = 'none';
      rowWarningsEl.textContent = '';
    }

    function renderBreakdownByServiceType(totals) {
      const entries = Object.values(totals.breakdownByType || {}).sort((a, b) => b.diffPence - a.diffPence);
      if (!entries.length) {
        breakdownPanelEl.innerHTML = '';
        return;
      }

      const rows = entries.map((entry) => `
        <tr>
          <td>${getShortServiceLabel(entry.serviceId)} (${entry.count})</td>
          <td>${formatGBP(entry.beforePence)}</td>
          <td>${formatGBP(entry.afterPence)}</td>
          <td>${formatGBP(entry.diffPence)}</td>
        </tr>`).join('');

      breakdownPanelEl.innerHTML = `
        <strong style="display:block;margin-bottom:0.4rem;">Breakdown by service type</strong>
        <table style="width:100%;min-width:0;font-size:0.84rem;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="position:static;background:#f9fafb;">Service type</th>
              <th style="position:static;background:#f9fafb;">Before</th>
              <th style="position:static;background:#f9fafb;">After</th>
              <th style="position:static;background:#f9fafb;">Diff</th>
            </tr>
          </thead>
          <tbody>${rows}
          </tbody>
        </table>`;
    }

    function renderIncreaseDrivers(totals) {
      const completeRows = totals.rows.filter((row) => row.complete);
      if (!completeRows.length) {
        driversPanelEl.innerHTML = '';
        return;
      }

      const topTypes = Object.values(totals.breakdownByType || {})
        .sort((a, b) => b.diffPence - a.diffPence)
        .slice(0, 3);

      const topRows = completeRows
        .slice()
        .sort((a, b) => b.totalDiffPence - a.totalDiffPence)
        .slice(0, 3);

      const typeItems = topTypes.length
        ? topTypes.map((item) => `<li>${getShortServiceLabel(item.serviceId)}: ${formatGBP(item.diffPence)}</li>`).join('')
        : '<li>None</li>';

      const rowItems = topRows.length
        ? topRows.map((row) => {
          const reference = truncateText(row.desc || row.cli || 'Service');
          return `<li>${reference} | ${getShortServiceLabel(row.serviceId)}: ${formatGBP(row.totalDiffPence)}</li>`;
        }).join('')
        : '<li>None</li>';

      driversPanelEl.innerHTML = `
        <strong style="display:block;margin-bottom:0.4rem;">Biggest drivers of increase</strong>
        <div style="font-size:0.85rem;color:#374151;">By service type</div>
        <ul style="margin:0.2rem 0 0.5rem 1.1rem;padding:0;">${typeItems}</ul>
        <div style="font-size:0.85rem;color:#374151;">By service line</div>
        <ul style="margin:0.2rem 0 0 1.1rem;padding:0;">${rowItems}</ul>`;
    }

    function addRow(data = {}) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="col-move"><button type="button" class="drag-handle" aria-label="Reorder row" title="Drag to reorder">☰</button></td>
        <td><input class="cli" type="text" placeholder="0161… / CLI" value="${data.cli || ''}" /></td>
        <td><input class="serviceDesc" type="text" placeholder="Optional service name" value="${data.desc || ''}" /></td>
        <td>
          <select class="serviceType" required>${createServiceOptions()}</select>
          <div class="error serviceError">Select a service</div>
        </td>
        <td data-field="ruleCell">${computedCell()}</td>
        <td>
          <input class="price" type="text" inputmode="decimal" placeholder="0.00" />
          <div class="error priceError">Enter a valid price</div>
        </td>
        <td><input class="qty" type="number" min="1" step="1" value="${data.qty || 1}" /></td>
        <td data-field="beforeTotal">${computedCell()}</td>
        <td data-field="afterTotal">${computedCell()}</td>
        <td data-field="diffTotal">${computedCell()}</td>
        <td>
          <div class="row-actions">
            <button type="button" class="duplicateBtn secondary">Duplicate</button>
            <button type="button" class="removeBtn danger">Remove</button>
          </div>
        </td>
      `;

      const serviceSelect = tr.querySelector('.serviceType');
      const priceInput = tr.querySelector('.price');

      if (data.serviceId) serviceSelect.value = data.serviceId;
      if (Number.isInteger(data.pricePence)) {
        priceInput.value = formatGBP(data.pricePence);
      } else if (data.priceText) {
        priceInput.value = data.priceText;
      }

      rowsEl.appendChild(tr);
    }

    function setComputedRow(row, model) {
      const setField = (key, value) => {
        const cell = row.querySelector(`[data-field="${key}"] .computed`);
        if (cell) cell.textContent = value;
      };

      if (!model.complete) {
        ['ruleCell', 'beforeTotal', 'afterTotal', 'diffTotal'].forEach((field) => setField(field, '—'));
        return;
      }

      setField('ruleCell', getServiceRuleLabel(model.serviceId));
      setField('beforeTotal', formatGBP(model.totalBeforePence));
      setField('afterTotal', formatGBP(model.totalAfterPence));
      setField('diffTotal', formatGBP(model.totalDiffPence));
    }

    function readRows() {
      return Array.from(rowsEl.querySelectorAll('tr')).map((row) => {
        const cli = row.querySelector('.cli').value.trim();
        const desc = row.querySelector('.serviceDesc').value.trim();
        const serviceSelect = row.querySelector('.serviceType');
        const serviceId = serviceSelect.value;
        const priceInput = row.querySelector('.price');
        const qtyInput = row.querySelector('.qty');
        const serviceError = row.querySelector('.serviceError');
        const priceError = row.querySelector('.priceError');

        const perUnitBeforePence = poundsToPence(priceInput.value);
        const qty = Math.max(1, Math.min(1000, parseInt(qtyInput.value, 10) || 1));
        qtyInput.value = qty;

        const rowHasMeaningfulData = Boolean(
          cli ||
          desc ||
          priceInput.value.trim() ||
          qty !== 1 ||
          serviceId
        );

        const serviceMissing = !serviceId && rowHasMeaningfulData;
        const priceMissing = perUnitBeforePence === null && rowHasMeaningfulData;

        serviceSelect.classList.toggle('invalid', serviceMissing);
        priceInput.classList.toggle('invalid', priceMissing);
        serviceError.style.display = serviceMissing ? 'block' : 'none';
        priceError.style.display = priceMissing ? 'block' : 'none';

        if (serviceMissing || priceMissing) {
          setComputedRow(row, { complete: false });
          return {
            cli,
            desc,
            serviceId,
            qty,
            priceText: priceInput.value,
            pricePence: perUnitBeforePence,
            complete: false,
            meaningful: rowHasMeaningfulData
          };
        }

        const perUnitAfterPence = applyRule(perUnitBeforePence, serviceId);
        const perUnitDiffPence = perUnitAfterPence - perUnitBeforePence;
        const totalBeforePence = perUnitBeforePence * qty;
        const totalAfterPence = perUnitAfterPence * qty;
        const totalDiffPence = totalAfterPence - totalBeforePence;

        setComputedRow(row, {
          complete: true,
          perUnitBeforePence,
          perUnitAfterPence,
          perUnitDiffPence,
          totalBeforePence,
          totalAfterPence,
          totalDiffPence,
          serviceId
        });

        return {
          cli,
          desc,
          serviceId,
          qty,
          priceText: priceInput.value,
          pricePence: perUnitBeforePence,
          perUnitAfterPence,
          perUnitDiffPence,
          totalBeforePence,
          totalAfterPence,
          totalDiffPence,
          complete: true,
          meaningful: rowHasMeaningfulData
        };
      });
    }

    function saveRowsToStorage(rows) {
      const safeRows = rows.map((row) => ({
        cli: row.cli,
        desc: row.desc,
        serviceId: row.serviceId,
        qty: row.qty,
        pricePence: Number.isInteger(row.pricePence) ? row.pricePence : null,
        priceText: row.priceText || ''
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safeRows));
    }

    function recalc() {
      const rows = readRows();
      let totalBefore = 0;
      let totalAfter = 0;
      const cliValues = [];
      let missingTypeCount = 0;
      const breakdownByType = {};

      rows.forEach((row) => {
        if (row.cli) cliValues.push(row.cli);
        if (row.meaningful && !row.serviceId) missingTypeCount += 1;
        if (!row.complete) return;

        totalBefore += row.totalBeforePence;
        totalAfter += row.totalAfterPence;

        if (!breakdownByType[row.serviceId]) {
          breakdownByType[row.serviceId] = {
            serviceId: row.serviceId,
            beforePence: 0,
            afterPence: 0,
            diffPence: 0,
            count: 0
          };
        }

        const bucket = breakdownByType[row.serviceId];
        bucket.beforePence += row.totalBeforePence;
        bucket.afterPence += row.totalAfterPence;
        bucket.diffPence += row.totalDiffPence;
        bucket.count += 1;
      });

      const diff = totalAfter - totalBefore;
      const annualDiff = diff * 12;

      const diffs = rows
        .filter((r) => r.complete)
        .map((r) => r.totalDiffPence);

      const maxDiff = diffs.length ? Math.max(...diffs) : 0;

      Array.from(rowsEl.querySelectorAll('tr')).forEach((tr, i) => {
        tr.classList.remove('largest-increase');

        const r = rows[i];
        if (r && r.totalDiffPence === maxDiff && maxDiff > 0) {
          tr.classList.add('largest-increase');
        }
      });
      totalBeforeEl.textContent = formatGBP(totalBefore);
      totalAfterEl.textContent = formatGBP(totalAfter);
      totalDiffEl.textContent = formatGBP(diff);
      annualDiffEl.textContent = formatGBP(annualDiff);

      totalDiffBoxEl.classList.remove('diff-positive', 'diff-negative', 'diff-zero');
      if (diff > 0) totalDiffBoxEl.classList.add('diff-positive');
      else if (diff < 0) totalDiffBoxEl.classList.add('diff-negative');
      else totalDiffBoxEl.classList.add('diff-zero');

      renderRowWarnings(missingTypeCount);
      const totals = { totalBefore, totalAfter, diff, annualDiff, cliValues, rows, breakdownByType, missingTypeCount };
      renderBreakdownByServiceType(totals);
      renderIncreaseDrivers(totals);

      analytics.totalIncrease += diff;
      localStorage.setItem('billIncreaseAnalytics', JSON.stringify(analytics));

      saveRowsToStorage(rows);

      return totals;
    }

    function buildExplanationText(totals) {
      const lines = [
        'April 2026 bill increase summary',
        `Total before: ${formatGBP(totals.totalBefore)} per month`,
        `Total after: ${formatGBP(totals.totalAfter)} per month`,
        `Monthly difference: ${formatGBP(totals.diff)}`,
        `Annual increase: ${formatGBP(totals.annualDiff)}`,
        '',
        'Pricing logic used:',
        '- WLR/ISDN line services: +£12.50 per line.',
        '- Other services: percentage uplift applied in pence-safe maths (e.g. base +6.9%).',
        '- Microsoft products are excluded from the April 2026 price increase.',
        '',
        'Checks:',
        '- This estimate assumes the April 2026 increase is not already specified in the customer’s contract terms (contract terms take precedence).',
        '- Verify which price increase letter the customer received in Daisy Central before providing guidance.',
        '- Some customers/services may be excluded; confirm exemptions with Commercial if needed.'
      ];

      if (totals.cliValues.length > 0) {
        lines.push('', `Numbers/CLIs referenced: ${totals.cliValues.join(', ')}`);
      }

      const detailedRows = totals.rows.filter((row) => row.complete && (row.cli || row.desc));
      if (detailedRows.length > 0) {
        lines.push('', 'Service lines:');
        detailedRows.forEach((row) => {
          const reference = [row.cli || 'No CLI', row.desc || 'No description'].join(' | ');
          lines.push(`- ${reference} — ${getServiceLabel(row.serviceId)} — Qty ${row.qty} — ${formatGBP(row.totalBeforePence)} to ${formatGBP(row.totalAfterPence)} (diff ${formatGBP(row.totalDiffPence)}).`);
        });
      }

      return lines.join('\n');
    }

    function buildCRMNote(totals) {
      const lines = [];

      if (importedCompanyName) lines.push(`Customer: ${importedCompanyName}`);
      if (importedAccountNumber) lines.push(`Account: ${importedAccountNumber}`);

      lines.push('');
      lines.push('April 2026 price increase explained.');
      lines.push('');
      lines.push(`Current monthly: ${formatGBP(totals.totalBefore)}`);
      lines.push(`New monthly: ${formatGBP(totals.totalAfter)}`);
      lines.push(`Increase: ${formatGBP(totals.diff)}`);
      lines.push('');
      lines.push('Services reviewed:');

      totals.rows
        .filter((r) => r.complete)
        .forEach((r) => {
          lines.push(`${r.cli || '—'} – ${r.desc || 'Service'} – ${formatGBP(r.totalBeforePence)} → ${formatGBP(r.totalAfterPence)}`);
        });

      lines.push('');
      lines.push('Estimate only. Contract terms may override.');

      return lines.join('\n');
    }

    function buildCustomerExplanation(totals) {

      const lines = [];

      lines.push(`Your current monthly bill is ${formatGBP(totals.totalBefore)}.`);
      lines.push('');

      lines.push(`From April 2026 this will change to approximately ${formatGBP(totals.totalAfter)}.`);
      lines.push('');

      lines.push(`This represents an increase of ${formatGBP(totals.diff)} per month.`);
      lines.push('');

      const keyRows = totals.rows
        .filter((r) => r.complete)
        .sort((a, b) => b.totalDiffPence - a.totalDiffPence)
        .slice(0, 3);

      if (keyRows.length) {
        lines.push('The increase mainly affects the following services:');

        keyRows.forEach((r) => {
          lines.push(`• ${r.desc || r.cli || 'Service'} – ${formatGBP(r.totalBeforePence)} → ${formatGBP(r.totalAfterPence)}`);
        });

        lines.push('');
      }

      lines.push('These changes are part of the standard April 2026 pricing adjustments.');

      return lines.join('\n');
    }


    function formatPoundsPlain(penceInt) {
      const sign = penceInt < 0 ? '-' : '';
      const abs = Math.abs(penceInt);
      const pounds = Math.floor(abs / 100);
      const pence = String(abs % 100).padStart(2, '0');
      return `${sign}${pounds}.${pence}`;
    }

    function escapeCsvField(value) {
      const text = String(value ?? '');
      if (!/[",\r\n]/.test(text)) return text;
      return `"${text.replace(/"/g, '""')}"`;
    }

    function buildCsvFromComputedRows(result) {
      const completeRows = (result?.rows || []).filter((row) => row.complete);
      const csvRows = [];

      if (importedCompanyName || importedAccountNumber) {
        csvRows.push(`# Customer: ${importedCompanyName || 'Unknown'} | Account: ${importedAccountNumber || 'Unknown'}`);
      }
      csvRows.push(`# Exported: ${new Date().toLocaleString('en-GB')}`);

      const headers = [
        'Number/CLI',
        'Service description',
        'Service type',
        'Rule',
        'Unit before (GBP)',
        'Unit after (GBP)',
        'Quantity',
        'Total before (GBP)',
        'Total after (GBP)',
        'Total diff (GBP)'
      ];
      csvRows.push(headers.join(','));

      completeRows.forEach((row) => {
        const fields = [
          row.cli || '',
          row.desc || '',
          getServiceLabel(row.serviceId),
          getServiceRuleLabel(row.serviceId),
          formatPoundsPlain(row.pricePence),
          formatPoundsPlain(row.perUnitAfterPence),
          String(row.qty),
          formatPoundsPlain(row.totalBeforePence),
          formatPoundsPlain(row.totalAfterPence),
          formatPoundsPlain(row.totalDiffPence)
        ];
        csvRows.push(fields.map(escapeCsvField).join(','));
      });

      return csvRows.join('\r\n');
    }

    function sanitiseFilenamePart(value, fallback) {
      const cleaned = String(value || '').replace(/[^A-Za-z0-9_-]/g, '');
      return cleaned || fallback;
    }

    function buildCsvFilename() {
      const date = new Date().toISOString().slice(0, 10);
      const accountPart = sanitiseFilenamePart(importedAccountNumber, 'UnknownAccount');
      return `April-2026-Price-Increase_${accountPart}_${date}.csv`;
    }

    function downloadCsv(text, filename) {
      const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }

    function initialiseSortableRows() {
      if (!window.Sortable || sortableInstance) return;
      sortableInstance = new Sortable(rowsEl, {
        animation: 150,
        handle: '.drag-handle',
        draggable: 'tr',
        direction: 'vertical',
        onEnd: () => {
          const totals = recalc();
          saveRowsToStorage(totals.rows);
        }
      });
    }

    function showToast(message) {
      toastEl.textContent = message;
      toastEl.classList.add('show');
      window.clearTimeout(showToast.timeoutId);
      showToast.timeoutId = window.setTimeout(() => {
        toastEl.classList.remove('show');
      }, 1600);
    }

    function buildCopyTableText(rows) {
      const lines = ['Number/CLI	Service description	Service type	Rule	Qty	Before	After	Diff'];
      rows
        .filter((row) => row.complete)
        .forEach((row) => {
          lines.push([
            row.cli || '—',
            row.desc || '—',
            getServiceLabel(row.serviceId),
            getServiceRuleLabel(row.serviceId),
            row.qty,
            formatGBP(row.totalBeforePence),
            formatGBP(row.totalAfterPence),
            formatGBP(row.totalDiffPence)
          ].join('	'));
        });
      return lines.join('\n');
    }

    async function copyText(text) {
      try {
        await navigator.clipboard.writeText(text);
        showToast('Copied');
      } catch (_err) {
        const fallback = document.createElement('textarea');
        fallback.value = text;
        document.body.appendChild(fallback);
        fallback.select();
        document.execCommand('copy');
        fallback.remove();
        showToast('Copied');
      }
    }

    function formatPriceOnBlur(priceInput) {
      const parsed = poundsToPence(priceInput.value);
      if (parsed === null) return;
      priceInput.value = formatGBP(parsed);
    }

    function loadRowsFromStorage() {
      let storedRows = [];
      try {
        storedRows = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      } catch (_err) {
        storedRows = [];
      }

      rowsEl.innerHTML = '';
      if (!Array.isArray(storedRows) || storedRows.length === 0) {
        addRow();
        return;
      }

      storedRows.forEach((row) => {
        addRow({
          cli: row.cli || '',
          desc: row.desc || '',
          serviceId: row.serviceId || '',
          qty: row.qty || 1,
          pricePence: Number.isInteger(row.pricePence) ? row.pricePence : null,
          priceText: row.priceText || ''
        });
      });
    }


    function normalisePIN(rawPin) {
      if (rawPin === null || rawPin === undefined) return '';

      let pin = String(rawPin).trim();
      if (!pin) return '';

      // Remove spaces and commas (some exports include them)
      pin = pin.replace(/\s+/g, '').replace(/,/g, '');

      // Excel sometimes leaves a trailing ".0" on numbers
      pin = pin.replace(/\.0+$/, '');

      // Expand scientific notation safely as a STRING, e.g.:
      //  - 1E+12 => 1000000000000
      //  - 1.0008765393E+10 => 10008765393
      const sciMatch = pin.match(/^([0-9]+(?:\.[0-9]+)?)e\+?([0-9]+)$/i);
      if (sciMatch) {
        const mantissa = sciMatch[1];
        const exponent = parseInt(sciMatch[2], 10);

        if (Number.isFinite(exponent)) {
          const [whole, frac = ''] = mantissa.split('.');
          const digits = `${whole}${frac}`;
          const shift = exponent - frac.length;

          if (shift >= 0) {
            pin = digits + '0'.repeat(shift);
          } else {
            // If shift is negative, keep only the integer part (PINs should not have decimals)
            pin = digits.slice(0, Math.max(0, digits.length + shift));
          }
        }
      }

      // Re-apply trailing .0 cleanup after sci expansion
      pin = pin.replace(/\.0+$/, '');

      // Weird Excel edge: sometimes a scientific export produces an extra trailing 0.
      // Keep this guarded and only when the original was scientific.
      if (sciMatch && /^[12378]\d{10}$/.test(pin) && pin.endsWith('0')) {
        pin = pin.slice(0, -1);
      }

      // Restore missing leading zero for UK phone numbers:
      // "PINs that start with 1, 2, 3, 7 or 8 and are 10 digits long" => prefix 0
      if (/^[12378]\d{9}$/.test(pin)) {
        pin = '0' + pin;
      }

      // Explicit mobile rule: 10 digits starting with 7 => prefix 0
      if (/^7\d{9}$/.test(pin)) {
        pin = '0' + pin;
      }

      // Optional warning for obviously-corrupted very-long numbers
      if (pin.length > 15 && pin.includes('0000000000')) {
        console.warn('Possible Excel precision loss on PIN:', pin);
      }

      return pin;
    }

    function detectServiceType(desc, cli) {

      const text = (desc || '').toLowerCase();

      if (cli && cli.startsWith('M0')) return 'maintenance';

      if (text.includes('wlr') || text.includes('pstn') || text.includes('single line'))
        return 'wlr';

      if (text.includes('isdn'))
        return 'isdn';

      if (text.includes('maintenance') || text.includes('care level'))
        return 'maintenance';

      if (text.includes('rack') || text.includes('co-location') || text.includes('colocation'))
        return 'hosting';

      if (text.includes('leased line') || text.includes('ethernet') || text.includes('mpls'))
        return 'leased';

      if (text.includes('microsoft') || text.includes('office 365'))
        return 'microsoft';

      return 'other';

    }

    function processLSRRows(rows) {

      const existingRows = Array.from(rowsEl.querySelectorAll('tr'));
      if (existingRows.length === 1) {
        const starterRow = existingRows[0];

        const starterIsEmpty =
          !starterRow.querySelector('.cli').value.trim() &&
          !starterRow.querySelector('.serviceDesc').value.trim() &&
          !starterRow.querySelector('.serviceType').value &&
          !starterRow.querySelector('.price').value.trim();

        if (starterIsEmpty) starterRow.remove();
      }

      function pick(row, keys) {
        for (const k of keys) {
          const v = row?.[k];
          if (v !== undefined && v !== null && String(v).trim() !== '') return v;
        }
        return '';
      }

      importedAccountNumber = '';
      importedCompanyName = '';

      let importedCount = 0;

      const IGNORED_LSR_SERVICES = [
        'charge for paper invoicing',
        'non dd payer',
        'recurring credit card charge'
      ];

      rows.forEach((row) => {

        if (!importedCompanyName) {
          const name = pick(row, ['CompanyName', 'Company Name', 'Company']);
          if (name) importedCompanyName = String(name).trim();
        }

        const serviceName = pick(row, ['ServiceDescription', 'Service Description', 'Description', 'Service']);

        const serviceNameLower = String(serviceName || '').toLowerCase();

        if (IGNORED_LSR_SERVICES.some((service) => serviceNameLower.includes(service))) {

          const accountPinRaw = pick(row, ['PIN', 'Pin', 'CLI', 'Number', 'CLI/Number', 'CLI Number']);
          const accountPIN = normalisePIN(accountPinRaw);

          if (accountPIN) importedAccountNumber = accountPIN;

          // Company name already handled above, but keep this as a fallback
          const cname = pick(row, ['CompanyName', 'Company Name', 'Company']);
          if (cname && !importedCompanyName) importedCompanyName = String(cname).trim();

          return; // do NOT import this row as a service line
        }

        const cliRaw = pick(row, ['PIN', 'Pin', 'CLI', 'Number', 'CLI/Number', 'CLI Number']);
        const cli = normalisePIN(cliRaw);

        const desc = String(serviceName || '').trim();

        const qtyRaw = pick(row, ['Quantity', 'Qty', 'QTY']);
        const qty = Math.max(1, parseInt(qtyRaw, 10) || 1);

        // Prefer per-unit rate to avoid double-counting when qty > 1
        const rawUnit = pick(row, ['Pre-discount Rate', 'Pre-discount rate', 'Rate', 'Monthly']);
        const rawTotal = pick(row, ['Pre-discount Total Rate', 'Pre-discount Total rate', 'Total Rate', 'Total']);

        const unitPence = parseImportPriceToPence(rawUnit);
        const totalPence = parseImportPriceToPence(rawTotal);

        let pricePence = unitPence;
        if (pricePence === null && totalPence !== null) {
          pricePence = Math.round(totalPence / qty);
        }

        if (!cli || !desc || !pricePence || pricePence <= 0) return;

        addRow({
          cli,
          desc,
          qty,
          pricePence,
          serviceId: detectServiceType(desc, cli)
        });

        importedCount++;

      });

      if (importedCount > 0) {
        recalc();
        tableWrapEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      const infoEl = document.getElementById('lsrAccountInfo');
      if (infoEl) {
        if (importedAccountNumber || importedCompanyName) {
          infoEl.textContent =
            'Account: ' + (importedAccountNumber || 'Unknown') +
            ' | Customer: ' + (importedCompanyName || 'Unknown');
        } else {
          infoEl.textContent = '';
        }
      }

      analytics.imports += 1;
      analytics.rowsProcessed += importedCount;

      localStorage.setItem(
        'billIncreaseAnalytics',
        JSON.stringify(analytics)
      );

      showToast(`Imported ${importedCount} services from LSR`);

    }

    importBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        try {
          const data = new Uint8Array(loadEvent.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          if (!firstSheetName) {
            showToast('Could not read LSR file');
            return;
          }
          const worksheet = workbook.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, { raw: true, defval: '', blankrows: false });
          processLSRRows(rows);
        } catch (_err) {
          showToast('Could not read LSR file');
        } finally {
          fileInput.value = '';
        }
      };
      reader.readAsArrayBuffer(file);
    });

    document.getElementById('addRowBtn').addEventListener('click', () => {
      addRow();
      recalc();
    });

    document.getElementById('resetBtn').addEventListener('click', () => {
      rowsEl.innerHTML = '';
      localStorage.removeItem(STORAGE_KEY);
      addRow();
      recalc();
    });

    document.getElementById('copyExplanationBtn').addEventListener('click', async () => {
      const totals = recalc();
      await copyText(buildExplanationText(totals));
    });

    document.getElementById('copyTableBtn').addEventListener('click', async () => {
      const totals = recalc();
      await copyText(buildCopyTableText(totals.rows));
    });

    document.getElementById('copyCRMBtn').addEventListener('click', async () => {
      const totals = recalc();
      await copyText(buildCRMNote(totals));
    });

    document.getElementById('copyCustomerBtn').addEventListener('click', async () => {
      const totals = recalc();
      await copyText(buildCustomerExplanation(totals));
    });

    downloadCsvBtn.addEventListener('click', () => {
      const totals = recalc();
      const completeRows = totals.rows.filter((row) => row.complete);
      if (!completeRows.length) {
        showToast('Nothing to export yet.');
        return;
      }
      const csvText = buildCsvFromComputedRows(totals);
      downloadCsv(csvText, buildCsvFilename());
      showToast('CSV downloaded');
    });

    rowsEl.addEventListener('input', (event) => {
      if (event.target.classList.contains('price')) {
        const clean = event.target.value.replace(/[^\d.]/g, '');
        event.target.value = clean;
      }
      if (event.target.closest('tr')) recalc();
    });

    rowsEl.addEventListener('change', (event) => {
      if (event.target.closest('tr')) recalc();
    });

    rowsEl.addEventListener('blur', (event) => {
      if (!event.target.classList.contains('price')) return;
      formatPriceOnBlur(event.target);
      recalc();
    }, true);

    rowsEl.addEventListener('click', (event) => {
      if (event.target.classList.contains('duplicateBtn')) {
        const tr = event.target.closest('tr');
        if (!tr) return;
        addRow({
          cli: tr.querySelector('.cli').value,
          desc: tr.querySelector('.serviceDesc').value,
          serviceId: tr.querySelector('.serviceType').value,
          qty: tr.querySelector('.qty').value,
          pricePence: poundsToPence(tr.querySelector('.price').value),
          priceText: tr.querySelector('.price').value
        });
        recalc();
        return;
      }

      if (!event.target.classList.contains('removeBtn')) return;
      const tr = event.target.closest('tr');
      if (tr) tr.remove();
      if (!rowsEl.querySelector('tr')) addRow();
      recalc();
    });

    document.getElementById('versionDisplay').textContent = VERSION;

    loadRowsFromStorage();
    initialiseSortableRows();
    recalc();

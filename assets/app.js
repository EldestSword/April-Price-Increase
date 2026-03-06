    const VERSION = '0.0.25';
    const STORAGE_KEY = 'april_2026_bill_increase_rows_v1';
    const THEME_KEY = 'april_2026_theme';
    const ELIGIBILITY_FLAGS_KEY = 'april_2026_eligibility_flags_v1';

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

    const PRODUCT_CATEGORY_LABELS = {
      wlr: 'WLR Line',
      broadband: 'Broadband',
      voice: 'Voice',
      mobile: 'Mobile',
      ethernet: 'Leased Line / Ethernet',
      select_services: 'Select Services',
      maintenance: 'Maintenance',
      other: 'Other'
    };

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
    const downloadCsvBtn = document.getElementById('btnDownloadCsv');
    const downloadPdfBtn = document.getElementById('btnDownloadPdf');
    const themeToggleBtn = document.getElementById('themeToggle');
    const categorySummaryEl = document.getElementById('categorySummary');
    const driversSummaryEl = document.getElementById('driversSummary');
    const eligibilityPanelEl = document.getElementById('eligibilityFlags');
    const eligibilityAssessmentEl = document.getElementById('eligibilityAssessment');

    const analytics = JSON.parse(localStorage.getItem('billIncreaseAnalytics') || '{}');
    analytics.imports = analytics.imports || 0;
    analytics.rowsProcessed = analytics.rowsProcessed || 0;
    analytics.totalIncrease = analytics.totalIncrease || 0;

    let importedAccountNumber = '';
    let importedCompanyName = '';
    let sortableInstance = null;

    function applyTheme(theme) {
      document.documentElement.dataset.theme = theme;
      if (!themeToggleBtn) return;
      if (theme === 'dark') {
        themeToggleBtn.textContent = 'Light mode';
        themeToggleBtn.setAttribute('aria-label', 'Switch to light mode');
        return;
      }
      themeToggleBtn.textContent = 'Dark mode';
      themeToggleBtn.setAttribute('aria-label', 'Switch to dark mode');
    }

    function getInitialTheme() {
      const storedTheme = localStorage.getItem(THEME_KEY);
      if (storedTheme === 'light' || storedTheme === 'dark') {
        return storedTheme;
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

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


    function getProductCategoryLabel(category) {
      return PRODUCT_CATEGORY_LABELS[category] || PRODUCT_CATEGORY_LABELS.other;
    }

    function normaliseServiceDescription(value) {
      return String(value || '').toLowerCase().trim();
    }

    function normaliseDigits(value) {
      return String(value || '').replace(/\D/g, '');
    }

    function normaliseIdentifier(value) {
      return String(value || '').trim().toUpperCase();
    }

    function isMaintenancePin(pin) {
      return /^M0/i.test(normaliseIdentifier(pin));
    }


    const ELIGIBILITY_DEFAULT_FLAGS = {
      cpi39Post2025: false,
      altitudeOriginalGamma: false,
      tncMismatchClaimed: false,
      finalThreeMonths: false
    };

    const QUALIFYING_SERVICE_IDS = ['wlr', 'isdn', 'maintenance', 'hosting', 'leased'];

    function parseDateOnly(value) {
      if (value === null || value === undefined || value === '') return null;

      if (typeof value === 'number' && Number.isFinite(value)) {
        const excelEpoch = Date.UTC(1899, 11, 30);
        const millis = Math.round(value * 86400000);
        const date = new Date(excelEpoch + millis);
        if (Number.isNaN(date.getTime())) return null;
        return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
      }

      const text = String(value).trim();
      if (!text) return null;

      const isoMatch = text.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
      if (isoMatch) {
        const year = parseInt(isoMatch[1], 10);
        const month = parseInt(isoMatch[2], 10);
        const day = parseInt(isoMatch[3], 10);
        return buildDateOnly(year, month, day);
      }

      const dmyMatch = text.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
      if (dmyMatch) {
        const day = parseInt(dmyMatch[1], 10);
        const month = parseInt(dmyMatch[2], 10);
        const year = parseInt(dmyMatch[3], 10);
        return buildDateOnly(year, month, day);
      }

      const asDate = new Date(text);
      if (!Number.isNaN(asDate.getTime())) {
        return { year: asDate.getUTCFullYear(), month: asDate.getUTCMonth() + 1, day: asDate.getUTCDate() };
      }

      return null;
    }

    function buildDateOnly(year, month, day) {
      if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
      if (year < 1900 || year > 2200) return null;
      if (month < 1 || month > 12) return null;
      if (day < 1 || day > 31) return null;
      const candidate = new Date(Date.UTC(year, month - 1, day));
      if (
        candidate.getUTCFullYear() !== year ||
        candidate.getUTCMonth() !== (month - 1) ||
        candidate.getUTCDate() !== day
      ) {
        return null;
      }
      return { year, month, day };
    }

    function dateOnlyToKey(dateOnly) {
      if (!dateOnly) return null;
      return (dateOnly.year * 10000) + (dateOnly.month * 100) + dateOnly.day;
    }

    function formatDateOnly(dateOnly) {
      if (!dateOnly) return 'Unknown';
      const dd = String(dateOnly.day).padStart(2, '0');
      const mm = String(dateOnly.month).padStart(2, '0');
      return `${dd}/${mm}/${dateOnly.year}`;
    }

    function isSelectServiceDescription(desc) {
      const keywords = ['fraud guardian', 'complete care', 'business assurance', 'safeweb', 'free2call', 'f2c'];
      if (keywords.some((keyword) => desc.includes(keyword))) return true;

      const careRegexes = [
        /\b(?:enhanced|premium|standard|advanced|complete)?\s*care\b/,
        /\bcare\s*(?:level|support|package|plan|service)?\b/
      ];

      return careRegexes.some((regex) => regex.test(desc));
    }

    function isMobileCli(value) {
      const digits = normaliseDigits(value);
      return /^07\d{9}$/.test(digits) || /^7\d{9}$/.test(digits);
    }

    function isEthernetPin(pin) {
      return normaliseIdentifier(pin).startsWith('DR-');
    }

    function isBroadbandService(desc, pin) {
      const broadbandTerms = ['sogea', 'fibre', 'fttc', 'fttp', 'broadband', 'superfast', 'gea'];

      return normaliseIdentifier(pin).startsWith('BBEU')
        || broadbandTerms.some((term) => desc.includes(term));
    }

    function isVoiceService(desc) {
      const voiceTerms = [
        'dhv',
        'hvs',
        'hosted voice',
        'hosted',
        'voice',
        'polycom',
        'yealink',
        'handset',
        'number port',
        'sip',
        'poe switch'
      ];

      return voiceTerms.some((term) => desc.includes(term));
    }

    function isWlrService(desc) {
      return desc.includes('wlr') || desc.includes('pstn') || desc.includes('single line');
    }

    function detectProductCategory(row) {
      const desc = normaliseServiceDescription(row.desc);
      const cli = String(row.cli || '').trim();
      const pin = normaliseIdentifier(row.pin || row.cli || '');

      if (row.serviceId === 'maintenance' || isMaintenancePin(pin)) return 'maintenance';
      if (isSelectServiceDescription(desc)) return 'select_services';
      if (isMobileCli(cli)) return 'mobile';
      if (isEthernetPin(pin)) return 'ethernet';
      if (isBroadbandService(desc, pin)) return 'broadband';
      if (isVoiceService(desc)) return 'voice';
      if (isWlrService(desc)) return 'wlr';
      return 'other';
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


    function addRow(data = {}) {
      const tr = document.createElement('tr');
      tr.dataset.startDate = data.startDate ? String(data.startDate) : '';

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
        const startDate = row.dataset.startDate || '';

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
            pin: cli,
            desc,
            serviceId,
            productCategory: detectProductCategory({ cli, pin: cli, desc, serviceId }),
            qty,
            priceText: priceInput.value,
            pricePence: perUnitBeforePence,
            startDate,
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
          pin: cli,
          desc,
          serviceId,
          productCategory: detectProductCategory({ cli, pin: cli, desc, serviceId }),
          qty,
          priceText: priceInput.value,
          pricePence: perUnitBeforePence,
          perUnitAfterPence,
          perUnitDiffPence,
          totalBeforePence,
          totalAfterPence,
          totalDiffPence,
          startDate,
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
        priceText: row.priceText || '',
        startDate: row.startDate || ''
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safeRows));
    }

    function buildProductCategorySummary(rows) {
      const completeRows = rows.filter((row) => row.complete);
      const grouped = new Map();

      completeRows.forEach((row) => {
        const category = row.productCategory || 'other';
        if (!grouped.has(category)) {
          grouped.set(category, {
            category,
            count: 0,
            totalBeforePence: 0,
            totalAfterPence: 0,
            totalDiffPence: 0
          });
        }
        const bucket = grouped.get(category);
        bucket.count += 1;
        bucket.totalBeforePence += row.totalBeforePence;
        bucket.totalAfterPence += row.totalAfterPence;
        bucket.totalDiffPence += row.totalDiffPence;
      });

      return Array.from(grouped.values()).sort((a, b) => b.totalDiffPence - a.totalDiffPence);
    }

    function buildBiggestDrivers(rows, categorySummary) {
      const topCategories = categorySummary
        .filter((item) => item.totalDiffPence > 0)
        .slice(0, 5)
        .map((item) => ({
          label: getProductCategoryLabel(item.category),
          diffPence: item.totalDiffPence
        }));

      const topRows = rows
        .filter((row) => row.complete)
        .sort((a, b) => b.totalDiffPence - a.totalDiffPence)
        .slice(0, 5)
        .map((row) => ({
          label: row.desc || row.cli || 'Service line',
          diffPence: row.totalDiffPence
        }));

      return { topCategories, topRows };
    }

    function renderSummarySections(categorySummary, drivers) {
      if (!categorySummaryEl || !driversSummaryEl) return;

      if (!categorySummary.length) {
        categorySummaryEl.innerHTML = '<p class="summary-empty">Add complete rows to view summary data.</p>';
        driversSummaryEl.innerHTML = '<p class="summary-empty">Biggest drivers will appear once rows are calculated.</p>';
        return;
      }

      const summaryRows = categorySummary
        .map((item) => `
          <tr>
            <td>${getProductCategoryLabel(item.category)}</td>
            <td>${item.count}</td>
            <td>${formatGBP(item.totalBeforePence)}</td>
            <td>${formatGBP(item.totalAfterPence)}</td>
            <td>${formatGBP(item.totalDiffPence)}</td>
          </tr>
        `)
        .join('');

      categorySummaryEl.innerHTML = `
        <table class="mini-table category-summary-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Count</th>
              <th>Before</th>
              <th>After</th>
              <th>Diff</th>
            </tr>
          </thead>
          <tbody>${summaryRows}</tbody>
        </table>
      `;

      const categoryList = drivers.topCategories.length
        ? drivers.topCategories.map((item) => `<li>${item.label}: ${formatGBP(item.diffPence)}</li>`).join('')
        : '<li>No positive increases yet.</li>';
      const lineList = drivers.topRows.length
        ? drivers.topRows.map((item) => `<li>${item.label}: ${formatGBP(item.diffPence)}</li>`).join('')
        : '<li>No lines available.</li>';

      driversSummaryEl.innerHTML = `
        <p class="mini-label"><strong>By product category</strong></p>
        <ul class="summary-list">${categoryList}</ul>
        <p class="mini-label"><strong>By service line</strong></p>
        <ul class="summary-list">${lineList}</ul>
      `;
    }


    function getQualifyingRows(rows) {
      return rows.filter((row) => row.complete && QUALIFYING_SERVICE_IDS.includes(row.serviceId));
    }

    function getEligibilitySignals(rows) {
      const completeRows = rows.filter((row) => row.complete);
      const qualifyingRows = getQualifyingRows(completeRows);
      const thresholdPost2014 = 20140123;
      const thresholdPost2025 = 20250117;

      const signals = {
        hasWlr: qualifyingRows.some((row) => row.serviceId === 'wlr'),
        hasIsdn: qualifyingRows.some((row) => row.serviceId === 'isdn'),
        hasMaintenance: qualifyingRows.some((row) => row.serviceId === 'maintenance'),
        hasHosting: qualifyingRows.some((row) => row.serviceId === 'hosting'),
        hasLeased: qualifyingRows.some((row) => row.serviceId === 'leased'),
        hasBroadband: completeRows.some((row) => row.productCategory === 'broadband' || row.serviceId === 'other'),
        qualifyingRows,
        qualifyingRowsPost2014: [],
        qualifyingRowsPost2025: [],
        qualifyingRowsWithUnknownDate: [],
        allQualifyingRowsPreOrOn2014: false,
        hasWlrOrIsdn: false,
        hasLinkedBroadband: false,
        noQualifyingRows: qualifyingRows.length === 0
      };

      signals.hasWlrOrIsdn = signals.hasWlr || signals.hasIsdn;
      signals.hasLinkedBroadband = signals.hasWlrOrIsdn && signals.hasBroadband;

      qualifyingRows.forEach((row) => {
        const parsed = parseDateOnly(row.startDate);
        const dateKey = dateOnlyToKey(parsed);
        if (!dateKey) {
          signals.qualifyingRowsWithUnknownDate.push(row);
          return;
        }
        if (dateKey > thresholdPost2014) signals.qualifyingRowsPost2014.push(row);
        if (dateKey >= thresholdPost2025) signals.qualifyingRowsPost2025.push(row);
      });

      signals.allQualifyingRowsPreOrOn2014 = qualifyingRows.length > 0
        && signals.qualifyingRowsWithUnknownDate.length === 0
        && signals.qualifyingRowsPost2014.length === 0;

      return signals;
    }

    function summariseQualifyingIncreaseTypes(signals) {
      const labels = [];
      if (signals.hasWlr) labels.push('WLR');
      if (signals.hasIsdn) labels.push('ISDN');
      if (signals.hasMaintenance) labels.push('Maintenance');
      if (signals.hasHosting) labels.push('Hosting');
      if (signals.hasLeased) labels.push('Leased line');
      return labels;
    }

    function loadEligibilityFlags() {
      try {
        const parsed = JSON.parse(localStorage.getItem(ELIGIBILITY_FLAGS_KEY) || '{}');
        return {
          ...ELIGIBILITY_DEFAULT_FLAGS,
          ...(parsed && typeof parsed === 'object' ? parsed : {})
        };
      } catch (_err) {
        return { ...ELIGIBILITY_DEFAULT_FLAGS };
      }
    }

    function saveEligibilityFlags(flags) {
      localStorage.setItem(ELIGIBILITY_FLAGS_KEY, JSON.stringify({ ...ELIGIBILITY_DEFAULT_FLAGS, ...flags }));
    }

    function readEligibilityFlags() {
      if (!eligibilityPanelEl) return { ...ELIGIBILITY_DEFAULT_FLAGS };
      return {
        cpi39Post2025: Boolean(document.getElementById('flagCpi39Post2025')?.checked),
        altitudeOriginalGamma: Boolean(document.getElementById('flagAltitudeOriginalGamma')?.checked),
        tncMismatchClaimed: Boolean(document.getElementById('flagTncMismatchClaimed')?.checked),
        finalThreeMonths: Boolean(document.getElementById('flagFinalThreeMonths')?.checked)
      };
    }

    function getStatusMeta(status) {
      if (status === 'likely_eligible') return { label: 'Likely eligible', className: 'eligibility-badge--likely' };
      if (status === 'possible_eligible') return { label: 'Possibly eligible', className: 'eligibility-badge--possible' };
      if (status === 'check_commercial') return { label: 'Check with Commercial', className: 'eligibility-badge--commercial' };
      return { label: 'Not eligible', className: 'eligibility-badge--not' };
    }

    function buildEligibilityAssessment(rows, flags) {
      const completeRows = rows.filter((row) => row.complete);
      if (completeRows.length === 0) {
        return {
          status: 'possible_eligible',
          headline: 'Import or add services to view eligibility guidance.',
          reasons: ['No complete service rows are available yet.'],
          actions: ['Import or add services, then use the manual checks to refine the guidance.'],
          signals: getEligibilitySignals(rows)
        };
      }

      const signals = getEligibilitySignals(rows);
      const qualifyingTypes = summariseQualifyingIncreaseTypes(signals);

      if (flags.tncMismatchClaimed) {
        return {
          status: 'check_commercial',
          headline: 'Check with Commercial before advising',
          reasons: ['Customer reports contract terms do not match the received letter. Possible T&C mismatch needs validation.'],
          actions: ['Do not advise exit rights until Commercial confirms applicable terms and letter alignment.'],
          signals
        };
      }

      if (flags.cpi39Post2025) {
        const actions = [flags.finalThreeMonths
          ? 'If within final 3 months, raise Opp to Loyalty to explore support options.'
          : 'Handle objections in line with contract terms and uphold charges where applicable.'];
        return {
          status: 'not_eligible',
          headline: 'Not eligible based on current checks',
          reasons: ['Customer is marked as being on post-17 Jan 2025 CPI + 3.9% terms, which do not carry exit rights for this increase in current guidance.'],
          actions,
          signals
        };
      }

      if (flags.altitudeOriginalGamma) {
        return {
          status: 'likely_eligible',
          headline: 'Likely eligible to exit without penalty',
          reasons: ['Customer is marked as being on the original Altitude Gamma contract.'],
          actions: ['Raise Opportunity for Loyalty.'],
          signals
        };
      }

      if (!signals.noQualifyingRows) {
        const reasons = [];
        if (qualifyingTypes.length) reasons.push(`${qualifyingTypes.join(', ')} price increase signal(s) detected.`);

        if (signals.qualifyingRowsPost2014.length > 0) {
          reasons.push('Qualifying services have Start Dates after 23 Jan 2014.');
          if (signals.hasLinkedBroadband) {
            reasons.push('Broadband services are present alongside qualifying WLR/ISDN services and may also gain the right to leave.');
          }
          const actions = ['Raise Opportunity for Loyalty.'];
          if (signals.hasWlrOrIsdn) actions.push('For WLR services, quote migration to future technology where appropriate.');
          return {
            status: 'likely_eligible',
            headline: 'Likely eligible to exit without penalty',
            reasons,
            actions,
            signals
          };
        }

        if (signals.qualifyingRowsWithUnknownDate.length > 0) {
          reasons.push('Qualifying services were detected but Start Dates could not be fully confirmed.');
          return {
            status: 'possible_eligible',
            headline: 'Possibly eligible - confirm before advising',
            reasons,
            actions: ['Confirm contract terms and dates before advising the customer.'],
            signals
          };
        }

        if (signals.allQualifyingRowsPreOrOn2014) {
          reasons.push('Available Start Dates do not indicate a qualifying post-23 Jan 2014 contract.');
          return {
            status: 'not_eligible',
            headline: 'Not eligible based on current checks',
            reasons,
            actions: ['Confirm manually if there is evidence of renewal or re-sign since the shown start date.'],
            signals
          };
        }
      }

      return {
        status: 'not_eligible',
        headline: 'No exit-right trigger detected from imported services',
        reasons: ['Only standard or non-qualifying increases are currently detected from imported services.'],
        actions: [
          flags.finalThreeMonths
            ? 'If within final 3 months, raise Opp to Loyalty to explore support options.'
            : 'Explain the increase and use normal retention handling if needed.'
        ],
        signals
      };
    }

    function renderEligibilityAssessment(assessment) {
      if (!eligibilityAssessmentEl) return;
      if (!assessment) {
        eligibilityAssessmentEl.innerHTML = '<p class="summary-empty">Import or add services to view eligibility guidance.</p>';
        return;
      }

      const statusMeta = getStatusMeta(assessment.status);
      const reasonsHtml = (assessment.reasons || []).map((item) => `<li>${item}</li>`).join('');
      const actionsHtml = (assessment.actions || []).map((item) => `<li>${item}</li>`).join('');

      eligibilityAssessmentEl.innerHTML = `
        <div class="eligibility-header">
          <span class="eligibility-badge ${statusMeta.className}">${statusMeta.label}</span>
          <h4>${assessment.headline}</h4>
        </div>
        <div class="eligibility-columns">
          <div>
            <p class="mini-label"><strong>Reasons</strong></p>
            <ul class="summary-list">${reasonsHtml}</ul>
          </div>
          <div>
            <p class="mini-label"><strong>Next step</strong></p>
            <ul class="summary-list">${actionsHtml}</ul>
          </div>
        </div>
        <p class="eligibility-note">Guidance only, based on imported services and manual checks. Confirm contract terms before advising.</p>
      `;
    }


    function recalc() {
      const rows = readRows();
      let totalBefore = 0;
      let totalAfter = 0;
      const cliValues = [];
      let missingTypeCount = 0;

      rows.forEach((row) => {
        if (row.cli) cliValues.push(row.cli);
        if (row.meaningful && !row.serviceId) missingTypeCount += 1;
        if (!row.complete) return;

        totalBefore += row.totalBeforePence;
        totalAfter += row.totalAfterPence;

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

      const categorySummary = buildProductCategorySummary(rows);
      const biggestDrivers = buildBiggestDrivers(rows, categorySummary);
      const eligibilityFlags = readEligibilityFlags();
      saveEligibilityFlags(eligibilityFlags);
      const eligibilityAssessment = buildEligibilityAssessment(rows, eligibilityFlags);

      renderRowWarnings(missingTypeCount);
      renderSummarySections(categorySummary, biggestDrivers);
      renderEligibilityAssessment(eligibilityAssessment);
      const totals = {
        totalBefore,
        totalAfter,
        diff,
        annualDiff,
        cliValues,
        rows,
        missingTypeCount,
        categorySummary,
        biggestDrivers,
        eligibilityFlags,
        eligibilityAssessment
      };

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

      const eligibility = totals.eligibilityAssessment;
      if (eligibility) {
        lines.push('', 'Eligibility signals (guidance only):');
        lines.push(`- Outcome: ${eligibility.headline}`);
        eligibility.reasons.forEach((reason) => lines.push(`- Reason: ${reason}`));
        eligibility.actions.forEach((action) => lines.push(`- Next step: ${action}`));
      }

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

      const eligibility = totals.eligibilityAssessment;
      if (eligibility) {
        lines.push('');
        lines.push(`Eligibility: ${eligibility.headline}`);
        eligibility.reasons.slice(0, 3).forEach((reason) => lines.push(`- ${reason}`));
      }

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
      if (result?.eligibilityAssessment) {
        csvRows.push(`# Eligibility: ${result.eligibilityAssessment.headline}`);
        csvRows.push(`# Eligibility reasons: ${(result.eligibilityAssessment.reasons || []).slice(0, 2).join(' | ') || 'None'}`);
      }

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

    function buildPdfFilename() {
      const date = new Date().toISOString().slice(0, 10);
      const accountPart = sanitiseFilenamePart(importedAccountNumber, 'UnknownAccount');
      return `April-2026-Price-Increase_${accountPart}_${date}.pdf`;
    }

    function downloadPdf(pdfBytes, filename) {
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }


    function sanitisePdfText(value) {
      return String(value ?? '')
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/[–—]/g, '-')
        .replace(/ /g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    async function buildPdfFromTotals(totals) {
      if (!window.PDFLib) {
        throw new Error('PDF library is unavailable.');
      }

      const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
      const pdfDoc = await PDFDocument.create();
      const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const margin = 42;
      const contentWidth = pageWidth - (margin * 2);
      const bottomReserve = 26;

      const palette = {
        text: rgb(0.15, 0.17, 0.2),
        muted: rgb(0.42, 0.45, 0.5),
        border: rgb(0.82, 0.85, 0.9),
        headerFill: rgb(0.95, 0.97, 0.99),
        zebra: rgb(0.985, 0.988, 0.995),
        cardFill: rgb(0.965, 0.975, 0.995),
        emphasis: rgb(0.13, 0.2, 0.36)
      };

      const titleSize = 18;
      const metaSize = 9;
      const sectionTitleSize = 11;
      const bodySize = 9;
      const smallSize = 8;

      const tableColumns = [
        { key: 'cli', title: 'Number/CLI', width: 72, align: 'left' },
        { key: 'desc', title: 'Description', width: 146, align: 'left' },
        { key: 'type', title: 'Service type', width: 82, align: 'left' },
        { key: 'rule', title: 'Rule', width: 46, align: 'left' },
        { key: 'qty', title: 'Qty', width: 26, align: 'center' },
        { key: 'before', title: 'Before', width: 46, align: 'right' },
        { key: 'after', title: 'After', width: 46, align: 'right' },
        { key: 'diff', title: 'Diff', width: 47, align: 'right' }
      ];

      let page = pdfDoc.addPage([pageWidth, pageHeight]);
      let cursorY = pageHeight - margin;

      const addPage = () => {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        cursorY = pageHeight - margin;
      };

      const ensureSpace = (heightNeeded) => {
        if ((cursorY - heightNeeded) < (margin + bottomReserve)) {
          addPage();
          return true;
        }
        return false;
      };

      const drawDivider = (y) => {
        page.drawLine({
          start: { x: margin, y },
          end: { x: margin + contentWidth, y },
          thickness: 1,
          color: palette.border
        });
      };

      const drawSectionHeading = (label, y) => {
        page.drawText(sanitisePdfText(label), {
          x: margin,
          y,
          size: sectionTitleSize,
          font: boldFont,
          color: palette.text
        });
      };

      const drawCard = (x, y, width, height, fill = palette.cardFill) => {
        page.drawRectangle({
          x,
          y,
          width,
          height,
          color: fill,
          borderColor: palette.border,
          borderWidth: 1
        });
      };

      const splitLongWord = (word, font, size, width) => {
        const chunks = [];
        let current = '';
        for (const char of word) {
          const trial = `${current}${char}`;
          if (font.widthOfTextAtSize(trial, size) <= width) {
            current = trial;
          } else {
            if (current) chunks.push(current);
            current = char;
          }
        }
        if (current) chunks.push(current);
        return chunks.length ? chunks : [''];
      };

      const measureWrappedLines = (text, font, size, width, maxLines = Infinity) => {
        const safe = sanitisePdfText(text) || '—';
        const words = safe.split(' ');
        const lines = [];
        let current = '';

        words.forEach((word) => {
          const candidate = current ? `${current} ${word}` : word;
          if (font.widthOfTextAtSize(candidate, size) <= width) {
            current = candidate;
            return;
          }

          if (current) lines.push(current);

          if (font.widthOfTextAtSize(word, size) <= width) {
            current = word;
            return;
          }

          const chunks = splitLongWord(word, font, size, width);
          lines.push(...chunks.slice(0, -1));
          current = chunks[chunks.length - 1];
        });

        if (current) lines.push(current);

        if (lines.length <= maxLines) return lines;

        const clipped = lines.slice(0, maxLines);
        let lastLine = clipped[maxLines - 1];
        while (lastLine.length > 1 && bodyFont.widthOfTextAtSize(`${lastLine}…`, size) > width) {
          lastLine = lastLine.slice(0, -1);
        }
        clipped[maxLines - 1] = `${lastLine}…`;
        return clipped;
      };

      const drawTextCell = (text, x, y, options = {}) => {
        const safe = sanitisePdfText(text) || '—';
        page.drawText(safe, {
          x,
          y,
          size: options.size || bodySize,
          font: options.font || bodyFont,
          color: options.color || palette.text
        });
      };

      const drawRightAlignedText = (text, xRight, y, font = bodyFont, size = bodySize, color = palette.text) => {
        const safe = sanitisePdfText(text) || '—';
        const width = font.widthOfTextAtSize(safe, size);
        page.drawText(safe, {
          x: xRight - width,
          y,
          size,
          font,
          color
        });
      };

      const drawTableHeader = () => {
        const headerHeight = 18;
        ensureSpace(headerHeight + 6);
        const yTop = cursorY;

        drawCard(margin, yTop - headerHeight, contentWidth, headerHeight, palette.headerFill);

        let x = margin;
        tableColumns.forEach((column) => {
          const cellY = yTop - 12;
          if (column.align === 'right') {
            drawRightAlignedText(column.title, x + column.width - 5, cellY, boldFont, bodySize, palette.text);
          } else if (column.align === 'center') {
            const safe = sanitisePdfText(column.title);
            const textWidth = boldFont.widthOfTextAtSize(safe, bodySize);
            drawTextCell(safe, x + ((column.width - textWidth) / 2), cellY, { font: boldFont });
          } else {
            drawTextCell(column.title, x + 4, cellY, { font: boldFont });
          }

          page.drawLine({
            start: { x: x + column.width, y: yTop - headerHeight },
            end: { x: x + column.width, y: yTop },
            thickness: 0.6,
            color: palette.border
          });
          x += column.width;
        });

        cursorY -= headerHeight;
      };

      const drawTableRow = (rowData, index) => {
        const descriptionLines = measureWrappedLines(rowData.desc, bodyFont, bodySize, tableColumns[1].width - 8, 2);
        const rowHeight = Math.max(22, (descriptionLines.length * 11) + 8);

        if ((cursorY - rowHeight) < (margin + 120)) {
          addPage();
          drawSectionHeading('Service lines', cursorY - sectionTitleSize);
          cursorY -= sectionTitleSize + 8;
          drawTableHeader();
        }

        const yTop = cursorY;
        if (index % 2 === 1) {
          page.drawRectangle({
            x: margin,
            y: yTop - rowHeight,
            width: contentWidth,
            height: rowHeight,
            color: palette.zebra
          });
        }

        page.drawLine({
          start: { x: margin, y: yTop - rowHeight },
          end: { x: margin + contentWidth, y: yTop - rowHeight },
          thickness: 0.6,
          color: palette.border
        });

        let x = margin;
        tableColumns.forEach((column) => {
          const value = rowData[column.key] || '—';
          const textY = yTop - 14;
          if (column.key === 'desc') {
            descriptionLines.forEach((line, lineIndex) => {
              drawTextCell(line, x + 4, textY - (lineIndex * 11));
            });
          } else if (column.align === 'right') {
            drawRightAlignedText(value, x + column.width - 4, textY);
          } else if (column.align === 'center') {
            const safe = sanitisePdfText(value) || '—';
            const textWidth = bodyFont.widthOfTextAtSize(safe, bodySize);
            drawTextCell(safe, x + ((column.width - textWidth) / 2), textY);
          } else {
            const lines = measureWrappedLines(value, bodyFont, bodySize, column.width - 8, 1);
            drawTextCell(lines[0], x + 4, textY);
          }

          page.drawLine({
            start: { x: x + column.width, y: yTop - rowHeight },
            end: { x: x + column.width, y: yTop },
            thickness: 0.3,
            color: palette.border
          });
          x += column.width;
        });

        cursorY -= rowHeight;
      };

      drawTextCell('April 2026 Bill Increase Explainer', margin, cursorY - titleSize, {
        size: titleSize,
        font: boldFont
      });
      cursorY -= titleSize + 6;

      const metadata = `Customer: ${sanitisePdfText(importedCompanyName || 'Unknown')} | Account: ${sanitisePdfText(importedAccountNumber || 'Unknown')} | Exported: ${sanitisePdfText(new Date().toLocaleString('en-GB'))}`;
      drawTextCell(metadata, margin, cursorY - metaSize, { size: metaSize, color: palette.muted });
      cursorY -= metaSize + 10;
      drawDivider(cursorY);
      cursorY -= 14;

      const summaryCardHeight = 88;
      ensureSpace(summaryCardHeight + 16);
      drawCard(margin, cursorY - summaryCardHeight, contentWidth, summaryCardHeight);
      drawSectionHeading('Totals summary', cursorY - 14);

      const summaryValues = [
        { label: 'Total before', value: formatGBP(totals.totalBefore), highlight: false },
        { label: 'Total after', value: formatGBP(totals.totalAfter), highlight: false },
        { label: 'Monthly difference', value: formatGBP(totals.diff), highlight: true },
        { label: 'Annual increase', value: formatGBP(totals.annualDiff), highlight: false }
      ];
      const itemTop = cursorY - 34;
      const itemWidth = contentWidth / 4;
      summaryValues.forEach((item, index) => {
        const blockX = margin + (index * itemWidth);
        drawTextCell(item.label, blockX + 8, itemTop, { size: smallSize, color: palette.muted });
        drawTextCell(item.value, blockX + 8, itemTop - 16, {
          size: item.highlight ? 12 : 11,
          font: boldFont,
          color: item.highlight ? palette.emphasis : palette.text
        });
      });
      cursorY -= summaryCardHeight + 18;

      const categorySummary = totals.categorySummary || [];
      if (categorySummary.length) {
        const rowHeight = 16;
        const headingGap = 10;
        const tableHeight = 22 + (categorySummary.length * rowHeight);
        ensureSpace(tableHeight + 14);
        drawSectionHeading('Summary by product category', cursorY - sectionTitleSize);
        cursorY -= sectionTitleSize + headingGap;

        drawCard(margin, cursorY - tableHeight, contentWidth, tableHeight, rgb(0.98, 0.985, 0.995));
        const headerY = cursorY - 14;
        drawTextCell('Category', margin + 8, headerY, { size: smallSize, font: boldFont, color: palette.muted });
        drawTextCell('Count', margin + 180, headerY, { size: smallSize, font: boldFont, color: palette.muted });
        drawTextCell('Before', margin + 240, headerY, { size: smallSize, font: boldFont, color: palette.muted });
        drawTextCell('After', margin + 330, headerY, { size: smallSize, font: boldFont, color: palette.muted });
        drawTextCell('Diff', margin + 430, headerY, { size: smallSize, font: boldFont, color: palette.muted });

        let rowY = cursorY - 30;
        categorySummary.forEach((item) => {
          drawTextCell(getProductCategoryLabel(item.category), margin + 8, rowY, { size: smallSize });
          drawTextCell(String(item.count), margin + 180, rowY, { size: smallSize });
          drawTextCell(formatGBP(item.totalBeforePence), margin + 240, rowY, { size: smallSize });
          drawTextCell(formatGBP(item.totalAfterPence), margin + 330, rowY, { size: smallSize });
          drawTextCell(formatGBP(item.totalDiffPence), margin + 430, rowY, { size: smallSize, font: boldFont });
          rowY -= rowHeight;
        });

        cursorY -= tableHeight + 16;
      }

      const driverGroups = totals.biggestDrivers || { topCategories: [], topRows: [] };
      const driverLineCount = 2 + Math.max(driverGroups.topCategories.length, 1) + 2 + Math.max(driverGroups.topRows.length, 1);
      const driversHeight = 24 + (driverLineCount * 10);
      ensureSpace(driversHeight + 12);
      drawSectionHeading('Biggest drivers of increase', cursorY - sectionTitleSize);
      cursorY -= sectionTitleSize + 8;
      drawCard(margin, cursorY - driversHeight, contentWidth, driversHeight, rgb(0.98, 0.985, 0.995));
      let driverY = cursorY - 14;
      drawTextCell('By product category', margin + 8, driverY, { size: smallSize, font: boldFont });
      driverY -= 11;
      (driverGroups.topCategories.length ? driverGroups.topCategories : [{ label: 'No positive increases yet.', diffPence: null }]).forEach((item) => {
        const text = item.diffPence === null ? `• ${item.label}` : `• ${item.label}: ${formatGBP(item.diffPence)}`;
        drawTextCell(text, margin + 12, driverY, { size: smallSize });
        driverY -= 10;
      });

      driverY -= 3;
      drawTextCell('By service line', margin + 8, driverY, { size: smallSize, font: boldFont });
      driverY -= 11;
      (driverGroups.topRows.length ? driverGroups.topRows : [{ label: 'No lines available.', diffPence: null }]).forEach((item) => {
        const text = item.diffPence === null ? `• ${item.label}` : `• ${sanitisePdfText(item.label)}: ${formatGBP(item.diffPence)}`;
        drawTextCell(text, margin + 12, driverY, { size: smallSize });
        driverY -= 10;
      });

      cursorY -= driversHeight + 16;

      const eligibility = totals.eligibilityAssessment;
      if (eligibility) {
        const eligibilityLines = [
          `Outcome: ${eligibility.headline}`,
          ...((eligibility.reasons || []).map((reason) => `Reason: ${reason}`)),
          ...((eligibility.actions || []).map((action) => `Next step: ${action}`)),
          'Guidance only. Confirm contract terms and dates before advising where relevant.'
        ];
        const wrappedEligibility = eligibilityLines
          .map((line) => measureWrappedLines(line, bodyFont, smallSize, contentWidth - 16, 4))
          .flat();
        const eligibilityHeight = 24 + (wrappedEligibility.length * 10);

        ensureSpace(eligibilityHeight + 14);
        drawSectionHeading('Eligibility signals', cursorY - sectionTitleSize);
        cursorY -= sectionTitleSize + 8;
        drawCard(margin, cursorY - eligibilityHeight, contentWidth, eligibilityHeight, rgb(0.98, 0.985, 0.995));

        let eligibilityY = cursorY - 14;
        wrappedEligibility.forEach((line) => {
          drawTextCell(line, margin + 8, eligibilityY, { size: smallSize });
          eligibilityY -= 10;
        });

        cursorY -= eligibilityHeight + 16;
      }

      drawSectionHeading('Service lines', cursorY - sectionTitleSize);
      cursorY -= sectionTitleSize + 8;
      drawTableHeader();

      const completeRows = (totals.rows || []).filter((row) => row.complete);
      completeRows.forEach((row, index) => {
        drawTableRow({
          cli: sanitisePdfText(row.cli || '—'),
          desc: sanitisePdfText(row.desc || '—'),
          type: sanitisePdfText(getShortServiceLabel(row.serviceId)),
          rule: sanitisePdfText(getServiceRuleLabel(row.serviceId)),
          qty: sanitisePdfText(String(row.qty)),
          before: sanitisePdfText(formatGBP(row.totalBeforePence)),
          after: sanitisePdfText(formatGBP(row.totalAfterPence)),
          diff: sanitisePdfText(formatGBP(row.totalDiffPence))
        }, index);
      });

      const disclaimerLines = [
        "This is an estimate and only applies where the April 2026 increase is not already specified in the customer's contract terms.",
        'Before advising a customer, verify which price increase letter they received in Daisy Central (under "Important information about your Daisy Service"). Some customers/services may be excluded.'
      ];
      const disclaimerHeadingHeight = 12;
      const disclaimerContent = disclaimerLines
        .map((line) => measureWrappedLines(line, bodyFont, smallSize, contentWidth - 16, 3))
        .flat();
      const disclaimerHeight = 18 + disclaimerHeadingHeight + (disclaimerContent.length * 10);

      if ((cursorY - disclaimerHeight) < (margin + bottomReserve)) {
        addPage();
      }

      const disclaimerTop = cursorY - 10;
      drawCard(margin, disclaimerTop - disclaimerHeight, contentWidth, disclaimerHeight, rgb(0.99, 0.99, 0.995));
      drawTextCell('Disclaimer', margin + 8, disclaimerTop - 12, { size: smallSize, font: boldFont, color: palette.muted });
      let disclaimerY = disclaimerTop - 24;
      disclaimerContent.forEach((line) => {
        drawTextCell(line, margin + 8, disclaimerY, { size: smallSize, color: palette.muted });
        disclaimerY -= 10;
      });

      return pdfDoc.save();
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


    function applyEligibilityFlagsToUI(flags) {
      if (!eligibilityPanelEl) return;
      const safeFlags = { ...ELIGIBILITY_DEFAULT_FLAGS, ...flags };
      const map = {
        flagCpi39Post2025: safeFlags.cpi39Post2025,
        flagAltitudeOriginalGamma: safeFlags.altitudeOriginalGamma,
        flagTncMismatchClaimed: safeFlags.tncMismatchClaimed,
        flagFinalThreeMonths: safeFlags.finalThreeMonths
      };
      Object.entries(map).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.checked = Boolean(value);
      });
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
          priceText: row.priceText || '',
          startDate: row.startDate || ''
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

      const text = normaliseServiceDescription(desc);

      if (isMaintenancePin(cli)) return 'maintenance';

      if (text.includes('fraud guardian')) return 'other';

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
        const startDate = String(pick(row, ['StartDate', 'Start Date']) || '').trim();

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
          serviceId: detectServiceType(desc, cli),
          startDate
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
      saveEligibilityFlags(ELIGIBILITY_DEFAULT_FLAGS);
      applyEligibilityFlagsToUI(ELIGIBILITY_DEFAULT_FLAGS);
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

    downloadPdfBtn.addEventListener('click', async () => {
      const totals = recalc();
      const completeRows = totals.rows.filter((row) => row.complete);
      if (!completeRows.length) {
        showToast('Nothing to export yet.');
        return;
      }

      try {
        const pdfBytes = await buildPdfFromTotals(totals);
        downloadPdf(pdfBytes, buildPdfFilename());
        showToast('PDF downloaded');
      } catch (error) {
        const message = (error && error.message) ? error.message : 'Could not create PDF export.';
        showToast(message);
      }
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
          priceText: tr.querySelector('.price').value,
          startDate: tr.dataset.startDate || ''
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

    applyTheme(getInitialTheme());

    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        localStorage.setItem(THEME_KEY, nextTheme);
        applyTheme(nextTheme);
      });
    }

    applyEligibilityFlagsToUI(loadEligibilityFlags());

    if (eligibilityPanelEl) {
      eligibilityPanelEl.addEventListener('change', () => {
        recalc();
      });
    }

    loadRowsFromStorage();
    initialiseSortableRows();
    recalc();

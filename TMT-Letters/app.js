/* ============================================================
   TECHMECHA TORQUE — app.js v2
   Clean · Modular · Vanilla JS
   Features: Live preview, CSV import/export, Google Sheets fetch, Downloads
   ============================================================ */
'use strict';

/* ── CREDENTIALS ── */
const CREDENTIALS = { username: 'venkatasrith', password: '2288' };

/* ── COUNTERS ── */
const downloadCounts = { certificates: 0, offerLetters: 0, completionLetters: 0 };

/* ── HELPERS ── */
const $ = id => document.getElementById(id);
const qs = sel => document.querySelector(sel);

function showToast(msg, duration = 2800) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._to);
  t._to = setTimeout(() => t.classList.add('hidden'), duration);
}

function formatDate(d) {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function updateTopbar() {
  const now = new Date();
  $('topbarGreeting').textContent = `${getGreeting()}, Venkatasrith`;
  $('topbarDate').textContent = now.toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  const yr = now.getFullYear();
  const ds = formatDate(now);
  ['offerDateDisplay','compDateDisplay','internDateDisplay','apprDateDisplay','expDateDisplay'].forEach(id => {
    const el = $(id); if (el) el.textContent = ds;
  });
  ['offerRefYear','compRefYear','internRefYear','apprRefYear','expRefYear'].forEach(id => {
    const el = $(id); if (el) el.textContent = yr;
  });
}

/* ── STATS ── */
function updateStats() {
  $('statCerts').textContent      = downloadCounts.certificates;
  $('statOffers').textContent     = downloadCounts.offerLetters;
  $('statCompletion').textContent = downloadCounts.completionLetters;
  $('statTotal').textContent      = Object.values(downloadCounts).reduce((a, b) => a + b, 0);
}


/* ============================================================
   LOGIN
   ============================================================ */
function initLogin() {
  const form = $('loginForm');
  const pwdToggle = $('pwdToggle');
  const eyeIcon   = $('eyeIcon');
  const errorEl   = $('loginError');

  pwdToggle.addEventListener('click', () => {
    const pwd = $('loginPassword');
    const isText = pwd.type === 'text';
    pwd.type = isText ? 'password' : 'text';
    eyeIcon.innerHTML = isText
      ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
      : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const u = $('loginUsername').value.trim();
    const p = $('loginPassword').value;
    errorEl.classList.add('hidden');

    if (u === CREDENTIALS.username && p === CREDENTIALS.password) {
      const card = qs('.login-card');
      card.style.transition = 'opacity .35s ease, transform .35s ease';
      card.style.opacity = '0';
      card.style.transform = 'translateY(-16px) scale(.98)';
      setTimeout(() => {
        $('loginPage').classList.add('hidden');
        $('dashboardPage').classList.remove('hidden');
        document.body.classList.remove('login-page');
        updateTopbar();
        updateStats();
      }, 360);
    } else {
      errorEl.classList.remove('hidden');
      [$('loginUsername'), $('loginPassword')].forEach(el => {
        el.style.borderColor = '#fecaca';
        setTimeout(() => el.style.borderColor = '', 1400);
      });
    }
  });
}


/* ============================================================
   NAVIGATION
   ============================================================ */
let currentSection = 'dashboard';

function navigateTo(section) {
  const oldSec = $(`section-${currentSection}`);
  const oldNav = $(`nav-${currentSection}`);
  if (oldSec) oldSec.classList.remove('active');
  if (oldNav) oldNav.classList.remove('active');
  currentSection = section;
  const newSec = $(`section-${section}`);
  const newNav = $(`nav-${section}`);
  if (newSec) newSec.classList.add('active');
  if (newNav) newNav.classList.add('active');
  closeSidebar();
}

function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => { e.preventDefault(); navigateTo(item.dataset.section); });
  });
  document.querySelectorAll('.doc-card').forEach(card => {
    card.addEventListener('click', () => navigateTo(card.dataset.section));
  });
  document.querySelectorAll('.doc-card-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); navigateTo(btn.closest('.doc-card').dataset.section); });
  });
}


/* ── MOBILE SIDEBAR ── */
function openSidebar()  { $('sidebar').classList.add('open'); const o=$('sidebarOverlay'); o.classList.remove('hidden'); setTimeout(()=>o.classList.add('visible'),10); }
function closeSidebar() { $('sidebar').classList.remove('open'); const o=$('sidebarOverlay'); o.classList.remove('visible'); setTimeout(()=>o.classList.add('hidden'),220); }
function initMobileSidebar() {
  $('hamburgerBtn').addEventListener('click', openSidebar);
  $('sidebarCloseBtn').addEventListener('click', closeSidebar);
  $('sidebarOverlay').addEventListener('click', closeSidebar);
}

/* ── LOGOUT ── */
function initLogout() {
  $('logoutBtn').addEventListener('click', () => {
    $('dashboardPage').classList.add('hidden');
    $('loginPage').classList.remove('hidden');
    document.body.classList.add('login-page');
    $('loginUsername').value = '';
    $('loginPassword').value = '';
    const card = qs('.login-card');
    card.style.opacity = ''; card.style.transform = '';
    navigateTo('dashboard');
  });
}


/* ============================================================
   LIVE PREVIEW BINDING
   ============================================================ */
function live(inputId, targetId, fallback) {
  const input = $(inputId), target = $(targetId);
  if (!input || !target) return;
  const update = () => { target.textContent = input.value.trim() || fallback; };
  input.addEventListener('input', update);
  update();
}

function initCertificate() {
  live('cert-name',  'certPreviewName',  '{Name}');
  live('cert-role',  'certPreviewRole',  'Full Stack Web Development Intern');
  live('cert-start', 'certPreviewStart', '1st March 2026');
  live('cert-end',   'certPreviewEnd',   '31st May 2026');

  const cidInput = $('cert-id');
  const cidPreview = $('certPreviewCid');
  if (cidInput && cidPreview) {
    const updateCid = () => {
      const val = cidInput.value.trim() || 'TMT001';
      cidPreview.textContent = val.toUpperCase().startsWith('CID:') ? val : `CID: ${val}`;
    };
    cidInput.addEventListener('input', updateCid);
    updateCid();
  }

  const typeSelect = $('cert-type');
  const roleGroup = $('form-group-cert-role');
  const bootcampGroup = $('form-group-cert-bootcamp');
  const bootcampInput = $('cert-bootcamp');
  const subtitleEl = $('certPreviewSubtitle');
  const tenureEl = $('certPreviewTenure');

  const updateCertificateType = () => {
    const isBootcamp = typeSelect ? typeSelect.value === 'bootcamp' : false;
    if (roleGroup) roleGroup.classList.toggle('hidden', isBootcamp);
    if (bootcampGroup) bootcampGroup.classList.toggle('hidden', !isBootcamp);

    const startVal = $('cert-start')?.value.trim() || '1st March 2026';
    const endVal = $('cert-end')?.value.trim() || '31st May 2026';

    if (isBootcamp) {
      if (subtitleEl) subtitleEl.textContent = 'of Bootcamp Completion';
      const bName = bootcampInput?.value.trim() || 'Full-Stack AI & Cloud Bootcamp';
      if (tenureEl) {
        tenureEl.innerHTML = `during the bootcamp from <strong id="certPreviewStart">${startVal}</strong> to <strong id="certPreviewEnd">${endVal}</strong> for <strong id="certPreviewBootcamp">${bName}</strong>`;
      }
    } else {
      if (subtitleEl) subtitleEl.textContent = 'of Recognisation';
      const roleVal = $('cert-role')?.value.trim() || 'Full Stack Web Development Intern';
      if (tenureEl) {
        tenureEl.innerHTML = `during their tenure from <strong id="certPreviewStart">${startVal}</strong> to <strong id="certPreviewEnd">${endVal}</strong> Serving as our <strong id="certPreviewRole">${roleVal}</strong>`;
      }
    }
  };

  if (typeSelect) typeSelect.addEventListener('change', updateCertificateType);
  if (bootcampInput) bootcampInput.addEventListener('input', updateCertificateType);
  $('cert-role')?.addEventListener('input', updateCertificateType);
  $('cert-start')?.addEventListener('input', updateCertificateType);
  $('cert-end')?.addEventListener('input', updateCertificateType);

  updateCertificateType();
}

function initOfferLetter() {
  live('offer-name',       'offerPreviewName',     '[Employee Name]');
  live('offer-joining',    'offerPreviewJoining',  '[Joining Date]');
  live('offer-end',        'offerPreviewEnd',      '[End Date]');
}

function initCompletionLetter() {
  live('comp-name',    'compPreviewName',     '[Name]');
  live('comp-program', 'compPreviewProgram',  '[Program Name]');
  live('comp-duration','compPreviewDuration', '[Duration]');
  live('comp-start',   'compPreviewStart',    '[Start Date]');
  live('comp-end',     'compPreviewEnd',      '[End Date]');
}

function initInternshipLetter() {
  live('intern-name',    'internPreviewName',    '[Intern Name]');
  live('intern-role',    'internPreviewRole',    '[Role]');
  live('intern-dept',    'internPreviewDept',    '[Department]');
  live('intern-start',   'internPreviewStart',   '[Start Date]');
  live('intern-end',     'internPreviewEnd',     '[End Date]');
  live('intern-stipend', 'internPreviewStipend', '[Stipend]');
}

function initAppreciationLetter() {
  live('appr-name',   'apprPreviewName',   '[Name]');
  live('appr-reason', 'apprPreviewReason', '[Reason]');
  live('appr-role',   'apprPreviewRole',   '[Role]');
}

function initExperienceLetter() {
  live('exp-name',    'expPreviewName',    '[Name]');
  live('exp-role',    'expPreviewRole',    '[Designation]');
  live('exp-dept',    'expPreviewDept',    '[Department]');
  live('exp-join',    'expPreviewJoin',    '[Joining Date]');
  live('exp-relieve', 'expPreviewRelieve', '[Last Working Day]');

  // Also bind second name occurrence in the body
  const nameInput = $('exp-name');
  const target2 = $('expPreviewName2');
  if (nameInput && target2) {
    const update2 = () => { target2.textContent = nameInput.value.trim() || '[Name]'; };
    nameInput.addEventListener('input', update2);
    update2();
  }
}

/* ── ID Card ── */
function initIdCard() {
  const updateAvatar = () => {
    // legacy logic removed since we now use actual photo upload
  };
  
  const updateRole = () => {
    const val = $('id-role').value || 'TECHNICAL HEAD';
    const words = val.trim().split(/\s+/);
    if (words.length > 1) {
      $('idVerticalP1').textContent = words[0].toUpperCase();
      $('idVerticalP2').textContent = words.slice(1).join(' ').toUpperCase();
    } else {
      $('idVerticalP1').textContent = val.toUpperCase();
      $('idVerticalP2').textContent = '';
    }
    $('idPreviewRole').textContent = val;
  };
  $('id-role').addEventListener('input', updateRole);
  updateRole();
  
  const updateEmpId = () => {
    const val = $('id-empid').value || 'TMT009';
    // split into prefix (letters) and suffix (numbers)
    const match = val.match(/^([A-Za-z]+)?(.*)$/);
    $('idPreviewEmpPrefix').textContent = (match[1] || '').toUpperCase();
    $('idPreviewEmpSuffix').textContent = match[2] || '';
  };
  $('id-empid').addEventListener('input', updateEmpId);
  updateEmpId();

  live('id-name',  'idPreviewName',  'Sai Dhanush');
  live('id-email', 'idPreviewEmail', 'tshivakumarreddy36@gmail.com');
  live('id-phone', 'idPreviewPhone', '+91 8328656484');

  const photoInput = $('id-photo');
  if (photoInput) {
    photoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const url = URL.createObjectURL(file);
        const img = $('idPreviewPhoto');
        img.src = url;
        img.style.opacity = '1';
      }
    });
  }
}


/* ============================================================
   CSV IMPORT / EXPORT
   ============================================================ */

/**
 * Parse a CSV string. Returns array of objects (headers as keys).
 */
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,''));
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g,''));
    return Object.fromEntries(headers.map((h,i) => [h, values[i] ?? '']));
  });
}

/**
 * Export form fields as CSV
 */
function exportCSV(fields, filename) {
  const headers = fields.map(f => f.label);
  const values  = fields.map(f => {
    const el = $(f.id);
    const val = el ? el.value.trim() : '';
    return `"${val.replace(/"/g,'""')}"`;
  });
  const csv = headers.join(',') + '\n' + values.join(',');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  showToast(`✓ ${filename} exported`);
}

/**
 * Populate form from parsed CSV row
 */
function populateFromCSVRow(row, mapping) {
  let filled = 0;
  mapping.forEach(({ csvKey, inputId }) => {
    const val = row[csvKey];
    const el  = $(inputId);
    if (el && val !== undefined) {
      el.value = val;
      el.dispatchEvent(new Event('input')); // trigger live preview
      filled++;
    }
  });
  showToast(filled > 0 ? `✓ Imported ${filled} field(s) from CSV` : 'CSV imported (no matching fields found)');
}

/* ============================================================
   BATCH NAVIGATION STATE
   ============================================================ */
let currentBatchData = [];
let currentBatchIndex = 0;
let currentBatchMapping = null;
let currentBatchPrefix = null; // e.g., 'cert', 'offer'

function loadBatchRecord(index) {
  if (!currentBatchData || currentBatchData.length === 0) return;
  if (index < 0) index = 0;
  if (index >= currentBatchData.length) index = currentBatchData.length - 1;
  currentBatchIndex = index;
  
  // Populate form
  populateFromCSVRow(currentBatchData[index], currentBatchMapping);
  
  // Update UI
  const prefix = currentBatchPrefix;
  if ($(`batchCount-${prefix}`)) {
    $(`batchCount-${prefix}`).textContent = `Record ${index + 1} of ${currentBatchData.length}`;
  }
  if ($(`batchPrev-${prefix}`)) {
    $(`batchPrev-${prefix}`).disabled = (index === 0);
  }
  if ($(`batchNext-${prefix}`)) {
    $(`batchNext-${prefix}`).disabled = (index === currentBatchData.length - 1);
  }
}

function handleBatchLoad(rows, mapping, prefix) {
  if (rows.length === 0) {
    showToast('No data found');
    return;
  }
  currentBatchData = rows;
  currentBatchMapping = mapping;
  currentBatchPrefix = prefix;
  currentBatchIndex = 0;
  
  // Show navigation UI
  const nav = $(`batchNav-${prefix}`);
  if (nav) nav.classList.remove('hidden');
  
  loadBatchRecord(0);
  showToast(`✓ Loaded ${rows.length} records`);
}

function initBatchNavs() {
  const prefixes = ['cert', 'offer', 'comp', 'intern', 'appr', 'exp', 'id'];
  prefixes.forEach(p => {
    const prev = $(`batchPrev-${p}`);
    const next = $(`batchNext-${p}`);
    if (prev) prev.addEventListener('click', () => loadBatchRecord(currentBatchIndex - 1));
    if (next) next.addEventListener('click', () => loadBatchRecord(currentBatchIndex + 1));
  });
}

/**
 * Setup CSV import for a section
 */
function setupCSVImport(btnId, fileInputId, mapping, prefix) {
  const btn  = $(btnId);
  const file = $(fileInputId);
  if (!btn || !file) return;
  btn.addEventListener('click', () => file.click());
  file.addEventListener('change', () => {
    const f = file.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = e => {
      const rows = parseCSV(e.target.result);
      handleBatchLoad(rows, mapping, prefix);
    };
    reader.readAsText(f);
    file.value = ''; // reset so same file can be re-imported
  });
}


/* ============================================================
   GOOGLE SHEETS FETCH
   ============================================================ */
let activeSheetsMappingFn = null;
let activeSheetsPrefix = null;
let activeSheetsRawMapping = null;

function initGoogleSheets() {
  // Close modal
  $('sheetsCloseBtn').addEventListener('click', () => $('sheetsModal').classList.add('hidden'));

  // Fetch button
  $('sheetsFetchBtn').addEventListener('click', async () => {
    const url = $('sheetsUrl').value.trim();
    if (!url) { showToast('Please enter a Google Sheets CSV URL'); return; }
    showToast('Fetching data…', 5000);
    try {
      let fetchUrl = url;
      if (url.includes('docs.google.com/spreadsheets')) {
        const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (match && match[1]) {
          fetchUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
        }
      }
      // Use corsproxy for fetching to bypass CORS
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(fetchUrl)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const rows = parseCSV(text);
      if (rows.length === 0) { showToast('No data found in the sheet'); return; }
      
      // Use batch load instead of single populate
      if (activeSheetsRawMapping && activeSheetsPrefix) {
        handleBatchLoad(rows, activeSheetsRawMapping, activeSheetsPrefix);
      } else if (activeSheetsMappingFn) {
        activeSheetsMappingFn(rows[0]);
      }
      
      $('sheetsModal').classList.add('hidden');
      $('sheetsUrl').value = '';
    } catch (err) {
      console.error('Sheets fetch error:', err);
      showToast('Error: Make sure the Google Sheet is public (Anyone with link) and try again.');
    }
  });
}

function openSheetsModal(mappingFn, rawMapping, prefix) {
  activeSheetsMappingFn = mappingFn;
  activeSheetsRawMapping = rawMapping;
  activeSheetsPrefix = prefix;
  $('sheetsModal').classList.remove('hidden');
  $('sheetsUrl').focus();
}

// Section-specific Google Sheets mappings
const sheetsMappings = {
  cert: (row) => populateFromCSVRow(row, [
    { csvKey: 'name',      inputId: 'cert-name' },
    { csvKey: 'id',        inputId: 'cert-id' },
    { csvKey: 'bootcamp',  inputId: 'cert-bootcamp' },
    { csvKey: 'date',      inputId: 'cert-date' },
    // Alternative column names
    { csvKey: 'Name',      inputId: 'cert-name' },
    { csvKey: 'CID',       inputId: 'cert-id' },
    { csvKey: 'Bootcamp',  inputId: 'cert-bootcamp' },
    { csvKey: 'Date',      inputId: 'cert-date' },
    { csvKey: 'Participant Name', inputId: 'cert-name' },
    { csvKey: 'Certificate ID',   inputId: 'cert-id' },
    { csvKey: 'Event Date',       inputId: 'cert-date' },
  ]),
  offer: (row) => populateFromCSVRow(row, [
    { csvKey: 'name',       inputId: 'offer-name' },
    { csvKey: 'Name',       inputId: 'offer-name' },
    { csvKey: 'Employee Name', inputId: 'offer-name' },
    { csvKey: 'joining',    inputId: 'offer-joining' },
    { csvKey: 'Joining Date', inputId: 'offer-joining' },
    { csvKey: 'end',        inputId: 'offer-end' },
    { csvKey: 'End Date',   inputId: 'offer-end' },
  ]),
  comp: (row) => populateFromCSVRow(row, [
    { csvKey: 'name',     inputId: 'comp-name' },
    { csvKey: 'Name',     inputId: 'comp-name' },
    { csvKey: 'program',  inputId: 'comp-program' },
    { csvKey: 'Program',  inputId: 'comp-program' },
    { csvKey: 'duration', inputId: 'comp-duration' },
    { csvKey: 'Duration', inputId: 'comp-duration' },
    { csvKey: 'start',    inputId: 'comp-start' },
    { csvKey: 'Start Date', inputId: 'comp-start' },
    { csvKey: 'end',      inputId: 'comp-end' },
    { csvKey: 'End Date', inputId: 'comp-end' },
  ]),
  intern: (row) => populateFromCSVRow(row, [
    { csvKey: 'name',    inputId: 'intern-name' },
    { csvKey: 'Name',    inputId: 'intern-name' },
    { csvKey: 'role',    inputId: 'intern-role' },
    { csvKey: 'Role',    inputId: 'intern-role' },
    { csvKey: 'dept',    inputId: 'intern-dept' },
    { csvKey: 'Department', inputId: 'intern-dept' },
    { csvKey: 'start',   inputId: 'intern-start' },
    { csvKey: 'end',     inputId: 'intern-end' },
    { csvKey: 'stipend', inputId: 'intern-stipend' },
  ]),
  appr: (row) => populateFromCSVRow(row, [
    { csvKey: 'name',   inputId: 'appr-name' },
    { csvKey: 'Name',   inputId: 'appr-name' },
    { csvKey: 'reason', inputId: 'appr-reason' },
    { csvKey: 'Reason', inputId: 'appr-reason' },
    { csvKey: 'role',   inputId: 'appr-role' },
    { csvKey: 'Role',   inputId: 'appr-role' },
  ]),
  exp: (row) => populateFromCSVRow(row, [
    { csvKey: 'name',     inputId: 'exp-name' },
    { csvKey: 'Name',     inputId: 'exp-name' },
    { csvKey: 'role',     inputId: 'exp-role' },
    { csvKey: 'Role',     inputId: 'exp-role' },
    { csvKey: 'dept',     inputId: 'exp-dept' },
    { csvKey: 'join',     inputId: 'exp-join' },
    { csvKey: 'Joining Date', inputId: 'exp-join' },
    { csvKey: 'relieve',  inputId: 'exp-relieve' },
    { csvKey: 'Last Working Day', inputId: 'exp-relieve' },
  ]),
  id: (row) => populateFromCSVRow(row, [
    { csvKey: 'name',    inputId: 'id-name' },
    { csvKey: 'Name',    inputId: 'id-name' },
    { csvKey: 'role',    inputId: 'id-role' },
    { csvKey: 'Role',    inputId: 'id-role' },
    { csvKey: 'empid',   inputId: 'id-empid' },
    { csvKey: 'Employee ID', inputId: 'id-empid' },
    { csvKey: 'email',   inputId: 'id-email' },
    { csvKey: 'Email',   inputId: 'id-email' },
    { csvKey: 'phone',   inputId: 'id-phone' },
    { csvKey: 'Phone',   inputId: 'id-phone' },
  ]),
};

function initCSVFeatures() {
  // ── Certificate ──
  setupCSVImport('certImportCsv','certCsvFile',[
    { csvKey:'Participant Name', inputId:'cert-name' },{ csvKey:'name', inputId:'cert-name' },
    { csvKey:'Certificate ID',   inputId:'cert-id'   },{ csvKey:'id',   inputId:'cert-id' },
    { csvKey:'Bootcamp Name',    inputId:'cert-bootcamp' },{ csvKey:'bootcamp', inputId:'cert-bootcamp' },
    { csvKey:'Event Date',       inputId:'cert-date' },{ csvKey:'date', inputId:'cert-date' },
  ], 'cert');
  $('certFetchSheets').addEventListener('click', () => openSheetsModal(sheetsMappings.cert, [
    { csvKey:'Participant Name', inputId:'cert-name' },{ csvKey:'name', inputId:'cert-name' },
    { csvKey:'Certificate ID',   inputId:'cert-id'   },{ csvKey:'id',   inputId:'cert-id' },
    { csvKey:'Bootcamp Name',    inputId:'cert-bootcamp' },{ csvKey:'bootcamp', inputId:'cert-bootcamp' },
    { csvKey:'Event Date',       inputId:'cert-date' },{ csvKey:'date', inputId:'cert-date' },
  ], 'cert'));
  $('certExportCsv').addEventListener('click', () => exportCSV([
    { label:'Participant Name', id:'cert-name' },
    { label:'Certificate ID',   id:'cert-id' },
    { label:'Bootcamp Name',    id:'cert-bootcamp' },
    { label:'Event Date',       id:'cert-date' },
  ], 'tmt_certificate_data.csv'));

  // ── Offer Letter ──
  setupCSVImport('offerImportCsv','offerCsvFile',[
    { csvKey:'Employee Name', inputId:'offer-name' },{ csvKey:'name', inputId:'offer-name' },
    { csvKey:'Joining Date',  inputId:'offer-joining' },{ csvKey:'joining', inputId:'offer-joining' },
    { csvKey:'End Date',      inputId:'offer-end' },{ csvKey:'end', inputId:'offer-end' },
  ], 'offer');
  $('offerFetchSheets').addEventListener('click', () => openSheetsModal(sheetsMappings.offer, [
    { csvKey:'Employee Name', inputId:'offer-name' },{ csvKey:'name', inputId:'offer-name' },
    { csvKey:'Joining Date',  inputId:'offer-joining' },{ csvKey:'joining', inputId:'offer-joining' },
    { csvKey:'End Date',      inputId:'offer-end' },{ csvKey:'end', inputId:'offer-end' },
  ], 'offer'));
  $('offerExportCsv').addEventListener('click', () => exportCSV([
    { label:'Employee Name', id:'offer-name' },
    { label:'Joining Date',  id:'offer-joining' },
    { label:'End Date',      id:'offer-end' },
  ], 'tmt_offer_letter_data.csv'));

  // ── Completion Letter ──
  setupCSVImport('compImportCsv','compCsvFile',[
    { csvKey:'Name',         inputId:'comp-name' },{ csvKey:'name', inputId:'comp-name' },
    { csvKey:'Program Name', inputId:'comp-program' },{ csvKey:'program', inputId:'comp-program' },
    { csvKey:'Duration',     inputId:'comp-duration' },{ csvKey:'duration', inputId:'comp-duration' },
    { csvKey:'Start Date',   inputId:'comp-start' },{ csvKey:'start', inputId:'comp-start' },
    { csvKey:'End Date',     inputId:'comp-end' },{ csvKey:'end', inputId:'comp-end' },
  ], 'comp');
  $('compFetchSheets').addEventListener('click', () => openSheetsModal(sheetsMappings.comp, [
    { csvKey:'Name',         inputId:'comp-name' },{ csvKey:'name', inputId:'comp-name' },
    { csvKey:'Program Name', inputId:'comp-program' },{ csvKey:'program', inputId:'comp-program' },
    { csvKey:'Duration',     inputId:'comp-duration' },{ csvKey:'duration', inputId:'comp-duration' },
    { csvKey:'Start Date',   inputId:'comp-start' },{ csvKey:'start', inputId:'comp-start' },
    { csvKey:'End Date',     inputId:'comp-end' },{ csvKey:'end', inputId:'comp-end' },
  ], 'comp'));
  $('compExportCsv').addEventListener('click', () => exportCSV([
    { label:'Name',       id:'comp-name' },
    { label:'Program',    id:'comp-program' },
    { label:'Duration',   id:'comp-duration' },
    { label:'Start Date', id:'comp-start' },
    { label:'End Date',   id:'comp-end' },
  ], 'tmt_completion_letter_data.csv'));

  // ── Internship Letter ──
  setupCSVImport('internImportCsv','internCsvFile',[
    { csvKey:'Name', inputId:'intern-name' },{ csvKey:'name', inputId:'intern-name' },
    { csvKey:'Role', inputId:'intern-role' },{ csvKey:'role', inputId:'intern-role' },
    { csvKey:'Department', inputId:'intern-dept' },{ csvKey:'dept', inputId:'intern-dept' },
    { csvKey:'Start Date', inputId:'intern-start' },{ csvKey:'start', inputId:'intern-start' },
    { csvKey:'End Date',   inputId:'intern-end' },{ csvKey:'end', inputId:'intern-end' },
    { csvKey:'Stipend',    inputId:'intern-stipend' },{ csvKey:'stipend', inputId:'intern-stipend' },
  ], 'intern');
  $('internFetchSheets').addEventListener('click', () => openSheetsModal(sheetsMappings.intern, [
    { csvKey:'Name', inputId:'intern-name' },{ csvKey:'name', inputId:'intern-name' },
    { csvKey:'Role', inputId:'intern-role' },{ csvKey:'role', inputId:'intern-role' },
    { csvKey:'Department', inputId:'intern-dept' },{ csvKey:'dept', inputId:'intern-dept' },
    { csvKey:'Start Date', inputId:'intern-start' },{ csvKey:'start', inputId:'intern-start' },
    { csvKey:'End Date',   inputId:'intern-end' },{ csvKey:'end', inputId:'intern-end' },
    { csvKey:'Stipend',    inputId:'intern-stipend' },{ csvKey:'stipend', inputId:'intern-stipend' },
  ], 'intern'));
  $('internExportCsv').addEventListener('click', () => exportCSV([
    { label:'Name', id:'intern-name' },{ label:'Role', id:'intern-role' },
    { label:'Department', id:'intern-dept' },{ label:'Start Date', id:'intern-start' },
    { label:'End Date', id:'intern-end' },{ label:'Stipend', id:'intern-stipend' },
  ], 'tmt_internship_letter_data.csv'));

  // ── Appreciation Letter ──
  setupCSVImport('apprImportCsv','apprCsvFile',[
    { csvKey:'Name',   inputId:'appr-name' },{ csvKey:'name', inputId:'appr-name' },
    { csvKey:'Reason', inputId:'appr-reason' },{ csvKey:'reason', inputId:'appr-reason' },
    { csvKey:'Role',   inputId:'appr-role' },{ csvKey:'role', inputId:'appr-role' },
  ], 'appr');
  $('apprFetchSheets').addEventListener('click', () => openSheetsModal(sheetsMappings.appr, [
    { csvKey:'Name',   inputId:'appr-name' },{ csvKey:'name', inputId:'appr-name' },
    { csvKey:'Reason', inputId:'appr-reason' },{ csvKey:'reason', inputId:'appr-reason' },
    { csvKey:'Role',   inputId:'appr-role' },{ csvKey:'role', inputId:'appr-role' },
  ], 'appr'));
  $('apprExportCsv').addEventListener('click', () => exportCSV([
    { label:'Name', id:'appr-name' },{ label:'Reason', id:'appr-reason' },{ label:'Role', id:'appr-role' },
  ], 'tmt_appreciation_data.csv'));

  // ── Experience Letter ──
  setupCSVImport('expImportCsv','expCsvFile',[
    { csvKey:'Name', inputId:'exp-name' },{ csvKey:'name', inputId:'exp-name' },
    { csvKey:'Role', inputId:'exp-role' },{ csvKey:'role', inputId:'exp-role' },
    { csvKey:'Department', inputId:'exp-dept' },{ csvKey:'dept', inputId:'exp-dept' },
    { csvKey:'Joining Date', inputId:'exp-join' },{ csvKey:'join', inputId:'exp-join' },
    { csvKey:'Last Working Day', inputId:'exp-relieve' },{ csvKey:'relieve', inputId:'exp-relieve' },
  ], 'exp');
  $('expFetchSheets').addEventListener('click', () => openSheetsModal(sheetsMappings.exp, [
    { csvKey:'Name', inputId:'exp-name' },{ csvKey:'name', inputId:'exp-name' },
    { csvKey:'Role', inputId:'exp-role' },{ csvKey:'role', inputId:'exp-role' },
    { csvKey:'Department', inputId:'exp-dept' },{ csvKey:'dept', inputId:'exp-dept' },
    { csvKey:'Joining Date', inputId:'exp-join' },{ csvKey:'join', inputId:'exp-join' },
    { csvKey:'Last Working Day', inputId:'exp-relieve' },{ csvKey:'relieve', inputId:'exp-relieve' },
  ], 'exp'));
  $('expExportCsv').addEventListener('click', () => exportCSV([
    { label:'Name', id:'exp-name' },{ label:'Role', id:'exp-role' },
    { label:'Department', id:'exp-dept' },{ label:'Joining Date', id:'exp-join' },
    { label:'Last Working Day', id:'exp-relieve' },
  ], 'tmt_experience_letter_data.csv'));

  // ── ID Card ──
  setupCSVImport('idImportCsv','idCsvFile',[
    { csvKey:'Name', inputId:'id-name' },{ csvKey:'name', inputId:'id-name' },
    { csvKey:'Role', inputId:'id-role' },{ csvKey:'role', inputId:'id-role' },
    { csvKey:'Department', inputId:'id-dept' },{ csvKey:'dept', inputId:'id-dept' },
    { csvKey:'Employee ID', inputId:'id-empid' },{ csvKey:'empid', inputId:'id-empid' },
    { csvKey:'Email', inputId:'id-email' },{ csvKey:'email', inputId:'id-email' },
    { csvKey:'Phone', inputId:'id-phone' },{ csvKey:'phone', inputId:'id-phone' },
  ], 'id');
  $('idFetchSheets').addEventListener('click', () => openSheetsModal(sheetsMappings.id, [
    { csvKey:'Name', inputId:'id-name' },{ csvKey:'name', inputId:'id-name' },
    { csvKey:'Role', inputId:'id-role' },{ csvKey:'role', inputId:'id-role' },
    { csvKey:'Department', inputId:'id-dept' },{ csvKey:'dept', inputId:'id-dept' },
    { csvKey:'Employee ID', inputId:'id-empid' },{ csvKey:'empid', inputId:'id-empid' },
    { csvKey:'Email', inputId:'id-email' },{ csvKey:'email', inputId:'id-email' },
    { csvKey:'Phone', inputId:'id-phone' },{ csvKey:'phone', inputId:'id-phone' },
  ], 'id'));
  $('idExportCsv').addEventListener('click', () => exportCSV([
    { label:'Name', id:'id-name' },{ label:'Role', id:'id-role' },
    { label:'Department', id:'id-dept' },{ label:'Employee ID', id:'id-empid' },
    { label:'Email', id:'id-email' },
  ], 'tmt_id_card_data.csv'));
}


/* ============================================================
   DOWNLOAD ENGINE
   ============================================================ */
async function downloadElement(elementId, baseFilename, type, countKey, orientation='landscape', nameInputId=null) {
  let finalFilename = baseFilename;
  if (nameInputId) {
    const nameEl = $(nameInputId);
    if (nameEl && nameEl.value.trim()) {
      // Append sanitized name to filename (e.g., TMT_Certificate -> TMT_Kavile_Akshaya_Certificate)
      const sanitizedName = nameEl.value.trim().replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
      // Format: TMT_Name_Type
      const parts = baseFilename.split('_');
      if (parts.length >= 2 && parts[0] === 'TMT') {
        finalFilename = `TMT_${sanitizedName}_${parts.slice(1).join('_')}`;
      } else {
        finalFilename = `${sanitizedName}_${baseFilename}`;
      }
    }
  }

  showToast('Preparing document…', 5000);
  const el = $(elementId);
  if (!el) { showToast('Preview element not found.'); return; }

  // Temporarily reset zoom so html2canvas captures the full natural size
  const savedZoom = el.style.zoom;
  el.style.zoom = '1';

  // Wait for reflow after zoom reset
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  try {
    const canvas = await html2canvas(el, {
      scale: 2.5,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 15000,
    });

    el.style.zoom = savedZoom;

    if (type === 'png') {
      const link = document.createElement('a');
      link.download = `${finalFilename}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
      showToast(`✓ ${finalFilename}.png downloaded`);
    } else {
      const { jsPDF } = window.jspdf;
      const isPortrait = orientation === 'portrait';
      const pdf = new jsPDF({ orientation, unit:'mm', format:'a4' });
      const w = pdf.internal.pageSize.getWidth();
      const h = pdf.internal.pageSize.getHeight();
      // Fit image to page preserving aspect ratio
      const canvasAR = canvas.width / canvas.height;
      const pageAR   = w / h;
      let imgW = w, imgH = h;
      if (canvasAR > pageAR) { imgH = w / canvasAR; }
      else                   { imgW = h * canvasAR; }
      const x = (w - imgW) / 2;
      const y = (h - imgH) / 2;
      pdf.addImage(canvas.toDataURL('image/png',1.0), 'PNG', x, y, imgW, imgH);
      pdf.save(`${finalFilename}.pdf`);
      showToast(`✓ ${finalFilename}.pdf downloaded`);
    }

    if (countKey) {
      downloadCounts[countKey] = (downloadCounts[countKey] || 0) + 1;
      updateStats();
    }
  } catch (err) {
    el.style.zoom = savedZoom;
    console.error('Download error:', err);
    showToast('Download failed — check console for details.');
  }
}

function initDownloads() {
  $('certDownloadPng').addEventListener('click',  () => downloadElement('certPreview',     'TMT_Certificate',          'png', 'certificates',    'landscape', 'cert-name'));
  $('certDownloadPdf').addEventListener('click',  () => downloadElement('certPreview',     'TMT_Certificate',          'pdf', 'certificates',    'landscape', 'cert-name'));
  $('offerDownloadPng').addEventListener('click', () => downloadElement('offerPreview',    'TMT_Offer_Letter',         'png', 'offerLetters',    'portrait', 'offer-name'));
  $('offerDownloadPdf').addEventListener('click', () => downloadElement('offerPreview',    'TMT_Offer_Letter',         'pdf', 'offerLetters',    'portrait', 'offer-name'));
  $('compDownloadPng').addEventListener('click',  () => downloadElement('compPreview',     'TMT_Completion_Letter',    'png', 'completionLetters','portrait', 'comp-name'));
  $('compDownloadPdf').addEventListener('click',  () => downloadElement('compPreview',     'TMT_Completion_Letter',    'pdf', 'completionLetters','portrait', 'comp-name'));
  $('internDownloadPng').addEventListener('click',() => downloadElement('internPreview',   'TMT_Internship_Letter',    'png', null,               'portrait', 'intern-name'));
  $('internDownloadPdf').addEventListener('click',() => downloadElement('internPreview',   'TMT_Internship_Letter',    'pdf', null,               'portrait', 'intern-name'));
  $('apprDownloadPng').addEventListener('click',  () => downloadElement('apprPreview',     'TMT_Appreciation_Letter',  'png', null,               'portrait', 'appr-name'));
  $('apprDownloadPdf').addEventListener('click',  () => downloadElement('apprPreview',     'TMT_Appreciation_Letter',  'pdf', null,               'portrait', 'appr-name'));
  $('expDownloadPng').addEventListener('click',   () => downloadElement('expPreview',      'TMT_Experience_Letter',    'png', null,               'portrait', 'exp-name'));
  $('expDownloadPdf').addEventListener('click',   () => downloadElement('expPreview',      'TMT_Experience_Letter',    'pdf', null,               'portrait', 'exp-name'));
  
  $('idDownloadFront').addEventListener('click',  () => downloadElement('idCardFront',     'TMT_ID_Card_Front',        'png', null,               'portrait', 'id-name'));
  $('idDownloadBack').addEventListener('click',   () => downloadElement('idCardBack',      'TMT_ID_Card_Back',         'png', null,               'portrait', 'id-name'));
}


/* ── SEARCH ── */
function initSearch() {
  const map = {
    dashboard:['dashboard','home','overview'],
    certificates:['certificate','cert','recognition'],
    offerLetters:['offer','offer letter','employment'],
    completionLetters:['completion','complete','course'],
    internshipLetters:['internship','intern'],
    appreciationLetters:['appreciation','appreciate','reward'],
    experienceLetters:['experience','relieving','exp'],
    idCards:['id','id card','identity'],
    settings:['settings','profile','account'],
  };
  $('searchInput').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const q = e.target.value.toLowerCase().trim();
    if (!q) return;
    for (const [sec,kws] of Object.entries(map)) {
      if (kws.some(k => k.includes(q) || q.includes(k))) {
        navigateTo(sec);
        e.target.value = '';
        return;
      }
    }
    showToast(`No section found for "${q}"`);
  });
}


/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initLogin();
  initNavigation();
  initMobileSidebar();
  initLogout();
  initCertificate();
  initOfferLetter();
  initCompletionLetter();
  initInternshipLetter();
  initAppreciationLetter();
  initExperienceLetter();
  initIdCard();
  initDownloads();
  initCSVFeatures();
  initGoogleSheets();
  initBatchNavs();
  initSearch();
});

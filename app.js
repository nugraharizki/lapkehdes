// Database Configuration (KVDB Online Sync)
const KVDB_BUCKET = 'R4RXft1bNXpuaY7cFTQ3Ka';
const isOnlineSyncEnabled = true;

// State Management
let dosenData = [];
let appPeriod = localStorage.getItem('appPeriod') || 'Semester ini / Tahun Akademik';
let currentUser = localStorage.getItem('currentUser');
let isLightMode = localStorage.getItem('isLightMode') === 'true';

// Constants
const MAX_MEETINGS = 16;
let isSaving = false; // flag to skip refresh during save

// Load local first for fallback
dosenData = JSON.parse(localStorage.getItem('dosenData')) || [];

// Initial Render
document.addEventListener('DOMContentLoaded', async () => {
    if (isLightMode) {
        document.body.classList.add('light-theme');
    }
    updateThemeIcon();

    checkAuth();
    generateTableHeaders();
    generateAttendanceForm();

    if (isOnlineSyncEnabled) {
        await loadDataFromOnline();
    }

    updatePeriodDisplay();
    populateFilters();
    renderTable();
});

async function loadDataFromOnline() {
    try {
        const responseData = await fetch(`https://kvdb.io/${KVDB_BUCKET}/dosenData`);
        if (responseData.ok) {
            const data = await responseData.json();
            dosenData = Array.isArray(data) ? data : Object.values(data);
        } else {
            // First time using online DB, let's sync local to online!
            const localData = JSON.parse(localStorage.getItem('dosenData'));
            if (localData && localData.length > 0) {
                dosenData = localData;
                await fetch(`https://kvdb.io/${KVDB_BUCKET}/dosenData`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dosenData)
                });
            }
        }

        const responsePeriod = await fetch(`https://kvdb.io/${KVDB_BUCKET}/appPeriod`);
        if (responsePeriod.ok) {
            const period = await responsePeriod.text();
            if (period) {
                appPeriod = period;
                localStorage.setItem('appPeriod', appPeriod);
            }
        }

        localStorage.setItem('dosenData', JSON.stringify(dosenData));
    } catch (err) {
        console.error("Gagal mengambil data dari database online:", err);
        dosenData = JSON.parse(localStorage.getItem('dosenData')) || [];
    }
}


// Authentication & Roles
function checkAuth() {
    const overlay = document.getElementById('loginOverlay');
    if (currentUser) {
        overlay.classList.remove('active');
        applyRolePermissions();
    } else {
        overlay.classList.add('active');
    }
}

let tempAdminEmail = '';
let generatedOtp = '';

// Kredensial EmailJS (Isi dengan data dari emailjs.com)
const EMAILJS_SERVICE_ID = 'service_w0gmdbb';
const EMAILJS_TEMPLATE_ID = 'template_hluup7h';
const EMAILJS_PUBLIC_KEY = 'NNtjCnTNu94WlWNha';

function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('username').value.toLowerCase();
    const pass = document.getElementById('password').value;

    if ((user === 'rizki.nuggraha@gmail.com' || user === 'admin') && pass === 'admin') {
        document.getElementById('loginError').style.display = 'none';
        tempAdminEmail = user === 'admin' ? 'rizki.nuggraha@gmail.com' : user;
        document.getElementById('otpEmailDisplay').innerText = tempAdminEmail;

        // Buat 6 angka random
        generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

        const btn = document.querySelector('#loginForm button');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengirim...';
        btn.disabled = true;

        if (EMAILJS_PUBLIC_KEY === 'YOUR_PUBLIC_KEY') {
            // Simulasi jika belum di-setup
            alert("INFO SISTEM: API Key EmailJS belum diisi. OTP Simulasi Anda: " + generatedOtp);
            showOtpOverlay();
            btn.innerHTML = originalText;
            btn.disabled = false;
        } else {
            // Kirim email beneran
            emailjs.init(EMAILJS_PUBLIC_KEY);
            emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
                to_email: tempAdminEmail,
                otp_code: generatedOtp
            }).then(() => {
                showOtpOverlay();
            }).catch((err) => {
                alert("Gagal mengirim email OTP: " + JSON.stringify(err));
            }).finally(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
            });
        }
    } else if (user === 'prodi' && pass === 'prodi') {
        currentUser = user;
        localStorage.setItem('currentUser', currentUser);
        document.getElementById('loginError').style.display = 'none';
        checkAuth();
    } else {
        document.getElementById('loginError').style.display = 'block';
    }
}

function showOtpOverlay() {
    document.getElementById('loginOverlay').classList.remove('active');
    document.getElementById('otpOverlay').classList.add('active');
}

function handleVerifyOTP(e) {
    e.preventDefault();
    const otp = document.getElementById('otpCode').value;

    // Verifikasi dengan OTP dinamis atau fallback statis jika belum setup
    if (otp === generatedOtp || (EMAILJS_PUBLIC_KEY === 'YOUR_PUBLIC_KEY' && otp === '123456')) {
        currentUser = 'admin';
        localStorage.setItem('currentUser', currentUser);
        document.getElementById('otpError').style.display = 'none';
        document.getElementById('otpOverlay').classList.remove('active');
        checkAuth();
    } else {
        document.getElementById('otpError').style.display = 'block';
    }
}

function handleLogout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    checkAuth();
}

function applyRolePermissions() {
    const addBtn = document.getElementById('btn-add-dosen');
    const editTitleBtn = document.querySelector('.btn-edit[title="Ubah Judul Periode"]');
    if (currentUser === 'prodi') {
        if (addBtn) addBtn.style.display = 'none';
        if (editTitleBtn) editTitleBtn.style.display = 'none';
    } else {
        if (addBtn) addBtn.style.display = 'inline-flex';
        if (editTitleBtn) editTitleBtn.style.display = 'inline-flex';
    }
    renderTable();
}

// Export Functionality
function exportExcel() {
    const table = document.getElementById('dataTable');
    // Clone table to remove action columns before export
    const cloneTable = table.cloneNode(true);
    const rows = cloneTable.querySelectorAll('tr');
    rows.forEach(row => {
        if (row.lastElementChild) row.removeChild(row.lastElementChild);
    });

    const wb = XLSX.utils.table_to_book(cloneTable, { sheet: "Kehadiran" });
    const safePeriod = appPeriod.replace(/[\/\\]/g, '_');
    XLSX.writeFile(wb, `Monitoring_Kehadiran_Dosen_${safePeriod}.xlsx`);
}

function exportPDF() {
    const element = document.querySelector('.table-container');
    const safePeriod = appPeriod.replace(/[\/\\]/g, '_');
    const opt = {
        margin: 0.5,
        filename: `Monitoring_Kehadiran_Dosen_${safePeriod}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'legal', orientation: 'landscape' }
    };
    html2pdf().set(opt).from(element).save();
}

// Theme Management
function toggleTheme() {
    isLightMode = !isLightMode;
    localStorage.setItem('isLightMode', isLightMode);
    if (isLightMode) {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }
    updateThemeIcon();
}

function updateThemeIcon() {
    const btn = document.getElementById('btn-theme');
    if (!btn) return;
    if (isLightMode) {
        btn.innerHTML = '<i class="fa-solid fa-moon"></i>';
        btn.title = "Ganti Tema Gelap";
    } else {
        btn.innerHTML = '<i class="fa-solid fa-sun"></i>';
        btn.title = "Ganti Tema Terang";
    }
}

// Generate dynamic meeting headers
function generateTableHeaders() {
    const headerRow = document.getElementById('meetingHeaders');
    let html = '';
    for (let i = 1; i <= MAX_MEETINGS; i++) {
        html += `<th class="text-center">Pert ${i}</th>`;
    }
    headerRow.innerHTML = html;
}

// Generate dynamic attendance modal form
function generateAttendanceForm() {
    const grid = document.getElementById('attendanceGrid');
    let html = '';
    for (let i = 1; i <= MAX_MEETINGS; i++) {
        html += `
            <div class="att-card">
                <div class="att-card-header">Pertemuan ${i}</div>
                <div class="form-group">
                    <label>Tanggal</label>
                    <input type="date" id="tglPert${i}">
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select id="statPert${i}">
                        <option value="">Belum Ada</option>
                        <option value="Hadir">Hadir</option>
                        <option value="Tidak Hadir">Tidak Hadir</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-primary btn-sm" style="width:100%; justify-content:center; padding: 0.5rem; font-size: 0.85rem; margin-top: 0.5rem;">
                    <i class="fa-solid fa-save"></i> Simpan
                </button>
            </div>
        `;
    }
    grid.innerHTML = html;
}

// Period Management
async function editPeriod() {
    const newPeriod = prompt("Masukkan Judul Periode (contoh: Tahun Akademik Genap 2025/2026):", appPeriod);
    if (newPeriod !== null && newPeriod.trim() !== '') {
        appPeriod = newPeriod.trim();
        if (isOnlineSyncEnabled) {
            try {
                await fetch(`https://kvdb.io/${KVDB_BUCKET}/appPeriod`, {
                    method: 'PUT',
                    body: appPeriod
                });
            } catch (err) {
                console.error("Gagal menyimpan periode:", err);
            }
        }
        localStorage.setItem('appPeriod', appPeriod);
        updatePeriodDisplay();
    }
}

function updatePeriodDisplay() {
    document.getElementById('periodTitle').innerText = 'Daftar Kehadiran ' + appPeriod;
    document.getElementById('periodTableHeader').innerText = 'Daftar Pertemuan (' + appPeriod + ')';
}

// Helper: Normalize dosen name to core name (strip titles & degrees)
function normalizeDosenName(name) {
    if (!name) return '';
    let n = name.trim();
    // Strip academic title prefixes (put Dra before Dr to prevent partial matching)
    n = n.replace(/^(Prof\.?\s*Dr\.?|Prof\.?|Dra\.?|Dr\.?|Ir\.?)\s*/i, '');
    // Take only the core name before degree suffixes (first comma usually starts degrees)
    // But only if what follows the comma looks like a degree abbreviation
    const commaIdx = n.indexOf(',');
    if (commaIdx > 0) {
        const afterComma = n.substring(commaIdx + 1).trim();
        // Check if after comma starts with common degree patterns
        if (/^[A-Za-z]{1,4}\./.test(afterComma) || /^(S|M|P|Ph|Dr)\b/i.test(afterComma)) {
            n = n.substring(0, commaIdx);
        }
    }
    // Normalize whitespace and case
    return n.trim().replace(/\s+/g, ' ').toLowerCase();
}

// Helper: Format dosen name to Title Case
function formatDosenNameTitleCase(name) {
    if (!name) return '';
    let n = name.trim();

    // Extract title prefix if present (put Dra before Dr to prevent partial matching)
    let prefix = '';
    const prefixMatch = n.match(/^(Prof\.?\s*Dr\.?|Prof\.?|Dra\.?|Dr\.?|Ir\.?)\s*/i);
    if (prefixMatch) {
        // Standardize prefix formatting
        let rawPrefix = prefixMatch[1].trim();
        // Capitalize prefix properly
        const prefixMap = {
            'prof dr': 'Prof. Dr.', 'prof. dr': 'Prof. Dr.', 'prof. dr.': 'Prof. Dr.',
            'prof': 'Prof.', 'prof.': 'Prof.',
            'dr': 'Dr.', 'dr.': 'Dr.',
            'dra': 'Dra.', 'dra.': 'Dra.',
            'ir': 'Ir.', 'ir.': 'Ir.'
        };
        prefix = prefixMap[rawPrefix.toLowerCase().replace(/\s+/g, ' ')] || rawPrefix;
        n = n.substring(prefixMatch[0].length);
    }

    // Extract degree suffix if present (after first comma that starts a degree)
    let suffix = '';
    const commaIdx = n.indexOf(',');
    if (commaIdx > 0) {
        const afterComma = n.substring(commaIdx + 1).trim();
        if (/^[A-Za-z]{1,4}\./.test(afterComma) || /^(S|M|P|Ph|Dr)\b/i.test(afterComma)) {
            suffix = n.substring(commaIdx); // includes the comma
            n = n.substring(0, commaIdx);
        }
    }

    // Convert core name to Title Case
    const titleCaseName = n.trim().replace(/\s+/g, ' ').split(' ').map(word => {
        if (word.length === 0) return '';
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');

    // Reassemble: prefix + title-case name + suffix
    let result = '';
    if (prefix) result += prefix + ' ';
    result += titleCaseName;
    if (suffix) result += suffix;

    return result.trim();
}

// Helper: Get unique dosen names (case-insensitive, title/degree-normalized)
function getUniqueDosenNames() {
    const seen = new Map();
    dosenData.forEach(d => {
        if (!d.namaDosen) return;
        const normalized = normalizeDosenName(d.namaDosen);
        if (!seen.has(normalized)) {
            // Store the formatted (Title Case) version
            seen.set(normalized, formatDosenNameTitleCase(d.namaDosen));
        }
    });
    return [...seen.values()].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

// Populate Filters
function populateFilters() {
    // Tahun
    const filterTahun = document.getElementById('filterTahun');
    const uniqueTahun = [...new Set(dosenData.map(d => d.tahunAkademik))].filter(Boolean);
    const currTahun = filterTahun ? filterTahun.value : '';
    if (filterTahun) {
        filterTahun.innerHTML = '<option value="" style="background:var(--bg-dark); color:white;">Semua Tahun Akademik</option>';
        uniqueTahun.forEach(val => {
            const opt = document.createElement('option');
            opt.value = val; opt.textContent = val;
            opt.style.background = 'var(--bg-dark)'; opt.style.color = 'white';
            filterTahun.appendChild(opt);
        });
        if (uniqueTahun.includes(currTahun)) filterTahun.value = currTahun;
    }

    // Prodi
    const filterProdi = document.getElementById('filterProdi');
    const uniqueProdi = [...new Set(dosenData.map(d => d.programStudi))].filter(Boolean);
    const currProdi = filterProdi ? filterProdi.value : '';
    if (filterProdi) {
        filterProdi.innerHTML = '<option value="" style="background:var(--bg-dark); color:white;">Semua Prodi</option>';
        uniqueProdi.forEach(val => {
            const opt = document.createElement('option');
            opt.value = val; opt.textContent = val;
            opt.style.background = 'var(--bg-dark)'; opt.style.color = 'white';
            filterProdi.appendChild(opt);
        });
        if (uniqueProdi.includes(currProdi)) filterProdi.value = currProdi;
    }

    // Jenis Kelas
    const filterJenisKelas = document.getElementById('filterJenisKelas');
    const uniqueJenisKelas = [...new Set(dosenData.map(d => d.jenisKelas))].filter(Boolean);
    const currJenisKelas = filterJenisKelas ? filterJenisKelas.value : '';
    if (filterJenisKelas) {
        filterJenisKelas.innerHTML = '<option value="" style="background:var(--bg-dark); color:white;">Semua Jenis Kelas</option>';
        uniqueJenisKelas.forEach(val => {
            const opt = document.createElement('option');
            opt.value = val; opt.textContent = val;
            opt.style.background = 'var(--bg-dark)'; opt.style.color = 'white';
            filterJenisKelas.appendChild(opt);
        });
        if (uniqueJenisKelas.includes(currJenisKelas)) filterJenisKelas.value = currJenisKelas;
    }

    // Dosen (deduplicated, case-insensitive)
    const filterDosen = document.getElementById('filterDosen');
    const uniqueDosen = getUniqueDosenNames();
    const currDosen = filterDosen ? filterDosen.value : '';
    if (filterDosen) {
        filterDosen.innerHTML = '<option value="" style="background:var(--bg-dark); color:white;">Semua Dosen</option>';
        uniqueDosen.forEach(val => {
            const opt = document.createElement('option');
            opt.value = val; opt.textContent = val;
            opt.style.background = 'var(--bg-dark)'; opt.style.color = 'white';
            filterDosen.appendChild(opt);
        });
        if (uniqueDosen.some(v => v.toLowerCase() === currDosen.toLowerCase())) filterDosen.value = currDosen;
    }

    // Bulan & Tahun Pertemuan
    populateDateFilters();
}

// Populate Month/Year filters from meeting dates
function populateDateFilters() {
    const months = new Set();
    const years = new Set();
    const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

    dosenData.forEach(d => {
        const pertemuan = d.pertemuan || [];
        pertemuan.forEach(p => {
            if (p.date) {
                const dt = new Date(p.date);
                if (!isNaN(dt)) {
                    months.add(dt.getMonth()); // 0-11
                    years.add(dt.getFullYear());
                }
            }
        });
    });

    // Bulan filter
    const filterBulan = document.getElementById('filterBulan');
    const currBulan = filterBulan ? filterBulan.value : '';
    if (filterBulan) {
        filterBulan.innerHTML = '<option value="" style="background:var(--bg-dark); color:white;">Semua Bulan</option>';
        [...months].sort((a, b) => a - b).forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = monthNames[m];
            opt.style.background = 'var(--bg-dark)'; opt.style.color = 'white';
            filterBulan.appendChild(opt);
        });
        if (currBulan !== '') filterBulan.value = currBulan;
    }

    // Tahun Pertemuan filter
    const filterTahunPert = document.getElementById('filterTahunPert');
    const currTahunPert = filterTahunPert ? filterTahunPert.value : '';
    if (filterTahunPert) {
        filterTahunPert.innerHTML = '<option value="" style="background:var(--bg-dark); color:white;">Semua Tahun</option>';
        [...years].sort((a, b) => a - b).forEach(y => {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            opt.style.background = 'var(--bg-dark)'; opt.style.color = 'white';
            filterTahunPert.appendChild(opt);
        });
        if (currTahunPert !== '') filterTahunPert.value = currTahunPert;
    }
}

// Modal Logic
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
    if (modalId === 'dosenModal') {
        populateDosenDropdown();
        populateMataKuliahDropdown();
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    if (modalId === 'dosenModal') {
        document.getElementById('dosenForm').reset();
        document.getElementById('dosenId').value = '';
        document.getElementById('namaDosen').value = '';
        document.getElementById('namaDosenInput').value = '';
        document.getElementById('namaDosenInput').style.display = 'none';
        document.getElementById('namaDosenSelect').required = true;
        document.getElementById('namaDosenInput').required = false;

        document.getElementById('mataKuliah').value = '';
        document.getElementById('mataKuliahInput').value = '';
        document.getElementById('mataKuliahInput').style.display = 'none';
        document.getElementById('mataKuliahSelect').required = true;
        document.getElementById('mataKuliahInput').required = false;

        document.getElementById('modalTitle').innerText = 'Tambah Data Dosen';
    }
}

// Populate Dosen Dropdown with unique names (case-insensitive dedup)
function populateDosenDropdown() {
    const select = document.getElementById('namaDosenSelect');
    const uniqueNames = getUniqueDosenNames();
    // Preserve options: default + dynamic + "Tambah Baru"
    select.innerHTML = '<option value="">Pilih Nama Dosen</option>';
    uniqueNames.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
    });
    const newOpt = document.createElement('option');
    newOpt.value = '__new__';
    newOpt.textContent = '+ Tambah Dosen Baru...';
    select.appendChild(newOpt);
}

// Handle Dosen Select Change
function handleDosenSelectChange() {
    const select = document.getElementById('namaDosenSelect');
    const input = document.getElementById('namaDosenInput');
    const hidden = document.getElementById('namaDosen');

    if (select.value === '__new__') {
        input.style.display = 'block';
        input.required = true;
        input.focus();
        select.required = false;
        hidden.value = '';
    } else {
        input.style.display = 'none';
        input.required = false;
        input.value = '';
        select.required = true;
        hidden.value = select.value;
    }
}

// Populate Mata Kuliah Dropdown with unique names
function populateMataKuliahDropdown() {
    const select = document.getElementById('mataKuliahSelect');
    const uniqueNames = [...new Set(dosenData.map(d => d.mataKuliah))].filter(Boolean).sort();
    
    select.innerHTML = '<option value="">Pilih Mata Kuliah</option>';
    uniqueNames.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
    });
    const newOpt = document.createElement('option');
    newOpt.value = '__new__';
    newOpt.textContent = '+ Tambah Mata Kuliah Baru...';
    select.appendChild(newOpt);
}

// Handle Mata Kuliah Select Change
function handleMataKuliahSelectChange() {
    const select = document.getElementById('mataKuliahSelect');
    const input = document.getElementById('mataKuliahInput');
    const hidden = document.getElementById('mataKuliah');

    if (select.value === '__new__') {
        input.style.display = 'block';
        input.required = true;
        input.focus();
        select.required = false;
        hidden.value = '';
    } else {
        input.style.display = 'none';
        input.required = false;
        input.value = '';
        select.required = true;
        hidden.value = select.value;
    }
}

// Generate Unique ID
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// Format Date string to dd-mm-yyyy
function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

// Get Badge Class
function getBadgeClass(status) {
    if (status === 'Hadir') return 'status-badge status-hadir';
    if (status === 'Tidak Hadir') return 'status-badge status-absen';
    return '';
}

// Calculate Metrics
function calculateMetrics(pertemuan) {
    let countRealized = 0;
    let countPresent = 0;

    pertemuan.forEach(p => {
        if (p.status) {
            countRealized++;
            if (p.status === 'Hadir') {
                countPresent++;
            }
        }
    });

    return { countRealized, countPresent };
}

// Save Data
async function saveData() {
    isSaving = true;
    if (isOnlineSyncEnabled) {
        try {
            const btnList = document.querySelectorAll('button');
            btnList.forEach(btn => btn.style.pointerEvents = 'none'); // prevent double click
            await fetch(`https://kvdb.io/${KVDB_BUCKET}/dosenData`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dosenData)
            });
            btnList.forEach(btn => btn.style.pointerEvents = 'auto');
        } catch (err) {
            console.error("Gagal menyimpan data ke database online:", err);
            alert("Gagal menyimpan data secara online.");
        }
    }
    localStorage.setItem('dosenData', JSON.stringify(dosenData));
    populateFilters();
    renderTable();
    isSaving = false;
}

// Render Table
function renderTable(data = dosenData) {
    const tbody = document.getElementById('tableBody');
    const emptyState = document.getElementById('emptyState');
    const dataTable = document.getElementById('dataTable');

    tbody.innerHTML = '';

    if (data.length === 0) {
        dataTable.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    dataTable.style.display = 'table';
    emptyState.style.display = 'none';

    data.forEach((item, index) => {
        // Prepare meetings array up to MAX_MEETINGS elements
        const pertemuan = item.pertemuan || Array(MAX_MEETINGS).fill({});
        const { countRealized, countPresent } = calculateMetrics(pertemuan);

        // Render meeting cells
        let meetingsHtml = '';
        for (let i = 0; i < MAX_MEETINGS; i++) {
            const m = pertemuan[i] || {};
            if (m.status && m.date) {
                meetingsHtml += `
                    <td class="text-center clickable-cell" onclick="openAttendance('${item.id}')" title="Klik untuk ubah kehadiran">
                        <span class="date-text">${formatDate(m.date)}</span>
                        <span class="${getBadgeClass(m.status)}">${m.status}</span>
                    </td>
                `;
            } else {
                meetingsHtml += `
                    <td class="text-center clickable-cell" onclick="openAttendance('${item.id}')" title="Klik untuk isi kehadiran">
                        <span class="status-none">-</span>
                    </td>
                `;
            }
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="sticky-col text-center">${index + 1}</td>
            <td class="sticky-col-2">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
                    <strong>${formatDosenNameTitleCase(item.namaDosen)}</strong>
                    <button class="btn btn-icon btn-attendance" style="width:28px; height:28px; padding:0; flex-shrink:0;" onclick="openAttendance('${item.id}')" title="Isi Kehadiran">
                        <i class="fa-solid fa-calendar-check" style="font-size:0.8rem;"></i>
                    </button>
                </div>
            </td>
            <td>${item.mataKuliah}</td>
            <td>${item.programStudi}</td>
            <td>${item.jenisKelas || '-'}</td>
            <td class="text-center">${item.semester}</td>
            <td class="text-center">${item.tahunAkademik}</td>
            <td class="text-center">${item.sks}</td>
            ${meetingsHtml}
            <td class="text-center"><strong>${countRealized}</strong></td>
            <td class="text-center"><strong style="color: var(--success);">${countPresent}</strong></td>
            <td class="text-center action-col">
                <div class="action-buttons">
                    <button class="btn btn-icon btn-attendance" onclick="openAttendance('${item.id}')" title="Isi Kehadiran">
                        <i class="fa-solid fa-calendar-check"></i>
                    </button>
                    ${currentUser !== 'prodi' ? `
                    <button class="btn btn-icon btn-edit" onclick="editDosen('${item.id}')" title="Edit Data">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn btn-icon btn-delete" onclick="deleteDosen('${item.id}')" title="Hapus Data">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                    ` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Handle Add/Edit Dosen Form Submit
function handleDosenSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('dosenId').value;
    const selectVal = document.getElementById('namaDosenSelect').value;
    const inputVal = document.getElementById('namaDosenInput').value.trim();
    const namaDosen = selectVal === '__new__' ? inputVal : selectVal;

    if (!namaDosen) {
        alert('Silakan pilih atau masukkan Nama Dosen.');
        return;
    }

    const mkSelectVal = document.getElementById('mataKuliahSelect').value;
    const mkInputVal = document.getElementById('mataKuliahInput').value.trim();
    const mataKuliah = mkSelectVal === '__new__' ? mkInputVal : mkSelectVal;

    if (!mataKuliah) {
        alert('Silakan pilih atau masukkan Mata Kuliah.');
        return;
    }

    const newData = {
        namaDosen: namaDosen,
        mataKuliah: mataKuliah,
        programStudi: document.getElementById('programStudi').value,
        jenisKelas: document.getElementById('jenisKelas').value,
        semester: document.getElementById('semester').value,
        tahunAkademik: document.getElementById('tahunAkademik').value,
        sks: document.getElementById('sks').value
    };

    if (id) {
        // Edit existing
        const index = dosenData.findIndex(d => d.id === id);
        if (index !== -1) {
            dosenData[index] = { ...dosenData[index], ...newData };
        }
    } else {
        // Add new
        newData.id = generateId();
        newData.pertemuan = Array(MAX_MEETINGS).fill({}); // Initialize meetings
        dosenData.push(newData);
    }

    saveData();
    closeModal('dosenModal');
}

// Edit Dosen
function editDosen(id) {
    const data = dosenData.find(d => d.id === id);
    if (data) {
        document.getElementById('dosenId').value = data.id;

        // Open modal first to populate dropdown
        document.getElementById('modalTitle').innerText = 'Edit Data Dosen';
        openModal('dosenModal');

        // Set the dropdown value
        const select = document.getElementById('namaDosenSelect');
        const input = document.getElementById('namaDosenInput');
        const hidden = document.getElementById('namaDosen');

        // Check if the name exists in the dropdown options
        const optionExists = [...select.options].some(opt => opt.value === data.namaDosen);
        if (optionExists) {
            select.value = data.namaDosen;
            hidden.value = data.namaDosen;
            input.style.display = 'none';
            input.required = false;
        } else {
            select.value = '__new__';
            input.style.display = 'block';
            input.value = data.namaDosen;
            input.required = true;
            select.required = false;
        }

        // Set the Mata Kuliah dropdown value
        const mkSelect = document.getElementById('mataKuliahSelect');
        const mkInput = document.getElementById('mataKuliahInput');
        const mkHidden = document.getElementById('mataKuliah');

        const mkOptionExists = [...mkSelect.options].some(opt => opt.value === data.mataKuliah);
        if (mkOptionExists) {
            mkSelect.value = data.mataKuliah;
            mkHidden.value = data.mataKuliah;
            mkInput.style.display = 'none';
            mkInput.required = false;
        } else {
            mkSelect.value = '__new__';
            mkInput.style.display = 'block';
            mkInput.value = data.mataKuliah;
            mkInput.required = true;
            mkSelect.required = false;
        }

        document.getElementById('programStudi').value = data.programStudi;
        document.getElementById('jenisKelas').value = data.jenisKelas || '';
        document.getElementById('semester').value = data.semester;
        document.getElementById('tahunAkademik').value = data.tahunAkademik;
        document.getElementById('sks').value = data.sks;
    }
}

// Delete Dosen
function deleteDosen(id) {
    if (confirm('Apakah Anda yakin ingin menghapus data ini?')) {
        dosenData = dosenData.filter(d => d.id !== id);
        saveData();
    }
}

// Open Attendance Modal
function openAttendance(id) {
    const data = dosenData.find(d => d.id === id);
    if (!data) return;

    document.getElementById('attDosenId').value = data.id;
    document.getElementById('attDosenName').innerText = formatDosenNameTitleCase(data.namaDosen);

    // Populate current attendance
    const pertemuan = data.pertemuan || Array(MAX_MEETINGS).fill({});
    for (let i = 0; i < MAX_MEETINGS; i++) {
        const m = pertemuan[i];
        document.getElementById(`tglPert${i + 1}`).value = m.date || '';
        document.getElementById(`statPert${i + 1}`).value = m.status || '';
    }

    openModal('attendanceModal');
}

// Handle Attendance Submit
function handleAttendanceSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('attDosenId').value;
    const index = dosenData.findIndex(d => d.id === id);

    if (index !== -1) {
        const pertemuan = [];
        for (let i = 1; i <= MAX_MEETINGS; i++) {
            pertemuan.push({
                date: document.getElementById(`tglPert${i}`).value,
                status: document.getElementById(`statPert${i}`).value
            });
        }
        dosenData[index].pertemuan = pertemuan;
        saveData();
        closeModal('attendanceModal');
    }
}

// Search and Filter — fetches latest data on every filter change
async function filterTable() {
    // Fetch latest data from online before filtering (skip if saving)
    if (isOnlineSyncEnabled && !isSaving) {
        try {
            const response = await fetch(`https://kvdb.io/${KVDB_BUCKET}/dosenData`);
            if (response.ok) {
                const data = await response.json();
                const newData = Array.isArray(data) ? data : Object.values(data);
                dosenData = newData;
                localStorage.setItem('dosenData', JSON.stringify(dosenData));
                populateFilters();
            }
        } catch (err) {
            // Use local data if fetch fails
        }
    }

    const query = document.getElementById('searchInput').value.toLowerCase();
    const filterTahun = document.getElementById('filterTahun') ? document.getElementById('filterTahun').value : '';
    const filterProdi = document.getElementById('filterProdi') ? document.getElementById('filterProdi').value : '';
    const filterJenisKelas = document.getElementById('filterJenisKelas') ? document.getElementById('filterJenisKelas').value : '';
    const filterDosen = document.getElementById('filterDosen') ? document.getElementById('filterDosen').value : '';
    const filterBulan = document.getElementById('filterBulan') ? document.getElementById('filterBulan').value : '';
    const filterTahunPert = document.getElementById('filterTahunPert') ? document.getElementById('filterTahunPert').value : '';

    const filteredData = dosenData.filter(d => {
        const matchesQuery = d.namaDosen.toLowerCase().includes(query) ||
            d.mataKuliah.toLowerCase().includes(query) ||
            d.programStudi.toLowerCase().includes(query);
        const matchesTahun = filterTahun === '' || d.tahunAkademik === filterTahun;
        const matchesProdi = filterProdi === '' || d.programStudi === filterProdi;
        const matchesJenisKelas = filterJenisKelas === '' || d.jenisKelas === filterJenisKelas;
        const matchesDosen = filterDosen === '' || normalizeDosenName(d.namaDosen) === normalizeDosenName(filterDosen);

        // Bulan & Tahun filter: check if any meeting date matches
        let matchesBulan = true;
        let matchesTahunPert = true;
        if (filterBulan !== '' || filterTahunPert !== '') {
            const pertemuan = d.pertemuan || [];
            if (filterBulan !== '') {
                matchesBulan = pertemuan.some(p => {
                    if (!p.date) return false;
                    const dt = new Date(p.date);
                    return !isNaN(dt) && dt.getMonth() === parseInt(filterBulan);
                });
            }
            if (filterTahunPert !== '') {
                matchesTahunPert = pertemuan.some(p => {
                    if (!p.date) return false;
                    const dt = new Date(p.date);
                    return !isNaN(dt) && dt.getFullYear() === parseInt(filterTahunPert);
                });
            }
        }

        return matchesQuery && matchesTahun && matchesProdi && matchesJenisKelas && matchesDosen && matchesBulan && matchesTahunPert;
    });
    renderTable(filteredData);
}

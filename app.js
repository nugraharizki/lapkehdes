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
    populateTahunFilter();
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

// Populate Filter
function populateTahunFilter() {
    const filterSelect = document.getElementById('filterTahun');
    if (!filterSelect) return;
    const uniqueTahun = [...new Set(dosenData.map(d => d.tahunAkademik))].filter(Boolean);
    const currentValue = filterSelect.value;

    filterSelect.innerHTML = '<option value="" style="background:var(--bg-dark); color:white;">Semua Tahun Akademik</option>';

    uniqueTahun.forEach(tahun => {
        const option = document.createElement('option');
        option.value = tahun;
        option.textContent = tahun;
        option.style.background = 'var(--bg-dark)';
        option.style.color = 'white';
        filterSelect.appendChild(option);
    });

    if (uniqueTahun.includes(currentValue)) {
        filterSelect.value = currentValue;
    }
}

// Modal Logic
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    if (modalId === 'dosenModal') {
        document.getElementById('dosenForm').reset();
        document.getElementById('dosenId').value = '';
        document.getElementById('modalTitle').innerText = 'Tambah Data Dosen';
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
    populateTahunFilter();
    renderTable();
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
            <td>${index + 1}</td>
            <td class="sticky-col-2">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
                    <strong>${item.namaDosen}</strong>
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
    const newData = {
        namaDosen: document.getElementById('namaDosen').value,
        mataKuliah: document.getElementById('mataKuliah').value,
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
        document.getElementById('namaDosen').value = data.namaDosen;
        document.getElementById('mataKuliah').value = data.mataKuliah;
        document.getElementById('programStudi').value = data.programStudi;
        document.getElementById('jenisKelas').value = data.jenisKelas || '';
        document.getElementById('semester').value = data.semester;
        document.getElementById('tahunAkademik').value = data.tahunAkademik;
        document.getElementById('sks').value = data.sks;

        document.getElementById('modalTitle').innerText = 'Edit Data Dosen';
        openModal('dosenModal');
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
    document.getElementById('attDosenName').innerText = data.namaDosen;

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

// Search and Filter
function filterTable() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const filterTahun = document.getElementById('filterTahun').value;

    const filteredData = dosenData.filter(d => {
        const matchesQuery = d.namaDosen.toLowerCase().includes(query) ||
            d.mataKuliah.toLowerCase().includes(query) ||
            d.programStudi.toLowerCase().includes(query);
        const matchesTahun = filterTahun === '' || d.tahunAkademik === filterTahun;
        return matchesQuery && matchesTahun;
    });
    renderTable(filteredData);
}

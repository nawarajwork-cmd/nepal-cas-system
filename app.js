const API_BASE = "https://cas-backend-s9ba.onrender.com/api";

let SESSION_TOKEN = localStorage.getItem('CAS_ACTIVE_JWT') || null;
let USER_ROLE = localStorage.getItem('CAS_ACTIVE_ROLE') || null;

let BACKEND_CURRICULUM_CACHE = [];
let BACKEND_ROSTER_CACHE = [];
let RUNTIME_MATRIX_SCORES = {};
let inputDebounceTimer = null;

// --- INITIAL CONTEXT HANDSHAKE ---
async function bootstrapApplicationNode() {
    const lockScreen = document.getElementById('login-modal');
    if (!SESSION_TOKEN) {
        lockScreen.style.display = 'flex';
        return;
    }
    lockScreen.style.display = 'none';
    
    await synchronizeProfilePayload();
    await fetchCloudSystemState();
}

// --- SECURE AUTHORIZATION RESOLVER (PREVENTS 400 ERROR) ---
async function runAuthPipeline() {
    const username = document.getElementById('user-input').value.trim();
    const password = document.getElementById('pass-input').value.trim();
    const errorMsg = document.getElementById('auth-error');

    if(!username || !password) {
        errorMsg.textContent = "Identity fields cannot pass empty parameters.";
        errorMsg.style.display = "block";
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }, // CRITICAL FIXED HEADER
            body: JSON.stringify({ username: username, password: password }) // BALANCED DATA KEYS
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Authentication framework mismatch rejection.");

        localStorage.setItem('CAS_ACTIVE_JWT', data.token);
        localStorage.setItem('CAS_ACTIVE_ROLE', data.role);
        
        location.reload();
    } catch (err) {
        errorMsg.textContent = err.message;
        errorMsg.style.display = 'block';
    }
}

function terminateSession() {
    localStorage.clear();
    location.reload();
}

// --- CLOUD DATABANK ROUTING SYNCHRONIZERS ---
async function synchronizeProfilePayload() {
    try {
        const res = await fetch(`${API_BASE}/profile`, { headers: { 'Authorization': `Bearer ${SESSION_TOKEN}` } });
        if(res.status === 401 || res.status === 403) terminateSession();
        const p = await res.json();

        document.getElementById('p-name').value = p.school_name || '';
        document.getElementById('p-addr').value = p.address_location || '';
        document.getElementById('p-emis').value = p.emis_code || '';
        document.getElementById('p-grade').value = p.selected_grade || '1';
        document.getElementById('p-year').value = p.academic_year || '';
        document.getElementById('p-term').value = p.evaluation_term || '';
    } catch (err) { console.error("Profile synchronization engine failure:", err); }
}

function pushProfileStream() {
    clearTimeout(inputDebounceTimer);
    inputDebounceTimer = setTimeout(async () => {
        const payload = {
            school_name: document.getElementById('p-name').value,
            address_location: document.getElementById('p-addr').value,
            emis_code: document.getElementById('p-emis').value,
            selected_grade: document.getElementById('p-grade').value,
            academic_year: document.getElementById('p-year').value,
            evaluation_term: document.getElementById('p-term').value
        };
        await fetch(`${API_BASE}/profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SESSION_TOKEN}` },
            body: JSON.stringify(payload)
        });
    }, 1000); // 1-second background throttle tracking debounce
}

async function switchDataGradeContext() {
    pushProfileStream();
    await fetchCloudSystemState();
}

async function fetchCloudSystemState() {
    const targetGrade = document.getElementById('p-grade').value;
    try {
        const curRes = await fetch(`${API_BASE}/curriculum?grade=${targetGrade}`, { headers: { 'Authorization': `Bearer ${SESSION_TOKEN}` } });
        BACKEND_CURRICULUM_CACHE = await curRes.json();

        const stdRes = await fetch(`${API_BASE}/students?grade=${targetGrade}`, { headers: { 'Authorization': `Bearer ${SESSION_TOKEN}` } });
        const stdData = await stdRes.json();

        BACKEND_ROSTER_CACHE = stdData.students;
        RUNTIME_MATRIX_SCORES = {};
        stdData.marks.forEach(m => {
            RUNTIME_MATRIX_SCORES[`${m.student_id}_${m.theme_id}`] = m.score;
        });

        renderCurriculumPanelMarkup();
    } catch (err) { console.error("Global system infrastructure synchronize interruption:", err); }
}
// Example of your login handler
async function handleLogin(username, password) {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.role);

        // THE VISIBILITY TOGGLE
        if (data.role === 'admin') {
            document.getElementById('admin-panel').style.display = 'block';
            console.log("Admin panel displayed.");
            loadAdminDashboard(); 
        } else {
            document.getElementById('admin-panel').style.display = 'none';
            alert("Logged in as Teacher");
        }
    } else {
        alert("Login failed: " + data.error);
    }
}
// --- DATA SCHEMA PARSING RECURSIONS ---
function buildNestedCurriculumMap() {
    const map = {};
    BACKEND_CURRICULUM_CACHE.forEach(r => {
        if (!map[r.subject_code]) map[r.subject_code] = { id: r.subject_id, chapters: [] };
        if (!r.chapter_id) return;

        let ch = map[r.subject_code].chapters.find(c => c.id === r.chapter_id);
        if (!ch) {
            ch = { id: r.chapter_id, name: r.chapter_name, active: r.is_active, themes: [] };
            map[r.subject_code].chapters.push(ch);
        }
        if (r.theme_id) ch.themes.push({ id: r.theme_id, name: r.theme_name });
    });
    return map;
}

// --- SETUP RENDER UI GENERATION ---
function renderCurriculumPanelMarkup() {
    const out = document.getElementById('curriculum-rendering-node');
    out.innerHTML = '';
    const map = buildNestedCurriculumMap();

    Object.keys(map).forEach(subCode => {
        const box = document.createElement('div');
        box.style.border = "1px solid #cbd5e1";
        box.style.borderRadius = "6px";
        box.style.marginBottom = "15px";
        box.style.background = "#f8fafc";

        let chHTML = '';
        map[subCode].chapters.forEach(ch => {
            let thHTML = '';
            ch.themes.forEach(th => {
                thHTML += `
                    <div style="display:flex; gap:10px; margin-bottom:5px; padding-left:25px; align-items:center;">
                        <span style="color:#cbd5e1;">⬤</span>
                        <span style="font-size:12px; color:#475569; flex:1;">${th.name}</span>
                        <button onclick="purgeNodeRecord('theme', ${th.id})" style="color:#dc2626; border:none; background:none; cursor:pointer;">✕</button>
                    </div>`;
            });

            chHTML += `
                <div style="padding:10px; margin:10px; background:#fff; border-left:4px solid #1e3a8a; border-radius:4px; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <label style="font-size:12px; font-weight:bold;"><input type="checkbox" ${ch.active?'checked':''} onchange="toggleChapterState(${ch.id}, this.checked)"> ACTIVE ROUTE</label>
                        <span style="font-weight:bold; font-size:13px; color:#1e293b;">📂 ${ch.name}</span>
                        <button onclick="purgeNodeRecord('chapter', ${ch.id})" style="padding:2px 6px; background:#fee2e2; color:#dc2626; border:none; border-radius:4px; cursor:pointer; font-size:11px;">Remove Chapter</button>
                    </div>
                    <div>${thHTML}</div>
                    <button onclick="appendThemePrompt(${ch.id})" style="margin-top:5px; font-size:11px; background:none; border:none; color:#2563eb; cursor:pointer; font-weight:bold;">+ Append Theme Variable</button>
                </div>`;
        });

        box.innerHTML = `
            <div style="background:#1e293b; color:#fff; padding:10px 15px; display:flex; justify-content:space-between; align-items:center; border-top-left-radius:5px; border-top-right-radius:5px;">
                <span style="font-weight:bold;">📚 SUBJECT CODE: ${subCode}</span>
                <div style="display:flex; gap:10px;">
                    <button onclick="appendChapterPrompt(${map[subCode].id})" style="padding:3px 8px; background:#2563eb; color:#fff; border:none; border-radius:4px; font-size:11px; cursor:pointer; font-weight:bold;">+ Add Chapter</button>
                    <button onclick="purgeNodeRecord('subject', ${map[subCode].id})" style="padding:3px 8px; background:#dc2626; color:#fff; border:none; border-radius:4px; font-size:11px; cursor:pointer;">Purge</button>
                </div>
            </div>
            <div>${chHTML}</div>`;
        out.appendChild(box);
    });
}

// Populate dropdowns with data
async function populateDropdowns() {
    const res = await fetch(`${API_BASE}/api/admin/dashboard-data`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const data = await res.json();

    const tDropdown = document.getElementById('teacher-dropdown');
    const sDropdown = document.getElementById('subject-dropdown');

    tDropdown.innerHTML = data.teachers.map(t => `<option value="${t.id}">${t.username}</option>`).join('');
    sDropdown.innerHTML = data.subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

// Submit assignment
async function submitAssignment() {
    const teacher_id = document.getElementById('teacher-dropdown').value;
    const subject_id = document.getElementById('subject-dropdown').value;

    const res = await fetch(`${API_BASE}/api/admin/assign`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({ teacher_id, subject_id })
    });

    if (res.ok) {
        alert("Assignment successful!");
        loadAdminDashboard();
    } else {
        alert("Assignment failed.");
    }
}


// --- DYNAMIC DATA CREATION ROUTERS ---
async function createNewSubjectNode() {
    const raw = prompt("Enter Unified Subject Code Target Name (e.g., MATHEMATICS, ENGLISH):");
    if(!raw) return;
    const code = raw.toUpperCase().replace(/[^A-Z_]/g, '');
    await fetch(`${API_BASE}/curriculum/subject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SESSION_TOKEN}` },
        body: JSON.stringify({ subject_code: code, grade_level: document.getElementById('p-grade').value })
    });
    await fetchCloudSystemState();
}

async function appendChapterPrompt(subId) {
    const name = prompt("Designate Chapter Module Label Name:");
    if(!name) return;
    await fetch(`${API_BASE}/curriculum/chapter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SESSION_TOKEN}` },
        body: JSON.stringify({ subject_id: subId, chapter_name: name })
    });
    await fetchCloudSystemState();
}

async function appendThemePrompt(chId) {
    const name = prompt("Paste Sub-Theme Target Milestone Parameters:");
    if(!name) return;
    await fetch(`${API_BASE}/curriculum/theme`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SESSION_TOKEN}` },
        body: JSON.stringify({ chapter_id: chId, theme_name: name })
    });
    await fetchCloudSystemState();
}

async function toggleChapterState(id, val) {
    await fetch(`${API_BASE}/curriculum/chapter/${id}/toggle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SESSION_TOKEN}` },
        body: JSON.stringify({ is_active: val })
    });
    await fetchCloudSystemState();
}

async function purgeNodeRecord(type, id) {
    if(!confirm(`Safely remove database verification target reference parameters for this ${type}?`)) return;
    await fetch(`${API_BASE}/curriculum/${type}/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${SESSION_TOKEN}` }
    });
    await fetchCloudSystemState();
}

// --- GRID ENTRY LEDGER ASSEMBLY ENGINE ---
function generateInteractiveSheetGrid() {
    const t = document.getElementById('data-sheet-matrix');
    t.innerHTML = '';
    const map = buildNestedCurriculumMap();

    let r1 = `<tr><th rowspan="3" style="background:#0f172a; color:#fff; border:1px solid #cbd5e1; padding:8px;">S.N.</th><th rowspan="3" style="background:#0f172a; color:#fff; border:1px solid #cbd5e1; padding:8px; min-width:180px;">Student Legal Full Name</th><th rowspan="3" style="background:#0f172a; color:#fff; border:1px solid #cbd5e1; padding:8px;">Roll</th>`;
    let r2 = `<tr>`;
    let r3 = `<tr>`;

    Object.keys(map).forEach(subCode => {
        let activeThemesCount = 0;
        let activeChsCount = 0;
        map[subCode].chapters.forEach(ch => {
            if(ch.active) { activeThemesCount += ch.themes.length; activeChsCount++; }
        });

        if(activeThemesCount > 0) {
            r1 += `<th colspan="${activeThemesThemes = activeThemesCount + activeChsCount}" style="background:#1e3a8a; color:#fff; border:1px solid #cbd5e1; padding:6px; text-align:center;">${subCode}</th>`;
            map[subCode].chapters.forEach(ch => {
                if(ch.active) {
                    r2 += `<th colspan="${ch.themes.length}" style="background:#334155; color:#fff; border:1px solid #cbd5e1; padding:4px; text-align:center;">${ch.name}</th>`;
                    r2 += `<th rowspan="2" style="background:#1e293b; color:#fff; border:1px solid #cbd5e1; padding:4px; font-size:10px; text-align:center;">Avg</th>`;
                    ch.themes.forEach(th => {
                        r3 += `<th style="background:#64748b; color:#fff; border:1px solid #cbd5e1; font-size:9px; padding:4px; font-weight:normal; min-width:70px; max-width:100px; white-space:normal; text-align:center;">${th.name}</th>`;
                    });
                }
            });
        }
    });

    r1 += `<th rowspan="3" style="background:#0f172a; color:#fff; border:1px solid #cbd5e1; padding:8px;">Action</th></tr>`; r2 += `</tr>`; r3 += `</tr>`;
    t.innerHTML = `<thead>${r1}${r2}${r3}</thead><tbody id="matrix-body-ledger-nodes"></tbody>`;

    renderMatrixRowInputs(map);
}

function renderMatrixRowInputs(map) {
    const tbody = document.getElementById('matrix-body-ledger-nodes');
    tbody.innerHTML = '';

    if(BACKEND_ROSTER_CACHE.length === 0) {
        tbody.innerHTML = `<tr><td colspan="40" style="text-align:center; padding:30px; color:#64748b; font-weight:bold;">No student record clusters matching grade tags. Use structural register prompts to populate rows.</td></tr>`;
        return;
    }

    BACKEND_ROSTER_CACHE.forEach((student, sIdx) => {
        const tr = document.createElement('tr');
        let cells = `
            <td style="text-align:center; font-weight:bold; border:1px solid #cbd5e1; background:#f8fafc; padding:4px;">${sIdx+1}</td>
            <td style="border:1px solid #cbd5e1; font-weight:600; color:#0f172a; padding:4px;">${student.student_name}</td>
            <td style="text-align:center; font-weight:bold; border:1px solid #cbd5e1; background:#f8fafc; padding:4px;">${student.roll_number}</td>`;

        Object.keys(map).forEach(subCode => {
            map[subCode].chapters.forEach(ch => {
                if(ch.active) {
                    let totalScoreVal = 0, themeCount = 0;
                    ch.themes.forEach(th => {
                        const mKey = `${student.id}_${th.id}`;
                        const currentScore = RUNTIME_MATRIX_SCORES[mKey] || '';
                        let nVal = parseFloat(currentScore);

                        if(!isNaN(nVal)) { totalScoreVal += nVal; themeCount++; }
                        cells += `<td style="border:1px solid #cbd5e1; text-align:center; padding:2px;"><input type="number" step="any" min="1" max="4" value="${currentScore}" style="width:45px; text-align:center; font-weight:bold; padding:2px; border:1px solid #cbd5e1;" oninput="dispatchLiveScoreTransmission(this, ${student.id}, ${th.id}, '${subCode}', ${ch.id}, ${sIdx})"></td>`;
                    });

                    let displayAvg = themeCount > 0 ? (totalScoreVal / themeCount).toFixed(2) : '—';
                    cells += `<td id="avg_node_${sIdx}_${subCode}_${ch.id}" style="border:1px solid #cbd5e1; text-align:center; font-weight:bold; background:#f1f5f9; color:#1e3a8a;">${displayAvg}</td>`;
                }
            });
        });

        cells += `<td style="text-align:center; border:1px solid #cbd5e1; padding:2px;"><button onclick="purgeStudentRecord(${student.id})" style="border:none; background:none; color:#dc2626; cursor:pointer; font-weight:bold;">✕</button></td>`;
        tr.innerHTML = cells;
        tbody.appendChild(tr);
    });
}

async function dispatchLiveScoreTransmission(inputEl, sId, thId, subCode, chId, sIdx) {
    let raw = inputEl.value.trim();
    let n = parseFloat(raw);

    if(raw !== '' && (isNaN(n) || n < 1 || n > 4)) {
        inputEl.style.borderColor = "#dc2626"; inputEl.style.background = "#fee2e2";
        return;
    }
    inputEl.style.borderColor = "#cbd5e1"; inputEl.style.background = "#fff";

    const key = `${sId}_${thId}`;
    if (raw === '') delete RUNTIME_MATRIX_SCORES[key];
    else RUNTIME_MATRIX_SCORES[key] = n;

    // Fast backplane transmission
    await fetch(`${API_BASE}/marks/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SESSION_TOKEN}` },
        body: JSON.stringify({ student_id: sId, theme_id: thId, score: raw === '' ? null : n })
    });

    // Recompute context averages inline
    const map = buildNestedCurriculumMap();
    let sum = 0, cnt = 0;
    const targetCh = map[subCode].chapters.find(c => c.id === chId);
    targetCh.themes.forEach(th => {
        let sc = RUNTIME_MATRIX_SCORES[`${sId}_${th.id}`];
        if (sc !== undefined) { sum += sc; cnt++; }
    });

    const targetCell = document.getElementById(`avg_node_${sIdx}_${subCode}_${chId}`);
    if(targetCell) targetCell.textContent = cnt > 0 ? (sum / cnt).toFixed(2) : '—';
}

async function createNewStudentNode() {
    const name = prompt("Enter Student Legal Identification Name:");
    if(!name) return;
    await fetch(`${API_BASE}/students/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SESSION_TOKEN}` },
        body: JSON.stringify({ grade: document.getElementById('p-grade').value, names: [name] })
    });
    await fetchCloudSystemState();
    generateInteractiveSheetGrid();
}

async function executeBulkImport() {
    const raw = prompt("Paste line-separated text string arrays of clean names:");
    if(!raw) return;
    const list = raw.split('\n').map(n => n.trim()).filter(n => n.length > 0);
    await fetch(`${API_BASE}/students/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SESSION_TOKEN}` },
        body: JSON.stringify({ grade: document.getElementById('p-grade').value, names: list })
    });
    await fetchCloudSystemState();
    generateInteractiveSheetGrid();
}

async function purgeStudentRecord(id) {
    if(!confirm("Purge student completely from active ledger registers? All score bindings collapse dynamically.")) return;
    await fetch(`${API_BASE}/students/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${SESSION_TOKEN}` }
    });
    await fetchCloudSystemState();
    generateInteractiveSheetGrid();
}

// --- REPORT PRINT COMPILE ASSEMBLERS ---
function fetchGradeDescriptorLetter(a) {
    if (a >= 3.6) return 'A+'; if (a >= 3.2) return 'A'; if (a >= 2.8) return 'B+'; if (a >= 2.4) return 'B';
    if (a >= 2.0) return 'C+'; if (a >= 1.6) return 'C'; if (a >= 1.2) return 'D'; return 'NG';
}

function assembleOfficialReportCards() {
    const targetArea = document.getElementById('print-assembly-node');
    targetArea.innerHTML = '';
    const map = buildNestedCurriculumMap();

    document.getElementById('print-counter-flag').textContent = `Total Compiled Packets: ${BACKEND_ROSTER_CACHE.length} Sheets ready.`;

    const sName = document.getElementById('p-name').value;
    const sAddr = document.getElementById('p-addr').value;
    const sEmis = document.getElementById('p-emis').value;
    const sGrade = document.getElementById('p-grade').value;
    const sYear = document.getElementById('p-year').value;
    const sTerm = document.getElementById('p-term').value;

    BACKEND_ROSTER_CACHE.forEach(student => {
        const card = document.createElement('div');
        card.style.background = "#fff"; card.style.width = "210mm"; card.style.minHeight = "297mm";
        card.style.padding = "20mm"; card.style.color = "#000"; card.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
        card.style.fontFamily = "'Courier New', Courier, monospace";

        let aggregatedSubjects = [];

        let tableRows = '';
        Object.keys(map).forEach(subCode => {
            let activeChs = map[subCode].chapters.filter(c => c.active);
            if(activeChs.length === 0) return;

            tableRows += `<tr style="background:#f1f5f9; font-weight:bold;"><td colspan="4" style="border:1px solid #000; padding:6px;">📚 CORE CLUSTER: ${subCode}</td></tr>`;
            let subPoints = 0, subChs = 0;

            map[subCode].chapters.forEach(ch => {
                if(!ch.active) return;
                let chSum = 0, chCnt = 0;
                let subRowThemes = '';

                ch.themes.forEach(th => {
                    let score = RUNTIME_MATRIX_SCORES[`${student.id}_${th.id}`];
                    let sDisp = '—', dDisp = 'Unevaluated';
                    if (score !== undefined) { chSum += score; chCnt++; sDisp = score.toFixed(1); dDisp = score >= 3.6 ? 'Outstanding' : score >= 2.8 ? 'Good' : 'Basic'; }
                    
                    subRowThemes += `<tr><td style="border:1px solid #000; padding:4px; padding-left:20px;">${th.name}</td><td style="border:1px solid #000; text-align:center;">${sDisp}</td><td style="border:1px solid #000; text-align:center;">—</td><td style="border:1px solid #000; font-size:10px; padding-left:6px;">${dDisp}</td></tr>`;
                });

                let chAvg = chCnt > 0 ? (chSum / chCnt) : null;
                if(chAvg) { subPoints += chAvg; subChs++; }

                tableRows += `
                    <tr style="font-weight:bold; background:#fafafa;">
                        <td style="border:1px solid #000; padding:5px;">📂 UNIT: ${ch.name}</td>
                        <td style="border:1px solid #000; text-align:center;">—</td>
                        <td style="border:1px solid #000; text-align:center; color:#1e3a8a;">${chAvg ? chAvg.toFixed(2) : '—'}</td>
                        <td style="border:1px solid #000; text-align:center;">${chAvg ? fetchGradeDescriptorLetter(chAvg) : '—'}</td>
                    </tr>` + subRowThemes;
            });

            aggregatedSubjects.push({ name: subCode, avg: subChs > 0 ? (subPoints / subChs) : null });
        });

        let summaryRows = '';
        let totalGPAVal = 0, gpaSubCount = 0;
        aggregatedSubjects.forEach(s => {
            if(s.avg) { totalGPAVal += s.avg; gpaSubCount++; }
            summaryRows += `<tr><td style="border:1px solid #000; padding:5px;"><b>${s.name}</b></td><td style="border:1px solid #000; text-align:center; font-weight:bold;">${s.avg ? s.avg.toFixed(2) : '—'}</td><td style="border:1px solid #000; text-align:center; font-weight:bold;">${s.avg ? fetchGradeDescriptorLetter(s.avg) : 'NG'}</td></tr>`;
        });

        let finalGPA = gpaSubCount > 0 ? (totalGPAVal / gpaSubCount) : 0;

        card.innerHTML = `
            <div style="text-align:center; margin-bottom:20px; text-transform:uppercase;">
                <h1 style="font-size:22px; font-weight:bold; margin:0;">${sName}</h1>
                <p style="font-size:12px; margin:2px 0;">${sAddr} | EMIS: ${sEmis}</p>
                <h3 style="font-size:14px; margin-top:10px; text-decoration:underline; font-weight:bold;">CAS INDIVIDUAL LEARNING EVALUATION DOSSIER</h3>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px; font-size:12px; border-bottom:2px solid #000; padding-bottom:10px; margin-bottom:15px;">
                <div><b>PUPIL NAME:</b> ${student.student_name.toUpperCase()}</div>
                <div><b>TARGET CLASS TRACK:</b> GRADE ${sGrade}</div>
                <div><b>REGISTERED ROLL NUMBER:</b> ${student.roll_number}</div>
                <div><b>ACADEMIC MATRIX TERM:</b> ${sYear} | ${sTerm}</div>
            </div>
            <table style="width:100%; border-collapse:collapse; font-size:11px; margin-bottom:20px;">
                <thead>
                    <tr style="background:#000; color:#fff;">
                        <th style="border:1px solid #000; padding:6px; text-align:left;">Assessment Component Cluster Mapping</th>
                        <th style="border:1px solid #000; width:12%; text-align:center;">Score</th>
                        <th style="border:1px solid #000; width:12%; text-align:center;">Avg</th>
                        <th style="border:1px solid #000; width:18%; text-align:center;">Grade</th>
                    </tr>
                </thead>
                <tbody>${tableRows}</tbody>
            </table>
            <div style="font-weight:bold; font-size:11px; margin-top:15px; background:#000; color:#fff; padding:3px 6px; text-transform:uppercase;">Subject Consolidation Matrix Summary</div>
            <table style="width:100%; border-collapse:collapse; font-size:11px; margin-top:5px;">
                <thead><tr style="background:#f1f5f9;"><th style="border:1px solid #000; padding:5px; text-align:left;">Subject Description</th><th style="border:1px solid #000; width:25%; text-align:center;">GPA Equivalent</th><th style="border:1px solid #000; width:25%; text-align:center;">Letter Grade</th></tr></thead>
                <tbody>
                    ${summaryRows}
                    <tr style="background:#e2e8f0; font-weight:bold;">
                        <td style="border:1px solid #000; padding:6px;">COMPREHENSIVE WEIGHTED CAS PERFORMANCE SCALE AVERAGE</td>
                        <td colspan="2" style="border:1px solid #000; text-align:center; font-size:13px; background:#cbd5e1;">${finalGPA > 0 ? finalGPA.toFixed(2) : '—'} (${fetchGradeDescriptorLetter(finalGPA)})</td>
                    </tr>
                </tbody>
            </table>
            <div style="display:flex; justify-content:space-between; margin-top:60px; font-size:11px;">
                <div style="border-top:1px solid #000; width:150px; text-align:center; padding-top:4px;">Class Instructor</div>
                <div style="border-top:1px solid #000; width:150px; text-align:center; padding-top:4px;">Institution Seal</div>
                <div style="border-top:1px solid #000; width:150px; text-align:center; padding-top:4px;">Headmaster / Principal</div>
            </div>`;
        
        targetArea.appendChild(card);
    });
}

// --- ACTIVE APP SHEET SHIFTER NAVIGATION ---
function shiftPanel(stepNum) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById(`st-${stepNum}`).classList.add('active');

    if (stepNum === 1) {
        renderCurriculumPanelMarkup(); document.getElementById('view-setup').classList.add('active');
    } else if (stepNum === 2) {
        generateInteractiveSheetGrid(); document.getElementById('view-marks').classList.add('active');
    } else if (stepNum === 3) {
        assembleOfficialReportCards(); document.getElementById('view-print').classList.add('active');
    }
}
// Function to create a new teacher via API
async function createNewTeacher() {
    const token = localStorage.getItem('token');
    console.log("Attempting to create teacher with token:", token); // DEBUG
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/teachers`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}` 
            }
        });

        const result = await response.json();
        console.log("Server response:", result); // DEBUG

        if (!response.ok) {
            alert(`Error: ${result.error || 'Failed to create'}`);
            return;
        }

        alert(`New Teacher Created! Username: ${result.teacher.username}`);
        loadAdminDashboard();
    } catch (err) {
        console.error("Fetch error:", err);
        alert("Check console for network error details.");
    }
}

// Ensure loadAdminDashboard() from our previous step is also here to pull the data
/**
 * Fetches and renders the Admin dashboard state.
 * Call this function whenever the Admin tab is opened or an action is completed.
 */
async function loadAdminDashboard() {
    try {
        const response = await fetch(`${API_BASE}/api/admin/dashboard-data`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (!response.ok) throw new Error('Failed to load dashboard');
        
        const data = await response.json();

        // 1. Render Teachers List
        const teacherList = document.getElementById('teacher-list-body');
        teacherList.innerHTML = data.teachers.map(t => `
            <tr>
                <td>${t.username}</td>
                <td>${t.password}</td>
            </tr>
        `).join('');

        // 2. Render Assignments Table
        const assignmentList = document.getElementById('assignment-list-body');
        assignmentList.innerHTML = data.assignments.map(a => `
            <tr>
                <td>${a.teacher_name}</td>
                <td>${a.subject_name}</td>
            </tr>
        `).join('');
        
    } catch (err) {
        console.error("Dashboard error:", err);
        alert("Could not load dashboard data.");
    }
}
async function loadAnalytics() {
    const response = await fetch(`${API_BASE}/api/admin/analytics`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const stats = await response.json();

    // Dynamically build a performance summary table
    const container = document.getElementById('analytics-container');
    container.innerHTML = stats.map(s => `
        <div class="stat-card">
            <h4>${s.subject_name}</h4>
            <p>Marks Recorded: ${s.total_marks_recorded}</p>
            <p>Class Average: ${parseFloat(s.average_score).toFixed(2)}</p>
        </div>
    `).join('');
}
/**
 * Triggers the backend to auto-generate a new teacher record
 * and adds it to the database.
 */
async function createNewTeacher() {
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/teachers`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}` 
            }
        });

        if (!response.ok) throw new Error('Failed to create teacher');

        const result = await response.json();
        alert(`New Teacher Created!\nUsername: ${result.teacher.username}\nPassword: ${result.teacher.password}`);
        
        // Refresh the dashboard to show the new teacher in the list
        loadAdminDashboard();
    } catch (err) {
        console.error(err);
        alert("Error creating teacher. Ensure you are logged in as Admin.");
    }
}
window.onload = function() { bootstrapApplicationNode(); };

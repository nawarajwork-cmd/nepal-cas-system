// CONFIGURATION HOST FRAMEWORK PIPELINE
const API_BASE = "https://cas-backend-s9ba.onrender.com/api"; // Update when web service URL is deployed

let APP_TOKEN = localStorage.getItem('CAS_SESSION_JWT') || null;
let USER_ROLE = localStorage.getItem('CAS_USER_ROLE') || null;

let RUNTIME_CURRICULUM = []; // Flat DB schema arrays tracking dynamic subjects
let RUNTIME_STUDENTS = [];   // Dynamic localized record cache maps
let RUNTIME_MARKS = {};       // Structural matrix mappings `studentID_themeID` -> score
let profileSaveTimeout = null;

// --- SESSION LIFE-CYCLE INTERCEPTORS ---
async function bootstrapSecureContext() {
    const modal = document.getElementById('login-modal');
    if (!APP_TOKEN) {
        modal.style.display = 'flex';
        return;
    }
    modal.style.display = 'none';
    document.getElementById('user-display-profile').textContent = `Authorized Mode: ${USER_ROLE}`;
    
    toggleRolePrivilegedElements();
    await loadRemoteSchoolProfile();
    await reloadLocalContextState();
}

function toggleRolePrivilegedElements() {
    const adminElements = document.querySelectorAll('.admin-only');
    adminElements.forEach(el => {
        el.style.display = (USER_ROLE === 'ADMIN') ? '' : 'none';
    });
    
    // Lock profile updates down if role validation is not Admin
    if (USER_ROLE !== 'ADMIN') {
        ['sch-name', 'sch-addr', 'sch-emis', 'sch-year', 'sch-term'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.disabled = true;
        });
    }
}

async function executeIdentityAuthentication() {
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;
    const errEl = document.getElementById('login-err');
    
    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Authentication structural fault.");
        
        localStorage.setItem('CAS_SESSION_JWT', data.token);
        localStorage.setItem('CAS_USER_ROLE', data.role);
        APP_TOKEN = data.token;
        USER_ROLE = data.role;
        
        location.reload();
    } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
    }
}

function executeSessionLogout() {
    localStorage.clear();
    location.reload();
}

// --- PIPELINE DATA CONTEXT SYNC SYNCHRONIZERS ---
async function loadRemoteSchoolProfile() {
    try {
        const res = await fetch(`${API_BASE}/profile`, { headers: { 'Authorization': `Bearer ${APP_TOKEN}` } });
        if (res.status === 401 || res.status === 403) return executeSessionLogout();
        const profile = await res.json();
        
        document.getElementById('sch-name').value = profile.school_name || '';
        document.getElementById('sch-addr').value = profile.address_location || '';
        document.getElementById('sch-emis').value = profile.emis_code || '';
        document.getElementById('sch-grade').value = profile.selected_grade || '1';
        document.getElementById('sch-year').value = profile.academic_year || '';
        document.getElementById('sch-term').value = profile.evaluation_term || '';
    } catch (err) { console.error("Profile payload mapping exception:", err); }
}

function queueProfilePersistence() {
    if (USER_ROLE !== 'ADMIN') return;
    clearTimeout(profileSaveTimeout);
    profileSaveTimeout = setTimeout(async () => {
        const payload = {
            school_name: document.getElementById('sch-name').value,
            address_location: document.getElementById('sch-addr').value,
            emis_code: document.getElementById('sch-emis').value,
            selected_grade: document.getElementById('sch-grade').value,
            academic_year: document.getElementById('sch-year').value,
            evaluation_term: document.getElementById('sch-term').value
        };
        await fetch(`${API_BASE}/profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${APP_TOKEN}` },
            body: JSON.stringify(payload)
        });
    }, 1000); // Debounce database operations by 1 second
}

async function executeContextGradeMigration() {
    queueProfilePersistence();
    await reloadLocalContextState();
    if(document.getElementById('panel-setup').classList.contains('active')) renderCurriculumStructureSetup();
}

async function reloadLocalContextState() {
    const grade = document.getElementById('sch-grade').value;
    try {
        // Fetch Curriculum
        const curRes = await fetch(`${API_BASE}/curriculum?grade=${grade}`, { headers: { 'Authorization': `Bearer ${APP_TOKEN}` } });
        RUNTIME_CURRICULUM = await curRes.json();
        
        // Fetch Students and associated scores matrix
        const stdRes = await fetch(`${API_BASE}/students?grade=${grade}`, { headers: { 'Authorization': `Bearer ${APP_TOKEN}` } });
        const stdData = await stdRes.json();
        
        RUNTIME_STUDENTS = stdData.students;
        RUNTIME_MARKS = {};
        stdData.marks.forEach(m => {
            RUNTIME_MARKS[`${m.student_id}_${m.theme_id}`] = m.score;
        });

        if (document.getElementById('panel-setup').classList.contains('active')) renderCurriculumStructureSetup();
    } catch (err) { console.error("Database structural pull failures:", err); }
}

// --- PARSING HELPERS ---
function parseCurriculumTree() {
    const tree = {};
    RUNTIME_CURRICULUM.forEach(row => {
        if (!tree[row.subject_code]) tree[row.subject_code] = { id: row.subject_id, chapters: [] };
        if (!row.chapter_id) return;
        
        let ch = tree[row.subject_code].chapters.find(c => c.id === row.chapter_id);
        if (!ch) {
            ch = { id: row.chapter_id, name: row.chapter_name, active: row.is_active, themes: [] };
            tree[row.subject_code].chapters.push(ch);
        }
        if (row.theme_id) {
            ch.themes.push({ id: row.theme_id, name: row.theme_name });
        }
    });
    return tree;
}

// --- STEP 1: UI RENDERING FOR SETUP MANAGEMENT ---
function renderCurriculumStructureSetup() {
    const container = document.getElementById('subject-mapping-container');
    container.innerHTML = '';
    const tree = parseCurriculumTree();

    Object.keys(tree).forEach(subCode => {
        const sub = tree[subCode];
        const subBox = document.createElement('div');
        subBox.className = 'subject-box';

        let chHTML = '';
        sub.chapters.forEach(ch => {
            let thHTML = '';
            ch.themes.forEach(th => {
                thHTML += `
                    <div class="theme-row">
                        <span style="color:#94a3b8; font-size:11px;">⬤</span>
                        <input type="text" value="${th.name}" disabled style="flex:1; padding:4px 8px; font-size:12px; background:#f1f5f9;">
                        <button class="btn btn-danger sm-btn admin-only" onclick="deleteCurriculumEntity('theme', ${th.id})">✕</button>
                    </div>`;
            });

            chHTML += `
                <div class="chapter-box">
                    <div class="chapter-hdr">
                        <label class="chk-container">
                            <input type="checkbox" ${ch.active ? 'checked' : ''} ${USER_ROLE !== 'ADMIN' ? 'disabled' : ''} onchange="toggleChapterState(${ch.id}, this.checked)"> Active
                        </label>
                        <input type="text" value="${ch.name}" disabled style="flex:1; font-weight:bold; font-size:13px; padding:4px 8px; background:#f1f5f9;">
                        <button class="btn btn-danger sm-btn admin-only" onclick="deleteCurriculumEntity('chapter', ${ch.id})">Remove Chapter</button>
                    </div>
                    <div class="themes-container">${thHTML}</div>
                    <button class="btn btn-s sm-btn admin-only" style="margin-left:20px; margin-top:5px;" onclick="triggerCreateTheme(${ch.id})">+ Append Sub-Theme Topic</button>
                </div>`;
        });

        subBox.innerHTML = `
            <div class="subject-hdr">
                <span>📚 ${subCode}</span>
                <div style="display:flex; gap:10px;">
                    <button class="btn btn-s sm-btn admin-only" onclick="triggerCreateChapter(${sub.id})">+ Append New Chapter Block</button>
                    <button class="btn btn-danger sm-btn admin-only" onclick="deleteCurriculumEntity('subject', ${sub.id})">Delete Entire Subject</button>
                </div>
            </div>
            <div style="padding-bottom:10px;">${chHTML}</div>`;
        container.appendChild(subBox);
    });
    toggleRolePrivilegedElements();
}

// --- ADMIN CURRICULUM MUTATOR DISPATCHERS ---
async function toggleChapterState(id, val) {
    await fetch(`${API_BASE}/curriculum/chapter/${id}/toggle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${APP_TOKEN}` },
        body: JSON.stringify({ is_active: val })
    });
    await reloadLocalContextState();
}

async function triggerCreateSubject() {
    const code = prompt("Enter Subject Code Matrix Header Name (e.g., SCIENCE, SOCIAL):");
    if (!code) return;
    const clean = code.toUpperCase().replace(/[^A-Z_]/g, '');
    const grade = document.getElementById('sch-grade').value;
    await fetch(`${API_BASE}/curriculum/subject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${APP_TOKEN}` },
        body: JSON.stringify({ subject_code: clean, grade_level: grade })
    });
    await reloadLocalContextState();
}

async function triggerCreateChapter(subId) {
    const name = prompt("Enter Chapter Unit Designation Title Name:");
    if (!name) return;
    await fetch(`${API_BASE}/curriculum/chapter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${APP_TOKEN}` },
        body: JSON.stringify({ subject_id: subId, chapter_name: name })
    });
    await reloadLocalContextState();
}

async function triggerCreateTheme(chId) {
    const name = prompt("Enter Target Subtheme Assessment Milestone Scope Name:");
    if (!name) return;
    await fetch(`${API_BASE}/curriculum/theme`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${APP_TOKEN}` },
        body: JSON.stringify({ chapter_id: chId, theme_name: name })
    });
    await reloadLocalContextState();
}

async function deleteCurriculumEntity(type, id) {
    if (!confirm(`Confirm purging targeted ${type} record module context safely?`)) return;
    await fetch(`${API_BASE}/curriculum/${type}/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${APP_TOKEN}` }
    });
    await reloadLocalContextState();
}

// --- STEP 2: LIVE SCORE GRID OPERATION FRAMEWORKS ---
function buildMarkMatrixLedger() {
    const table = document.getElementById('matrix-table');
    table.innerHTML = '';
    const tree = parseCurriculumTree();

    let h1 = `<tr><th rowspan="3" style="min-width:40px;">S.N.</th><th rowspan="3" style="min-width:180px;">Full Legal Student Name</th><th rowspan="3" style="min-width:60px;">Roll No</th>`;
    let h2 = `<tr>`;
    let h3 = `<tr>`;

    Object.keys(tree).forEach(subCode => {
        let activeThemesInSubject = 0;
        let activeChaptersInSubject = 0;
        
        tree[subCode].chapters.forEach(ch => {
            if (ch.active) {
                activeThemesInSubject += ch.themes.length;
                activeChaptersInSubject++;
            }
        });

        if (activeThemesInSubject > 0) {
            h1 += `<th colspan="${activeThemesInSubject + activeChaptersInSubject}" style="background:#1e3a8a;">${subCode}</th>`;
            tree[subCode].chapters.forEach(ch => {
                if (ch.active) {
                    h2 += `<th colspan="${ch.themes.length}" style="background:#334155;">${ch.name}</th>`;
                    h2 += `<th rowspan="2" class="ch-avg-col" style="background:#475569; color:white; font-size:10px;">Ch Avg</th>`;
                    ch.themes.forEach(th => {
                        h3 += `<th style="background:#64748b; font-size:9px; font-weight:normal; min-width:60px; max-width:90px; white-space:normal;">${th.name}</th>`;
                    });
                }
            });
        }
    });

    h1 += `<th rowspan="3" class="admin-only" style="min-width:50px;">Action</th></tr>`; h2 += `</tr>`; h3 += `</tr>`;
    table.innerHTML = `<thead>${h1}${h2}${h3}</thead><tbody id="matrix-body-rows"></tbody>`;

    renderMatrixStudentDataRows(tree);
}

function renderMatrixStudentDataRows(tree) {
    const tbody = document.getElementById('matrix-body-rows');
    tbody.innerHTML = '';

    if (RUNTIME_STUDENTS.length === 0) {
        tbody.innerHTML = `<tr><td colspan="20" style="text-align:center; padding:30px; color:#64748b;">No active records synchronized down channels. Generate rosters to execute tracking operations.</td></tr>`;
        return;
    }

    RUNTIME_STUDENTS.forEach((student, sIdx) => {
        const tr = document.createElement('tr');
        let cells = `
            <td style="text-align:center; font-weight:bold;">${sIdx + 1}</td>
            <td><input type="text" value="${student.student_name}" disabled style="font-weight:600; background:transparent; border:none; padding:0;"></td>
            <td style="text-align:center; font-weight:bold;">${student.roll_number}</td>`;

        Object.keys(tree).forEach(subCode => {
            tree[subCode].chapters.forEach(ch => {
                if (ch.active) {
                    let totalChMarks = 0;
                    let evaluatedThemesCount = 0;

                    ch.themes.forEach(th => {
                        const scoreKey = `${student.id}_${th.id}`;
                        const currentVal = RUNTIME_MARKS[scoreKey] || '';
                        let sNum = parseFloat(currentVal);
                        
                        if (!isNaN(sNum)) {
                            totalChMarks += sNum;
                            evaluatedThemesCount++;
                        }

                        cells += `<td style="text-align:center;"><input type="number" step="any" min="1" max="4" class="mark-input" value="${currentVal}" placeholder="1-4" oninput="executeLiveCellSubmission(this, ${student.id}, ${th.id}, '${subCode}', ${ch.id}, ${sIdx})"></td>`;
                    });

                    let avgDisplay = '—';
                    if (evaluatedThemesCount > 0) avgDisplay = (totalChMarks / evaluatedThemesCount).toFixed(2);
                    cells += `<td class="ch-avg-col" id="avg_${sIdx}_${subCode}_${ch.id}">${avgDisplay}</td>`;
                }
            });
        });

        cells += `<td style="text-align:center;" class="admin-only"><button class="btn btn-danger sm-btn" onclick="triggerRemoveStudent(${student.id})">✕</button></td>`;
        tr.innerHTML = cells;
        tbody.appendChild(tr);
    });
    toggleRolePrivilegedElements();
}

async function executeLiveCellSubmission(inputEl, studentId, themeId, subCode, chId, sIdx) {
    let val = inputEl.value.trim();
    let num = parseFloat(val);
    
    if (val !== '' && (isNaN(num) || num < 1 || num > 4)) {
        inputEl.classList.add('err');
        return;
    }
    inputEl.classList.remove('err');
    
    const scoreKey = `${studentId}_${themeId}`;
    if (val === '') delete RUNTIME_MARKS[scoreKey];
    else RUNTIME_MARKS[scoreKey] = num;

    // Direct background update to remote DB endpoints
    try {
        await fetch(`${API_BASE}/marks/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${APP_TOKEN}` },
            body: JSON.stringify({ student_id: studentId, theme_id: themeId, score: val === '' ? null : num })
        });
    } catch (err) { console.error("Communication loss on data streams:", err); }

    // Recompute row display UI state in real-time
    const tree = parseCurriculumTree();
    let totalChMarks = 0;
    let evaluatedThemesCount = 0;
    
    const ch = tree[subCode].chapters.find(c => c.id === chId);
    ch.themes.forEach(th => {
        let sc = RUNTIME_MARKS[`${studentId}_${th.id}`];
        if (sc !== undefined) {
            totalChMarks += sc;
            evaluatedThemesCount++;
        }
    });

    const targetCell = document.getElementById(`avg_${sIdx}_${subCode}_${chId}`);
    if (targetCell) targetCell.textContent = evaluatedThemesCount > 0 ? (totalChMarks / evaluatedThemesCount).toFixed(2) : '—';
}

async function triggerCreateStudentRow() {
    const name = prompt("Enter Full Legal Student Name:");
    if (!name) return;
    const grade = document.getElementById('sch-grade').value;
    await fetch(`${API_BASE}/students/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${APP_TOKEN}` },
        body: JSON.stringify({ grade, names: [name] })
    });
    await reloadLocalContextState();
    buildMarkMatrixLedger();
}

async function triggerBulkImportRoster() {
    const raw = prompt("Paste line-separated list of student names here:");
    if (!raw) return;
    const names = raw.split('\n').map(n => n.trim()).filter(n => n.length > 0);
    const grade = document.getElementById('sch-grade').value;
    await fetch(`${API_BASE}/students/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${APP_TOKEN}` },
        body: JSON.stringify({ grade, names })
    });
    await reloadLocalContextState();
    buildMarkMatrixLedger();
}

async function triggerRemoveStudent(id) {
    if (!confirm("Remove this student and all associated evaluation marks safely from databanks?")) return;
    await fetch(`${API_BASE}/students/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${APP_TOKEN}` }
    });
    await reloadLocalContextState();
    buildMarkMatrixLedger();
}

// --- STEP 3: CONVERGENCE ENGINE REPORT COMPILATION ---
function getCASGradeLetter(avg) {
    if (avg >= 3.6) return 'A+'; if (avg >= 3.2) return 'A'; if (avg >= 2.8) return 'B+'; if (avg >= 2.4) return 'B';
    if (avg >= 2.0) return 'C+'; if (avg >= 1.6) return 'C'; if (avg >= 1.2) return 'D'; return 'NG';
}
function getCASPerformanceDescriptor(avg) {
    if (avg >= 3.6) return 'Outstanding'; if (avg >= 3.2) return 'Excellent'; if (avg >= 2.8) return 'Very Good'; if (avg >= 2.4) return 'Good';
    if (avg >= 2.0) return 'Satisfactory'; if (avg >= 1.6) return 'Acceptable'; if (avg >= 1.2) return 'Basic'; return 'Needs Support (NG)';
}

function compileOfficialGradeSheets() {
    const area = document.getElementById('print-area');
    area.innerHTML = '';
    const tree = parseCurriculumTree();
    
    document.getElementById('print-stats').textContent = `Total Ready Records: ${RUNTIME_STUDENTS.length} Students`;
    if (RUNTIME_STUDENTS.length === 0) {
        area.innerHTML = `<div style="color:white; padding:40px; text-align:center;">No valid data available to map. Register roster metrics in Step 2.</div>`;
        return;
    }

    const schName = document.getElementById('sch-name').value;
    const schAddr = document.getElementById('sch-addr').value;
    const schEmis = document.getElementById('sch-emis').value;
    const schGrade = document.getElementById('sch-grade').value;
    const schYear = document.getElementById('sch-year').value;
    const schTerm = document.getElementById('sch-term').value;

    RUNTIME_STUDENTS.forEach(student => {
        const card = document.createElement('div');
        card.className = 'report-card';

        let headerHTML = `
            <div class="school-header">
                <div class="sch-name">${schName}</div>
                <div class="sch-addr">${schAddr}</div>
                <div style="font-size:11px; margin-top:4px; font-weight:bold;">EMIS Code: ${schEmis}</div>
                <div class="sch-title">CAS CHAPTER-WISE EVALUATION REPORT CARD</div>
            </div>
            <div class="student-info-grid">
                <div><b>STUDENT NAME:</b> ${student.student_name.toUpperCase()}</div>
                <div><b>CLASS / GRADE:</b> Grade ${schGrade}</div>
                <div><b>ROLL NUMBER:</b> ${student.roll_number}</div>
                <div><b>ACADEMIC YEAR / TERM:</b> ${schYear} | ${schTerm}</div>
            </div>`;

        let tableHTML = `
            <table class="cas-table">
                <thead>
                    <tr>
                        <th style="width: 50%;">Subject / Dynamic Chapter / Theme Metrics</th>
                        <th style="width: 15%; text-align:center;">Theme Mark (1-4)</th>
                        <th style="width: 15%; text-align:center;">Chapter Average</th>
                        <th style="width: 20%; text-align:center;">Descriptor / Grade</th>
                    </tr>
                </thead>
                <tbody>`;

        let activeSubjectsSummaryList = [];

        Object.keys(tree).forEach(subCode => {
            let activeChs = tree[subCode].chapters.filter(c => c.active);
            if (activeChs.length === 0) return;

            tableHTML += `<tr class="sub-heading-row"><td colspan="4">📚 ${subCode}</td></tr>`;
            let subjectPoints = 0, subjectChapters = 0;

            tree[subCode].chapters.forEach(ch => {
                if (!ch.active) return;
                let chSum = 0, chCount = 0;
                let themesRowsHTML = '';

                ch.themes.forEach(th => {
                    let score = RUNTIME_MARKS[`${student.id}_${th.id}`];
                    let scoreDisplay = '—', descDisplay = 'Unevaluated';

                    if (score !== undefined) {
                        chSum += score; chCount++;
                        scoreDisplay = score.toFixed(1);
                        descDisplay = getCASPerformanceDescriptor(score);
                    }
                    themesRowsHTML += `
                        <tr>
                            <td class="th-indent">${th.name}</td>
                            <td style="text-align:center;">${scoreDisplay}</td>
                            <td style="text-align:center;">—</td>
                            <td style="font-size:9px; padding-left:10px; color:#555;">${descDisplay}</td>
                        </tr>`;
                });

                let chAvgNum = chCount > 0 ? (chSum / chCount) : null;
                let chAvgStr = chAvgNum ? chAvgNum.toFixed(2) : '—';
                let chGradeStr = chAvgNum ? getCASGradeLetter(chAvgNum) : '—';

                if (chAvgNum) { subjectPoints += chAvgNum; subjectChapters++; }

                tableHTML += `
                    <tr class="ch-summary-row">
                        <td>📂 ${ch.name}</td>
                        <td style="text-align:center;">—</td>
                        <td style="text-align:center; color:var(--primary);">${chAvgStr}</td>
                        <td style="text-align:center; font-weight:bold;">${chGradeStr}</td>
                    </tr>` + themesRowsHTML;
            });

            let overallSubjectAvg = subjectChapters > 0 ? (subjectPoints / subjectChapters) : null;
            activeSubjectsSummaryList.push({ name: subCode, avg: overallSubjectAvg });
        });

        tableHTML += `</tbody></table>`;

        let summaryHTML = `
            <div style="font-weight:bold; font-size:12px; margin-top:20px; text-transform:uppercase; background:#000; color:#fff; padding:4px 8px;">Subject-Wise Aggregation Matrix Summary</div>
            <table class="summary-gpa-box">
                <thead>
                    <tr><th>Subject Title Ledger</th><th style="width:25%; text-align:center;">Aggregated Score Average</th><th style="width:25%; text-align:center;">Final Letter Grade</th></tr>
                </thead>
                <tbody>`;
        
        let cumulativePoints = 0, cumulativeSubjects = 0;
        activeSubjectsSummaryList.forEach(sub => {
            let subAvgDisplay = '—', subGradeDisplay = 'NG';
            if (sub.avg) {
                subAvgDisplay = sub.avg.toFixed(2);
                subGradeDisplay = getCASGradeLetter(sub.avg);
                cumulativePoints += sub.avg; cumulativeSubjects++;
            }
            summaryHTML += `<tr><td><b>${sub.name}</b></td><td style="text-align:center; font-weight:bold;">${subAvgDisplay}</td><td style="text-align:center; font-weight:bold; color:var(--primary);">${subGradeDisplay}</td></tr>`;
        });

        let grandCasGPA = cumulativeSubjects > 0 ? (cumulativePoints / cumulativeSubjects) : 0;
        summaryHTML += `
                <tr style="background:#eaeaea; font-weight:bold; font-size:12px;">
                    <td>OVERALL WEIGHTED CAS PERFORMANCE AVERAGE (GPA)</td>
                    <td style="text-align:center; font-size:14px; background:#d9f99d;" colspan="2">${grandCasGPA > 0 ? grandCasGPA.toFixed(2) : '—'} (${getCASGradeLetter(grandCasGPA)})</td>
                </tr>
            </tbody></table>`;

        let scaleHTML = `
            <table class="scale-table">
                <thead><tr><th>CAS Interval Score Range</th><th>Equated Letter Grade</th><th>Official Descriptor Definition</th><th>Achievement Meaning Summary Map</th></tr></thead>
                <tbody>
                    <tr><td>3.60 to 4.00</td><td>A+</td><td>Outstanding</td><td>Extremely thorough learning comprehension milestones achieved.</td></tr>
                    <tr><td>3.20 to 3.59</td><td>A</td><td>Excellent</td><td>Higher tier capability mastery across curriculum framework elements.</td></tr>
                    <tr><td>2.80 to 3.19</td><td>B+</td><td>Very Good</td><td>Solid knowledge conceptual foundation accurately sustained.</td></tr>
                    <tr><td>2.40 to 2.79</td><td>B</td><td>Good</td><td>Meets general execution criteria systematically.</td></tr>
                    <tr><td>2.00 to 2.39</td><td>C+</td><td>Satisfactory</td><td>Acceptable target criteria fulfillment tracked.</td></tr>
                    <tr><td>1.60 to 1.99</td><td>C</td><td>Acceptable</td><td>Minimum competency standard requirements met.</td></tr>
                    <tr><td>1.20 to 1.59</td><td>D</td><td>Basic</td><td>Basic understanding reached; requires continued scaffolding input.</td></tr>
                    <tr><td>Below 1.20</td><td>NG</td><td>Needs Support</td><td>Requires systematic instructional modification support.</td></tr>
                </tbody></table>`;

        let footerHTML = `<div class="signature-section"><div class="sig-line">Class Teacher Signature</div><div class="sig-line">Official School Seal</div><div class="sig-line">School Principal Approval</div></div>`;

        card.innerHTML = headerHTML + tableHTML + summaryHTML + scaleHTML + footerHTML;
        area.appendChild(card);
    });
}

// --- GLOBAL APP ROUTING MATRIX ---
function goStep(stepNum) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById(`st-${stepNum}`).classList.add('active');
    
    if (stepNum === 1) {
        renderCurriculumStructureSetup();
        document.getElementById('panel-setup').classList.add('active');
    } else if (stepNum === 2) {
        buildMarkMatrixLedger();
        document.getElementById('panel-marks').classList.add('active');
    } else if (stepNum === 3) {
        compileOfficialGradeSheets();
        document.getElementById('panel-print').classList.add('active');
    }
}

window.onload = function() {
    bootstrapSecureContext();
};
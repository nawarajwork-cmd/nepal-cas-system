// --- BACKEND ROUTING SYSTEM CONFIGURATION ---
const BACKEND_API = "https://cas-backend-s9ba.onrender.com/api";

// --- SYSTEM STATE STORAGE CONTAINER ---
let appState = {
    classes: {},    // Dynamic format: { "Grade 1": { subjects: { "NEPALI": [..], "ENGLISH": [..] } } }
    students: [],   // Format: [ { id: 123, name: "Name", class: "Grade 1", marks: { "NEPALI_C0_T0": 3 } } ]
    teachers: []    // Format: [ { id: "teacher.1", name: "Name", pass: "9876", assignments: [ { class: "Grade 1", subject: "NEPALI" } ] } ]
};

let currentUser = null; 
let currentRole = null; // "ADMIN" or "TEACHER"
let activeClassContext = ""; 
let activeSubjectContext = ""; 

// --- INITIAL DATA ORCHESTRATION ON BOOT ---
async function fetchSystemMasterState() {
    try {
        const response = await fetch(`${BACKEND_API}/admin/database-state`);
        if (response.ok) {
            const serverData = await response.json();
            if (serverData && serverData.classes) {
                appState = serverData;
            } else {
                initializeDefaultSchema();
            }
        } else {
            initializeDefaultSchema();
        }
    } catch (err) {
        console.warn("Server unavailable - establishing standalone fallback matrix layers.", err);
        initializeDefaultSchema();
    }
    populateGlobalDropdownSelectors();
    renderAdministrativeDashboards();
}

function initializeDefaultSchema() {
    appState.classes = {
        "Grade 1": {
            subjects: {
                "NEPALI": [
                    { chName: 'Chapter 1 – वर्णमाला र उच्चारण', active: true, themes: ['स्वर वर्ण र मात्रा पहिचान', 'व्यञ्जन वर्ण उच्चारण र लेखन', 'समान ध्वनि भएका शब्द वर्गीकरण'] },
                    { chName: 'Chapter 2 – शब्द भण्डार र प्रयोग', active: true, themes: ['घरायसी र सामाजिक शब्द प्रयोग', 'विपरीतार्थक शब्द पहिचान', 'सरल वाक्य निर्माण क्षमता'] }
                ],
                "ENGLISH": [
                    { chName: 'Chapter 1 – Phonics and Alphabetics', active: true, themes: ['Letter-sound correspondences', 'Decoding simple CVC words'] }
                ]
            }
        }
    };
    if (!appState.students) appState.students = [];
    if (!appState.teachers) appState.teachers = [];
}

async function pushStateToServer() {
    try {
        await fetch(`${BACKEND_API}/admin/database-state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(appState)
        });
    } catch (e) {
        console.error("Critical Cloud Sync Interruption:", e);
    }
}

// --- AUTHENTICATION CORRIDOR PROCESSING PIPELINE ---
function runAuthPipeline() {
    const userField = document.getElementById('user-input').value.trim();
    const passField = document.getElementById('pass-input').value.trim();
    const errBox = document.getElementById('auth-error');

    if (userField === 'admin' && passField === 'admin') {
        currentUser = { name: "System Administrator", id: "admin" };
        currentRole = "ADMIN";
        completeSessionAuthorization();
        return;
    }

    const teacher = appState.teachers.find(t => t.id === userField && t.pass === passField);
    if (teacher) {
        currentUser = teacher;
        currentRole = "TEACHER";
        completeSessionAuthorization();
        return;
    }

    errBox.textContent = "CRITICAL FAILURE: Invalid node credentials.";
    errBox.style.display = 'block';
}

function completeSessionAuthorization() {
    document.getElementById('login-modal').style.display = 'none';
    document.getElementById('main-application-content').style.display = 'block';
    document.getElementById('user-display-profile').textContent = `🛡️ Profile: ${currentUser.name} (${currentRole})`;
    
    const adminWrapper = document.getElementById('admin-only-dashboard-wrapper');
    const teacherWrapper = document.getElementById('teacher-welcome-dashboard-wrapper');

    if (currentRole === "ADMIN") {
        adminWrapper.style.display = "block";
        teacherWrapper.style.display = "none";
        document.getElementById('admin-add-student-row-btn').style.display = "inline-flex";
        document.getElementById('admin-bulk-student-btn').style.display = "inline-flex";
    } else {
        adminWrapper.style.display = "none";
        teacherWrapper.style.display = "block";
        document.getElementById('teacher-welcome-name').textContent = currentUser.name;
        document.getElementById('admin-add-student-row-btn').style.display = "none";
        document.getElementById('admin-bulk-student-btn').style.display = "none";
    }

    populateGlobalDropdownSelectors();
    goStep(1);
}

function terminateSession() {
    currentUser = null;
    currentRole = null;
    document.getElementById('user-input').value = '';
    document.getElementById('pass-input').value = '';
    document.getElementById('auth-error').style.display = 'none';
    document.getElementById('login-modal').style.display = 'flex';
    document.getElementById('main-application-content').style.display = 'none';
}

// --- DROPDOWN MATRIX FILL ROUTINES ---
function populateGlobalDropdownSelectors() {
    const classes = Object.keys(appState.classes);
    
    // 1. Core Controls selectors
    const classTargetSelect = document.getElementById('subject-target-class-select');
    const assignClassSelect = document.getElementById('assign-class-select');
    const globalClassSelector = document.getElementById('global-class-selector');
    
    let classOptions = "";
    classes.forEach(c => { classOptions += `<option value="${c}">${c}</option>`; });
    
    if(classTargetSelect) classTargetSelect.innerHTML = classOptions;
    if(assignClassSelect) assignClassSelect.innerHTML = classOptions;
    if(globalClassSelector) globalClassSelector.innerHTML = classOptions;

    // Populate assignment options
    const assignTeacherSelect = document.getElementById('assign-teacher-select');
    if (assignTeacherSelect) {
        let tOpts = "";
        appState.teachers.forEach(t => { tOpts += `<option value="${t.id}">${t.name}</option>`; });
        assignTeacherSelect.innerHTML = tOpts;
    }

    populateAssignSubjectDropdown();
    handleGlobalClassChange();
}

function populateAssignSubjectDropdown() {
    const cls = document.getElementById('assign-class-select').value;
    const select = document.getElementById('assign-subject-select');
    if (!cls || !appState.classes[cls] || !select) return;

    let opts = "";
    Object.keys(appState.classes[cls].subjects).forEach(s => {
        opts += `<option value="${s}">${s}</option>`;
    });
    select.innerHTML = opts;
}

function handleGlobalClassChange() {
    const cls = document.getElementById('global-class-selector').value;
    activeClassContext = cls;
    const subSelect = document.getElementById('global-subject-selector');
    if(!cls || !appState.classes[cls] || !subSelect) return;

    let opts = "";
    Object.keys(appState.classes[cls].subjects).forEach(s => {
        if (currentRole === "TEACHER") {
            const hasRule = currentUser.assignments.some(a => a.class === cls && a.subject === s);
            if (!hasRule) return;
        }
        opts += `<option value="${s}">${s}</option>`;
    });
    subSelect.innerHTML = opts;
    activeSubjectContext = subSelect.value;
    
    renderCurriculumStructureSetup();
}

function handleGlobalClassSubjectScopeReset() {
    activeSubjectContext = document.getElementById('global-subject-selector').value;
    renderCurriculumStructureSetup();
}

// --- SYSTEM CONFIGURATION METHODS (ADMIN ROUTINGS) ---
async function adminCreateClass() {
    const name = document.getElementById('new-class-input').value.trim();
    if (!name) return;
    if (appState.classes[name]) { alert("Class exists."); return; }

    appState.classes[name] = { subjects: {} };
    document.getElementById('new-class-input').value = '';
    await pushStateToServer();
    populateGlobalDropdownSelectors();
    renderAdministrativeDashboards();
}

async function adminCreateSubject() {
    const cls = document.getElementById('subject-target-class-select').value;
    const subName = document.getElementById('new-subject-input').value.trim().toUpperCase();
    if (!cls || !subName) return;

    if (!appState.classes[cls].subjects[subName]) {
        appState.classes[cls].subjects[subName] = [
            { chName: 'Chapter 1 – Unit Introduction', active: true, themes: ['Theme Core Competency Evaluation Matrix Parameters'] }
        ];
    }
    document.getElementById('new-subject-input').value = '';
    await pushStateToServer();
    populateGlobalDropdownSelectors();
    renderAdministrativeDashboards();
}

async function adminCreateTeacherAccount() {
    const name = document.getElementById('new-teacher-name').value.trim();
    if (!name) return;

    const tId = `teacher.${appState.teachers.length + 1}`;
    const newTeacher = { id: tId, name: name, pass: "9876", assignments: [] };
    appState.teachers.push(newTeacher);
    
    document.getElementById('new-teacher-name').value = '';
    await pushStateToServer();
    populateGlobalDropdownSelectors();
    renderAdministrativeDashboards();
}

async function adminAssignTeacherCourseRoute() {
    const tId = document.getElementById('assign-teacher-select').value;
    const cls = document.getElementById('assign-class-select').value;
    const sub = document.getElementById('assign-subject-select').value;
    if (!tId || !cls || !sub) return;

    const teacher = appState.teachers.find(t => t.id === tId);
    if (teacher) {
        const ruleExists = teacher.assignments.some(a => a.class === cls && a.subject === sub);
        if (!ruleExists) {
            teacher.assignments.push({ class: cls, subject: sub });
            await pushStateToServer();
            renderAdministrativeDashboards();
        }
    }
}

async function adminDeleteTeacherRow(id) {
    if(!confirm("Remove this teacher profile allocation permanently?")) return;
    appState.teachers = appState.teachers.filter(t => t.id !== id);
    await pushStateToServer();
    renderAdministrativeDashboards();
}

// --- DIRECTORY UI RENDERING MATRIX ---
function renderAdministrativeDashboards() {
    const dirBox = document.getElementById('class-directory-render-box');
    const teacherTbody = document.getElementById('teacher-directory-tbody');
    
    if(dirBox) {
        dirBox.innerHTML = '';
        Object.keys(appState.classes).forEach(cName => {
            const div = document.createElement('div');
            div.style.marginBottom = '12px';
            let subs = Object.keys(appState.classes[cName].subjects).map(s => 
                `<span class="assignment-tag">${s}</span>`
            ).join(' ');
            div.innerHTML = `<strong>📁 ${cName}:</strong><div style="margin-top:4px;">${subs || '<em style="color:#94a3b8">No subjects defined</em>'}</div>`;
            dirBox.appendChild(div);
        });
    }

    if(teacherTbody) {
        teacherTbody.innerHTML = '';
        appState.teachers.forEach(t => {
            const tr = document.createElement('tr');
            let maps = t.assignments.map(a => `${a.class} (${a.subject})`).join(', ');
            tr.innerHTML = `
                <td><b>${t.name}</b></td>
                <td><code>${t.id}</code></td>
                <td><code>${t.pass}</code></td>
                <td><small>${maps || 'None allocated'}</small></td>
                <td><button class="btn btn-danger sm-btn" onclick="adminDeleteTeacherRow('${t.id}')">✕</button></td>
            `;
            teacherTbody.appendChild(tr);
        });
    }
}

// --- PANEL STEPPER CONTROL ENGINE ---
function goStep(stepNum) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById(`st-${stepNum}`).classList.add('active');
    
    if (stepNum === 1) {
        document.getElementById('panel-admin').classList.add('active');
        renderAdministrativeDashboards();
    } else if (stepNum === 2) {
        document.getElementById('panel-setup').classList.add('active');
        if (document.getElementById('global-subject-selector').value) {
            activeSubjectContext = document.getElementById('global-subject-selector').value;
        }
        renderCurriculumStructureSetup();
    } else if (stepNum === 3) {
        document.getElementById('panel-marks').classList.add('active');
        buildMarkMatrixLedger();
    } else if (stepNum === 4) {
        document.getElementById('panel-print').classList.add('active');
        buildPrintingDashboardControls();
    }
}

// --- SUBJECT SCHEMATIC RENDERING ENGINE ---
function renderCurriculumStructureSetup() {
    const container = document.getElementById('subject-mapping-container');
    if (!container) return; container.innerHTML = '';
    
    activeClassContext = document.getElementById('global-class-selector').value;
    activeSubjectContext = document.getElementById('global-subject-selector').value;

    if (!activeClassContext || !activeSubjectContext || !appState.classes[activeClassContext]) {
        container.innerHTML = `<p style="color:#64748b; padding:10px;">No operational configurations targeted.</p>`;
        return;
    }

    const subData = appState.classes[activeClassContext].subjects[activeSubjectContext] || [];
    const subBox = document.createElement('div');
    subBox.className = 'subject-box';
    
    let chHTML = '';
    subData.forEach((ch, chIdx) => {
        let thHTML = '';
        ch.themes.forEach((th, thIdx) => {
            thHTML += `
                <div class="theme-row">
                    <span style="color:#94a3b8; font-size:11px;">⬤</span>
                    <input type="text" value="${th}" onchange="updateThemeString(${chIdx}, ${thIdx}, this.value)" style="flex:1; padding:4px 8px; font-size:12px;">
                </div>`;
        });

        chHTML += `
            <div class="chapter-box">
                <div class="chapter-hdr">
                    <label class="chk-container">
                        <input type="checkbox" ${ch.active ? 'checked' : ''} onchange="toggleChapterActive(${chIdx}, this.checked)"> Active
                    </label>
                    <input type="text" value="${ch.chName}" onchange="updateChapterString(${chIdx}, this.value)" style="flex:1; font-weight:bold; font-size:13px; padding:4px 8px;">
                </div>
                <div class="themes-container">${thHTML}</div>
            </div>`;
    });

    subBox.innerHTML = `
        <div class="subject-hdr">
            <span>📚 ${activeSubjectContext} Unit Tree Matrix Overview</span>
            <button class="btn btn-p sm-btn" onclick="addNewChapterNode()">+ Append Structural Chapter Unit</button>
        </div>
        <div style="padding-bottom:10px;">${chHTML || '<p style="padding:15px; color:#94a3b8">No chapters initialized.</p>'}</div>
    `;
    container.appendChild(subBox);
}

function addNewChapterNode() {
    if (!appState.classes[activeClassContext].subjects[activeSubjectContext]) return;
    const themesCount = prompt("How many structural themes/criteria lines are contained in this chapter?", "2");
    let arr = [];
    let count = parseInt(themesCount) || 1;
    for(let i=0; i<count; i++) { arr.push(`Assessment Evaluation Objective Guideline Rule ${i+1}`); }

    appState.classes[activeClassContext].subjects[activeSubjectContext].push({
        chName: `Chapter ${appState.classes[activeClassContext].subjects[activeSubjectContext].length + 1} — New Unit Title Spec`,
        active: true,
        themes: arr
    });
    pushStateToServer();
    renderCurriculumStructureSetup();
}

function toggleChapterActive(chIdx, val) { appState.classes[activeClassContext].subjects[activeSubjectContext][chIdx].active = val; pushStateToServer(); }
function updateChapterString(chIdx, val) { appState.classes[activeClassContext].subjects[activeSubjectContext][chIdx].chName = val; pushStateToServer(); }
function updateThemeString(chIdx, thIdx, val) { appState.classes[activeClassContext].subjects[activeSubjectContext][chIdx].themes[thIdx] = val; pushStateToServer(); }

// --- DATA ENTRY MATRIX ENGINE ---
function buildMarkMatrixLedger() {
    const table = document.getElementById('matrix-table');
    if (!table || !activeClassContext || !activeSubjectContext) return;
    table.innerHTML = '';

    const chList = appState.classes[activeClassContext].subjects[activeSubjectContext] || [];
    
    let h1 = `<tr><th rowspan="3" style="min-width:45px;">S.N.</th><th rowspan="3" style="min-width:200px;">Full Legal Student Name</th><th rowspan="3" style="min-width:70px;">Roll No</th>`;
    let h2 = `<tr>`; 
    let h3 = `<tr>`;

    let activeThemesTotal = 0;
    let activeChaptersCount = 0;

    chList.forEach(ch => {
        if (ch.active) {
            activeThemesTotal += ch.themes.length;
            activeChaptersCount++;
        }
    });

    if (activeThemesTotal > 0) {
        h1 += `<th colspan="${activeThemesTotal + activeChaptersCount}" style="background:#1e3a8a;">${activeSubjectContext} PERFORMANCE PROFILE EVALUATION MATRIX</th>`;
        chList.forEach((ch, chIdx) => {
            if (ch.active) {
                h2 += `<th colspan="${ch.themes.length}" style="background:#334155;">${ch.chName}</th><th rowspan="2" class="ch-avg-col" style="background:#475569; color:white; font-size:10px;">Ch Avg</th>`;
                ch.themes.forEach(th => { h3 += `<th style="background:#64748b; font-size:9px; min-width:80px; max-width:120px; white-space:normal;">${th}</th>`; });
            }
        });
    }

    h1 += `</tr>`; h2 += `</tr>`; h3 += `</tr>`;
    table.innerHTML = `<thead>${h1}${h2}${h3}</thead><tbody id="matrix-body-rows"></tbody>`;
    
    renderMatrixRows();
}

function renderMatrixRows() {
    const tbody = document.getElementById('matrix-body-rows');
    if (!tbody) return; tbody.innerHTML = '';

    const targetedStudents = appState.students.filter(s => s.class === activeClassContext);
    const chList = appState.classes[activeClassContext].subjects[activeSubjectContext] || [];

    targetedStudents.forEach((student, sIdx) => {
        // Find real index inside absolute tracking array
        const absoluteIdx = appState.students.findIndex(x => x.id === student.id);
        
        const tr = document.createElement('tr');
        let cells = `<td>${sIdx + 1}</td>
            <td><input type="text" value="${student.name || ''}" onchange="updateStudentMeta(${absoluteIdx}, 'name', this.value)"></td>
            <td><input type="text" value="${student.roll || ''}" onchange="updateStudentMeta(${absoluteIdx}, 'roll', this.value)"></td>`;

        chList.forEach((ch, chIdx) => {
            if (ch.active) {
                let totalChMarks = 0; let evaluatedThemesCount = 0;
                ch.themes.forEach((th, thIdx) => {
                    const scoreKey = `${activeSubjectContext}_C${chIdx}_T${thIdx}`;
                    const currentVal = student.marks[scoreKey] || '';
                    if (currentVal !== '') { totalChMarks += parseFloat(currentVal); evaluatedThemesCount++; }

                    cells += `<td><input type="number" class="mark-input" value="${currentVal}" min="1" max="4" oninput="liveValidateRecompute(this, ${absoluteIdx}, '${scoreKey}', ${chIdx})"></td>`;
                });
                cells += `<td class="ch-avg-col" id="avg_${absoluteIdx}_C${chIdx}">${evaluatedThemesCount > 0 ? (totalChMarks / evaluatedThemesCount).toFixed(2) : '—'}</td>`;
            }
        });
        
        tr.innerHTML = cells;
        tbody.appendChild(tr);
    });
}

function updateStudentMeta(absoluteIdx, field, value) {
    appState.students[absoluteIdx][field] = value;
}

function liveValidateRecompute(inputEl, absoluteIdx, scoreKey, chIdx) {
    let val = inputEl.value.trim();
    if (val === '') { 
        delete appState.students[absoluteIdx].marks[scoreKey]; 
    } else { 
        let parsed = parseFloat(val);
        if(parsed < 1 || parsed > 4) { inputEl.style.background = "#fee2e2"; return; }
        inputEl.style.background = "#fff";
        appState.students[absoluteIdx].marks[scoreKey] = parsed; 
    }
    
    let chTotal = 0; let chCount = 0;
    const chList = appState.classes[activeClassContext].subjects[activeSubjectContext] || [];
    chList[chIdx].themes.forEach((_, thIdx) => {
        let score = parseFloat(appState.students[absoluteIdx].marks[`${activeSubjectContext}_C${chIdx}_T${thIdx}`]);
        if (!isNaN(score)) { chTotal += score; chCount++; }
    });
    const indicator = document.getElementById(`avg_${absoluteIdx}_C${chIdx}`);
    if (indicator) indicator.textContent = chCount > 0 ? (chTotal / chCount).toFixed(2) : '—';
}

function addNewStudent() {
    if (!activeClassContext) return;
    appState.students.push({ id: Date.now(), name: '', roll: appState.students.filter(s=>s.class === activeClassContext).length + 1, class: activeClassContext, marks: {} });
    buildMarkMatrixLedger();
}

function importBulkStudents() {
    const raw = prompt("Enter student names separated by commas (e.g. Anil Giri, Sita Thapa):");
    if(!raw) return;
    raw.split(',').forEach(name => {
        if(name.trim()) {
            appState.students.push({ id: Date.now() + Math.random(), name: name.trim(), roll: appState.students.filter(s=>s.class === activeClassContext).length + 1, class: activeClassContext, marks: {} });
        }
    });
    buildMarkMatrixLedger();
}

async function saveActiveMarksToStorage() {
    await pushStateToServer();
    alert("Data successfully synchronized with the cloud backend database router!");
}

// --- COMPILED MARKSHEET DESK LOGIC ---
function buildPrintingDashboardControls() {
    const grid = document.getElementById('print-student-checkbox-grid');
    if(!grid) return; grid.innerHTML = '';

    const targetedStudents = appState.students.filter(s => s.class === activeClassContext);
    if(targetedStudents.length === 0) {
        grid.innerHTML = '<p style="color:#94a3b8; padding:10px;">No student records created for this class index path yet.</p>';
        return;
    }

    targetedStudents.forEach(s => {
        const div = document.createElement('div');
        div.className = 'student-select-item';
        div.innerHTML = `<label style="display:flex; gap:8px; cursor:pointer; width:100%;">
            <input type="checkbox" value="${s.id}" checked class="print-student-selector-chk">
            <span>Roll ${s.roll} - <b>${s.name || 'Unnamed Record'}</b></span>
        </label>`;
        grid.appendChild(div);
    });
    compileReportSheetsDOM();
}

function compileReportSheetsDOM() {
    const mode = document.getElementById('print-layout-mode').value;
    const printArea = document.getElementById('print-area');
    if (!printArea) return;
    printArea.innerHTML = '';

    const checkedIds = Array.from(document.querySelectorAll('.print-student-selector-chk:checked')).map(el => parseFloat(el.value));
    const targetedStudents = appState.students.filter(s => checkedIds.includes(s.id));

    targetedStudents.forEach(student => {
        const card = document.createElement('div');
        card.className = 'report-card';
        
        let reportDataHTML = "";
        if (mode === "CONSOLIDATED") {
            reportDataHTML = compileConsolidatedHTML(student);
        } else {
            reportDataHTML = compileChapterWiseHTML(student);
        }

        card.innerHTML = `
            <div>
                <div class="school-header">
                    <div class="sch-name">Sirjana English Secondary School</div>
                    <div class="sch-addr">Bharatpur-9, Chitwan, Nepal</div>
                    <div class="sch-title">CONTINUOUS ASSESSMENT SYSTEM GRADE PROFILE</div>
                </div>
                <div class="student-info-grid">
                    <div>
                        Student Name: <b>${student.name || '—'}</b><br>
                        Class Scope: <b>${student.class}</b>
                    </div>
                    <div>
                        Roll Number: <b>${student.roll || '—'}</b><br>
                        Evaluation Node Tier: <b>Annual Evaluation Summary</b>
                    </div>
                </div>
                ${reportDataHTML}
            </div>
            <div>
                <div class="signature-section">
                    <div class="sig-line">Class Teacher Desk</div>
                    <div class="sig-line">Internal CAS Auditor</div>
                    <div class="sig-line">School Principal</div>
                </div>
            </div>
        `;
        printArea.appendChild(card);
    });
}

function compileConsolidatedHTML(student) {
    let trs = "";
    const subjects = Object.keys(appState.classes[activeClassContext].subjects);

    subjects.forEach(sub => {
        let totalMarks = 0; let counts = 0;
        const chList = appState.classes[activeClassContext].subjects[sub] || [];
        
        chList.forEach((ch, chIdx) => {
            if (ch.active) {
                ch.themes.forEach((_, thIdx) => {
                    let mark = student.marks[`${sub}_C${chIdx}_T${thIdx}`];
                    if (mark !== undefined && mark !== '') { totalMarks += parseFloat(mark); counts++; }
                });
            }
        });

        let average = counts > 0 ? (totalMarks / counts).toFixed(2) : '—';
        let gradeScale = computeDescriptiveIndicator(average);

        trs += `<tr>
            <td><b>${sub}</b></td>
            <td style="text-align:center;">${counts}</td>
            <td style="text-align:center; font-weight:bold; color:#1e3a8a;">${average}</td>
            <td style="text-align:center; font-weight:bold;">${gradeScale}</td>
        </tr>`;
    });

    return `
        <table class="cas-table">
            <thead>
                <tr><th>Course Curriculums Mapped</th><th style="text-align:center;">Objectives Assessed</th><th style="text-align:center;">Aggregated Score Average</th><th style="text-align:center;">Descriptive Grade Scale</th></tr>
            </thead>
            <tbody>${trs}</tbody>
        </table>
    `;
}

function compileChapterWiseHTML(student) {
    let trs = "";
    const chList = appState.classes[activeClassContext].subjects[activeSubjectContext] || [];

    chList.forEach((ch, chIdx) => {
        if (!ch.active) return;
        trs += `<tr class="sub-heading-row"><td colspan="3">📁 ${ch.chName}</td></tr>`;
        
        let chTotal = 0; let chCount = 0;
        ch.themes.forEach((th, thIdx) => {
            let mark = student.marks[`${activeSubjectContext}_C${chIdx}_T${thIdx}`];
            let displayMark = '—';
            if (mark !== undefined && mark !== '') { 
                displayMark = mark; 
                chTotal += parseFloat(mark); 
                chCount++; 
            }
            trs += `<tr><td style="padding-left:25px;">${th}</td><td style="text-align:center; font-weight:bold;">${displayMark}</td><td></td></tr>`;
        });
        let chAvg = chCount > 0 ? (chTotal / chCount).toFixed(2) : '—';
        trs += `<tr class="ch-summary-row"><td>Unit Average Performance Node Summary</td><td style="text-align:center; background:#cbd5e1;">${chAvg}</td><td style="text-align:center;">${computeDescriptiveIndicator(chAvg)}</td></tr>`;
    });

    return `
        <h4 style="margin-bottom:8px;">Subject Focus View Profile Node: ${activeSubjectContext}</h4>
        <table class="cas-table">
            <thead>
                <tr><th>Unit Objective Matrix Rules</th><th style="text-align:center; width:100px;">Assigned Metric</th><th style="text-align:center; width:120px;">Descriptive Rank</th></tr>
            </thead>
            <tbody>${trs}</tbody>
        </table>
    `;
}

function computeDescriptiveIndicator(val) {
    let num = parseFloat(val);
    if(isNaN(num)) return "Unevaluated Core Context";
    if(num >= 3.6) return "A+ Outstanding";
    if(num >= 3.0) return "A Highly Acceptable";
    if(num >= 2.4) return "B Sufficient";
    if(num >= 1.5) return "C Developing Strategy";
    return "Insufficient Progress Framework";
}

function executeSystemPrintJob() {
    compileReportSheetsDOM();
    window.print();
}

// --- DOM REGISTRATION BOOTLOADER MAPPING ---
window.onload = function() {
    fetchSystemMasterState();
};

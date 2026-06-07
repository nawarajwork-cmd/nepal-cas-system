const API_BASE = "https://cas-backend-s9ba.onrender.com/api";

let SESSION_TOKEN = localStorage.getItem('CAS_ACTIVE_JWT') || null;
let USER_ROLE = localStorage.getItem('CAS_ACTIVE_ROLE') || null; // 'ADMIN' or 'TEACHER'
let USER_NAME = localStorage.getItem('CAS_ACTIVE_NAME') || null; // e.g., 'admin', 'teacher.1'

// --- CORE SYSTEM ARCHITECTURE STATES ---
let systemDB = {
    classes: {}, // Layout schema format: { "Grade 1": { subjects: { "NEPALI": [ chapters... ] }, students: [] } }
    teachers: [] // Layout schema format: [{ id: "teacher.1", name: "Ram Bahadur", pass: "9876", assignments: [{ class: "Grade 1", subject: "NEPALI" }] }]
};

// --- APP INIT BOOTSTRAPPING FLOW ---
function verifyIdentityContext() {
    const lockScreen = document.getElementById('login-modal');
    const mainAppDisplay = document.getElementById('main-application-content');
    const profileLabel = document.getElementById('user-display-profile');

    if (!SESSION_TOKEN || !USER_ROLE) {
        lockScreen.style.display = 'flex';
        mainAppDisplay.style.display = 'none';
        return false;
    }

    lockScreen.style.display = 'none';
    mainAppDisplay.style.display = 'block';
    profileLabel.textContent = `${USER_NAME.toUpperCase()} (${USER_ROLE})`;
    return true;
}

async function runAuthPipeline() {
    const username = document.getElementById('user-input').value.trim();
    const password = document.getElementById('pass-input').value.trim();
    const errorMsg = document.getElementById('auth-error');

    if (!username || !password) {
        errorMsg.textContent = "Please input access credentials mapping details.";
        errorMsg.style.display = 'block';
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Authentication match rejection.");

        localStorage.setItem('CAS_ACTIVE_JWT', data.token);
        localStorage.setItem('CAS_ACTIVE_ROLE', data.role); 
        localStorage.setItem('CAS_ACTIVE_NAME', username);
        
        location.reload();
    } catch (err) {
        errorMsg.textContent = err.message;
        errorMsg.style.display = 'block';
    }
}

function terminateSession() {
    localStorage.removeItem('CAS_ACTIVE_JWT');
    localStorage.removeItem('CAS_ACTIVE_ROLE');
    localStorage.removeItem('CAS_ACTIVE_NAME');
    location.reload();
}

// --- LOCAL STORAGE SNAPSHOT MANAGER ---
function loadSystemState() {
    if (!verifyIdentityContext()) return;

    const data = localStorage.getItem('SIRJANA_MULTI_CLASS_CAS_DATABASE');
    if (data) {
        systemDB = JSON.parse(data);
    } else {
        // SEED DATA FOUNDATION MOCK
        systemDB.classes = {
            "Grade 1": {
                subjects: {
                    "NEPALI": [
                        { chName: 'Chapter 1 – वर्णमाला र उच्चारण', active: true, themes: ['स्वर वर्ण र मात्रा पहिचान', 'व्यञ्जन वर्ण उच्चारण र लेखन'] }
                    ],
                    "ENGLISH": [
                        { chName: 'Chapter 1 – Alphabet Mechanics', active: true, themes: ['Letter tracking patterns', 'Vowels identification'] }
                    ]
                },
                students: [
                    { id: 101, name: "Sita Kumari Thapa", roll: 1, marks: {} },
                    { id: 102, name: "Arjun Prasad Neupane", roll: 2, marks: {} }
                ]
            }
        };
        systemDB.teachers = [
            { id: "teacher.1", name: "Ram Bahadur", pass: "9876", assignments: [{ class: "Grade 1", subject: "NEPALI" }] }
        ];
        saveSystemState();
    }

    setupUIRoleLayoutViews();
}

function saveSystemState() {
    localStorage.setItem('SIRJANA_MULTI_CLASS_CAS_DATABASE', JSON.stringify(systemDB));
}

// --- PRIVILEGES MATRIX DISPLAY LAYOUT RULES ---
function setupUIRoleLayoutViews() {
    const adminWrapper = document.getElementById('admin-only-dashboard-wrapper');
    const teacherWrapper = document.getElementById('teacher-welcome-dashboard-wrapper');
    
    if (USER_ROLE === "ADMIN") {
        adminWrapper.style.display = "block";
        teacherWrapper.style.display = "none";
        populateAdminDropdownControlPanels();
    } else {
        adminWrapper.style.display = "none";
        teacherWrapper.style.display = "block";
        document.getElementById('teacher-welcome-name').textContent = getUserTeacherProfileName();
    }

    populateGlobalClassDropdownFilters();
}

function getUserTeacherProfileName() {
    const teach = systemDB.teachers.find(t => t.id === USER_NAME);
    return teach ? teach.name : "Faculty Member";
}

// --- ADMIN CONTROL MANAGEMENT METHODS (PANEL 1) ---
function populateAdminDropdownControlPanels() {
    const targetClassSel = document.getElementById('subject-target-class-select');
    const assignTeacherSel = document.getElementById('assign-teacher-select');
    const assignClassSel = document.getElementById('assign-class-select');
    
    let classOpts = "";
    Object.keys(systemDB.classes).forEach(c => { classOpts += `<option value="${c}">${c}</option>`; });
    targetClassSel.innerHTML = classOpts;
    assignClassSel.innerHTML = classOpts;

    let teachOpts = "";
    systemDB.teachers.forEach(t => { teachOpts += `<option value="${t.id}">${t.name} (${t.id})</option>`; });
    assignTeacherSel.innerHTML = teachOpts;

    populateAssignSubjectDropdown();
    renderAdminDirectories();
}

function populateAssignSubjectDropdown() {
    const targetClass = document.getElementById('assign-class-select').value;
    const assignSubSel = document.getElementById('assign-subject-select');
    if(!targetClass || !systemDB.classes[targetClass]) return;

    let subOpts = "";
    Object.keys(systemDB.classes[targetClass].subjects).forEach(s => {
        subOpts += `<option value="${s}">${s}</option>`;
    });
    assignSubSel.innerHTML = subOpts;
}

function adminCreateClass() {
    const cName = document.getElementById('new-class-input').value.trim();
    if(!cName) return alert("Please specify Class Code.");
    if(systemDB.classes[cName]) return alert("Class context already present.");

    systemDB.classes[cName] = { subjects: {}, students: [] };
    document.getElementById('new-class-input').value = "";
    saveSystemState();
    populateAdminDropdownControlPanels();
    populateGlobalClassDropdownFilters();
}

function adminCreateSubject() {
    const targetClass = document.getElementById('subject-target-class-select').value;
    const sName = document.getElementById('new-subject-input').value.trim().toUpperCase();
    if(!targetClass || !sName) return alert("Missing form details.");
    if(systemDB.classes[targetClass].subjects[sName]) return alert("Subject already linked to class grid.");

    systemDB.classes[targetClass].subjects[sName] = [{ chName: 'Chapter 1', active: true, themes: ['Evaluation Theme Base Node'] }];
    document.getElementById('new-subject-input').value = "";
    saveSystemState();
    populateAdminDropdownControlPanels();
}

function adminCreateTeacherAccount() {
    const tName = document.getElementById('new-teacher-name').value.trim();
    if(!tName) return alert("Input Teacher Full Name.");

    const serialNum = systemDB.teachers.length + 1;
    const generatedId = `teacher.${serialNum}`;
    const defaultPass = "9876";

    systemDB.teachers.push({ id: generatedId, name: tName, pass: defaultPass, assignments: [] });
    document.getElementById('new-teacher-name').value = "";
    saveSystemState();
    populateAdminDropdownControlPanels();
}

function adminAssignTeacherCourseRoute() {
    const tId = document.getElementById('assign-teacher-select').value;
    const cName = document.getElementById('assign-class-select').value;
    const sName = document.getElementById('assign-subject-select').value;

    if(!tId || !cName || !sName) return alert("Invalid mapping pairing parameters.");
    const teacher = systemDB.teachers.find(t => t.id === tId);

    // Prevent duplicate entries
    const exists = teacher.assignments.some(a => a.class === cName && a.subject === sName);
    if(exists) return alert("Mapping route definition already active.");

    teacher.assignments.push({ class: cName, subject: sName });
    saveSystemState();
    renderAdminDirectories();
}

function adminRemoveTeacherAssignment(tId, idx) {
    const teacher = systemDB.teachers.find(t => t.id === tId);
    teacher.assignments.splice(idx, 1);
    saveSystemState();
    renderAdminDirectories();
}

function renderAdminDirectories() {
    // Render Class Structure Tree Map Display
    const dirBox = document.getElementById('class-directory-render-box');
    let dirHTML = "";
    Object.keys(systemDB.classes).forEach(cName => {
        const subs = Object.keys(systemDB.classes[cName].subjects).join(", ") || "No Subjects Linked Yet";
        const count = systemDB.classes[cName].students.length;
        dirHTML += `
            <div style="padding:10px; border:1px solid var(--border); border-radius:6px; margin-bottom:8px; background:#fafafa;">
                <div style="font-weight:bold; color:var(--primary);">${cName} <span style="font-size:11px; color:#64748b;">(${count} Students Active)</span></div>
                <div style="font-size:12px; margin-top:4px; color:#475569;"><b>Subjects:</b> ${subs}</div>
            </div>`;
    });
    dirBox.innerHTML = dirHTML || "<p style='color:#64748b;'>No classes registered via panel options.</p>";

    // Render Teacher Grid Credentials + Assignment Mapping
    const tbody = document.getElementById('teacher-directory-tbody');
    tbody.innerHTML = "";
    systemDB.teachers.forEach(t => {
        let tagsHTML = "";
        t.assignments.forEach((a, idx) => {
            tagsHTML += `
                <span class="assignment-tag">
                    ${a.class} : ${a.subject}
                    <span style="color:var(--danger); cursor:pointer; margin-left:3px;" onclick="adminRemoveTeacherAssignment('${t.id}', ${idx})">✕</span>
                </span>`;
        });

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:600;">${t.name}</td>
            <td><code style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-weight:bold; color:var(--danger);">${t.id}</code></td>
            <td><code>${t.pass}</code></td>
            <td>${tagsHTML || '<em style="color:#94a3b8; font-size:11px;">No Assignments</em>'}</td>
            <td><button class="btn btn-danger sm-btn" onclick="adminDeleteTeacherRow('${t.id}')">Delete</button></td>`;
        tbody.appendChild(tr);
    });
}

function adminDeleteTeacherRow(tId) {
    if(confirm("Confirm deletion of teacher credentials row?")) {
        systemDB.teachers = systemDB.teachers.filter(t => t.id !== tId);
        saveSystemState();
        populateAdminDropdownControlPanels();
    }
}

// --- GLOBAL SHARED RUNTIME NAVIGATION CONTROLS (PANEL 2 & 3) ---
function populateGlobalClassDropdownFilters() {
    const classSel = document.getElementById('global-class-selector');
    let opts = "";

    Object.keys(systemDB.classes).forEach(cName => {
        if (USER_ROLE === "ADMIN") {
            opts += `<option value="${cName}">${cName}</option>`;
        } else {
            // Teacher filtering scope limits
            const teacher = systemDB.teachers.find(t => t.id === USER_NAME);
            const hasClass = teacher.assignments.some(a => a.class === cName);
            if(hasClass) opts += `<option value="${cName}">${cName}</option>`;
        }
    });

    classSel.innerHTML = opts || `<option value="">No Active Class Profile Match</option>`;
    handleGlobalClassChange();
}

function handleGlobalClassChange() {
    const currentClass = document.getElementById('global-class-selector').value;
    const subSel = document.getElementById('global-subject-selector');
    let opts = "";

    if(currentClass && systemDB.classes[currentClass]) {
        Object.keys(systemDB.classes[currentClass].subjects).forEach(sName => {
            if(USER_ROLE === "ADMIN") {
                opts += `<option value="${sName}">${sName}</option>`;
            } else {
                const teacher = systemDB.teachers.find(t => t.id === USER_NAME);
                const isAssigned = teacher.assignments.some(a => a.class === currentClass && a.subject === sName);
                if(isAssigned) opts += `<option value="${sName}">${sName}</option>`;
            }
        });
    }

    subSel.innerHTML = opts || `<option value="">No Subject Action Profile Open</option>`;
    renderCurriculumStructureSetup();
}

// --- DYNAMIC CURRICULUM ACTIONS MAPPINGS (PANEL 2) ---
function renderCurriculumStructureSetup() {
    const container = document.getElementById('subject-mapping-container');
    container.innerHTML = '';

    const currentClass = document.getElementById('global-class-selector').value;
    const currentSub = document.getElementById('global-subject-selector').value;
    if(!currentClass || !currentSub) {
        container.innerHTML = `<p style="color:#64748b;">No working profile matrix is open for this account scope.</p>`;
        return;
    }

    const subData = systemDB.classes[currentClass].subjects[currentSub] || [];
    
    subData.forEach((ch, chIdx) => {
        let thHTML = '';
        ch.themes.forEach((th, thIdx) => {
            thHTML += `
                <div style="display:flex; gap:10px; align-items:center; margin-bottom:6px; padding-left:20px;">
                    <span style="color:#94a3b8; font-size:11px;">⬤</span>
                    <input type="text" value="${th}" onchange="updateThemeString('${currentClass}', '${currentSub}', ${chIdx}, ${thIdx}, this.value)" style="flex:1; padding:4px 8px; font-size:12px;">
                    <button class="btn btn-danger sm-btn" onclick="deleteTheme('${currentClass}', '${currentSub}', ${chIdx}, ${thIdx})">✕</button>
                </div>`;
        });

        const chBox = document.createElement('div');
        chBox.style = "background:#fafafa; border:1px solid var(--border); border-left:4px solid var(--primary); padding:15px; border-radius:6px; margin-bottom:15px;";
        chBox.innerHTML = `
            <div style="display:flex; gap:10px; align-items:center; margin-bottom:12px;">
                <label style="display:flex; gap:5px; font-weight:bold; font-size:12px;"><input type="checkbox" ${ch.active ? 'checked' : ''} onchange="toggleChapterActive('${currentClass}', '${currentSub}', ${chIdx}, this.checked)"> Active</label>
                <input type="text" value="${ch.chName}" onchange="updateChapterString('${currentClass}', '${currentSub}', ${chIdx}, this.value)" style="flex:1; font-weight:bold; font-size:13px; padding:4px 8px;">
                <button class="btn btn-danger sm-btn" onclick="deleteChapter('${currentClass}', '${currentSub}', ${chIdx})">Remove Chapter Unit</button>
            </div>
            <div>${thHTML}</div>
            <button class="btn btn-s sm-btn" style="margin-left:20px; margin-top:5px;" onclick="addThemeToChapter('${currentClass}', '${currentSub}', ${chIdx})">+ Append Theme Evaluation Topic</button>
        `;
        container.appendChild(chBox);
    });

    const actionRow = document.createElement('div');
    actionRow.innerHTML = `<button class="btn btn-s" onclick="addChapterToSubject('${currentClass}', '${currentSub}')">+ Append New Chapter Block</button>`;
    container.appendChild(actionRow);
}

function toggleChapterActive(c, s, chIdx, val) { systemDB.classes[c].subjects[s][chIdx].active = val; saveSystemState(); }
function updateChapterString(c, s, chIdx, val) { systemDB.classes[c].subjects[s][chIdx].chName = val; saveSystemState(); }
function updateThemeString(c, s, chIdx, thIdx, val) { systemDB.classes[c].subjects[s][chIdx].themes[thIdx] = val; saveSystemState(); }
function addThemeToChapter(c, s, chIdx) { systemDB.classes[c].subjects[s][chIdx].themes.push("New Theme Module Topic"); saveSystemState(); renderCurriculumStructureSetup(); }
function addChapterToSubject(c, s) { systemDB.classes[c].subjects[s].push({ chName: "New Progress Chapter Unit", active: true, themes: ["New Theme Module Topic"] }); saveSystemState(); renderCurriculumStructureSetup(); }
function deleteTheme(c, s, chIdx, thIdx) { systemDB.classes[c].subjects[s][chIdx].themes.splice(thIdx, 1); saveSystemState(); renderCurriculumStructureSetup(); }
function deleteChapter(c, s, chIdx) { systemDB.classes[c].subjects[s].splice(chIdx, 1); saveSystemState(); renderCurriculumStructureSetup(); }

// --- SCORE SHEET ENTRY INPUT MATRIX OPERATION CODES (PANEL 3) ---
function buildMarkMatrixLedger() {
    const table = document.getElementById('matrix-table');
    table.innerHTML = '';

    const currentClass = document.getElementById('global-class-selector').value;
    const currentSub = document.getElementById('global-subject-selector').value;
    if(!currentClass || !currentSub) {
        table.innerHTML = `<tr><td style="padding:20px; text-align:center; color:#64748b;">No subject profiles match the validation criteria.</td></tr>`;
        return;
    }

    // Hide administrative add rows options if looking at teacher profile roles
    document.getElementById('admin-add-student-row-btn').style.display = USER_ROLE === 'ADMIN' ? 'inline-flex' : 'none';
    document.getElementById('admin-bulk-student-btn').style.display = USER_ROLE === 'ADMIN' ? 'inline-flex' : 'none';

    let h1 = `<tr><th rowspan="3" style="width:45px;">S.N.</th><th rowspan="3" style="min-width:200px;">Full Legal Student Name</th><th rowspan="3" style="width:70px;">Roll No</th>`;
    let h2 = `<tr>`;
    let h3 = `<tr>`;

    const subData = systemDB.classes[currentClass].subjects[currentSub] || [];
    let activeThemes = 0; let activeChapters = 0;
    
    subData.forEach(ch => {
        if(ch.active) { activeThemes += ch.themes.length; activeChapters++; }
    });

    if(activeThemes === 0) {
        table.innerHTML = `<tr><td style="padding:20px; text-align:center; color:#64748b;">Please configure at least 1 active chapter and theme topic in Step 2 first.</td></tr>`;
        return;
    }

    h1 += `<th colspan="${activeThemes + activeChapters}" style="background:#1e3a8a;">${currentSub} (${currentClass})</th>`;
    if(USER_ROLE === "ADMIN") h1 += `<th rowspan="3" style="width:60px;">Action</th>`;
    h1 += `</tr>`;

    subData.forEach((ch, chIdx) => {
        if(ch.active) {
            h2 += `<th colspan="${ch.themes.length}" style="background:#334155;">${ch.chName}</th>`;
            h2 += `<th rowspan="2" style="background:#475569; color:white; width:65px; text-align:center;">Avg</th>`;
            ch.themes.forEach(th => { h3 += `<th style="background:#64748b; font-weight:normal; min-width:80px;">${th}</th>`; });
        }
    });
    h2 += `</tr>`; h3 += `</tr>`;

    table.innerHTML = `<thead>${h1}${h2}${h3}</thead><tbody id="matrix-body-rows"></tbody>`;
    renderMatrixStudentDataRows(currentClass, currentSub);
}

function renderMatrixStudentDataRows(currentClass, currentSub) {
    const tbody = document.getElementById('matrix-body-rows');
    tbody.innerHTML = '';

    const students = systemDB.classes[currentClass].students || [];
    const subData = systemDB.classes[currentClass].subjects[currentSub] || [];

    if(students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="20" style="padding:30px; text-align:center; color:#64748b;">No student records found in this class yet. Admin can append rows using buttons above.</td></tr>`;
        return;
    }

    students.forEach((student, sIdx) => {
        const tr = document.createElement('tr');
        let isMetaDisabled = USER_ROLE !== 'ADMIN' ? "disabled style='background:transparent; border:none; color:black; font-weight:600;'" : "";
        
        let cells = `
            <td style="text-align:center; font-weight:bold;">${sIdx + 1}</td>
            <td><input type="text" value="${student.name || ''}" placeholder="Student Name" onchange="updateStudentMeta('${currentClass}', ${sIdx}, 'name', this.value)" ${isMetaDisabled} style="font-weight:600;"></td>
            <td><input type="text" value="${student.roll || ''}" placeholder="Roll" onchange="updateStudentMeta('${currentClass}', ${sIdx}, 'roll', this.value)" ${isMetaDisabled} style="text-align:center;"></td>`;

        subData.forEach((ch, chIdx) => {
            if(ch.active) {
                let totalChMarks = 0; let evaluatedCount = 0;

                ch.themes.forEach((th, thIdx) => {
                    const scoreKey = `${currentSub}_C${chIdx}_T${thIdx}`;
                    const currentVal = student.marks[scoreKey] || '';
                    
                    let sNum = parseFloat(currentVal);
                    if(!isNaN(sNum) && sNum >= 1 && sNum <= 4) { totalChMarks += sNum; evaluatedCount++; }

                    cells += `<td style="text-align:center;"><input type="number" step="any" min="1" max="4" style="width:55px; text-align:center; font-weight:bold;" value="${currentVal}" placeholder="1-4" oninput="liveValidateRecompute(this, '${currentClass}', ${sIdx}, '${scoreKey}', '${currentSub}', ${chIdx})"></td>`;
                });

                let avgDisplay = evaluatedCount > 0 ? (totalChMarks / evaluatedCount).toFixed(2) : '—';
                cells += `<td id="avg_${sIdx}_C${chIdx}" style="background:#f1f5f9; font-weight:bold; text-align:center; color:var(--primary);">${avgDisplay}</td>`;
            }
        });

        if(USER_ROLE === "ADMIN") {
            cells += `<td style="text-align:center;"><button class="btn btn-danger sm-btn" onclick="removeStudentRow('${currentClass}', ${sIdx})">✕</button></td>`;
        }
        tr.innerHTML = cells;
        tbody.appendChild(tr);
    });
}

function updateStudentMeta(c, sIdx, field, val) {
    if(USER_ROLE !== 'ADMIN') return;
    systemDB.classes[c].students[sIdx][field] = val;
    saveSystemState();
}

function liveValidateRecompute(inputEl, c, sIdx, scoreKey, subKey, chIdx) {
    let val = inputEl.value.trim();
    if(val === '') {
        delete systemDB.classes[c].students[sIdx].marks[scoreKey];
    } else {
        let num = parseFloat(val);
        if(isNaN(num) || num < 1 || num > 4) { inputEl.style.background = "#fee2e2"; return; }
        inputEl.style.background = "";
        systemDB.classes[c].students[sIdx].marks[scoreKey] = num;
    }

    // Recompute local UI column averages row segment instantly
    const student = systemDB.classes[c].students[sIdx];
    const chData = systemDB.classes[c].subjects[subKey][chIdx];
    let chTotal = 0; let chCount = 0;

    chData.themes.forEach((_, thIdx) => {
        const targetKey = `${subKey}_C${chIdx}_T${thIdx}`;
        let score = parseFloat(student.marks[targetKey]);
        if(!isNaN(score)) { chTotal += score; chCount++; }
    });

    const indicator = document.getElementById(`avg_${sIdx}_C${chIdx}`);
    if(indicator) indicator.textContent = chCount > 0 ? (chTotal / chCount).toFixed(2) : '—';
}

function addNewStudent() {
    const c = document.getElementById('global-class-selector').value;
    if(!c || USER_ROLE !== 'ADMIN') return;
    systemDB.classes[c].students.push({ id: Date.now() + Math.random(), name: '', roll: systemDB.classes[c].students.length + 1, marks: {} });
    buildMarkMatrixLedger();
}

function removeStudentRow(c, sIdx) {
    if(USER_ROLE !== 'ADMIN') return;
    if(confirm("Delete student row entry?")) {
        systemDB.classes[c].students.splice(sIdx, 1);
        saveSystemState();
        buildMarkMatrixLedger();
    }
}

function importBulkStudents() {
    const c = document.getElementById('global-class-selector').value;
    if(!c || USER_ROLE !== 'ADMIN') return;
    const raw = prompt("Paste line-separated student names:");
    if(raw) {
        const names = raw.split('\n').map(n => n.trim()).filter(n => n.length > 0);
        names.forEach(name => {
            systemDB.classes[c].students.push({ id: Date.now() + Math.random(), name: name, roll: systemDB.classes[c].students.length + 1, marks: {} });
        });
        saveSystemState();
        buildMarkMatrixLedger();
    }
}

function saveActiveMarksToStorage() {
    saveSystemState();
    alert("Local changes successfully synchronized to storage ledger nodes.");
}

// --- BULK A4 REPORT GENERATION DISPATCH ENGINE (PANEL 4) ---
function buildPrintingDashboardControls() {
    const grid = document.getElementById('print-student-checkbox-grid');
    grid.innerHTML = "";

    const currentClass = document.getElementById('global-class-selector').value;
    if(!currentClass || !systemDB.classes[currentClass]) return;

    const students = systemDB.classes[currentClass].students || [];
    students.forEach(s => {
        const div = document.createElement('div');
        div.innerHTML = `<label style="display:flex; gap:8px; font-weight:600;"><input type="checkbox" checked class="student-print-chk" value="${s.id}" onchange="compileReportSheetsDOM()"> Roll ${s.roll} - ${s.name || 'Blank'}</label>`;
        grid.appendChild(div);
    });

    compileReportSheetsDOM();
}

function get壓CASGradeLetter(avg) {
    if (avg === null || isNaN(avg) || avg === 0) return '—';
    if (avg >= 3.6) return 'A+';
    if (avg >= 3.2) return 'A';
    if (avg >= 2.8) return 'B+';
    if (avg >= 2.4) return 'B';
    if (avg >= 2.0) return 'C+';
    if (avg >= 1.6) return 'C';
    if (avg >= 1.2) return 'D';
    return 'NG';
}

function compileReportSheetsDOM() {
    const area = document.getElementById('print-area');
    area.innerHTML = "";

    const currentClass = document.getElementById('global-class-selector').value;
    const currentSub = document.getElementById('global-subject-selector').value;
    if(!currentClass || !systemDB.classes[currentClass]) return;

    // Filter student records matching UI status selections checkboxes
    const checkedIds = Array.from(document.querySelectorAll('.student-print-chk:checked')).map(el => parseFloat(el.value));
    const targetStudents = systemDB.classes[currentClass].students.filter(s => checkedIds.includes(s.id));
    const layoutMode = document.getElementById('print-layout-mode').value;

    targetStudents.forEach(student => {
        const card = document.createElement('div');
        card.className = "report-card";

        let headHTML = `
            <div>
                <div style="text-align:center; font-weight:bold; font-size:18px; text-transform:uppercase;">SIRJANA ENGLISH SECONDARY SCHOOL</div>
                <div style="text-align:center; font-size:12px; font-weight:bold;">BHARATPUR-9, CHITWAN, NEPAL</div>
                <div style="text-align:center; font-size:13px; margin-top:10px; font-weight:bold; text-decoration:underline; color:#1e3a8a;">CONTINUOUS ASSESSMENT SYSTEM (CAS) SUMMARY REPORT CARD</div>
                
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:20px; font-size:12px; border-bottom:2px solid #000; padding-bottom:8px;">
                    <div><b>STUDENT NAME:</b> ${(student.name || '').toUpperCase()}</div>
                    <div><b>CLASS CONTEXT:</b> ${currentClass}</div>
                    <div><b>ROLL NUMBER:</b> ${student.roll || '—'}</div>
                    <div><b>EVALUATION TERM:</b> Academic Evaluation Session Summary</div>
                </div>
            </div>`;

        let bodyHTML = "";

        if(layoutMode === "CONSOLIDATED") {
            bodyHTML = `<table class="cas-table"><thead><tr style="background:#f2f2f2;"><th>Subject Course Heading Module</th><th style="text-align:center; width:25%;">Obtained GPA Average</th><th style="text-align:center; width:25%;">Letter Grade</th></tr></thead><tbody>`;
            
            Object.keys(systemDB.classes[currentClass].subjects).forEach(subKey => {
                let chList = systemDB.classes[currentClass].subjects[subKey];
                let pointsSum = 0; let evaluatedChCount = 0;

                chList.forEach((ch, chIdx) => {
                    if(!ch.active) return;
                    let thSum = 0; let thCount = 0;
                    ch.themes.forEach((_, thIdx) => {
                        let val = parseFloat(student.marks[`${subKey}_C${chIdx}_T${thIdx}`]);
                        if(!isNaN(val)) { thSum += val; thCount++; }
                    });
                    if(thCount > 0) { pointsSum += (thSum / thCount); evaluatedChCount++; }
                });

                let subAvg = evaluatedChCount > 0 ? (pointsSum / evaluatedChCount) : null;
                bodyHTML += `
                    <tr>
                        <td style="font-weight:bold; font-size:12px; padding:10px 8px;">📚 ${subKey}</td>
                        <td style="text-align:center; font-weight:bold;">${subAvg ? subAvg.toFixed(2) : '—'}</td>
                        <td style="text-align:center; font-weight:bold; color:var(--primary);">${subAvg ? get壓CASGradeLetter(subAvg) : '—'}</td>
                    </tr>`;
            });
            bodyHTML += "</tbody></table>";
        } else {
            bodyHTML = `<table class="cas-table"><thead><tr style="background:#f2f2f2;"><th>Theme-Wise Curriculum Track Parameters: ${currentSub}</th><th style="text-align:center; width:30%;">Obtained Rating (1-4)</th></tr></thead><tbody>`;
            
            const chapters = systemDB.classes[currentClass].subjects[currentSub] || [];
            chapters.forEach((ch, chIdx) => {
                if(!ch.active) return;
                bodyHTML += `<tr style="background:#f8fafc;"><td colspan="2" style="font-weight:bold; padding-left:5px;">📂 ${ch.chName}</td></tr>`;
                ch.themes.forEach((th, thIdx) => {
                    let val = parseFloat(student.marks[`${currentSub}_C${chIdx}_T${thIdx}`]);
                    bodyHTML += `<tr><td style="padding-left:25px; color:#475569;">${th}</td><td style="text-align:center; font-weight:bold; color:var(--primary);">${val ? val.toFixed(1) : '—'}</td></tr>`;
                });
            });
            bodyHTML += "</tbody></table>";
        }

        let footHTML = `
            <div style="display:flex; justify-content:space-between; margin-top:50px; font-size:11px;">
                <div style="border-top:1px solid #000; width:160px; text-align:center; padding-top:5px; font-weight:bold;">Class Teacher Signature</div>
                <div style="border-top:1px solid #000; width:160px; text-align:center; padding-top:5px; font-weight:bold;">Official School Seal</div>
                <div style="border-top:1px solid #000; width:160px; text-align:center; padding-top:5px; font-weight:bold;">School Principal Approval</div>
            </div>`;

        card.innerHTML = headHTML + bodyHTML + footHTML;
        area.appendChild(card);
    });
}

function executeSystemPrintJob() { window.print(); }

// --- PANEL LAYOUT INDEX VIEWS FLOW STATE ---
function goStep(stepNum) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById(`st-${stepNum}`).classList.add('active');
    
    if(stepNum === 1) {
        document.getElementById('panel-admin').classList.add('active');
        setupUIRoleLayoutViews();
    } else if(stepNum === 2) {
        document.getElementById('panel-setup').classList.add('active');
        renderCurriculumStructureSetup();
    } else if(stepNum === 3) {
        document.getElementById('panel-marks').classList.add('active');
        buildMarkMatrixLedger();
    } else if(stepNum === 4) {
        document.getElementById('panel-print').classList.add('active');
        buildPrintingDashboardControls();
    }
}

window.onload = function() {
    loadSystemState();
};

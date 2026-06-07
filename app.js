const API_BASE = "https://cas-backend-s9ba.onrender.com/api";

let SESSION_TOKEN = localStorage.getItem('CAS_ACTIVE_JWT') || null;
let USER_ROLE = localStorage.getItem('CAS_ACTIVE_ROLE') || null; 
let USER_NAME = localStorage.getItem('CAS_ACTIVE_NAME') || null; 

let systemDB = { classes: {}, teachers: [] };

// --- SECURE ROUTE HEADERS INJECTION CODES ---
function getHttpHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SESSION_TOKEN}`
    };
}

// --- INITIAL ENGINE SYNC & IDENTITY SECURITY CHECK ---
async function loadSystemState() {
    if (!verifyIdentityContext()) return;
    
    try {
        // Fetch the full database configurations live from your Render Backend
        const res = await fetch(`${API_BASE}/admin/database-state`, { headers: getHttpHeaders() });
        if (!res.ok) throw new Error("Could not pull cloud snapshot data.");
        
        systemDB = await res.json();
        setupUIRoleLayoutViews();
    } catch (err) {
        console.error("Database connection failure, running local fallback: ", err);
        // Fallback safety layer to load from localStorage if the server cannot connect
        const cached = localStorage.getItem('SIRJANA_MULTI_CLASS_CAS_DATABASE');
        if (cached) systemDB = JSON.parse(cached);
        setupUIRoleLayoutViews();
    }
}

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
    localStorage.clear();
    location.reload();
}

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
        const currentTeacher = systemDB.teachers.find(t => t.id === USER_NAME);
        document.getElementById('teacher-welcome-name').textContent = currentTeacher ? currentTeacher.name : "Faculty Member";
    }
    populateGlobalClassDropdownFilters();
}

// --- ADMIN SYSTEM CONFIGURATIONS ENGINE (FULL CLOUD REPLICATION DATABASE LINK) ---
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
    Object.keys(systemDB.classes[targetClass].subjects).forEach(s => { subOpts += `<option value="${s}">${s}</option>`; });
    assignSubSel.innerHTML = subOpts;
}

async function adminCreateClass() {
    const cName = document.getElementById('new-class-input').value.trim();
    if(!cName) return alert("Please specify Class Code.");

    const res = await fetch(`${API_BASE}/admin/classes`, {
        method: 'POST',
        headers: getHttpHeaders(),
        body: JSON.stringify({ className: cName })
    });
    
    if(res.ok) {
        document.getElementById('new-class-input').value = "";
        loadSystemState();
    } else { alert("Error saving class database record."); }
}

async function adminCreateSubject() {
    const targetClass = document.getElementById('subject-target-class-select').value;
    const sName = document.getElementById('new-subject-input').value.trim().toUpperCase();
    if(!targetClass || !sName) return alert("Missing form details.");

    const res = await fetch(`${API_BASE}/admin/subjects`, {
        method: 'POST',
        headers: getHttpHeaders(),
        body: JSON.stringify({ className: targetClass, subjectName: sName })
    });

    if(res.ok) {
        document.getElementById('new-subject-input').value = "";
        loadSystemState();
    } else { alert("Error saving subject module entry."); }
}

async function adminCreateTeacherAccount() {
    const tName = document.getElementById('new-teacher-name').value.trim();
    if(!tName) return alert("Input Teacher Full Name.");

    const res = await fetch(`${API_BASE}/admin/teachers`, {
        method: 'POST',
        headers: getHttpHeaders(),
        body: JSON.stringify({ name: tName })
    });

    if(res.ok) {
        document.getElementById('new-teacher-name').value = "";
        loadSystemState();
    } else { alert("Error registering teacher cloud node."); }
}

// --- MODAL DIALOG EDIT CONTROLLER LAYERS ---
function openEditTeacherModal(teacherId) {
    const teacher = systemDB.teachers.find(t => t.id === teacherId);
    if(!teacher) return alert("Account index profile mismatch.");

    document.getElementById('edit-teacher-index-id').value = teacher.id; // Record Original ID
    document.getElementById('edit-teacher-name').value = teacher.name;
    document.getElementById('edit-teacher-login-id').value = teacher.id; // Editable Login field
    document.getElementById('edit-teacher-password').value = teacher.pass;

    document.getElementById('edit-teacher-modal').style.display = 'flex';
}

function closeEditTeacherModal() {
    document.getElementById('edit-teacher-modal').style.display = 'none';
}

async function adminSubmitTeacherUpdate() {
    const originalId = document.getElementById('edit-teacher-index-id').value;
    const updatedName = document.getElementById('edit-teacher-name').value.trim();
    const updatedLoginId = document.getElementById('edit-teacher-login-id').value.trim();
    const updatedPassword = document.getElementById('edit-teacher-password').value.trim();

    if(!updatedName || !updatedLoginId || !updatedPassword) return alert("Fields cannot be empty strings.");

    // PUT request pushes properties to database
    const res = await fetch(`${API_BASE}/admin/teachers/${originalId}`, {
        method: 'PUT',
        headers: getHttpHeaders(),
        body: JSON.stringify({
            newName: updatedName,
            newLoginId: updatedLoginId,
            newPassword: updatedPassword
        })
    });

    if(res.ok) {
        closeEditTeacherModal();
        loadSystemState();
    } else {
        const errData = await res.json();
        alert("Error saving: " + (errData.error || "Server transaction error."));
    }
}

async function adminAssignTeacherCourseRoute() {
    const tId = document.getElementById('assign-teacher-select').value;
    const cName = document.getElementById('assign-class-select').value;
    const sName = document.getElementById('assign-subject-select').value;

    const res = await fetch(`${API_BASE}/admin/assignments`, {
        method: 'POST',
        headers: getHttpHeaders(),
        body: JSON.stringify({ teacherId: tId, className: cName, subjectName: sName })
    });

    if(res.ok) loadSystemState();
}

async function adminRemoveTeacherAssignment(tId, classContext, subjectContext) {
    const res = await fetch(`${API_BASE}/admin/assignments`, {
        method: 'DELETE',
        headers: getHttpHeaders(),
        body: JSON.stringify({ teacherId: tId, className: classContext, subjectName: subjectContext })
    });

    if(res.ok) loadSystemState();
}

async function adminDeleteTeacherRow(tId) {
    if(confirm("Confirm hard structural deletion of teacher credentials row from database?")) {
        const res = await fetch(`${API_BASE}/admin/teachers/${tId}`, {
            method: 'DELETE',
            headers: getHttpHeaders()
        });
        if(res.ok) loadSystemState();
    }
}

function renderAdminDirectories() {
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
    dirBox.innerHTML = dirHTML || "<p style='color:#64748b;'>No classes registered.</p>";

    const tbody = document.getElementById('teacher-directory-tbody');
    tbody.innerHTML = "";
    systemDB.teachers.forEach(t => {
        let tagsHTML = "";
        t.assignments.forEach(a => {
            tagsHTML += `
                <span class="assignment-tag">
                    ${a.class} : ${a.subject}
                    <span style="color:var(--danger); cursor:pointer; margin-left:3px;" onclick="adminRemoveTeacherAssignment('${t.id}', '${a.class}', '${a.subject}')">✕</span>
                </span>`;
        });

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:600;">${t.name}</td>
            <td><code style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-weight:bold; color:var(--danger);">${t.id}</code></td>
            <td><code>${t.pass}</code></td>
            <td>${tagsHTML || '<em>No Assignments Scope</em>'}</td>
            <td>
                <button class="btn btn-warning sm-btn" onclick="openEditTeacherModal('${t.id}')">Edit</button>
                <button class="btn btn-danger sm-btn" onclick="adminDeleteTeacherRow('${t.id}')">Delete</button>
            </td>`;
        tbody.appendChild(tr);
    });
}

// --- CURRICULUM CONFIGURATIONS & LEDGERS ---
function populateGlobalClassDropdownFilters() {
    const classSel = document.getElementById('global-class-selector');
    let opts = "";
    Object.keys(systemDB.classes).forEach(cName => {
        if (USER_ROLE === "ADMIN") {
            opts += `<option value="${cName}">${cName}</option>`;
        } else {
            const teacher = systemDB.teachers.find(t => t.id === USER_NAME);
            if(teacher && teacher.assignments.some(a => a.class === cName)) opts += `<option value="${cName}">${cName}</option>`;
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
                if(teacher && teacher.assignments.some(a => a.class === currentClass && a.subject === sName)) {
                    opts += `<option value="${sName}">${sName}</option>`;
                }
            }
        });
    }
    subSel.innerHTML = opts || `<option value="">No Profile Match</option>`;
    renderCurriculumStructureSetup();
}

function renderCurriculumStructureSetup() {
    const container = document.getElementById('subject-mapping-container');
    container.innerHTML = '';

    const currentClass = document.getElementById('global-class-selector').value;
    const currentSub = document.getElementById('global-subject-selector').value;
    if(!currentClass || !currentSub) return;

    const subData = systemDB.classes[currentClass].subjects[currentSub] || [];
    
    subData.forEach((ch, chIdx) => {
        let thHTML = '';
        ch.themes.forEach((th, thIdx) => {
            thHTML += `
                <div style="display:flex; gap:10px; align-items:center; margin-bottom:6px; padding-left:20px;">
                    <input type="text" value="${th}" onchange="updateThemeString('${currentClass}', '${currentSub}', ${chIdx}, ${thIdx}, this.value)" style="flex:1; padding:4px 8px; font-size:12px;">
                    <button class="btn btn-danger sm-btn" onclick="deleteTheme('${currentClass}', '${currentSub}', ${chIdx}, ${thIdx})">✕</button>
                </div>`;
        });

        const chBox = document.createElement('div');
        chBox.style = "background:#fafafa; border:1px solid var(--border); border-left:4px solid var(--primary); padding:15px; border-radius:6px; margin-bottom:15px;";
        chBox.innerHTML = `
            <div style="display:flex; gap:10px; align-items:center; margin-bottom:12px;">
                <label><input type="checkbox" ${ch.active ? 'checked' : ''} onchange="toggleChapterActive('${currentClass}', '${currentSub}', ${chIdx}, this.checked)"> Active</label>
                <input type="text" value="${ch.chName}" onchange="updateChapterString('${currentClass}', '${currentSub}', ${chIdx}, this.value)" style="flex:1; font-weight:bold;">
                <button class="btn btn-danger sm-btn" onclick="deleteChapter('${currentClass}', '${currentSub}', ${chIdx})">Remove Chapter</button>
            </div>
            <div>${thHTML}</div>
            <button class="btn btn-s sm-btn" style="margin-left:20px;" onclick="addThemeToChapter('${currentClass}', '${currentSub}', ${chIdx}')">+ Append Theme</button>
        `;
        container.appendChild(chBox);
    });

    const btn = document.createElement('button');
    btn.className = "btn btn-s";
    btn.textContent = "+ Append New Chapter Block";
    btn.onclick = () => addChapterToSubject(currentClass, currentSub);
    container.appendChild(btn);
}

function toggleChapterActive(c, s, chIdx, val) { systemDB.classes[c].subjects[s][chIdx].active = val; }
function updateChapterString(c, s, chIdx, val) { systemDB.classes[c].subjects[s][chIdx].chName = val; }
function updateThemeString(c, s, chIdx, thIdx, val) { systemDB.classes[c].subjects[s][chIdx].themes[thIdx] = val; }
function addThemeToChapter(c, s, chIdx) { systemDB.classes[c].subjects[s][chIdx].themes.push("New Theme Module"); renderCurriculumStructureSetup(); }
function addChapterToSubject(c, s) { systemDB.classes[c].subjects[s].push({ chName: "New Chapter", active: true, themes: ["New Theme"] }); renderCurriculumStructureSetup(); }
function deleteTheme(c, s, chIdx, thIdx) { systemDB.classes[c].subjects[s][chIdx].themes.splice(thIdx, 1); renderCurriculumStructureSetup(); }
function deleteChapter(c, s, chIdx) { systemDB.classes[c].subjects[s].splice(chIdx, 1); renderCurriculumStructureSetup(); }

// --- SCORE DATA MATRIX WORKSPACE (PANEL 3) ---
function buildMarkMatrixLedger() {
    const table = document.getElementById('matrix-table');
    table.innerHTML = '';

    const currentClass = document.getElementById('global-class-selector').value;
    const currentSub = document.getElementById('global-subject-selector').value;
    if(!currentClass || !currentSub) return;

    document.getElementById('admin-add-student-row-btn').style.display = USER_ROLE === 'ADMIN' ? 'inline-flex' : 'none';
    document.getElementById('admin-bulk-student-btn').style.display = USER_ROLE === 'ADMIN' ? 'inline-flex' : 'none';

    let h1 = `<tr><th rowspan="3">S.N.</th><th rowspan="3" style="min-width:200px;">Full Legal Student Name</th><th rowspan="3">Roll No</th>`;
    let h2 = `<tr>`; let h3 = `<tr>`;

    const subData = systemDB.classes[currentClass].subjects[currentSub] || [];
    let activeThemes = 0; let activeChapters = 0;
    subData.forEach(ch => { if(ch.active) { activeThemes += ch.themes.length; activeChapters++; } });

    if(activeThemes === 0) {
        table.innerHTML = `<tr><td style="padding:20px; text-align:center;">Configure curriculum settings in Step 2.</td></tr>`;
        return;
    }

    h1 += `<th colspan="${activeThemes + activeChapters}">${currentSub} (${currentClass})</th></tr>`;
    subData.forEach((ch, chIdx) => {
        if(ch.active) {
            h2 += `<th colspan="${ch.themes.length}">${ch.chName}</th><th rowspan="2">Avg</th>`;
            ch.themes.forEach(th => { h3 += `<th>${th}</th>`; });
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

    students.forEach((student, sIdx) => {
        const tr = document.createElement('tr');
        let isMetaDisabled = USER_ROLE !== 'ADMIN' ? "disabled" : "";
        let cells = `
            <td>${sIdx + 1}</td>
            <td><input type="text" value="${student.name || ''}" onchange="student.name=this.value" ${isMetaDisabled}></td>
            <td><input type="text" value="${student.roll || ''}" onchange="student.roll=this.value" ${isMetaDisabled}></td>`;

        subData.forEach((ch, chIdx) => {
            if(ch.active) {
                let totalChMarks = 0; let evaluatedCount = 0;
                ch.themes.forEach((th, thIdx) => {
                    const scoreKey = `${currentSub}_C${chIdx}_T${thIdx}`;
                    const currentVal = student.marks[scoreKey] || '';
                    if(currentVal !== '') { totalChMarks += parseFloat(currentVal); evaluatedCount++; }

                    cells += `<td><input type="number" step="any" min="1" max="4" style="width:55px;" value="${currentVal}" oninput="liveValidateRecompute(this, '${currentClass}', ${sIdx}, '${scoreKey}', '${currentSub}', ${chIdx})"></td>`;
                });
                let avgDisplay = evaluatedCount > 0 ? (totalChMarks / evaluatedCount).toFixed(2) : '—';
                cells += `<td id="avg_${sIdx}_C${chIdx}" style="background:#f1f5f9; font-weight:bold;">${avgDisplay}</td>`;
            }
        });
        tr.innerHTML = cells;
        tbody.appendChild(tr);
    });
}

function liveValidateRecompute(inputEl, c, sIdx, scoreKey, subKey, chIdx) {
    let val = inputEl.value.trim();
    if(val === '') delete systemDB.classes[c].students[sIdx].marks[scoreKey];
    else systemDB.classes[c].students[sIdx].marks[scoreKey] = parseFloat(val);
}

function addNewStudent() {
    const c = document.getElementById('global-class-selector').value;
    systemDB.classes[c].students.push({ id: Date.now(), name: '', roll: systemDB.classes[c].students.length + 1, marks: {} });
    buildMarkMatrixLedger();
}

function importBulkStudents() {
    const c = document.getElementById('global-class-selector').value;
    const raw = prompt("Paste student names (separated by new lines):");
    if(raw) {
        raw.split('\n').forEach(name => {
            if(name.trim()) systemDB.classes[c].students.push({ id: Date.now()+Math.random(), name: name.trim(), roll: systemDB.classes[c].students.length + 1, marks: {} });
        });
        buildMarkMatrixLedger();
    }
}

// --- SAVE ENTIRE DATA ARRAY PACKAGE TO CLOUD ---
async function saveActiveMarksToStorage() {
    try {
        const res = await fetch(`${API_BASE}/admin/database-state`, {
            method: 'POST',
            headers: getHttpHeaders(),
            body: JSON.stringify(systemDB)
        });
        if(res.ok) alert("All structural configurations and student marks synced to cloud database.");
        else alert("Sync operation rejected by server database pipelines.");
    } catch (err) {
        alert("Database connection offline.");
    }
}

// --- NAVIGATION LAYOUT MANAGER ---
function goStep(stepNum) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById(`st-${stepNum}`).classList.add('active');
    
    if(stepNum === 1) { document.getElementById('panel-admin').classList.add('active'); renderAdminDirectories(); }
    else if(stepNum === 2) { document.getElementById('panel-setup').classList.add('active'); renderCurriculumStructureSetup(); }
    else if(stepNum === 3) { document.getElementById('panel-marks').classList.add('active'); buildMarkMatrixLedger(); }
    else if(stepNum === 4) { document.getElementById('panel-print').classList.add('active'); }
}

window.onload = function() { loadSystemState(); };

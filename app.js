// --- CORE CONFIGURATION & CONSTANTS ---
const BACKEND_API = "https://cas-backend-s9ba.onrender.com/api";

// Main Reactive State Matrix
let db = {
    classes: {},       
    teachers: [],      
    students: {}       
};

let currentUser = null; 

// --- ACTIVE CLOUD SERVER STATE HANDSHAKE RETRIEVAL ---
async function loadSystemStateFromServer() {
    try {
        const response = await fetch(`${BACKEND_API}/admin/database-state`);
        if (response.ok) {
            const serverData = await response.json();
            if (serverData) {
                db.classes = serverData.classes || {};
                db.teachers = serverData.teachers || [];
                db.students = serverData.students || {};
            }
        }
    } catch (err) {
        console.error("Cloud engine handshake offline. Local engine layer rollback fallback active.", err);
    }

    // CRITICAL ENGINE REFRESH TRIGGERS: Force instant local element updates across screens
    refreshControlPanelDropdownsAndViews();
    refreshCurriculumDropdownSelectors();
    renderCurriculumStructureSetup();
    buildMarkMatrixLedger();
    buildPrintingDashboardControls();
}

// Bulk state fallback utility for nested mark matrix changes
async function syncStateToBackendCloud() {
    try {
        await fetch(`${BACKEND_API}/admin/database-state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(db)
        });
    } catch (e) {
        console.error("Failed to sync structural changes to remote server clusters:", e);
    }
}

// --- ADMINISTRATIVE DATA ACTION OPERATIONS WITH LIFECYCLE REFRESHES ---

async function adminCreateClass() {
    const inp = document.getElementById('new-class-input');
    const className = inp.value.trim();
    if (!className) return;

    try {
        const response = await fetch(`${BACKEND_API}/admin/classes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ className })
        });
        
        if (!response.ok) {
            const errData = await response.json();
            alert(errData.error || "Failed to commit class creation structural layer.");
            return;
        }

        inp.value = "";
        // Immediately fetch clean cloud server state and trigger page layout refreshes
        await loadSystemStateFromServer();
    } catch (err) {
        console.error("Network communication failure handling class storage creation:", err);
    }
}

async function adminCreateSubject() {
    const className = document.getElementById('subject-target-class-select').value;
    const inp = document.getElementById('new-subject-input');
    const subjectName = inp.value.trim().toUpperCase();
    
    if (!className || !subjectName) return;

    try {
        const response = await fetch(`${BACKEND_API}/admin/subjects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ className, subjectName })
        });

        if (!response.ok) {
            const errData = await response.json();
            alert(errData.error || "Failed to link course subject structure mapping target.");
            return;
        }

        inp.value = "";
        // Immediately pull clean data down and trigger internal directory rebuilds
        await loadSystemStateFromServer();
    } catch (err) {
        console.error("Network failure allocating unique system subject row:", err);
    }
}

async function adminCreateTeacherAccount() {
    const inp = document.getElementById('new-teacher-name');
    const name = inp.value.trim();
    if (!name) return;

    try {
        const response = await fetch(`${BACKEND_API}/admin/teachers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });

        if (!response.ok) {
            const errData = await response.json();
            alert(errData.error || "Failed to finalize structural teacher row entry.");
            return;
        }

        inp.value = "";
        // Fetch new teacher dataset arrays instantly to update access rosters
        await loadSystemStateFromServer();
    } catch (err) {
        console.error("Network interface error registering system faculty account:", err);
    }
}

async function adminAssignTeacherCourseRoute() {
    const tId = document.getElementById('assign-teacher-select').value;
    const className = document.getElementById('assign-class-select').value;
    const subjectName = document.getElementById('assign-subject-select').value;

    if (!tId || !className || !subjectName) { 
        alert("Ensure valid criteria selections across all allocation registry pairs."); 
        return; 
    }

    try {
        const response = await fetch(`${BACKEND_API}/admin/assignments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teacherId: tId, className, subjectName })
        });

        if (!response.ok) {
            const errData = await response.json();
            alert(errData.error || "Failed mapping routing matrix link.");
            return;
        }

        // Complete state lifecycle pull and drop-down option sync
        await loadSystemStateFromServer();
    } catch (err) {
        console.error("Network exception committing structural configuration mapping pairing:", err);
    }
}

async function adminDeleteTeacher(id) {
    if(!confirm("Purge selected faculty profile registry permanently?")) return;
    try {
        const response = await fetch(`${BACKEND_API}/admin/teachers/${id}`, { method: 'DELETE' });
        if(response.ok) {
            await loadSystemStateFromServer();
        }
    } catch (err) {
        console.error("Error executing collection row removal operation:", err);
    }
}

async function adminSubmitTeacherUpdate() {
    const id = document.getElementById('edit-teacher-index-id').value;
    const name = document.getElementById('edit-teacher-name').value.trim();
    const pass = document.getElementById('edit-teacher-password').value.trim();

    try {
        const response = await fetch(`${BACKEND_API}/admin/teachers/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, pass })
        });
        if(response.ok) {
            closeEditTeacherModal();
            await loadSystemStateFromServer();
        }
    } catch(err) {
        console.error("Error committing individual profile edits:", err);
    }
}

// --- FRONTEND COMPONENT RENDER ENGINE MANIPULATION ---

function refreshControlPanelDropdownsAndViews() {
    const classList = Object.keys(db.classes || {});
    
    // 1. Target Class Selection Dropdown
    const targetClassSel = document.getElementById('subject-target-class-select');
    if (targetClassSel) {
        targetClassSel.innerHTML = "";
        classList.forEach(c => {
            let opt = document.createElement('option');
            opt.value = c; opt.textContent = c;
            targetClassSel.appendChild(opt);
        });
    }

    // 2. Assignment Section Class Selection Dropdown
    const assignClassSel = document.getElementById('assign-class-select');
    if (assignClassSel) {
        const previousAssignClassVal = assignClassSel.value;
        assignClassSel.innerHTML = "";
        classList.forEach(c => {
            let opt = document.createElement('option');
            opt.value = c; opt.textContent = c;
            assignClassSel.appendChild(opt);
        });
        if (previousAssignClassVal && classList.includes(previousAssignClassVal)) {
            assignClassSel.value = previousAssignClassVal;
        }
    }
    populateAssignSubjectDropdown();

    // 3. Teacher Allocation Account Picklists
    const assignTeacherSel = document.getElementById('assign-teacher-select');
    if (assignTeacherSel) {
        assignTeacherSel.innerHTML = "";
        (db.teachers || []).forEach(t => {
            let opt = document.createElement('option');
            opt.value = t.id; opt.textContent = t.name;
            assignTeacherSel.appendChild(opt);
        });
    }

    // 4. Structural Setup Core School Lookups Block Render
    const dirBox = document.getElementById('class-directory-render-box');
    if (dirBox) {
        dirBox.innerHTML = "";
        if (classList.length === 0) {
            dirBox.innerHTML = `<p style="color:#64748b; font-size:12px;">No active classes or subjects configured on server database tier nodes.</p>`;
        } else {
            classList.forEach(className => {
                let subjectsList = Object.keys(db.classes[className].subjects || {});
                let row = document.createElement('div');
                row.style.marginBottom = "10px";
                row.innerHTML = `<strong>🏫 ${className}</strong>: ${subjectsList.length > 0 ? subjectsList.map(s => `<span class="assignment-tag">${s}</span>`).join('') : '<em style="color:#94a3b8">No course modules registered</em>'}`;
                dirBox.appendChild(row);
            });
        }
    }

    // 5. Build Registered Teacher Row Matrix Directory Rows
    const teacherTbody = document.getElementById('teacher-directory-tbody');
    if (teacherTbody) {
        teacherTbody.innerHTML = "";
        if (!db.teachers || db.teachers.length === 0) {
            teacherTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#64748b;">No faculty members registered.</td></tr>`;
        } else {
            db.teachers.forEach(t => {
                let tags = (t.assignments || []).map(a => `<span class="assignment-tag">${a.class} (${a.subject})</span>`).join('');
                let tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${t.name}</strong></td>
                    <td><code>${t.id}</code></td>
                    <td><code>${t.pass}</code></td>
                    <td>${tags || '<em style="color:#94a3b8">No Assigned Active Paths</em>'}</td>
                    <td>
                        <button class="btn btn-p sm-btn" onclick="openEditTeacherModal('${t.id}', '${t.name}', '${t.pass}')">✏️ Edit</button>
                        <button class="btn btn-danger sm-btn" onclick="adminDeleteTeacher('${t.id}')">✕</button>
                    </td>
                `;
                teacherTbody.appendChild(tr);
            });
        }
    }
}

function populateAssignSubjectDropdown() {
    const classSelectEl = document.getElementById('assign-class-select');
    const subSel = document.getElementById('assign-subject-select');
    if (!classSelectEl || !subSel) return;
    
    const targetClass = classSelectEl.value;
    subSel.innerHTML = "";
    if (targetClass && db.classes[targetClass] && db.classes[targetClass].subjects) {
        Object.keys(db.classes[targetClass].subjects).forEach(s => {
            let opt = document.createElement('option');
            opt.value = s; opt.textContent = s;
            subSel.appendChild(opt);
        });
    }
}

// --- CURRICULUM SETUP CONTROLS PANEL ROUTING ---

function refreshCurriculumDropdownSelectors() {
    const classSel = document.getElementById('global-class-selector');
    const subSel = document.getElementById('global-subject-selector');
    if (!classSel || !subSel) return;
    
    let previousClass = classSel.value;
    let previousSub = subSel.value;

    classSel.innerHTML = "";
    subSel.innerHTML = "";

    let availableClasses = [];
    if (currentUser && currentUser.role === 'TEACHER') {
        let mappedClasses = new Set();
        (currentUser.assignments || []).forEach(a => mappedClasses.add(a.class));
        availableClasses = Array.from(mappedClasses);
    } else {
        availableClasses = Object.keys(db.classes || {});
    }

    availableClasses.forEach(c => {
        let opt = document.createElement('option');
        opt.value = c; opt.textContent = c;
        classSel.appendChild(opt);
    });

    if (previousClass && availableClasses.includes(previousClass)) {
        classSel.value = previousClass;
    }

    handleGlobalClassChange(false);
    if (previousSub && [...subSel.options].some(o => o.value === previousSub)) {
        subSel.value = previousSub;
    }
}

function handleGlobalClassChange(shouldTriggerRender = true) {
    const classSel = document.getElementById('global-class-selector');
    const subSel = document.getElementById('global-subject-selector');
    if(!classSel || !subSel) return;

    const targetClass = classSel.value;
    subSel.innerHTML = "";

    if (!targetClass || !db.classes[targetClass]) return;

    let subjectsToLoad = [];
    if (currentUser && currentUser.role === 'TEACHER') {
        (currentUser.assignments || []).forEach(a => {
            if (a.class === targetClass) subjectsToLoad.push(a.subject);
        });
    } else {
        subjectsToLoad = Object.keys(db.classes[targetClass].subjects || {});
    }

    subjectsToLoad.forEach(s => {
        let opt = document.createElement('option');
        opt.value = s; opt.textContent = s;
        subSel.appendChild(opt);
    });

    if (shouldTriggerRender) {
        renderCurriculumStructureSetup();
        buildMarkMatrixLedger();
    }
}

function renderCurriculumStructureSetup() {
    const container = document.getElementById('subject-mapping-container');
    if (!container) return;
    container.innerHTML = "";

    const activeClass = document.getElementById('global-class-selector')?.value;
    const activeSub = document.getElementById('global-subject-selector')?.value;

    if (!activeClass || !activeSub || !db.classes[activeClass] || !db.classes[activeClass].subjects[activeSub]) {
        container.innerHTML = `<p style="padding:15px; color:#64748b;">No curriculum structure mapping configuration matches criteria metrics context.</p>`;
        return;
    }

    let chapters = db.classes[activeClass].subjects[activeSub];

    chapters.forEach((ch, chIdx) => {
        let chBox = document.createElement('div');
        chBox.style.background = "#fafafa";
        chBox.style.border = "1px solid #cbd5e1";
        chBox.style.padding = "15px";
        chBox.style.borderRadius = "6px";
        chBox.style.marginBottom = "15px";

        let themesHTML = ch.themes.map((th, thIdx) => `
            <div style="display:flex; gap:10px; margin-bottom:8px; padding-left:20px; align-items:center;">
                <span style="color:#cbd5e1;">⬤</span>
                <input type="text" value="${th}" onchange="updateThemeString('${activeClass}', '${activeSub}', ${chIdx}, ${thIdx}, this.value)" style="font-size:12px; padding:4px 8px;">
                <button class="btn btn-danger sm-btn" onclick="deleteThemeRoute('${activeClass}', '${activeSub}', ${chIdx}, ${thIdx})">✕</button>
            </div>
        `).join('');

        chBox.innerHTML = `
            <div style="display:flex; gap:12px; align-items:center; margin-bottom:12px;">
                <input type="checkbox" ${ch.active ? 'checked' : ''} onchange="toggleChapterActive('${activeClass}', '${activeSub}', ${chIdx}, this.checked)" style="width:auto;">
                <input type="text" value="${ch.chName}" onchange="updateChapterString('${activeClass}', '${activeSub}', ${chIdx}, this.value)" style="font-weight:bold; width:70%;">
                <button class="btn btn-success sm-btn" onclick="addThemeNode('${activeClass}', '${activeSub}', ${chIdx})">+ Add Theme Criterion</button>
                <button class="btn btn-danger sm-btn" onclick="deleteChapterRoute('${activeClass}', '${activeSub}', ${chIdx})">Delete Chapter</button>
            </div>
            <div>${themesHTML}</div>
        `;
        container.appendChild(chBox);
    });

    let addChBtn = document.createElement('button');
    addChBtn.className = "btn btn-p sm-btn";
    addChBtn.style.marginTop = "5px";
    addChBtn.textContent = "+ Append Structural Chapter Block Unit";
    addChBtn.onclick = () => {
        chapters.push({ chName: "New Module Segment Heading Unit", active: true, themes: ["New Specific Evaluation Metric Point"] });
        syncStateToBackendCloud();
        renderCurriculumStructureSetup();
        buildMarkMatrixLedger();
    };
    container.appendChild(addChBtn);
}

function toggleChapterActive(c, s, cIdx, val) { db.classes[c].subjects[s][cIdx].active = val; syncStateToBackendCloud(); buildMarkMatrixLedger(); }
// Use standard text processing directly to keep inline character composition lightweight
function updateChapterString(c, s, cIdx, val) { db.classes[c].subjects[s][cIdx].chName = val; syncStateToBackendCloud(); }
function updateThemeString(c, s, cIdx, tIdx, val) { db.classes[c].subjects[s][cIdx].themes[tIdx] = val; syncStateToBackendCloud(); }
function addThemeNode(c, s, cIdx) { db.classes[c].subjects[s][cIdx].themes.push("New Operational Assessment Metric Attribute"); syncStateToBackendCloud(); renderCurriculumStructureSetup(); buildMarkMatrixLedger(); }
function deleteChapterRoute(c, s, cIdx) { db.classes[c].subjects[s].splice(cIdx, 1); syncStateToBackendCloud(); renderCurriculumStructureSetup(); buildMarkMatrixLedger(); }
function deleteThemeRoute(c, s, cIdx, tIdx) { db.classes[c].subjects[s][cIdx].themes.splice(tIdx, 1); syncStateToBackendCloud(); renderCurriculumStructureSetup(); buildMarkMatrixLedger(); }

// --- SECURE MATRIX ASSESSMENT ENTRIES SHEET ---

function buildMarkMatrixLedger() {
    const table = document.getElementById('matrix-table');
    if (!table) return;
    table.innerHTML = "";

    const activeClass = document.getElementById('global-class-selector')?.value;
    const activeSub = document.getElementById('global-subject-selector')?.value;

    if (!activeClass || !activeSub || !db.classes[activeClass] || !db.classes[activeClass].subjects[activeSub]) {
        table.innerHTML = `<tr><td style="padding:15px; color:#64748b;">No structural context active to display evaluating parameters matrix spreadsheet.</td></tr>`;
        return;
    }

    let chs = db.classes[activeClass].subjects[activeSub];
    
    let h1 = `<tr><th rowspan="3" style="width:45px;">S.N.</th><th rowspan="3" style="min-width:180px;">Full Legal Student Name</th><th rowspan="3" style="width:75px;">Roll No</th>`;
    let h2 = `<tr>`;
    let h3 = `<tr>`;

    let activeChaptersCount = 0;
    chs.forEach((ch, cIdx) => {
        if (!ch.active) return;
        activeChaptersCount++;
        let themeCount = ch.themes.length;
        h1 += `<th colspan="${themeCount + 1}" style="text-align:center; background:#1e3a8a;">${ch.chName}</th>`;
        ch.themes.forEach(th => {
            h3 += `<th style="background:#475569; font-size:10px; font-weight:normal; max-width:120px; white-space:normal; text-align:center;">${th}</th>`;
        });
        h2 += `<th colspan="${themeCount}" style="background:#334155; text-align:center; font-size:10px;">Evaluation Parameters</th><th rowspan="2" class="ch-avg-col" style="background:#0f172a; color:white;">Ch Avg</th>`;
    });

    h1 += `</tr>`; h2 += `</tr>`; h3 += `</tr>`;
    table.innerHTML = `<thead>${h1}${h2}${h3}</thead><tbody id="matrix-body-rows"></tbody>`;

    const tbody = document.getElementById('matrix-body-rows');
    let studentsList = db.students[activeClass] || [];

    if (studentsList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${5 + (activeChaptersCount * 5)}" style="text-align:center; color:#64748b; padding:20px;">No student records attached to this class. Append a student row to begin entering metrics.</td></tr>`;
        return;
    }

    studentsList.forEach((stud, sIdx) => {
        let tr = document.createElement('tr');
        let cells = `<td>${sIdx + 1}</td>
            <td><input type="text" value="${stud.name || ''}" onchange="updateStudentMetaDataContext(${sIdx}, 'name', this.value)" style="font-weight:600;"></td>
            <td><input type="number" value="${stud.roll || ''}" onchange="updateStudentMetaDataContext(${sIdx}, 'roll', this.value)" style="text-align:center;"></td>`;

        chs.forEach((ch, cIdx) => {
            if (!ch.active) return;
            let total = 0; let count = 0;
            ch.themes.forEach((th, tIdx) => {
                let scoreKey = `${activeSub}_C${cIdx}_T${tIdx}`;
                let scoreVal = stud.marks[scoreKey] !== undefined ? stud.marks[scoreKey] : "";
                
                if (scoreVal !== "") { total += parseFloat(scoreVal); count++; }
                
                cells += `<td><input type="number" class="mark-input" min="1" max="4" value="${scoreVal}" oninput="liveMatrixScoreCalculation(this, ${sIdx}, '${scoreKey}', '${activeClass}', '${activeSub}', ${cIdx})"></td>`;
            });
            let avg = count > 0 ? (total / count).toFixed(2) : "—";
            cells += `<td class="ch-avg-col" id="avg_${sIdx}_C${cIdx}">${avg}</td>`;
        });

        tr.innerHTML = cells;
        tbody.appendChild(tr);
    });
}

function updateStudentMetaDataContext(sIdx, field, val) {
    const activeClass = document.getElementById('global-class-selector').value;
    if (db.students[activeClass] && db.students[activeClass][sIdx]) {
        db.students[activeClass][sIdx][field] = val;
        syncStateToBackendCloud();
    }
}

function liveMatrixScoreCalculation(inputEl, sIdx, scoreKey, className, subName, cIdx) {
    let val = inputEl.value.trim();
    if (val === "") {
        delete db.students[className][sIdx].marks[scoreKey];
    } else {
        let numericValue = parseFloat(val);
        if (numericValue < 1 || numericValue > 4) { inputEl.style.background = "#fee2e2"; return; }
        inputEl.style.background = "";
        db.students[className][sIdx].marks[scoreKey] = numericValue;
    }

    let ch = db.classes[className].subjects[subName][cIdx];
    let total = 0; let count = 0;
    ch.themes.forEach((_, tIdx) => {
        let s = db.students[className][sIdx].marks[`${subName}_C${cIdx}_T${tIdx}`];
        if (s !== undefined && s !== "") { total += parseFloat(s); count++; }
    });

    const targetAvgCell = document.getElementById(`avg_${sIdx}_C${cIdx}`);
    if (targetAvgCell) targetAvgCell.textContent = count > 0 ? (total / count).toFixed(2) : "—";
}

function addNewStudent() {
    const activeClass = document.getElementById('global-class-selector').value;
    if (!activeClass) { alert("Create or choose a target Class environment context node first."); return; }
    if (!db.students[activeClass]) db.students[activeClass] = [];

    db.students[activeClass].push({
        id: Date.now() + Math.random(),
        name: "",
        roll: db.students[activeClass].length + 1,
        marks: {}
    });

    syncStateToBackendCloud();
    buildMarkMatrixLedger();
}

function importBulkStudents() {
    const activeClass = document.getElementById('global-class-selector').value;
    if (!activeClass) return;
    let raw = prompt("Paste student names (one per line):");
    if (!raw) return;

    let lines = raw.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    if (!db.students[activeClass]) db.students[activeClass] = [];

    lines.forEach(name => {
        db.students[activeClass].push({
            id: Date.now() + Math.random(),
            name: name,
            roll: db.students[activeClass].length + 1,
            marks: {}
        });
    });

    syncStateToBackendCloud();
    buildMarkMatrixLedger();
}

async function saveActiveMarksToStorage() {
    await syncStateToBackendCloud();
    alert("Local workspace evaluation metrics synchronized smoothly with the cloud architecture cluster.");
}

// --- REPORT CARD COMPILATION DISPLAY CENTER PRINT ENGINE ---

function buildPrintingDashboardControls() {
    const grid = document.getElementById('print-student-checkbox-grid');
    if (!grid) return;
    grid.innerHTML = "";
    
    const activeClass = document.getElementById('global-class-selector').value;
    if (!activeClass || !db.students[activeClass] || db.students[activeClass].length === 0) {
        grid.innerHTML = `<p style="color:#64748b; font-size:12px; padding:10px;">No available student workspace metrics compiled to run layout cards.</p>`;
        return;
    }

    db.students[activeClass].forEach(st => {
        let lbl = document.createElement('label');
        lbl.style.display = "flex"; lbl.style.alignItems = "center"; lbl.style.gap = "8px";
        lbl.style.padding = "6px"; lbl.style.background = "#f8fafc"; lbl.style.borderRadius = "4px";
        lbl.innerHTML = `<input type="checkbox" checked value="${st.id}" class="print-student-selector-chk" style="width:auto;"> Row ${st.roll}: ${st.name || 'Unnamed'}`;
        lbl.querySelector('input').onchange = () => compileReportSheetsDOM();
        grid.appendChild(lbl);
    });
    compileReportSheetsDOM();
}

function compileReportSheetsDOM() {
    const area = document.getElementById('print-area');
    if (!area) return;
    area.innerHTML = "";

    const activeClass = document.getElementById('global-class-selector').value;
    if (!activeClass || !db.students[activeClass]) return;

    const selectedStyle = document.getElementById('print-layout-mode').value;
    const checkedIds = Array.from(document.querySelectorAll('.print-student-selector-chk:checked')).map(el => parseFloat(el.value));

    let targets = db.students[activeClass].filter(s => checkedIds.includes(s.id));

    targets.forEach(student => {
        let card = document.createElement('div');
        card.className = "report-card";

        let headerHTML = `
            <div style="text-align:center; margin-bottom:20px; border-bottom:2px solid var(--primary); padding-bottom:10px;">
                <h2 style="text-transform:uppercase; font-size:18px; color:var(--primary);">Sirjana Secondary School Evaluation Profile</h2>
                <p style="font-size:11px; color:#475569;">Bharatpur-9, Chitwan, Nepal | CAS Continuous Assessment System Ledger</p>
                <div style="display:flex; justify-content:space-between; margin-top:15px; font-size:12px; font-weight:bold; background:#f1f5f9; padding:6px 12px; border-radius:4px;">
                    <span>Student Name: ${student.name || '____________'}</span>
                    <span>Class Scope: ${activeClass}</span>
                    <span>Roll No: ${student.roll}</span>
                </div>
            </div>
        `;

        let bodyTableHTML = "";
        if (selectedStyle === "CONSOLIDATED") {
            bodyTableHTML = `<table class="sheet"><thead><tr><th>Course Domain Subject</th><th>Overall Formative Achievement Band Status</th></tr></thead><tbody>`;
            Object.keys(db.classes[activeClass].subjects || {}).forEach(sub => {
                let totalSum = 0; let totalCount = 0;
                db.classes[activeClass].subjects[sub].forEach((ch, cIdx) => {
                    if (!ch.active) return;
                    ch.themes.forEach((_, tIdx) => {
                        let sc = student.marks[`${sub}_C${cIdx}_T${tIdx}`];
                        if (sc !== undefined && sc !== "") { totalSum += parseFloat(sc); totalCount++; }
                    });
                });
                let finalAvg = totalCount > 0 ? (totalSum / totalCount).toFixed(2) : "Unevaluated";
                bodyTableHTML += `<tr><td><strong>${sub}</strong></td><td><strong>${finalAvg}</strong></td></tr>`;
            });
            bodyTableHTML += `</tbody></table>`;
        } else {
            bodyTableHTML = `<table class="sheet"><thead><tr><th>Subject / Chapter Module Units</th><th>Achievement Progress Metric Scale Band Rating</th></tr></thead><tbody>`;
            Object.keys(db.classes[activeClass].subjects || {}).forEach(sub => {
                bodyTableHTML += `<tr style="background:#e2e8f0;"><td colspan="2"><strong>📚 Subject Core: ${sub}</strong></td></tr>`;
                db.classes[activeClass].subjects[sub].forEach((ch, cIdx) => {
                    if (!ch.active) return;
                    let chSum = 0; let chCount = 0;
                    ch.themes.forEach((_, tIdx) => {
                        let sc = student.marks[`${sub}_C${cIdx}_T${tIdx}`];
                        if (sc !== undefined && sc !== "") { chSum += parseFloat(sc); chCount++; }
                    });
                    let chAvg = chCount > 0 ? (chSum / chCount).toFixed(2) : "—";
                    bodyTableHTML += `<tr><td style="padding-left:20px;">• ${ch.chName}</td><td><strong>${chAvg}</strong></td></tr>`;
                });
            });
            bodyTableHTML += `</tbody></table>`;
        }

        let footerHTML = `
            <div style="display:flex; justify-content:space-between; margin-top:50px; font-size:11px; border-top:1px dashed #cbd5e1; padding-top:20px;">
                <div style="border-top:1px solid #000; width:150px; text-align:center; padding-top:5px; font-weight:bold;">Class Teacher</div>
                <div style="border-top:1px solid #000; width:150px; text-align:center; padding-top:5px; font-weight:bold;">School Seal</div>
                <div style="border-top:1px solid #000; width:150px; text-align:center; padding-top:5px; font-weight:bold;">Principal Approval</div>
            </div>
        `;

        card.innerHTML = headerHTML + bodyTableHTML + footerHTML;
        area.appendChild(card);
    });
}

function executeSystemPrintJob() {
    const activeClass = document.getElementById('global-class-selector').value;
    if (!activeClass || !db.students[activeClass] || db.students[activeClass].length === 0) {
        alert("Compile performance criteria sheets inside desk views before pushing data fields downstream to hardware print queues.");
        return;
    }
    window.print();
}

// --- PORTAL LOGIN SECURITY VALIDATION PIPELINE ---

function runAuthPipeline() {
    const userInp = document.getElementById('user-input').value.trim();
    const passInp = document.getElementById('pass-input').value.trim();
    const errEl = document.getElementById('auth-error');

    if (userInp === "admin" && passInp === "admin123") {
        currentUser = { role: "ADMIN", name: "System Administrator Node" };
        launchAuthorizedApplicationSession();
    } else {
        let teacher = db.teachers.find(t => t.id === userInp && t.pass === passInp);
        if (teacher) {
            currentUser = { role: "TEACHER", id: teacher.id, name: teacher.name, assignments: teacher.assignments || [] };
            launchAuthorizedApplicationSession();
        } else {
            errEl.textContent = "Authentication credentials rejected. Re-enter authorization access tokens.";
            errEl.style.display = "block";
        }
    }
}

function launchAuthorizedApplicationSession() {
    document.getElementById('login-modal').style.display = "none";
    document.getElementById('main-application-content').style.display = "block";
    document.getElementById('user-display-profile').textContent = `👤 ${currentUser.name} (${currentUser.role})`;

    if (currentUser.role === "TEACHER") {
        document.getElementById('admin-only-dashboard-wrapper').style.display = "none";
        document.getElementById('teacher-welcome-dashboard-wrapper').style.display = "block";
        document.getElementById('teacher-welcome-name').textContent = currentUser.name;
        document.getElementById('admin-add-student-row-btn').style.display = "none";
        document.getElementById('admin-bulk-student-btn').style.display = "none";
    } else {
        document.getElementById('admin-only-dashboard-wrapper').style.display = "block";
        document.getElementById('teacher-welcome-dashboard-wrapper').style.display = "none";
        document.getElementById('admin-add-student-row-btn').style.display = "inline-flex";
        document.getElementById('admin-bulk-student-btn').style.display = "inline-flex";
    }

    refreshCurriculumDropdownSelectors();
    goStep(1);
}

function terminateSession() {
    currentUser = null;
    document.getElementById('user-input').value = "";
    document.getElementById('pass-input').value = "";
    document.getElementById('auth-error').style.display = "none";
    document.getElementById('login-modal').style.display = "flex";
    document.getElementById('main-application-content').style.display = "none";
    document.getElementById('print-area').style.display = "none";
}

function openEditTeacherModal(id, name, pass) {
    document.getElementById('edit-teacher-index-id').value = id;
    document.getElementById('edit-teacher-name').value = name;
    document.getElementById('edit-teacher-login-id').value = id; 
    document.getElementById('edit-teacher-password').value = pass;
    document.getElementById('edit-teacher-modal').style.display = "flex";
}
function closeEditTeacherModal() { document.getElementById('edit-teacher-modal').style.display = "none"; }

// --- GLOBAL NAVIGATION MANAGER ---
function goStep(stepNum) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById(`st-${stepNum}`).classList.add('active');

    const printArea = document.getElementById('print-area');

    if (stepNum === 1) {
        document.getElementById('panel-admin').classList.add('active');
        if (printArea) printArea.style.display = "none";
    } else if (stepNum === 2) {
        refreshCurriculumDropdownSelectors();
        document.getElementById('panel-setup').classList.add('active');
        if (printArea) printArea.style.display = "none";
    } else if (stepNum === 3) {
        buildMarkMatrixLedger();
        document.getElementById('panel-marks').classList.add('active');
        if (printArea) printArea.style.display = "none";
    } else if (stepNum === 4) {
        document.getElementById('panel-print').classList.add('active');
        buildPrintingDashboardControls();
        if (printArea) printArea.style.display = "flex";
    }
}

// System Boot Initialization Engine Row Handshake
window.onload = function() {
    loadSystemStateFromServer();
};

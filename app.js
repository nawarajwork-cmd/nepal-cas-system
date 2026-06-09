console.log("APP JS LOADED");
const API_BASE = "https://cas-backend-s9ba.onrender.com/api";
// ====================================================== // SESSION // ======================================================
let SESSION_TOKEN = sessionStorage.getItem('CAS_ACTIVE_JWT') || null;
let USER_ROLE = sessionStorage.getItem('CAS_ACTIVE_ROLE') || null;
let BACKEND_CURRICULUM_CACHE = []; let BACKEND_ROSTER_CACHE = []; let RUNTIME_MATRIX_SCORES = {};
let inputDebounceTimer = null;
// ====================================================== // APP BOOT // ======================================================
async function bootstrapApplicationNode() {
const modal =
    document.getElementById('login-modal');

if(!SESSION_TOKEN) {

    modal.style.display = 'flex';

    return;
}

modal.style.display = 'none';

await synchronizeProfilePayload();

await fetchCloudSystemState();

if(USER_ROLE === 'ADMIN') {

    await loadTeachers();

    await loadSubjectsForAssignment();

} else {

    document.getElementById(
        'teacher-management-panel'
    ).style.display = 'none';

    document.getElementById(
        'teacher-assignment-panel'
    ).style.display = 'none';
}
}
// ====================================================== // LOGIN // ======================================================
async function runAuthPipeline() {
const username =
    document.getElementById('user-input')
    .value.trim();

const password =
    document.getElementById('pass-input')
    .value.trim();

const error =
    document.getElementById('auth-error');

if(!username || !password) {

    error.textContent =
    'Username and password required';

    error.style.display = 'block';

    return;
}

try {

    const response =
        await fetch(
            `${API_BASE}/auth/login`,
        {
            method:'POST',

            headers:{
                'Content-Type':'application/json'
            },

body: JSON.stringify({
    username,
    password,
    role: document.getElementById('login-role').value
})

        });

    const data =
        await response.json();

    if(!response.ok) {

        throw new Error(
            data.error
        );
    }

    sessionStorage.setItem(
        'CAS_ACTIVE_JWT',
        data.token
    );

    sessionStorage.setItem(
        'CAS_ACTIVE_ROLE',
        data.role
    );

    SESSION_TOKEN = data.token;

    USER_ROLE = data.role;

    location.reload();

} catch(err) {

    error.textContent =
    err.message;

    error.style.display = 'block';
}
}
// ====================================================== // LOGOUT // ======================================================
function terminateSession() {
sessionStorage.clear();

location.reload();
}
// ====================================================== // PROFILE // ======================================================
async function synchronizeProfilePayload() {
try {

    const response =
        await fetch(
            `${API_BASE}/profile`,
        {
            headers:{
                'Authorization':
                `Bearer ${SESSION_TOKEN}`
            }
        });

    const profile =
        await response.json();

    document.getElementById('p-name')
    .value =
    profile.school_name || '';

    document.getElementById('p-addr')
    .value =
    profile.address_location || '';

    document.getElementById('p-emis')
    .value =
    profile.emis_code || '';

    document.getElementById('p-grade')
    .value =
    profile.selected_grade || '1';

    document.getElementById('p-year')
    .value =
    profile.academic_year || '';

    document.getElementById('p-term')
    .value =
    profile.evaluation_term || '';

} catch(err) {

    console.log(err);
}
}
function pushProfileStream() {
if(USER_ROLE !== 'ADMIN') return;

clearTimeout(
    inputDebounceTimer
);

inputDebounceTimer =
setTimeout(async () => {

    const payload = {

        school_name:
        document.getElementById('p-name').value,

        address_location:
        document.getElementById('p-addr').value,

        emis_code:
        document.getElementById('p-emis').value,

        selected_grade:
        document.getElementById('p-grade').value,

        academic_year:
        document.getElementById('p-year').value,

        evaluation_term:
        document.getElementById('p-term').value
    };

    await fetch(
        `${API_BASE}/profile`,
    {
        method:'POST',

        headers:{
            'Content-Type':'application/json',
            'Authorization':
            `Bearer ${SESSION_TOKEN}`
        },

        body: JSON.stringify(payload)
    });

}, 700);
}
// ====================================================== // LOAD MAIN SYSTEM // ======================================================
async function switchDataGradeContext() {
pushProfileStream();

await fetchCloudSystemState();
}
async function fetchCloudSystemState() {
const grade =
document.getElementById('p-grade')
.value;

try {

    // CURRICULUM

    const curriculumResponse =
        await fetch(
            `${API_BASE}/curriculum?grade=${grade}`,
        {
            headers:{
                'Authorization':
                `Bearer ${SESSION_TOKEN}`
            }
        });

    BACKEND_CURRICULUM_CACHE =
        await curriculumResponse.json();

    // STUDENTS

    const studentResponse =
        await fetch(
            `${API_BASE}/students?grade=${grade}`,
        {
            headers:{
                'Authorization':
                `Bearer ${SESSION_TOKEN}`
            }
        });

    const studentData =
        await studentResponse.json();

    BACKEND_ROSTER_CACHE =
        studentData.students;

    RUNTIME_MATRIX_SCORES = {};

    studentData.marks.forEach(mark => {

        RUNTIME_MATRIX_SCORES[
            `${mark.student_id}_${mark.theme_id}`
        ] = mark.score;
    });

    renderCurriculumPanelMarkup();

} catch(err) {

    console.log(err);
}
}
// ====================================================== // TEACHER MANAGEMENT // ======================================================
async function createTeacher() {
const full_name =
    document.getElementById('teacher-name')
    .value.trim();

if(!full_name) {

    alert('Teacher name required');

    return;
}

try {

    const response =
        await fetch(
            `${API_BASE}/admin/teachers`,
        {
            method:'POST',

            headers:{
                'Content-Type':'application/json',
                'Authorization':
                `Bearer ${SESSION_TOKEN}`
            },

            body: JSON.stringify({
                full_name
            })
        });

    const data =
        await response.json();

    if(!response.ok) {

        throw new Error(
            data.error
        );
    }

    alert( "Teacher Created\n\n" + "Username: " + data.teacher.username + "\n\nPassword: " + data.password );
    document.getElementById(
        'teacher-name'
    ).value = '';

    await loadTeachers();

} catch(err) {

    alert(err.message);
}
}
async function loadTeachers() {
try {

    const response =
        await fetch(
            `${API_BASE}/admin/teachers`,
        {
            headers:{
                'Authorization':
                `Bearer ${SESSION_TOKEN}`
            }
        });

    const teachers =
        await response.json();

    let html = '';

    let options = '';

    teachers.forEach(teacher => {

        html += `
        <div
            style="
                padding:12px;
                border:1px solid #cbd5e1;
                border-radius:6px;
                margin-bottom:10px;
                display:flex;
                justify-content:space-between;
                align-items:center;
            "
        >

            <div>

                <div
                    style="
                        font-weight:bold;
                        color:#0f172a;
                    "
                >
                    ${teacher.full_name}
                </div>

                <div
                    style="
                        font-size:12px;
                        color:#64748b;
                    "
                >
                    Username:
                    ${teacher.username}
                </div>

            </div>

            <div
                style="
                    display:flex;
                    gap:8px;
                "
            >

                <button
                    onclick="editTeacher(
                        ${teacher.id},
                        '${teacher.username}',
                        '${teacher.full_name}'
                    )"
                    style="
                        background:#0284c7;
                        color:#fff;
                        border:none;
                        padding:6px 10px;
                        border-radius:4px;
                        cursor:pointer;
                    "
                >
                    Edit
                </button>

                <button
                    onclick="deleteTeacher(
                        ${teacher.id}
                    )"
                    style="
                        background:#dc2626;
                        color:#fff;
                        border:none;
                        padding:6px 10px;
                        border-radius:4px;
                        cursor:pointer;
                    "
                >
                    Delete
                </button>

            </div>

        </div>
        `;

        options += `
        <option value="${teacher.id}">
            ${teacher.full_name}
        </option>
        `;
    });

    document.getElementById(
        'teacher-list'
    ).innerHTML = html;

    document.getElementById(
        'assign-teacher'
    ).innerHTML = options;

} catch(err) {

    console.log(err);
}
}
async function editTeacher( id, oldUsername, oldName ) {
const username =
    prompt(
        'Edit Username',
        oldUsername
    );

if(!username) return;

const full_name =
    prompt(
        'Edit Full Name',
        oldName
    );

if(!full_name) return;

try {

    await fetch(
        `${API_BASE}/admin/teachers/${id}`,
    {
        method:'PUT',

        headers:{
            'Content-Type':'application/json',
            'Authorization':
            `Bearer ${SESSION_TOKEN}`
        },

        body: JSON.stringify({
            username,
            full_name
        })
    });

    await loadTeachers();

} catch(err) {

    alert(err.message);
}
}
async function deleteTeacher(id) {
if(
    !confirm(
        'Delete this teacher?'
    )
) return;

try {

    await fetch(
        `${API_BASE}/admin/teachers/${id}`,
    {
        method:'DELETE',

        headers:{
            'Authorization':
            `Bearer ${SESSION_TOKEN}`
        }
    });

    await loadTeachers();

} catch(err) {

    alert(err.message);
}
}
// ====================================================== // SUBJECT ASSIGNMENT // ======================================================
async function loadSubjectsForAssignment() {
try {

    const response =
        await fetch(
            `${API_BASE}/subjects`,
        {
            headers:{
                'Authorization':
                `Bearer ${SESSION_TOKEN}`
            }
        });

    const subjects =
        await response.json();

    let options = '';

    subjects.forEach(subject => {

        options += `
        <option value="${subject.id}">
            Grade ${subject.grade_level}
            -
            ${subject.subject_code}
        </option>
        `;
    });

    document.getElementById(
        'assign-subject'
    ).innerHTML = options;

} catch(err) {

    console.log(err);
}
}
async function assignTeacherSubject() {
const teacher_id =
    document.getElementById(
        'assign-teacher'
    ).value;

const subject_id =
    document.getElementById(
        'assign-subject'
    ).value;

const grade_level =
    document.getElementById(
        'assign-grade'
    ).value;

try {

    const response =
        await fetch(
            `${API_BASE}/admin/assign-teacher`,
        {
            method:'POST',

            headers:{
                'Content-Type':'application/json',
                'Authorization':
                `Bearer ${SESSION_TOKEN}`
            },

            body: JSON.stringify({
                teacher_id,
                subject_id,
                grade_level
            })
        });

    const data =
        await response.json();

    if(!response.ok) {

        throw new Error(
            data.error
        );
    }

    alert(
        'Teacher Assigned Successfully'
    );

} catch(err) {

    alert(err.message);
}
}
// ====================================================== // CURRICULUM // ======================================================
function buildNestedCurriculumMap() {
const map = {};

BACKEND_CURRICULUM_CACHE
.forEach(row => {

    if(!map[row.subject_code]) {

        map[row.subject_code] = {

            id: row.subject_id,

            chapters:[]
        };
    }

    if(!row.chapter_id) return;

    let chapter =
        map[row.subject_code]
        .chapters
        .find(
            ch => ch.id === row.chapter_id
        );

    if(!chapter) {

        chapter = {

            id: row.chapter_id,

            name: row.chapter_name,

            active: row.is_active,

            themes:[]
        };

        map[row.subject_code]
        .chapters
        .push(chapter);
    }
    
if(row.theme_id) {

    const alreadyExists =
        chapter.themes.find(
            th => th.id === row.theme_id
        );

    if(!alreadyExists) {

        chapter.themes.push({

            id: row.theme_id,

            name: row.theme_name
        });
    }
}
});

return map;
}
function renderCurriculumPanelMarkup() {

    const out =
    document.getElementById(
        'curriculum-rendering-node'
    );

    out.innerHTML = '';

    const map =
    buildNestedCurriculumMap();

    Object.keys(map).forEach(sub => {

        const box =
        document.createElement('div');

        box.style.border =
        '1px solid #cbd5e1';

        box.style.borderRadius =
        '8px';

        box.style.marginBottom =
        '20px';

        let chapters = '';

        map[sub].chapters.forEach(ch => {

            let themes = '';

            let themeCounter = 1;

            ch.themes.forEach(th => {

                themes += `

                <li
                    style="
                        list-style:none;
                        margin-bottom:8px;
                    "
                >

                    <div
                        style="
                            border:1px solid #edf2f7;
                            background:#f8fafc;
                            border-radius:8px;
                            padding:10px 12px;

                            display:flex;
                            justify-content:space-between;
                            align-items:center;
                        "
                    >

                        <div>

                            <strong>
                                ${themeCounter}.
                            </strong>

                            ${th.name}

                        </div>

                        <div
                            style="
                                display:flex;
                                gap:8px;
                            "
                        >

                            <button
                                onclick="
                                    editTheme(
                                        ${th.id},
                                        '${th.name}',
                                        '${sub}',
                                        '${ch.name}'
                                    )
                                "
                                style="
                                    background:#0284c7;
                                    color:#fff;
                                    border:none;
                                    padding:4px 8px;
                                    border-radius:4px;
                                    cursor:pointer;
                                "
                            >
                                Edit
                            </button>

                            <button
                                onclick="
                                    deleteTheme(
                                        ${th.id},
                                        '${sub}',
                                        '${ch.name}',
                                        '${th.name}'
                                    )
                                "
                                style="
                                    background:#dc2626;
                                    color:#fff;
                                    border:none;
                                    padding:4px 8px;
                                    border-radius:4px;
                                    cursor:pointer;
                                "
                            >
                                Delete
                            </button>

                        </div>

                    </div>

                </li>
                `;

                themeCounter++;
            });

            chapters += `

            <div
                style="
                    border:1px solid #e2e8f0;
                    padding:15px;
                    margin-bottom:12px;
                    border-radius:8px;
                    background:#fff;
                "
            >

                <div
                    style="
                        display:flex;
                        justify-content:space-between;
                        align-items:center;
                        margin-bottom:12px;
                    "
                >

                    <div
                        style="
                            display:flex;
                            align-items:center;
                            gap:10px;
                        "
                    >

                        <input
                            type="checkbox"

                            ${ch.is_selected
                            ? "checked"
                            : ""}

                            onchange="
                                toggleChapter(
                                    ${ch.id},
                                    this.checked
                                )
                            "
                        />

                        <strong>
                            ${ch.name}
                        </strong>

                    </div>

                    <div
                        style="
                            display:flex;
                            gap:8px;
                            align-items:center;
                        "
                    >

                        <button
                            onclick="
                                editChapter(
                                    ${ch.id},
                                    '${ch.name}',
                                    '${sub}'
                                )
                            "
                            style="
                                background:#0284c7;
                                color:#fff;
                                border:none;
                                padding:5px 10px;
                                border-radius:5px;
                                cursor:pointer;
                            "
                        >
                            Edit
                        </button>

                        <button
                            onclick="
                                deleteChapter(
                                    ${ch.id},
                                    '${sub}',
                                    '${ch.name}'
                                )
                            "
                            style="
                                background:#dc2626;
                                color:#fff;
                                border:none;
                                padding:5px 10px;
                                border-radius:5px;
                                cursor:pointer;
                            "
                        >
                            Delete
                        </button>

                        <button
                            onclick="
                                appendThemePrompt(
                                    ${ch.id}
                                )
                            "
                            style="
                                background:#2563eb;
                                color:#fff;
                                border:none;
                                padding:5px 10px;
                                border-radius:5px;
                                cursor:pointer;
                            "
                        >
                            Add Theme
                        </button>

                    </div>

                </div>

                <ol
                    style="
                        margin:0;
                        padding-left:0;
                    "
                >
                    ${themes}
                </ol>

            </div>
            `;
        });

        box.innerHTML = `

        <div
            style="
                background:#1e293b;
                color:#fff;
                padding:12px;
                display:flex;
                justify-content:space-between;
                align-items:center;
            "
        >

            <strong>
                ${sub}
            </strong>

            <button
                onclick="
                    appendChapterPrompt(
                        ${map[sub].id}
                    )
                "
                style="
                    background:#2563eb;
                    color:#fff;
                    border:none;
                    padding:6px 10px;
                    border-radius:4px;
                    cursor:pointer;
                "
            >
                Add Chapter
            </button>

        </div>

        <div style="padding:15px;">
            ${chapters}
        </div>
        `;

        out.appendChild(box);
    });
}
// ====================================================== // ADD SUBJECT // ======================================================
async function createNewSubjectNode() {
const subject =
    prompt(
        'Enter Subject Name'
    );

if(!subject) return;

const grade =
document.getElementById(
    'p-grade'
).value;

try {

    await fetch(
        `${API_BASE}/curriculum/subject`,
    {
        method:'POST',

        headers:{
            'Content-Type':'application/json',
            'Authorization':
            `Bearer ${SESSION_TOKEN}`
        },

        body: JSON.stringify({

            subject_code:
            subject.toUpperCase(),

            grade_level: grade
        })
    });

    await fetchCloudSystemState();

    await loadSubjectsForAssignment();

} catch(err) {

    alert(err.message);
}
}
// ====================================================== // CHAPTER // ======================================================
async function appendChapterPrompt( subject_id ) {
const chapter =
    prompt(
        'Enter Chapter Name'
    );

if(!chapter) return;

try {

    await fetch(
        `${API_BASE}/curriculum/chapter`,
    {
        method:'POST',

        headers:{
            'Content-Type':'application/json',
            'Authorization':
            `Bearer ${SESSION_TOKEN}`
        },

        body: JSON.stringify({
            subject_id,
            chapter_name: chapter
        })
    });

    await fetchCloudSystemState();

} catch(err) {

    alert(err.message);
}
}
// ====================================================== // THEME // ======================================================
async function appendThemePrompt( chapter_id ) {
const theme =
    prompt(
        'Enter Theme Name'
    );

if(!theme) return;

try {

    await fetch(
        `${API_BASE}/curriculum/theme`,
    {
        method:'POST',

        headers:{
            'Content-Type':'application/json',
            'Authorization':
            `Bearer ${SESSION_TOKEN}`
        },

        body: JSON.stringify({
            chapter_id,
            theme_name: theme
        })
    });

    await fetchCloudSystemState();

} catch(err) {

    alert(err.message);
}
}

async function editChapter(
    id,
    oldName,
    subjectName
) {

    const newName =
        prompt(
            `Edit Chapter\n\n${subjectName} → ${oldName}`,
            oldName
        );

    if(!newName) return;

    await fetch(
        `${API_BASE}/curriculum/chapter/${id}`,
    {
        method:'PUT',

        headers:{
            'Content-Type':'application/json',

            'Authorization':
            `Bearer ${SESSION_TOKEN}`
        },

        body: JSON.stringify({
            chapter_name: newName
        })
    });

    await fetchCloudSystemState();
}
    await fetchCloudSystemState();
}

async function editTheme(
    id,
    oldName,
    subjectName,
    chapterName
) {

    const newName =
        prompt(
            `Edit Theme\n\n${subjectName} → ${chapterName} → ${oldName}`,
            oldName
        );

    if(!newName) return;

    await fetch(
        `${API_BASE}/curriculum/theme/${id}`,
    {
        method:'PUT',

        headers:{
            'Content-Type':'application/json',

            'Authorization':
            `Bearer ${SESSION_TOKEN}`
        },

        body: JSON.stringify({
            theme_name: newName
        })
    });

    await fetchCloudSystemState();
}

async function deleteTheme(
    id,
    subjectName,
    chapterName,
    themeName
) {

    if(
        !confirm(
            `Delete Theme?\n\n${subjectName} → ${chapterName} → ${themeName}`
        )
    ) return;

    await fetch(
        `${API_BASE}/curriculum/theme/${id}`,
    {
        method:'DELETE',

        headers:{
            'Authorization':
            `Bearer ${SESSION_TOKEN}`
        }
    });

    await fetchCloudSystemState();
}

async function deleteChapter(
    id,
    subjectName,
    chapterName
) {

    if(
        !confirm(
            `Delete Chapter?\n\n${subjectName} → ${chapterName}`
        )
    ) return;

    await fetch(
        `${API_BASE}/curriculum/chapter/${id}`,
    {
        method:'DELETE',

        headers:{
            'Authorization':
            `Bearer ${SESSION_TOKEN}`
        }
    });

    await fetchCloudSystemState();
}

async function toggleChapter(
    chapterId,
    isSelected
) {

    await fetch(
        `${API_BASE}/teacher/chapter-toggle`,
    {
        method:'POST',

        headers:{
            'Content-Type':'application/json',

            'Authorization':
            `Bearer ${SESSION_TOKEN}`
        },

        body: JSON.stringify({

            chapter_id: chapterId,

            is_selected: isSelected
        })
    });
}
// ====================================================== // SIMPLE PANEL SWITCH // ======================================================
function shiftPanel(step) {
document
.querySelectorAll('.panel')
.forEach(panel => {

    panel.style.display = 'none';
});

document
.querySelectorAll('.step')
.forEach(stepEl => {

    stepEl.classList.remove(
        'active'
    );
});

document.getElementById(
    `view-${
        step === 1
        ? 'setup'
        : step === 2
        ? 'marks'
        : 'print'
    }`
).style.display = 'block';

document.getElementById(
    `st-${step}`
).classList.add('active');
}
// ====================================================== // STUDENT PLACEHOLDER // ======================================================
function createNewStudentNode() {
alert(
    'Use your previous student logic here'
);
}
function executeBulkImport() {
alert(
    'Use your previous bulk import logic here'
);
}




function toggleChapter(chapterId, isSelected) {

  fetch(
    'https://cas-backend-s9ba.onrender.com/api/teacher/chapter-toggle',
    {

      method: 'POST',

      headers: {

        'Content-Type':
          'application/json',

        Authorization:
          `Bearer ${SESSION_TOKEN}`
      },

      body: JSON.stringify({

        chapter_id: chapterId,
        is_selected: isSelected

      })

    }
  );
}
// ====================================================== // LOAD APP // ======================================================
window.onload = async function() {

    await bootstrapApplicationNode();

};

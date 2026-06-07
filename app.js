const API_BASE = "https://cas-backend-s9ba.onrender.com"; // VERIFY YOUR URL

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
        if (data.role === 'admin') {
            document.getElementById('admin-panel').style.display = 'block';
            loadAdminDashboard();
        }
    } else { alert("Login Failed"); }
}

async function loadAdminDashboard() {
    const res = await fetch(`${API_BASE}/api/admin/dashboard-data`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const data = await res.json();
    document.getElementById('teacher-list-body').innerHTML = data.teachers.map(t => 
        `<tr><td>${t.username}</td><td>${t.password}</td></tr>`).join('');
    document.getElementById('assignment-list-body').innerHTML = data.assignments.map(a => 
        `<tr><td>${a.username}</td><td>${a.name}</td></tr>`).join('');
}

async function createNewTeacher() {
    await fetch(`${API_BASE}/api/admin/teachers`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    loadAdminDashboard();
}

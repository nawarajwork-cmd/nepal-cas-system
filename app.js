const API_BASE = "https://cas-backend-s9ba.onrender.com/api";

async function login() {
    const username = document.getElementById('user-input').value;
    const password = document.getElementById('pass-input').value;
    const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok) {
        sessionStorage.setItem('token', data.token);
        sessionStorage.setItem('role', data.role);
        window.location.reload(); 
    } else { alert("Login Failed"); }
}

async function performAction(endpoint, body) {
    await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionStorage.getItem('token')}` 
        },
        body: JSON.stringify(body)
    });
    window.location.reload(); // Ensures internal refresh requirement
}

function initDashboard() {
    if (sessionStorage.getItem('role') === 'TEACHER') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    }
}

window.onload = () => {
    if (sessionStorage.getItem('token')) {
        initDashboard();
    } else {
        // Show login modal
    }
};

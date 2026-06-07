const API_BASE = "https://cas-backend-s9ba.onrender.com"; // VERIFY YOUR URL

// --- STATE MANAGEMENT ---
// Note: We use sessionStorage instead of localStorage to ensure data 
// clears when the browser tab is closed (Remote-friendly).
const getToken = () => sessionStorage.getItem('token');
const getRole = () => sessionStorage.getItem('role');

async function runAuthPipeline() {
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
        window.location.reload(); // Internal refresh requirement met
    }
}

// --- SECURE ACTION ---
async function adminAction(endpoint, body) {
    await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}` 
        },
        body: JSON.stringify(body)
    });
    window.location.reload(); // Ensures the UI updates immediately from Database
}

// --- DASHBOARD RENDERING ---
function renderDashboard() {
    const role = getRole();
    if (role === 'TEACHER') {
        // Hide Admin UI elements by class name
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    }
    // Logic to fetch and display curriculum
}

window.onload = () => {
    if (!getToken()) {
        document.getElementById('login-modal').style.display = 'flex';
    } else {
        renderDashboard();
    }
};

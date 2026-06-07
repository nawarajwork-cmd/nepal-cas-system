// --- CONFIGURATION ---
// Ensure this matches your backend's prefix (your server.js uses /api/auth/login)
const API_BASE = "https://cas-backend-s9ba.onrender.com/api";

// --- STATE MANAGEMENT ---
const getToken = () => sessionStorage.getItem('token');
const getRole = () => sessionStorage.getItem('role');

// --- AUTHENTICATION PIPELINE ---
async function runAuthPipeline() {
    const username = document.getElementById('user-input').value.trim();
    const password = document.getElementById('pass-input').value.trim();
    const errorMsg = document.getElementById('auth-error'); // Ensure this ID exists in HTML

    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (res.ok) {
            sessionStorage.setItem('token', data.token);
            sessionStorage.setItem('role', data.role);
            window.location.reload(); // Force state refresh
        } else {
            if(errorMsg) {
                errorMsg.textContent = data.error || "Login failed.";
                errorMsg.style.display = "block";
            }
        }
    } catch (err) {
        console.error("Auth Error:", err);
    }
}

// --- SECURE API ACTIONS ---
async function adminAction(endpoint, body) {
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}` 
            },
            body: JSON.stringify(body)
        });
        
        if (res.ok) {
            window.location.reload(); // Ensures the UI updates immediately from Database
        } else {
            alert("Action failed: Unauthorized or invalid request.");
        }
    } catch (err) {
        console.error("API Action Error:", err);
    }
}

// --- LOGOUT ---
function logout() {
    sessionStorage.clear();
    window.location.reload();
}

// --- DASHBOARD RENDERING & RBAC ---
function renderDashboard() {
    const role = getRole();
    
    // Hide UI elements based on role
    if (role === 'TEACHER') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
        console.log("Teacher mode: Admin controls hidden.");
    } else if (role === 'ADMIN') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
        console.log("Admin mode: Full access.");
    }
    
    // Trigger initial data load
    fetchCloudSystemState(); 
}

// --- INITIALIZATION ---
window.onload = () => {
    const modal = document.getElementById('login-modal');
    if (!getToken()) {
        if(modal) modal.style.display = 'flex';
    } else {
        if(modal) modal.style.display = 'none';
        renderDashboard();
    }
};

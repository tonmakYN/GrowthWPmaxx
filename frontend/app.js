document.addEventListener('DOMContentLoaded', () => {
    // กำหนด URL ของ Backend (อัปเดตสำหรับ Production แล้ว)
    const backendUrl = 'https://growthwpmaxx-backend.onrender.com';

    // --- DOM Elements ---
    const loginContainer = document.getElementById('login-container');
    const signupContainer = document.getElementById('signup-container');
    const forgotPasswordContainer = document.getElementById('forgot-password-container');
    const dashboard = document.getElementById('dashboard');
    const profilePage = document.getElementById('profile-page');
    const featureSelection = document.getElementById('feature-selection');

    // Forms
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const profileForm = document.getElementById('profile-form');

    // Messages
    const loginMessage = document.getElementById('login-message');
    const signupMessage = document.getElementById('signup-message');
    const forgotMessage = document.getElementById('forgot-message');
    const profileMessage = document.getElementById('profile-message');

    // Dashboard & Profile Elements
    const welcomeMessage = document.getElementById('welcome-message');
    const logoutButton = document.getElementById('logout-button');
    const featureGrid = document.getElementById('feature-grid');
    const profileButton = document.getElementById('profile-button');
    const backToDashboardButton = document.getElementById('back-to-dashboard');
    const profileEmail = document.getElementById('profile-email');
    const profileDisplayNameInput = document.getElementById('profile-display-name');

    // --- State ---
    let currentUser = null;

    // --- Helper Functions ---
    function showSection(sectionId) {
        loginContainer.style.display = 'none';
        signupContainer.style.display = 'none';
        forgotPasswordContainer.style.display = 'none';
        dashboard.style.display = 'none';
        profilePage.style.display = 'none';

        const section = document.getElementById(sectionId);
        if (section) {
            section.style.display = 'block';
        }
    }

    function displayMessage(element, message, type, duration = 3000) {
        element.textContent = message;
        element.className = `message ${type}`;
        element.style.display = 'block';
        if (duration) {
            setTimeout(() => hideMessage(element), duration);
        }
    }

    function hideMessage(element) {
        element.style.display = 'none';
        element.textContent = '';
        element.className = 'message';
    }

    // --- Main Logic ---
    async function updateUIForLoggedInUser() {
        const storedUser = JSON.parse(localStorage.getItem('currentUser'));
        if (storedUser && storedUser.email) {
            currentUser = storedUser;
            welcomeMessage.textContent = `ยินดีต้อนรับ, ${currentUser.displayName || currentUser.email}!`;
            showSection('dashboard');
        } else {
            updateUIForLoggedOutUser();
        }
    }

    function updateUIForLoggedOutUser() {
        currentUser = null;
        localStorage.removeItem('currentUser');
        showSection('login');
    }

    // --- Event Listeners ---
    // Form Toggles
    document.getElementById('show-signup').addEventListener('click', (e) => { e.preventDefault(); showSection('signup-container'); });
    document.getElementById('show-login').addEventListener('click', (e) => { e.preventDefault(); showSection('login-container'); });
    document.getElementById('show-forgot-password').addEventListener('click', (e) => { e.preventDefault(); showSection('forgot-password-container'); });
    document.getElementById('back-to-login').addEventListener('click', (e) => { e.preventDefault(); showSection('login-container'); });

    // Signup
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = signupForm['signup-email'].value;
        const password = signupForm['signup-password'].value;
        try {
            const res = await fetch(`${backendUrl}/api/register`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            displayMessage(signupMessage, data.message, 'success');
            setTimeout(() => showSection('login-container'), 2000);
        } catch (err) {
            displayMessage(signupMessage, err.message, 'error');
        }
    });

    // Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginForm['login-email'].value;
        const password = loginForm['login-password'].value;
        try {
            const res = await fetch(`${backendUrl}/api/login`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            localStorage.setItem('currentUser', JSON.stringify(data.user));
            updateUIForLoggedInUser();
        } catch (err) {
            displayMessage(loginMessage, err.message, 'error');
        }
    });
    
    // Forgot Password
    forgotPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = forgotPasswordForm['forgot-email'].value;
        try {
            const res = await fetch(`${backendUrl}/api/forgot-password`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            displayMessage(forgotMessage, data.message, 'info', null); // Don't auto-hide
        } catch (err) {
            displayMessage(forgotMessage, err.message, 'error');
        }
    });

    // Logout
    logoutButton.addEventListener('click', () => updateUIForLoggedOutUser());
    
    // Feature Grid Click
    featureGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.card');
        if (card) {
            alert(`คุณเลือกฟีเจอร์: ${card.dataset.feature}`);
        }
    });

    // Profile Page Logic
    profileButton.addEventListener('click', async () => {
        if (!currentUser) return;
        try {
            const res = await fetch(`${backendUrl}/api/profile/${currentUser.email}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            profileEmail.textContent = data.email;
            profileDisplayNameInput.value = data.displayName || '';
            showSection('profile-page');
        } catch (err) {
            alert('ไม่สามารถโหลดข้อมูลโปรไฟล์ได้');
        }
    });

    backToDashboardButton.addEventListener('click', () => showSection('dashboard'));
    
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const displayName = profileDisplayNameInput.value;
        try {
            const res = await fetch(`${backendUrl}/api/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: currentUser.email, displayName })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            
            // Update local storage and UI
            currentUser.displayName = data.user.displayName;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            welcomeMessage.textContent = `ยินดีต้อนรับ, ${currentUser.displayName || currentUser.email}!`;
            
            displayMessage(profileMessage, data.message, 'success');
        } catch(err) {
            displayMessage(profileMessage, err.message, 'error');
        }
    });

    // --- Initial Load ---
    if (localStorage.getItem('currentUser')) {
        updateUIForLoggedInUser();
    } else {
        showSection('login-container');
    }
});


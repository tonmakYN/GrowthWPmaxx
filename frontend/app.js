document.addEventListener('DOMContentLoaded', () => {
    // เนื่องจาก Frontend และ Backend อยู่บนเซิร์ฟเวอร์เดียวกันแล้ว เราจึงใช้ relative path ได้เลย
    const backendUrl = ''; 

    // --- DOM Elements ---
    const loginView = document.getElementById('login-view');
    const signupView = document.getElementById('signup-view');
    const forgotPasswordView = document.getElementById('forgot-password-view');
    const dashboardView = document.getElementById('dashboard-view');
    const profileView = document.getElementById('profile-view');
    const allViews = [loginView, signupView, forgotPasswordView, dashboardView, profileView];

    const signupForm = document.getElementById('signup-form');
    const loginForm = document.getElementById('login-form');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const profileForm = document.getElementById('profile-form');
    const profileDisplayNameInput = document.getElementById('profile-displayName');
    
    const showSignupLink = document.getElementById('show-signup');
    const showLoginLinkFromSignup = document.getElementById('show-login-from-signup');
    const showLoginLinkFromForgot = document.getElementById('show-login-from-forgot');
    const showForgotPasswordLink = document.getElementById('show-forgot-password');
    const logoutButton = document.getElementById('logout-button');
    const profileButton = document.getElementById('profile-button');
    const backToDashboardButton = document.getElementById('back-to-dashboard-button');

    const signupMessage = document.getElementById('signup-message');
    const loginMessage = document.getElementById('login-message');
    const forgotPasswordMessage = document.getElementById('forgot-password-message');
    const profileMessage = document.getElementById('profile-message');
    const welcomeMessage = document.getElementById('welcome-message');
    const featureGrid = document.getElementById('feature-grid');
    const profileEmailDisplay = document.getElementById('profile-email');

    // --- Helper Functions ---
    function showView(viewId) {
        allViews.forEach(view => {
            if (view) view.style.display = 'none';
        });
        const activeView = document.getElementById(viewId);
        if (activeView) activeView.style.display = 'block';
    }

    function displayMessage(element, message, type) {
        if (!element) return;
        element.textContent = message;
        element.className = `message ${type}`;
    }

    // --- UI Update Logic ---
    function updateUIForLoggedInUser() {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        if (user) {
            welcomeMessage.textContent = `ยินดีต้อนรับ, ${user.displayName || user.email}!`;
            profileEmailDisplay.textContent = user.email;
            profileDisplayNameInput.value = user.displayName || '';
            showView('dashboard-view');
        } else {
            updateUIForLoggedOutUser();
        }
    }

    function updateUIForLoggedOutUser() {
        localStorage.removeItem('currentUser');
        showView('login-view');
    }

    // --- Event Listeners ---
    showSignupLink.addEventListener('click', (e) => { e.preventDefault(); showView('signup-view'); });
    showLoginLinkFromSignup.addEventListener('click', (e) => { e.preventDefault(); showView('login-view'); });
    showForgotPasswordLink.addEventListener('click', (e) => { e.preventDefault(); showView('forgot-password-view'); });
    showLoginLinkFromForgot.addEventListener('click', (e) => { e.preventDefault(); showView('login-view'); });
    profileButton.addEventListener('click', (e) => { e.preventDefault(); showView('profile-view'); });
    backToDashboardButton.addEventListener('click', (e) => { e.preventDefault(); showView('dashboard-view'); });
    logoutButton.addEventListener('click', (e) => { e.preventDefault(); updateUIForLoggedOutUser(); });

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = e.target.email.value;
        const password = e.target.password.value;
        try {
            const response = await fetch(`${backendUrl}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await response.json();
            if (response.ok) {
                displayMessage(signupMessage, data.message, 'success');
                setTimeout(() => showView('login-view'), 2000);
            } else {
                displayMessage(signupMessage, data.error, 'error');
            }
        } catch (err) {
            displayMessage(signupMessage, 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = e.target.email.value;
        const password = e.target.password.value;
        try {
            const response = await fetch(`${backendUrl}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('currentUser', JSON.stringify(data.user));
                updateUIForLoggedInUser();
            } else {
                displayMessage(loginMessage, data.error, 'error');
            }
        } catch (err) {
            displayMessage(loginMessage, 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
        }
    });

    forgotPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = e.target.email.value;
        try {
            const response = await fetch(`${backendUrl}/api/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await response.json();
            displayMessage(forgotPasswordMessage, data.message, 'success');
        } catch (err) {
            displayMessage(forgotPasswordMessage, 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
        }
    });

    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const displayName = profileDisplayNameInput.value;
        const user = JSON.parse(localStorage.getItem('currentUser'));

        try {
            const response = await fetch(`${backendUrl}/api/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, displayName }),
            });
            const data = await response.json();
            if(response.ok) {
                localStorage.setItem('currentUser', JSON.stringify(data.user));
                displayMessage(profileMessage, 'บันทึกข้อมูลสำเร็จ!', 'success');
                welcomeMessage.textContent = `ยินดีต้อนรับ, ${data.user.displayName || data.user.email}!`;
                setTimeout(() => showView('dashboard-view'), 1500);
            } else {
                displayMessage(profileMessage, data.error, 'error');
            }
        } catch(err) {
            displayMessage(profileMessage, 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
        }
    });

    featureGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.card');
        if (card) {
            const feature = card.dataset.feature;
            if (feature === 'face-analysis') {
                window.location.href = '/face-analysis';
            } else {
                alert(`คุณเลือกฟีเจอร์: ${feature}`);
            }
        }
    });

    // --- Initialization ---
    function initialize() {
        if (localStorage.getItem('currentUser')) {
            updateUIForLoggedInUser();
        } else {
            showView('login-view');
        }
    }

    initialize();
});
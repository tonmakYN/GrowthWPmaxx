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

    // Forms & Inputs
    const signupForm = document.getElementById('signup-form');
    const loginForm = document.getElementById('login-form');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const profileForm = document.getElementById('profile-form');
    const profileDisplayNameInput = document.getElementById('profile-displayName');
    // **Elements ใหม่สำหรับฟีเจอร์ที่เพิ่ม**
    const loginPasswordInput = document.getElementById('login-password-input');
    
    // Buttons & Links
    const showSignupLink = document.getElementById('show-signup');
    const showLoginLinkFromSignup = document.getElementById('show-login-from-signup');
    const showLoginLinkFromForgot = document.getElementById('show-login-from-forgot');
    const showForgotPasswordLink = document.getElementById('show-forgot-password');
    const logoutButton = document.getElementById('logout-button');
    const profileButton = document.getElementById('profile-button');
    const backToDashboardButton = document.getElementById('back-to-dashboard-button');
    const loginTogglePasswordBtn = document.getElementById('login-toggle-password-btn'); // **Element ใหม่**

    // Display Elements
    const signupMessage = document.getElementById('signup-message');
    const loginMessage = document.getElementById('login-message');
    const forgotPasswordMessage = document.getElementById('forgot-password-message');
    const profileMessage = document.getElementById('profile-message');
    const welcomeMessage = document.getElementById('welcome-message');
    const featureGrid = document.getElementById('feature-grid');
    const profileEmailDisplay = document.getElementById('profile-email');
    const loginTogglePasswordIcon = document.getElementById('login-toggle-password-icon'); // **Element ใหม่**

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
        element.className = `message text-center text-sm h-6 mt-2 ${type === 'success' ? 'text-success' : 'text-error'}`;
    }

    // **ฟังก์ชันใหม่: จัดการ Animation โหลด**
    function toggleLoading(form, isLoading) {
        const button = form.querySelector('button[type="submit"]');
        if (!button) return;
        const text = button.querySelector('.login-text');
        const loader = button.querySelector('.login-loader');
        
        if (isLoading) {
            button.disabled = true;
            if (text) text.style.display = 'none';
            if (loader) loader.style.display = 'inline-block';
        } else {
            button.disabled = false;
            if (text) text.style.display = 'inline-block';
            if (loader) loader.style.display = 'none';
        }
    }

    // --- UI Update Logic ---
    function updateUIForLoggedInUser(user) {
        if (!user) {
            return updateUIForLoggedOutUser();
        }
        localStorage.setItem('currentUser', JSON.stringify(user));
        welcomeMessage.textContent = `ยินดีต้อนรับ, ${user.displayName || user.email}!`;
        profileEmailDisplay.textContent = user.email;
        profileDisplayNameInput.value = user.displayName || '';
        showView('dashboard-view');
    }

    function updateUIForLoggedOutUser() {
        localStorage.removeItem('currentUser');
        fetch(`${backendUrl}/api/logout`, { method: 'POST', credentials: 'include' }); 
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

    // **Event Listener ใหม่: ปุ่มดูรหัสผ่าน**
    if (loginTogglePasswordBtn) {
        loginTogglePasswordBtn.addEventListener('click', () => {
            const isPassword = loginPasswordInput.type === 'password';
            loginPasswordInput.type = isPassword ? 'text' : 'password';
            loginTogglePasswordIcon.className = `fas ${isPassword ? 'fa-eye-slash' : 'fa-eye'}`;
        });
    }

    // การ Submit Form (Signup)
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

    // การ Submit Form (Login) - แก้ไข Bug และเพิ่ม Feature
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        displayMessage(loginMessage, '', '');
        toggleLoading(loginForm, true); // <--- เริ่ม Animation

        const email = e.target.email.value;
        const password = e.target.password.value;
        
        try {
            const response = await fetch(`${backendUrl}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
                credentials: 'include'
            });
            const data = await response.json();
            if (response.ok) {
                // **แก้ไข Bug:** เรียก updateUIForLoggedInUser โดยตรง ไม่ต้องเรียก initialize() ซ้ำ
                updateUIForLoggedInUser(data.user);
            } else {
                displayMessage(loginMessage, data.error, 'error');
            }
        } catch (err) {
            displayMessage(loginMessage, 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
        } finally {
            toggleLoading(loginForm, false); // <--- หยุด Animation เสมอไม่ว่าจะสำเร็จหรือล้มเหลว
        }
    });

    // การ Submit Form (Forgot Password)
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

    // การ Submit Form (Profile)
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const displayName = profileDisplayNameInput.value;
        try {
            const response = await fetch(`${backendUrl}/api/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ displayName }),
                credentials: 'include'
            });
            const data = await response.json();
            if(response.ok) {
                updateUIForLoggedInUser(data.user);
                displayMessage(profileMessage, 'บันทึกข้อมูลสำเร็จ!', 'success');
                setTimeout(() => showView('dashboard-view'), 1500);
            } else {
                displayMessage(profileMessage, data.error, 'error');
            }
        } catch(err) {
            displayMessage(profileMessage, 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
        }
    });
    
    // การคลิก Feature Card
    featureGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.card');
        if (card) {
            const feature = card.dataset.feature;
            if (feature === 'face-analysis') {
                window.location.href = '/face-analysis';
            } else {
                alert(`คุณเลือกฟีเจอร์: ${feature} (ยังไม่ได้พัฒนา)`);
            }
        }
    });

    // --- Initialization ---
    async function initialize() {
        try {
            const response = await fetch(`${backendUrl}/api/current_user`, {
                credentials: 'include'
            });
            if (response.ok) {
                const user = await response.json();
                if (user) {
                    updateUIForLoggedInUser(user);
                } else {
                    showView('login-view');
                }
            } else {
                showView('login-view');
            }
        } catch (error) {
            console.error("Could not fetch auth status", error);
            showView('login-view');
        }
    }

    initialize();
});
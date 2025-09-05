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
    
    // Buttons & Links
    const showSignupLink = document.getElementById('show-signup');
    const showLoginLinkFromSignup = document.getElementById('show-login-from-signup');
    const showLoginLinkFromForgot = document.getElementById('show-login-from-forgot');
    const showForgotPasswordLink = document.getElementById('show-forgot-password');
    const logoutButton = document.getElementById('logout-button');
    const profileButton = document.getElementById('profile-button');
    const backToDashboardButton = document.getElementById('back-to-dashboard-button');

    // Display Elements
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
        element.className = `message text-center text-sm h-6 mt-2 ${type === 'success' ? 'text-success' : 'text-error'}`;
    }

    // --- UI Update Logic ---
    function updateUIForLoggedInUser(user) {
        if (!user) return;
        localStorage.setItem('currentUser', JSON.stringify(user));
        
        welcomeMessage.textContent = `ยินดีต้อนรับ, ${user.displayName || user.email}!`;
        profileEmailDisplay.textContent = user.email;
        profileDisplayNameInput.value = user.displayName || '';
        showView('dashboard-view');
    }

    function updateUIForLoggedOutUser() {
        localStorage.removeItem('currentUser');
        // ส่งคำขอ POST ไปยัง /api/logout เพื่อทำลาย session ที่เซิร์ฟเวอร์
        fetch(`${backendUrl}/api/logout`, { 
            method: 'POST',
            // headers for credentials might be needed if your CORS is strict
            // credentials: 'include' 
        }); 
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
                updateUIForLoggedInUser(data.user);
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
                body: JSON.stringify({ displayName }), // Passport session knows who the user is
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

    // --- **การเปลี่ยนแปลงที่สำคัญที่สุด** ---
    // Initialization: ตรวจสอบสถานะการล็อกอินกับเซิร์ฟเวอร์ทุกครั้งที่โหลดหน้า
    async function initialize() {
        try {
            const response = await fetch(`${backendUrl}/api/current_user`);
            if (response.ok) {
                const user = await response.json();
                if (user) {
                    // ถ้าเซิร์ฟเวอร์บอกว่ามีคนล็อกอินอยู่ ให้แสดงหน้า Dashboard
                    updateUIForLoggedInUser(user);
                } else {
                    // ถ้าไม่มี session ที่เซิร์ฟเวอร์ ให้แสดงหน้า Login
                    updateUIForLoggedOutUser();
                }
            } else {
                // ถ้า API ตอบกลับมาเป็น Error (เช่น 401) ให้แสดงหน้า Login
                updateUIForLoggedOutUser();
            }
        } catch (error) {
            // ถ้าเชื่อมต่อ Backend ไม่ได้เลย ให้แสดงหน้า Login
            console.error("Could not connect to backend to check auth status", error);
            updateUIForLoggedOutUser();
        }
    }

    initialize();
});
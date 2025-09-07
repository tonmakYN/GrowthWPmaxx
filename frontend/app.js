document.addEventListener('DOMContentLoaded', () => {
    const backendUrl = ''; // ใช้ relative path เนื่องจาก frontend + backend อยู่ service เดียวกัน

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
    const loginPasswordInput = document.getElementById('login-password-input');

    const showSignupLink = document.getElementById('show-signup');
    const showLoginLinkFromSignup = document.getElementById('show-login-from-signup');
    const showLoginLinkFromForgot = document.getElementById('show-login-from-forgot');
    const showForgotPasswordLink = document.getElementById('show-forgot-password');
    const logoutButton = document.getElementById('logout-button');
    const profileButton = document.getElementById('profile-button');
    const backToDashboardButton = document.getElementById('back-to-dashboard-button');
    const loginTogglePasswordBtn = document.getElementById('login-toggle-password-btn');

    const signupMessage = document.getElementById('signup-message');
    const loginMessage = document.getElementById('login-message');
    const forgotPasswordMessage = document.getElementById('forgot-password-message');
    const profileMessage = document.getElementById('profile-message');
    const welcomeMessage = document.getElementById('welcome-message');
    const featureGrid = document.getElementById('feature-grid');
    const profileEmailDisplay = document.getElementById('profile-email');
    const loginTogglePasswordIcon = document.getElementById('login-toggle-password-icon');

    // --- State Management ---
    let currentUser = null;

    // --- Utility Functions ---
    function showView(viewId) {
        allViews.forEach(v => { if (v) v.style.display = 'none'; });
        const active = document.getElementById(viewId);
        if (active) active.style.display = 'block';
    }

    function displayMessage(el, msg, type) {
        if (!el) return;
        el.textContent = msg;
        el.className = `message text-center text-sm h-6 mt-2 ${type === 'success' ? 'text-success' : 'text-error'}`;
    }

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

    function updateUIForLoggedInUser(user) {
        if (!user) return updateUIForLoggedOutUser();
        
        currentUser = user;
        localStorage.setItem('currentUser', JSON.stringify(user));
        
        // อัปเดต UI elements
        if (welcomeMessage) {
            welcomeMessage.textContent = `ยินดีต้อนรับ, ${user.displayName || user.email}!`;
        }
        if (profileEmailDisplay) {
            profileEmailDisplay.textContent = user.email;
        }
        if (profileDisplayNameInput) {
            profileDisplayNameInput.value = user.displayName || '';
        }
        
        // ตรวจสอบ URL path ปัจจุบันเพื่อตัดสินใจว่าจะแสดง view ไหน
        const currentPath = window.location.pathname;
        
        if (currentPath === '/main' || currentPath === '/') {
            showView('dashboard-view');
        } else if (currentPath === '/login') {
            // ถ้า login แล้วแต่ยังอยู่หน้า login ให้ redirect
            window.location.href = '/main';
        }
    }

    function updateUIForLoggedOutUser() {
        currentUser = null;
        localStorage.removeItem('currentUser');
        
        // ล้าง session ที่ server
        fetch(`${backendUrl}/api/logout`, { 
            method: 'GET', 
            credentials: 'include' 
        }).catch(() => {}); // ไม่สนใจ error
        
        // Redirect ไปหน้า login ถ้าอยู่หน้าที่ต้อง auth
        const currentPath = window.location.pathname;
        if (currentPath === '/main' || currentPath === '/face-analysis') {
            window.location.href = '/login';
        } else {
            showView('login-view');
        }
    }

    // --- Event Listeners ---
    if (showSignupLink) {
        showSignupLink.addEventListener('click', e => { 
            e.preventDefault(); 
            showView('signup-view'); 
        });
    }
    
    if (showLoginLinkFromSignup) {
        showLoginLinkFromSignup.addEventListener('click', e => { 
            e.preventDefault(); 
            showView('login-view'); 
        });
    }
    
    if (showForgotPasswordLink) {
        showForgotPasswordLink.addEventListener('click', e => { 
            e.preventDefault(); 
            showView('forgot-password-view'); 
        });
    }
    
    if (showLoginLinkFromForgot) {
        showLoginLinkFromForgot.addEventListener('click', e => { 
            e.preventDefault(); 
            showView('login-view'); 
        });
    }
    
    if (profileButton) {
        profileButton.addEventListener('click', e => { 
            e.preventDefault(); 
            showView('profile-view'); 
        });
    }
    
    if (backToDashboardButton) {
        backToDashboardButton.addEventListener('click', e => { 
            e.preventDefault(); 
            showView('dashboard-view'); 
        });
    }
    
    if (logoutButton) {
        logoutButton.addEventListener('click', e => { 
            e.preventDefault(); 
            updateUIForLoggedOutUser(); 
        });
    }

    if (loginTogglePasswordBtn && loginPasswordInput && loginTogglePasswordIcon) {
        loginTogglePasswordBtn.addEventListener('click', () => {
            const isPassword = loginPasswordInput.type === 'password';
            loginPasswordInput.type = isPassword ? 'text' : 'password';
            loginTogglePasswordIcon.className = `fas ${isPassword ? 'fa-eye-slash' : 'fa-eye'}`;
        });
    }

    // --- Form Handlers ---
    if (signupForm) {
        signupForm.addEventListener('submit', async e => {
            e.preventDefault();
            displayMessage(signupMessage, '', '');
            
            const email = e.target.email.value;
            const password = e.target.password.value;
            
            try {
                const res = await fetch(`${backendUrl}/api/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                    credentials: 'include'
                });
                
                const data = await res.json();
                
                if (res.ok) {
                    displayMessage(signupMessage, 'สมัครสำเร็จ! กำลังเข้าสู่ระบบ...', 'success');
                    // สมัครสำเร็จแล้ว backend จะ set session ให้อัตโนมัติ
                    setTimeout(() => {
                        updateUIForLoggedInUser(data.user);
                    }, 1000);
                } else {
                    displayMessage(signupMessage, data.error, 'error');
                }
            } catch (error) {
                displayMessage(signupMessage, 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async e => {
            e.preventDefault();
            displayMessage(loginMessage, '', '');
            toggleLoading(loginForm, true);
            
            const email = e.target.email.value;
            const password = e.target.password.value;
            
            try {
                const res = await fetch(`${backendUrl}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                    credentials: 'include'
                });
                
                const data = await res.json();
                
                if (res.ok) {
                    displayMessage(loginMessage, 'เข้าสู่ระบบสำเร็จ!', 'success');
                    setTimeout(() => {
                        updateUIForLoggedInUser(data.user);
                    }, 500);
                } else {
                    displayMessage(loginMessage, data.error, 'error');
                }
            } catch (error) {
                displayMessage(loginMessage, 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
            } finally {
                toggleLoading(loginForm, false);
            }
        });
    }

    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async e => {
            e.preventDefault();
            displayMessage(forgotPasswordMessage, '', '');
            
            const email = e.target.email.value;
            
            try {
                const res = await fetch(`${backendUrl}/api/request-reset`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email }),
                });
                
                const data = await res.json();
                
                if (res.ok) {
                    displayMessage(forgotPasswordMessage, 'ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลแล้ว', 'success');
                } else {
                    displayMessage(forgotPasswordMessage, data.error, 'error');
                }
            } catch (error) {
                displayMessage(forgotPasswordMessage, 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
            }
        });
    }

    if (profileForm) {
        profileForm.addEventListener('submit', async e => {
            e.preventDefault();
            displayMessage(profileMessage, '', '');
            
            const displayName = profileDisplayNameInput.value;
            
            try {
                const res = await fetch(`${backendUrl}/api/profile`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ displayName }),
                    credentials: 'include'
                });
                
                const data = await res.json();
                
                if (res.ok) {
                    updateUIForLoggedInUser(data.user);
                    displayMessage(profileMessage, 'บันทึกข้อมูลสำเร็จ!', 'success');
                    setTimeout(() => showView('dashboard-view'), 1500);
                } else {
                    displayMessage(profileMessage, data.error, 'error');
                }
            } catch (error) {
                displayMessage(profileMessage, 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
            }
        });
    }

    // Feature Grid Handler
    if (featureGrid) {
        featureGrid.addEventListener('click', e => {
            const card = e.target.closest('.card');
            if (!card) return;
            
            const feature = card.dataset.feature;
            
            if (feature === 'face-analysis') {
                window.location.href = '/face-analysis';
            } else {
                alert(`คุณเลือกฟีเจอร์: ${feature} (ยังไม่ได้พัฒนา)`);
            }
        });
    }

    // --- Google OAuth ---
    const googleBtn = document.querySelector('a[href="/auth/google"]');
    if (googleBtn) {
        googleBtn.addEventListener('click', e => {
            e.preventDefault();
            window.location.href = `${backendUrl}/auth/google`;
        });
    }

    // --- URL-based Navigation ---
    function handleCurrentPath() {
        const currentPath = window.location.pathname;
        
        if (currentPath === '/login') {
            if (currentUser) {
                // ถ้า login แล้วให้ redirect ไป main
                window.location.href = '/main';
            } else {
                showView('login-view');
            }
        } else if (currentPath === '/main' || currentPath === '/') {
            if (currentUser) {
                showView('dashboard-view');
            } else {
                // ถ้ายังไม่ login ให้ redirect ไป login
                window.location.href = '/login';
            }
        }
    }

    // --- Initialization ---
    async function initialize() {
        try {
            // เช็คสถานะ authentication จาก server
            const res = await fetch(`${backendUrl}/api/current_user`, { 
                credentials: 'include' 
            });
            
            if (res.ok) {
                const user = await res.json();
                if (user) {
                    updateUIForLoggedInUser(user);
                } else {
                    updateUIForLoggedOutUser();
                }
            } else {
                updateUIForLoggedOutUser();
            }
        } catch (error) {
            console.error('Initialize error:', error);
            updateUIForLoggedOutUser();
        }
        
        // จัดการ path ปัจจุบัน
        handleCurrentPath();
    }

    // เริ่มต้นแอป
    initialize();
});
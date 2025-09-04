document.addEventListener('DOMContentLoaded', () => {
    // กำหนด URL ของ Backend ของคุณ (อัปเดตสำหรับ Production แล้ว)
    const backendUrl = 'https://growthwpmaxx-backend.onrender.com';

    // --- DOM Elements ---
    const signupContainer = document.getElementById('signup-container');
    const loginContainer = document.getElementById('login-container');
    const dashboard = document.getElementById('dashboard');

    const signupForm = document.getElementById('signup-form');
    const signupEmailInput = document.getElementById('signup-email');
    const signupPasswordInput = document.getElementById('signup-password');
    const signupMessage = document.getElementById('signup-message');

    const loginForm = document.getElementById('login-form');
    const loginEmailInput = document.getElementById('login-email');
    const loginPasswordInput = document.getElementById('login-password');
    const loginMessage = document.getElementById('login-message');

    const welcomeMessage = document.getElementById('welcome-message');
    const logoutButton = document.getElementById('logout-button');
    const featureGrid = document.getElementById('feature-grid');

    // --- State Management ---
    let currentUser = null;

    // --- Helper Functions ---
    function showSection(sectionId) {
        signupContainer.style.display = 'none';
        loginContainer.style.display = 'none';
        dashboard.style.display = 'none';

        if (sectionId === 'signup') {
            signupContainer.style.display = 'block';
        } else if (sectionId === 'login') {
            loginContainer.style.display = 'block';
        } else if (sectionId === 'dashboard') {
            dashboard.style.display = 'block';
        }
    }

    function displayMessage(element, message, type) {
        element.textContent = message;
        element.className = `message ${type}`;
        element.style.display = 'block';
    }

    function hideMessage(element) {
        element.style.display = 'none';
        element.textContent = '';
        element.className = 'message';
    }

    // --- UI Update Logic ---
    function updateUIForLoggedInUser() {
        // ดึงข้อมูลผู้ใช้ที่เก็บไว้ใน localStorage เพื่อแสดงอีเมลที่ถูกต้อง
        const storedUser = JSON.parse(localStorage.getItem('currentUser'));
        if (storedUser && storedUser.email) {
            welcomeMessage.textContent = `ยินดีต้อนรับ, ${storedUser.email}!`;
        } else {
             welcomeMessage.textContent = `ยินดีต้อนรับ!`;
        }
        showSection('dashboard');
    }

    function updateUIForLoggedOutUser() {
        currentUser = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser'); // ล้างข้อมูลผู้ใช้ออกจากระบบ
        showSection('login');
    }

    // --- Event Listeners ---

    // สลับฟอร์ม Login/Signup
    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        hideMessage(signupMessage);
        showSection('login');
    });

    document.getElementById('show-signup').addEventListener('click', (e) => {
        e.preventDefault();
        hideMessage(loginMessage);
        showSection('signup');
    });

    // สมัครสมาชิก
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideMessage(signupMessage);

        const email = signupEmailInput.value;
        const password = signupPasswordInput.value;

        try {
            const response = await fetch(`${backendUrl}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();
            if (response.ok) {
                displayMessage(signupMessage, data.message, 'success');
                signupForm.reset();
                setTimeout(() => {
                    hideMessage(signupMessage);
                    showSection('login'); // หน่วงเวลา 2 วิ แล้วค่อยพาไปหน้า Login
                }, 2000);
            } else {
                displayMessage(signupMessage, data.error || 'เกิดข้อผิดพลาดในการสมัครสมาชิก', 'error');
            }
        } catch (error) {
            displayMessage(signupMessage, 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
        }
    });

    // เข้าสู่ระบบ
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideMessage(loginMessage);

        const email = loginEmailInput.value;
        const password = loginPasswordInput.value;

        try {
            const response = await fetch(`${backendUrl}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();
            if (response.ok) {
                currentUser = data.user;
                localStorage.setItem('authToken', 'dummy_token_for_now');
                localStorage.setItem('currentUser', JSON.stringify(data.user)); // เก็บข้อมูลผู้ใช้
                loginForm.reset();
                updateUIForLoggedInUser();
            } else {
                displayMessage(loginMessage, data.error || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', 'error');
            }
        } catch (error) {
            displayMessage(loginMessage, 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
        }
    });

    // ออกจากระบบ
    logoutButton.addEventListener('click', (e) => {
        e.preventDefault();
        updateUIForLoggedOutUser();
    });

    // คลิก Feature Card
    featureGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.feature-card');
        if (card) {
            const feature = card.dataset.feature;
            alert(`คุณเลือกฟีเจอร์: ${feature}! (ยังไม่ได้พัฒนาหน้านี้)`);
        }
    });

    // --- Initialize ---
    // เริ่มต้นที่หน้า Login เสมอเมื่อเปิดเว็บ
    showSection('login');
});


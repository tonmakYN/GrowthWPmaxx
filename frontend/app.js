const backendUrl = 'http://localhost:3000'; // URL ของ Backend

// DOM Elements
const signupContainer = document.getElementById('signup-container');
const loginContainer = document.getElementById('login-container');
const dashboard = document.getElementById('dashboard');
// ... (Get all other form elements here)

// Form submission logic for signup and login
// (This would involve adding event listeners to forms,
// using fetch to POST data to /api/register and /api/login,
// and showing success/error messages)

// Toggle between forms
document.getElementById('show-login').addEventListener('click', () => {
    signupContainer.style.display = 'none';
    loginContainer.style.display = 'block';
});

document.getElementById('show-signup').addEventListener('click', () => {
    loginContainer.style.display = 'none';
    signupContainer.style.display = 'block';
});
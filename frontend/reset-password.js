document.addEventListener('DOMContentLoaded', () => {
    const backendUrl = 'https://growthwpmaxx-backend.onrender.com'; // ** URL ของ Backend **

    const resetForm = document.getElementById('reset-password-form');
    const passwordInput = document.getElementById('new-password');
    const messageElement = document.getElementById('reset-message');

    // ดึง Token จาก URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
        messageElement.textContent = 'ไม่พบ Token สำหรับการรีเซ็ต';
        messageElement.className = 'message error';
        resetForm.style.display = 'none';
    }

    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        messageElement.textContent = '';
        messageElement.className = 'message';

        const password = passwordInput.value;

        try {
            const response = await fetch(`${backendUrl}/api/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password })
            });

            const data = await response.json();

            if (response.ok) {
                messageElement.textContent = data.message;
                messageElement.className = 'message success';
                resetForm.style.display = 'none';
                setTimeout(() => {
                    window.location.href = '/'; // กลับไปหน้า Login
                }, 3000);
            } else {
                messageElement.textContent = data.error || 'เกิดข้อผิดพลาด';
                messageElement.className = 'message error';
            }
        } catch (error) {
            messageElement.textContent = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้';
            messageElement.className = 'message error';
        }
    });
});


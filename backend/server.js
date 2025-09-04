const express = require('express');
const express = require('express');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const axios = require('axios');
const { createProxyMiddleware } = require('http-proxy-middleware');

// --- Initializations ---
const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// --- Configuration ---
// **แก้ไขแล้ว:** URL ของ Frontend ตอนนี้ก็คือ URL ของ Backend Service เอง
const frontendURL = "https://growthwpmaxx-backend.onrender.com"; 

// URL ภายในสำหรับเรียกใช้ AI Service (ดึงจาก Environment Variables)
const aiServiceURL = process.env.AI_SERVICE_URL;

// --- Middleware ---
app.use(cors({ origin: frontendURL }));
app.use(express.json({ limit: '10mb' })); // รองรับการอัปโหลดรูปภาพขนาดใหญ่

// --- Static File Serving (ส่วนที่ 1) ---
// ทำให้เซิร์ฟเวอร์รู้จักและสามารถส่งไฟล์ในโฟลเดอร์ frontend ได้
app.use(express.static(path.join(__dirname, '../frontend')));

// --- API Routes for Users & Auth ---
// API: สมัครสมาชิก
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password || password.length < 6) {
        return res.status(400).json({ error: 'กรุณากรอกอีเมลและรหัสผ่านอย่างน้อย 6 ตัวอักษร' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await prisma.user.create({ data: { email, password: hashedPassword } });
        res.status(201).json({ message: 'สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ' });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' });
        }
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสมัครสมาชิก' });
    }
});

// API: เข้าสู่ระบบ
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
        }
        res.status(200).json({ message: 'เข้าสู่ระบบสำเร็จ!', user: { id: user.id, email: user.email, displayName: user.displayName } });
    } catch (error) {
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' });
    }
});

// API: ขอรีเซ็ตรหัสผ่าน
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
        const resetToken = crypto.randomBytes(32).toString('hex');
        const passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        const passwordResetAt = new Date(Date.now() + 10 * 60 * 1000); // 10 นาที
        
        await prisma.user.update({
            where: { email },
            data: { passwordResetToken, passwordResetAt },
        });

        const resetURL = `${frontendURL}/reset-password.html?token=${resetToken}`;
        console.log('--- PASSWORD RESET LINK (FOR TESTING) ---');
        console.log(resetURL);
        console.log('-----------------------------------------');
    }
    // ส่งข้อความเดียวกันเสมอเพื่อความปลอดภัย
    res.status(200).json({ message: 'หากอีเมลของคุณมีอยู่ในระบบ เราได้ส่งลิงก์สำหรับรีเซ็ตรหัสผ่านไปให้แล้ว' });
});

// API: ตั้งรหัสผ่านใหม่
app.post('/api/reset-password', async (req, res) => {
    const { token, password } = req.body;
    if(!token || !password) return res.status(400).json({error: 'ข้อมูลไม่ครบถ้วน'});

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await prisma.user.findFirst({
        where: { passwordResetToken: hashedToken, passwordResetAt: { gt: new Date() } },
    });

    if (!user) {
        return res.status(400).json({ error: 'Token ไม่ถูกต้องหรือหมดอายุแล้ว' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword, passwordResetToken: null, passwordResetAt: null },
    });

    res.status(200).json({ message: 'เปลี่ยนรหัสผ่านสำเร็จ! กรุณาเข้าสู่ระบบอีกครั้ง' });
});

// --- Reverse Proxy for AI Service ---
// ทำหน้าที่เป็น "ประตู" ส่งต่อคำขอไปยังแผนก AI (Python)
// คำขอทั้งหมดที่ขึ้นต้นด้วย /api/ai จะถูกส่งต่อไปยัง AI Service
app.use('/api/ai', createProxyMiddleware({
    target: aiServiceURL,
    changeOrigin: true,
    pathRewrite: {
        '^/api/ai': '', // ลบ /api/ai ออกจาก path ก่อนส่งต่อไป
    },
    onError: (err, req, res) => {
        console.error('Proxy Error:', err);
        res.status(500).json({ error: 'ไม่สามารถเชื่อมต่อกับ AI Service ได้' });
    }
}));


// --- Catch-all Route for Frontend (ส่วนที่ 2) ---
// สำหรับ URL อื่นๆ ทั้งหมด ให้ส่งไฟล์ index.html กลับไปเสมอ
// เพื่อให้การ routing ในหน้าเว็บ (เช่น /login, /profile) ทำงานได้
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// --- Start the Server ---
app.listen(PORT, () => {
    console.log(`🚀 Unified server is running on port ${PORT}`);
});
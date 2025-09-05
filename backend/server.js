const express = require('express');
const cors = require('cors');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// --- Initializations ---
const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 10000;

// --- Configuration ---
const frontendURL = "https://growthwpmaxx-backend.onrender.com";
const aiServiceURL = process.env.AI_SERVICE_URL;

// --- Middleware ---
app.use(cors({ origin: frontendURL }));
app.use(express.json({ limit: '10mb' })); // รองรับการอัปโหลดรูปภาพขนาดใหญ่

// --- API Routes for Users & Auth ---

// API: สมัครสมาชิก (พร้อมระบบส่ง Email Verification)
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password || password.length < 6) {
        return res.status(400).json({ error: 'กรุณากรอกอีเมลและรหัสผ่านอย่างน้อย 6 ตัวอักษร' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const hashedVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

        await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                verificationToken: hashedVerificationToken,
            },
        });

        // ในระบบจริง ส่วนนี้คือการส่งอีเมล
        const verificationURL = `${frontendURL}/verify-email.html?token=${verificationToken}`;
        console.log('--- EMAIL VERIFICATION LINK (FOR TESTING) ---');
        console.log(verificationURL);
        console.log('---------------------------------------------');

        res.status(201).json({ message: 'สมัครสมาชิกสำเร็จ! กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชีของคุณ' });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' });
        }
        console.error("Register Error:", error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสมัครสมาชิก' });
    }
});

// API: ยืนยันอีเมล
app.get('/api/verify-email', async (req, res) => {
    const { token } = req.query;
    if (!token) {
        return res.status(400).redirect(`${frontendURL}/verification-failed.html`);
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    try {
        const user = await prisma.user.findFirst({
            where: { verificationToken: hashedToken },
        });

        if (!user) {
            return res.status(400).redirect(`${frontendURL}/verification-failed.html`);
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                isVerified: true,
                verificationToken: null, // ล้าง token ทิ้งหลังใช้งาน
            },
        });
        
        return res.redirect(`${frontendURL}/verification-success.html`);

    } catch (error) {
        console.error("Verification Error:", error);
        return res.status(500).redirect(`${frontendURL}/verification-failed.html`);
    }
});


// API: เข้าสู่ระบบ (พร้อมเช็คสถานะ Verified)
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
        }

        if (!user.isVerified) {
            return res.status(403).json({ error: 'บัญชีของคุณยังไม่ได้ยืนยันทางอีเมล' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
        }

        res.status(200).json({ message: 'เข้าสู่ระบบสำเร็จ!', user: { id: user.id, email: user.email, displayName: user.displayName } });
    } catch (error) {
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' });
    }
});

// API: จัดการโปรไฟล์
app.put('/api/profile', async (req, res) => {
    // (โค้ดส่วนนี้เหมือนเดิม)
});

// API: ขอรีเซ็ตรหัสผ่าน
app.post('/api/forgot-password', async (req, res) => {
    // (โค้ดส่วนนี้เหมือนเดิม)
});

// API: ตั้งรหัสผ่านใหม่
app.post('/api/reset-password', async (req, res) => {
    // (โค้ดส่วนนี้เหมือนเดิม)
});


// --- Reverse Proxy for AI Service ---
// ทำหน้าที่เป็น "ประตู" ส่งต่อคำขอไปยังแผนก AI (Python)
app.use('/api/ai', createProxyMiddleware({
    target: aiServiceURL,
    changeOrigin: true,
    proxyTimeout: 90000, // ขยายเวลารอเป็น 90 วินาที
    pathRewrite: {
        '^/api/ai': '', // ลบ /api/ai ออกจาก path ก่อนส่งต่อไปยัง Python Service
    },
    onError: (err, req, res) => {
        console.error('Proxy Error:', err);
        res.status(500).json({ error: 'ไม่สามารถเชื่อมต่อกับ AI Service ได้' });
    }
}));


// --- Serve Frontend Files & Handle SPA Routing ---
// **กฎพิเศษ:** ถ้ามีคนขอ /face-analysis ให้ส่งไฟล์ face-analysis.html ไปให้
app.get('/face-analysis', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/face-analysis.html'));
});

// **กฎทั่วไป:** ทำให้เซิร์ฟเวอร์รู้จักและสามารถส่งไฟล์อื่นๆ ในโฟลเดอร์ frontend ได้ (เช่น .css, .js)
app.use(express.static(path.join(__dirname, '../frontend')));

// **กฎสุดท้าย:** สำหรับ URL อื่นๆ ทั้งหมด (เช่น /login, /profile) ให้ส่งไฟล์ index.html กลับไปเสมอ
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});


// --- Start the Server ---
app.listen(PORT, () => {
    console.log(`🚀 Unified server is running on port ${PORT}`);
});
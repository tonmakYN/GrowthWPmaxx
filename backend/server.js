const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// *** สำคัญ: แก้ไข URL นี้ให้เป็น URL ของ Frontend ของคุณบน Render ***
const frontendURL = "https://growthwpmaxx.onrender.com";

app.use(cors({ origin: frontendURL }));
app.use(express.json());

// --- API Endpoints ---

// API: สมัครสมาชิก
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password || password.length < 6) {
        return res.status(400).json({ error: 'กรุณากรอกอีเมลและรหัสผ่านอย่างน้อย 6 ตัวอักษร' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
            },
        });
        res.status(201).json({ message: 'สมัครสมาชิกสำเร็จ!', user: { id: newUser.id, email: newUser.email } });
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

    if (!email || !password) {
        return res.status(400).json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' });
    }

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

// API: ดึงข้อมูลโปรไฟล์
app.get('/api/profile/:email', async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { email: req.params.email } });
        if (!user) {
            return res.status(404).json({ error: 'ไม่พบผู้ใช้งาน' });
        }
        res.status(200).json({ email: user.email, displayName: user.displayName });
    } catch (error) {
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    }
});

// API: อัปเดตโปรไฟล์ (ชื่อที่แสดงผล)
app.put('/api/profile', async (req, res) => {
    const { email, displayName } = req.body;
    try {
        const updatedUser = await prisma.user.update({
            where: { email },
            data: { displayName },
        });
        res.status(200).json({ message: 'บันทึกข้อมูลสำเร็จ!', user: { displayName: updatedUser.displayName } });
    } catch (error) {
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' });
    }
});

// API: ขอรีเซ็ตรหัสผ่าน
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
        return res.status(200).json({ message: 'หากอีเมลของคุณมีอยู่ในระบบ เราได้ส่งลิงก์สำหรับรีเซ็ตรหัสผ่านไปให้แล้ว' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const passwordResetAt = new Date(Date.now() + 10 * 60 * 1000); // 10 นาที

    await prisma.user.update({
        where: { email },
        data: { passwordResetToken, passwordResetAt },
    });

    try {
        const resetURL = `${frontendURL}/reset-password.html?token=${resetToken}`;
        console.log('--- PASSWORD RESET LINK (FOR TESTING) ---');
        console.log('--- ลิงก์นี้จะถูกส่งไปที่อีเมลของผู้ใช้ในระบบจริง ---');
        console.log(resetURL);
        console.log('-----------------------------------------');
        res.status(200).json({ message: 'คำขอรีเซ็ตรหัสผ่านถูกส่งแล้ว' });
    } catch (error) {
        await prisma.user.update({
            where: { email },
            data: { passwordResetToken: null, passwordResetAt: null },
        });
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการส่งลิงก์รีเซ็ต' });
    }
});

// API: ตั้งรหัสผ่านใหม่
app.post('/api/reset-password', async (req, res) => {
    const { token, password } = req.body;

    if (!token || !password || password.length < 6) {
        return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง' });
    }
    
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    const user = await prisma.user.findFirst({
        where: {
            passwordResetToken: hashedToken,
            passwordResetAt: { gt: new Date() }, // Check if token is not expired
        },
    });

    if (!user) {
        return res.status(400).json({ error: 'Token ไม่ถูกต้องหรือหมดอายุแล้ว' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
        where: { id: user.id },
        data: {
            password: hashedPassword,
            passwordResetToken: null,
            passwordResetAt: null,
        },
    });

    res.status(200).json({ message: 'เปลี่ยนรหัสผ่านสำเร็จ! กรุณาเข้าสู่ระบบอีกครั้ง' });
});


// --- Server Start ---
app.listen(PORT, () => {
    console.log(`🚀 Backend server is running on port ${PORT}`);
});


const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000; // สำหรับ Render

// --- Middleware ---
// **สำคัญ:** ตั้งค่า CORS สำหรับตอน Deploy
// const frontendURL = process.env.FRONTEND_URL || 'http://127.0.0.1:5500';
// app.use(cors({ origin: frontendURL }));
app.use(cors()); // สำหรับทดสอบบนเครื่อง local
app.use(express.json());

// --- API Endpoints ---

// 1. API สำหรับสมัครสมาชิก
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10); // เข้ารหัสผ่าน
        const newUser = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
            },
        });
        res.status(201).json({ message: 'สมัครสมาชิกสำเร็จ!', user: { id: newUser.id, email: newUser.email } });
    } catch (error) {
        if (error.code === 'P2002') { // Prisma error code for unique constraint violation
            return res.status(409).json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' });
        }
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสมัครสมาชิก' });
    }
});

// 2. API สำหรับเข้าสู่ระบบ
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' });
    }

    try {
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
        }

        res.status(200).json({ message: 'เข้าสู่ระบบสำเร็จ!', user: { id: user.id, email: user.email } });
    } catch (error) {
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' });
    }
});

// --- Start the server ---
app.listen(PORT, () => {
    console.log(`🚀 Backend server is running at http://localhost:${PORT}`);
});
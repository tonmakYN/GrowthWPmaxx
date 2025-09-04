const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

// --- Initializations ---
const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000; // ใช้ Port ที่ Render กำหนดให้ หรือ 3000 สำหรับ local
const frontendURL = "https://growthwpmaxx.onrender.com"; // URL ของ Frontend ของคุณ

// --- Middleware ---
// ตั้งค่า CORS ให้รับ Request จาก Frontend ของคุณเท่านั้นเพื่อความปลอดภัย
app.use(cors({ origin: frontendURL }));
app.use(express.json()); // ทำให้เซิร์ฟเวอร์เข้าใจข้อมูลแบบ JSON ที่ส่งมา

// --- API Endpoints ---

// API #1: สำหรับสมัครสมาชิก (/api/register)
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;

    // ตรวจสอบข้อมูลเบื้องต้น
    if (!email || !password || password.length < 6) {
        return res.status(400).json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน (อย่างน้อย 6 ตัวอักษร)' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10); // เข้ารหัสผ่านก่อนบันทึก
        
        const newUser = await prisma.user.create({
            data: {
                email: email,
                password: hashedPassword,
            },
        });
        
        // ส่ง response กลับไปเฉพาะข้อมูลที่ปลอดภัย
        res.status(201).json({ message: 'สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ', user: { id: newUser.id, email: newUser.email } });
    } catch (error) {
        // จัดการกรณีอีเมลซ้ำ (Prisma error code P2002)
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' });
        }
        // จัดการ Error อื่นๆ
        console.error("Register Error:", error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ' });
    }
});

// API #2: สำหรับเข้าสู่ระบบ (/api/login)
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' });
    }

    try {
        // ค้นหาผู้ใช้จากอีเมล
        const user = await prisma.user.findUnique({ where: { email } });

        // ตรวจสอบว่ามีผู้ใช้หรือไม่ และรหัสผ่านตรงกันหรือไม่
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
        }
        
        // ในโปรเจกต์จริง ส่วนนี้ควรจะสร้าง JWT Token เพื่อส่งกลับไปให้ Frontend
        // แต่สำหรับตอนนี้ เราจะส่งแค่ข้อมูลผู้ใช้กลับไปก่อน
        res.status(200).json({ message: 'เข้าสู่ระบบสำเร็จ!', user: { id: user.id, email: user.email } });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ' });
    }
});

// API #3: สำหรับตรวจสอบสถานะการ Login (จำลอง) (/api/check-auth)
// Frontend จะเรียกใช้ API นี้เพื่อตรวจสอบว่าผู้ใช้ยังล็อกอินอยู่หรือไม่
app.get('/api/check-auth', async (req, res) => {
    // ในโปรเจกต์จริง คุณจะตรวจสอบ JWT Token ที่ส่งมาใน Header 'Authorization'
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        
        // --- ส่วนนี้สำหรับอนาคตเมื่อใช้ JWT Token จริง ---
        // try {
        //     const decoded = jwt.verify(token, process.env.JWT_SECRET);
        //     const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        //     if (user) {
        //         return res.status(200).json({ isAuthenticated: true, user: { id: user.id, email: user.email } });
        //     }
        // } catch (error) {
        //     return res.status(401).json({ isAuthenticated: false, error: 'Token ไม่ถูกต้อง' });
        // }
        // ----------------------------------------------------

        // สำหรับตอนนี้ เราจะจำลองว่าถ้ามี Token (ที่เราตั้งชื่อว่า 'dummy_token_for_now') ก็คือล็อกอินอยู่
        // และจำลองข้อมูลผู้ใช้กลับไป
        if (token === 'dummy_token_for_now') {
            // เราไม่มีข้อมูล user จริงจาก token จำลอง, จึงส่งข้อมูลจำลองกลับไป
            return res.status(200).json({ isAuthenticated: true, user: { id: 1, email: 'user@example.com' } });
        }
    }
    
    // ถ้าไม่มี Token หรือ Token ไม่ถูกต้อง
    return res.status(401).json({ isAuthenticated: false, error: 'ไม่ได้รับอนุญาต' });
});

// --- Start the Server ---
app.listen(PORT, () => {
    console.log(`🚀 Backend server is running and listening on port ${PORT}`);
});

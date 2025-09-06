const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch'); // สำหรับ Google OAuth token verify

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

// --- Config Google OAuth ---
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// --- Middleware ---
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24*60*60*1000 }
}));

// Serve frontend
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// --- API Routes ---
// Register
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'กรอกข้อมูลให้ครบ' });

    try {
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) return res.status(400).json({ error: 'อีเมลนี้มีอยู่แล้ว' });

        const user = await prisma.user.create({ data: { email, password } });
        req.session.userId = user.id;
        res.json({ message: 'สมัครสมาชิกสำเร็จ', user: { email: user.email, displayName: user.displayName } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'กรอกข้อมูลให้ครบ' });

    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.password !== password) return res.status(400).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });

        req.session.userId = user.id;
        res.json({ user: { email: user.email, displayName: user.displayName } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
    }
});

// Google OAuth redirect
app.get('/auth/google', (req, res) => {
    const redirect_uri = `${BASE_URL}/auth/google/callback`;
    const scope = encodeURIComponent('email profile');
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${redirect_uri}&response_type=code&scope=${scope}`;
    res.redirect(url);
});

// Google OAuth callback
app.get('/auth/google/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.redirect('/');

    try {
        // แลก token
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: `${BASE_URL}/auth/google/callback`,
                grant_type: 'authorization_code'
            })
        });
        const tokenData = await tokenRes.json();
        const access_token = tokenData.access_token;

        // เอา profile
        const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${access_token}` }
        });
        const profile = await profileRes.json();
        if (!profile.email) return res.redirect('/');

        // สร้างหรือหา user
        let user = await prisma.user.findUnique({ where: { email: profile.email } });
        if (!user) {
            user = await prisma.user.create({
                data: { email: profile.email, googleId: profile.id, displayName: profile.name }
            });
        } else if (!user.googleId) {
            await prisma.user.update({ where: { email: profile.email }, data: { googleId: profile.id } });
        }

        // สร้าง session
        req.session.userId = user.id;

        res.redirect('/'); // SPA จะจัดการ redirect หน้า dashboard
    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
});

// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ message: 'ออกจากระบบแล้ว' });
    });
});

// Current user
app.get('/api/current_user', async (req, res) => {
    if (!req.session.userId) return res.json(null);
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
    if (!user) return res.json(null);
    res.json({ email: user.email, displayName: user.displayName });
});

// Update profile
app.put('/api/profile', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'ต้องเข้าสู่ระบบ' });
    const { displayName } = req.body;

    try {
        const user = await prisma.user.update({
            where: { id: req.session.userId },
            data: { displayName }
        });
        res.json({ user: { email: user.email, displayName: user.displayName } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
    }
});

// --- SPA fallback ---
app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on ${BASE_URL}`);
});

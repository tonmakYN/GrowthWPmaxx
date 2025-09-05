const express = require('express');
const cors = require('cors');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');

// --- Initializations ---
const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 10000;

// --- Configuration ---
const frontendURL = "https://growthwpmaxx-backend.onrender.com";
const aiServiceURL = process.env.AI_SERVICE_URL;

// --- Middleware ---
app.use(cors({ origin: frontendURL, credentials: true })); // credentials: true สำคัญสำหรับ session
app.use(express.json({ limit: '10mb' }));

// --- Session Middleware for Passport ---
app.use(session({
    secret: process.env.SESSION_SECRET, // ต้องตั้งค่านี้ใน Environment Variable
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
    }
}));
app.use(passport.initialize());
app.use(passport.session());

// --- Passport.js Configuration for Google Strategy ---
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${frontendURL}/auth/google/callback`
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
        const user = await prisma.user.findUnique({
            where: { email: profile.emails[0].value },
        });

        if (user) {
            // ถ้าเจอผู้ใช้ด้วยอีเมล, อัปเดต Google ID ถ้ายังไม่มี
            if (!user.googleId) {
                const updatedUser = await prisma.user.update({
                    where: { email: profile.emails[0].value },
                    data: { googleId: profile.id, avatarUrl: profile.photos[0].value }
                });
                return done(null, updatedUser);
            }
            return done(null, user);
        } else {
            // ถ้าไม่เจอ, สร้างผู้ใช้ใหม่
            const newUser = await prisma.user.create({
                data: {
                    googleId: profile.id,
                    email: profile.emails[0].value,
                    displayName: profile.displayName,
                    avatarUrl: profile.photos[0].value,
                }
            });
            return done(null, newUser);
        }
    } catch (error) {
        return done(error, null);
    }
  }
));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await prisma.user.findUnique({ where: { id } });
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});


// --- API Routes for Users & Auth ---

// API: สมัครสมาชิกด้วย Email/Password (ระบบเดิม)
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

// API: เข้าสู่ระบบด้วย Email/Password (ระบบเดิม)
app.post('/api/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) { return next(err); }
        if (!user) { return res.status(401).json({ error: info.message }); }
        req.logIn(user, (err) => {
            if (err) { return next(err); }
            return res.status(200).json({ message: 'เข้าสู่ระบบสำเร็จ!', user: { id: user.id, email: user.email, displayName: user.displayName } });
        });
    })(req, res, next);
});

// --- **API ใหม่สำหรับ Google Sign-In** ---
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    // ล็อกอินสำเร็จ, redirect กลับไปที่หน้าหลัก
    res.redirect('/');
  }
);

// API: ตรวจสอบสถานะการล็อกอินปัจจุบัน
app.get('/api/current_user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ id: req.user.id, email: req.user.email, displayName: req.user.displayName, avatarUrl: req.user.avatarUrl });
    } else {
        res.status(401).json(null);
    }
});

// API: ออกจากระบบ
app.post('/api/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) { return next(err); }
        req.session.destroy();
        res.status(200).json({ message: 'ออกจากระบบสำเร็จ' });
    });
});

// --- API อื่นๆ (Profile, Forgot Password, AI Proxy) ---
app.put('/api/profile', (req, res) => { /* ... โค้ดโปรไฟล์ ... */ });
app.post('/api/forgot-password', (req, res) => { /* ... โค้ดลืมรหัสผ่าน ... */ });
app.post('/api/reset-password', (req, res) => { /* ... โค้ดรีเซ็ตรหัสผ่าน ... */ });
app.use('/api/ai', createProxyMiddleware({ /* ... โค้ด Proxy ... */ }));


// --- Serve Frontend Files & Handle SPA Routing ---
app.use(express.static(path.join(__dirname, '../frontend')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// --- Start the Server ---
app.listen(PORT, () => {
    console.log(`🚀 Unified server is running on port ${PORT}`);
});
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const { PrismaSessionStore } = require('@quixo3/prisma-session-store');

// --- Initializations ---
const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 10000;

// --- Configuration ---
const frontendURL = "https://growthwpmaxx-backend.onrender.com";
const aiServiceURL = process.env.AI_SERVICE_URL;
const googleClientID = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

// --- **DEBUGGING STEP: ตรวจสอบ Environment Variables** ---
console.log("--- INITIALIZING SERVER: CHECKING ENV VARS ---");
console.log(`GOOGLE_CLIENT_ID loaded: ${googleClientID ? 'Yes, value starts with ' + googleClientID.substring(0, 5) : 'NO, a value was NOT FOUND'}`);
console.log(`GOOGLE_CLIENT_SECRET loaded: ${googleClientSecret ? 'Yes, a value is present' : 'NO, a value was NOT FOUND'}`);
console.log(`AI_SERVICE_URL loaded: ${aiServiceURL || 'NO, a value was NOT FOUND'}`);
console.log("-------------------------------------------------");
// --- END DEBUGGING STEP ---


// --- Middleware ---
app.use(cors({ origin: frontendURL, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// --- Session Middleware (Production Ready) ---
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
    },
    store: new PrismaSessionStore(
        prisma,
        {
            checkPeriod: 2 * 60 * 1000,
            dbRecordIdIsSessionId: true,
            dbRecordIdFunction: undefined,
        }
    )
}));
app.use(passport.initialize());
app.use(passport.session());

// --- Passport.js Configuration ---

// 1. Google Strategy
passport.use(new GoogleStrategy({
    clientID: googleClientID,
    clientSecret: googleClientSecret,
    callbackURL: `${frontendURL}/auth/google/callback`
  },
  async (accessToken, refreshToken, profile, done) => {
    console.log("[Google Strategy] Callback received from Google.");
    try {
        console.log("[Google Strategy] User profile received:", profile.displayName, profile.emails[0].value);
        
        console.log("[Google Strategy] Searching for user in database...");
        const user = await prisma.user.findUnique({
            where: { email: profile.emails[0].value },
        });

        if (user) {
            console.log("[Google Strategy] Found existing user:", user.email);
            if (!user.googleId) {
                console.log("[Google Strategy] Linking Google ID to existing user...");
                const updatedUser = await prisma.user.update({
                    where: { email: profile.emails[0].value },
                    data: { googleId: profile.id, avatarUrl: profile.photos[0].value }
                });
                console.log("[Google Strategy] User updated. Passing to done().");
                return done(null, updatedUser);
            }
            console.log("[Google Strategy] User already linked. Passing to done().");
            return done(null, user);
        } else {
            console.log("[Google Strategy] User not found. Creating new user...");
            const newUser = await prisma.user.create({
                data: {
                    googleId: profile.id,
                    email: profile.emails[0].value,
                    displayName: profile.displayName,
                    avatarUrl: profile.photos[0].value,
                }
            });
            console.log("[Google Strategy] New user created. Passing to done().");
            return done(null, newUser);
        }
    } catch (error) {
        console.error("[Google Strategy] Error during database operation:", error);
        return done(error, null);
    }
  }
));

// (ส่วนที่เหลือของโค้ดเหมือนเดิมทุกประการ)
// 2. Local (Email/Password) Strategy
passport.use(new LocalStrategy({ usernameField: 'email' },
    async (email, password, done) => {
        try {
            const user = await prisma.user.findUnique({ where: { email } });
            if (!user) {
                return done(null, false, { message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
            }
            if (!user.password) {
                return done(null, false, { message: 'บัญชีนี้ถูกสร้างผ่าน Google กรุณาล็อกอินด้วย Google' });
            }
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return done(null, false, { message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
            }
            return done(null, user);
        } catch (error) {
            return done(error);
        }
    }
));

passport.serializeUser((user, done) => {
    console.log("[Passport Serialize] Storing user ID in session:", user.id);
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    console.log("[Passport Deserialize] Fetching user from session ID:", id);
    try {
        const user = await prisma.user.findUnique({ where: { id } });
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});


// --- API Routes for Users & Auth ---

// API: สมัครสมาชิกด้วย Email/Password
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

// API: เข้าสู่ระบบด้วย Email/Password (ใช้ Passport)
app.post('/api/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) { return next(err); }
        if (!user) { return res.status(401).json({ error: info.message }); }
        req.logIn(user, (err) => {
            if (err) { return next(err); }
            return res.status(200).json({ message: 'เข้าสู่ระบบสำเร็จ!', user: { id: user.id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl } });
        });
    })(req, res, next);
});

// API: Routes สำหรับ Google Sign-In
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);
app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    console.log("[Google Callback] Authentication successful. Redirecting to frontend.");
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
        res.clearCookie('connect.sid');
        res.status(200).json({ message: 'ออกจากระบบสำเร็จ' });
    });
});

// API: จัดการโปรไฟล์
app.put('/api/profile', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อน' });
    }
    const { displayName } = req.body;
    try {
        const updatedUser = await prisma.user.update({
            where: { id: req.user.id },
            data: { displayName },
        });
        res.status(200).json({
            message: 'อัปเดตโปรไฟล์สำเร็จ!',
            user: { id: updatedUser.id, email: updatedUser.email, displayName: updatedUser.displayName, avatarUrl: updatedUser.avatarUrl },
        });
    } catch (error) {
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปเดตโปรไฟล์' });
    }
});

// API: ขอรีเซ็ตรหัสผ่าน (สำหรับ Email/Password)
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && user.password) {
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
app.use('/api/ai', createProxyMiddleware({
    target: aiServiceURL,
    changeOrigin: true,
    proxyTimeout: 90000,
    pathRewrite: { '^/api/ai': '' },
}));

// --- Serve Frontend Files & Handle SPA Routing ---
app.use(express.static(path.join(__dirname, '../frontend')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// --- Start the Server ---
app.listen(PORT, () => {
    console.log(`🚀 Unified server is running on port ${PORT}`);
});
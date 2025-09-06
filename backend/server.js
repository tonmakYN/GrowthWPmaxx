import express from 'express';
import session from 'express-session';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import bodyParser from 'body-parser';
import cors from 'cors';

const prisma = new PrismaClient();
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const SESSION_SECRET = process.env.SESSION_SECRET || 'supersecret';

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(bodyParser.json());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 วัน
}));

// Serve frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// --- Helper functions ---
function isLoggedIn(req) {
  return req.session && req.session.userId;
}

// --- Auth Routes ---

// Register
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' });

  try {
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashed }
    });
    res.json({ message: 'สมัครสมาชิกสำเร็จ!' });
  } catch (err) {
    if (err.code === 'P2002') { // unique constraint
      return res.status(400).json({ error: 'อีเมลนี้ถูกใช้แล้ว' });
    }
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' });

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) return res.status(400).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });

    req.session.userId = user.id;
    res.json({ user: { email: user.email, displayName: user.displayName } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'ไม่สามารถออกจากระบบได้' });
    res.json({ message: 'ออกจากระบบเรียบร้อย' });
  });
});

// Current user
app.get('/api/current_user', async (req, res) => {
  if (!isLoggedIn(req)) return res.json(null);
  const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
  if (!user) return res.json(null);
  res.json({ email: user.email, displayName: user.displayName });
});

// Update profile
app.put('/api/profile', async (req, res) => {
  if (!isLoggedIn(req)) return res.status(401).json({ error: 'ยังไม่ได้เข้าสู่ระบบ' });
  const { displayName } = req.body;
  try {
    const user = await prisma.user.update({
      where: { id: req.session.userId },
      data: { displayName }
    });
    res.json({ user: { email: user.email, displayName: user.displayName } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'ไม่สามารถบันทึกข้อมูลได้' });
  }
});

// Forgot password (dummy, ทำจริงต้องส่งอีเมล)
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.json({ message: 'ถ้ามีอีเมลนี้ ระบบจะส่งลิงก์รีเซ็ตให้' });
  // สร้าง token และบันทึก
  const token = Math.random().toString(36).substr(2, 8);
  await prisma.user.update({ where: { email }, data: { passwordResetToken: token, passwordResetAt: new Date() } });
  // ส่งอีเมลจริงต้อง integrate service อีเมล
  console.log(`Reset token for ${email}: ${token}`);
  res.json({ message: 'ลิงก์รีเซ็ตถูกส่งไปยังอีเมลของคุณ (จำลอง)' });
});

// --- Google OAuth ---
app.get('/auth/google', (req, res) => {
  const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const options = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${FRONTEND_URL}/auth/google/callback`,
    response_type: 'code',
    scope: 'profile email'
  });
  res.redirect(`${rootUrl}?${options.toString()}`);
});

// Google OAuth callback
app.get('/auth/google/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.redirect('/');

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${FRONTEND_URL}/auth/google/callback`,
        grant_type: 'authorization_code'
      })
    });
    const tokenData = await tokenRes.json();
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const profile = await profileRes.json();
    // เช็คว่ามี user อยู่แล้วไหม
    let user = await prisma.user.findUnique({ where: { googleId: profile.id } });
    if (!user) {
      user = await prisma.user.create({ data: { email: profile.email, googleId: profile.id, displayName: profile.name } });
    }
    req.session.userId = user.id;
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.redirect('/');
  }
});

// Serve all other routes to index.html (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

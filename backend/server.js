import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import bodyParser from "body-parser";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const db = new PrismaClient();
const app = express();

// --- Setup ---
app.use(cors());
app.use(bodyParser.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "defaultsecret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
  })
);
app.use(passport.initialize());
app.use(passport.session());

// --- Helper Middleware ---
function ensureAuth(req, res, next) {
  if (req.isAuthenticated() || req.session.userId) return next();
  
  // สำหรับ API requests ให้ส่ง JSON error
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // สำหรับ HTML pages ให้ redirect ไป login
  res.redirect('/login');
}

// --- Google OAuth (เดิม) ---
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await db.user.findUnique({ where: { googleId: profile.id } });

        if (!user) {
          user = await db.user.create({
            data: {
              email: profile.emails[0].value,
              displayName: profile.displayName,
              googleId: profile.id,
              avatarUrl: profile.photos[0]?.value || null,
            },
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await db.user.findUnique({ where: { id } });
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// --- Auth Routes (เดิม + เพิ่ม current_user) ---
app.post("/api/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);

    const user = await db.user.create({
      data: { email, password: hashed },
    });

    req.session.userId = user.id;
    res.json({ message: "User registered", user });
  } catch (err) {
    res.status(400).json({ error: "Registration failed" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await db.user.findUnique({ where: { email } });

    if (!user || !user.password) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: "Invalid credentials" });

    req.session.userId = user.id;
    res.json({ message: "Login success", user });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
});

// เพิ่ม API สำหรับเช็คสถานะ user ปัจจุบัน
app.get("/api/current_user", async (req, res) => {
  try {
    if (!req.session.userId && !req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = req.session.userId || req.user.id;
    const user = await db.user.findUnique({ 
      where: { id: userId },
      select: { id: true, email: true, displayName: true, avatarUrl: true }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Failed to get user" });
  }
});

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    res.redirect("/main");
  }
);

app.get("/api/logout", (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.redirect("/login");
    });
  });
});

// --- Reset Password (เดิม) ---
app.post("/api/request-reset", async (req, res) => {
  const { email } = req.body;
  const token = crypto.randomBytes(32).toString("hex");

  try {
    await db.user.update({
      where: { email },
      data: {
        passwordResetToken: token,
        passwordResetAt: new Date(Date.now() + 3600000), // 1 hr
      },
    });

    res.json({ message: "Password reset requested", token });
  } catch (err) {
    res.status(400).json({ error: "User not found" });
  }
});

app.post("/api/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;
  const user = await db.user.findUnique({
    where: { passwordResetToken: token },
  });

  if (!user) return res.status(400).json({ error: "Invalid token" });

  if (user.passwordResetAt < new Date()) {
    return res.status(400).json({ error: "Token expired" });
  }

  const hashed = await bcrypt.hash(newPassword, 10);

  await db.user.update({
    where: { id: user.id },
    data: {
      password: hashed,
      passwordResetToken: null,
      passwordResetAt: null,
    },
  });

  res.json({ message: "Password reset success" });
});

// เพิ่ม API สำหรับอัปเดต profile
app.put("/api/profile", ensureAuth, async (req, res) => {
  try {
    const userId = req.session.userId || req.user.id;
    const { displayName } = req.body;

    const user = await db.user.update({
      where: { id: userId },
      data: { displayName },
      select: { id: true, email: true, displayName: true, avatarUrl: true }
    });

    res.json({ message: "Profile updated", user });
  } catch (err) {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// --- AI Service Proxy (เพิ่มใหม่) ---
app.post("/api/ai/analyze", ensureAuth, async (req, res) => {
  try {
    // ถ้ามี AI service แยก ให้ส่งต่อไปที่นั่น
    const AI_SERVICE_URL = process.env.AI_SERVICE_URL;
    
    if (AI_SERVICE_URL) {
      const aiResponse = await fetch(`${AI_SERVICE_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      });
      
      if (!aiResponse.ok) {
        throw new Error('AI service unavailable');
      }
      
      const result = await aiResponse.json();
      res.json(result);
    } else {
      // Mock response สำหรับ development
      res.json({
        message: "AI service not configured",
        mock: true
      });
    }
  } catch (err) {
    console.error('AI service error:', err);
    res.status(500).json({ error: "AI analysis failed" });
  }
});

app.post("/api/ai/chat", ensureAuth, async (req, res) => {
  try {
    const AI_SERVICE_URL = process.env.AI_SERVICE_URL;
    
    if (AI_SERVICE_URL) {
      const aiResponse = await fetch(`${AI_SERVICE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      });
      
      if (!aiResponse.ok) {
        throw new Error('AI service unavailable');
      }
      
      const result = await aiResponse.json();
      res.json(result);
    } else {
      // Mock response
      res.json({
        response: "ขออภัยครับ AI Chat ยังไม่พร้อมใช้งานในขณะนี้"
      });
    }
  } catch (err) {
    console.error('AI chat error:', err);
    res.status(500).json({ error: "AI chat failed" });
  }
});

// --- Static Files ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "../frontend")));

// --- Route Handlers (ปรับปรุงใหม่) ---
// Root route - redirect based on auth
app.get("/", async (req, res) => {
  if (req.session.userId || req.isAuthenticated()) {
    res.redirect("/main");
  } else {
    res.redirect("/login");
  }
});

// Login page - redirect to main if already authenticated
app.get("/login", (req, res) => {
  if (req.session.userId || req.isAuthenticated()) {
    return res.redirect("/main");
  }
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// Main page - require authentication
app.get("/main", ensureAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// Face analysis - require authentication
app.get("/face-analysis", ensureAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/face-analysis.html"));
});

// Reset password page
app.get("/reset-password", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/reset-password.html"));
});

// Catch-all for other routes
app.get("*", (req, res) => {
  res.redirect("/login");
});

// --- Start Server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await db.$disconnect();
  process.exit(0);
});
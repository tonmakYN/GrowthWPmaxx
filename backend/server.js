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
  })
);
app.use(passport.initialize());
app.use(passport.session());

// --- Google OAuth ---
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

// --- Helper Middleware ---
function ensureAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect("/login.html");
}

// --- Auth Routes ---
app.post("/api/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);

    const user = await db.user.create({
      data: { email, password: hashed },
    });

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

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login.html" }),
  (req, res) => {
    res.redirect("/");
  }
);

app.get("/api/logout", (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.redirect("/login.html");
    });
  });
});

// --- Reset Password (ส่ง token แล้วเปลี่ยนรหัสผ่านใหม่) ---
import crypto from "crypto";

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

// --- Serve frontend ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "../frontend")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// --- Start ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

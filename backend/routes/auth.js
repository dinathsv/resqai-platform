"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const { requireAuth, signToken } = require("../middleware/auth");

const router = express.Router();

const ADMIN_TYPES = new Set(["admin", "administrator"]);

function isAdmin(userType) {
  return ADMIN_TYPES.has(
    String(userType || "")
      .trim()
      .toLowerCase(),
  );
}

function publicUser(user) {
  return {
    user_id: user.user_id,
    full_name: user.full_name,
    email: user.email,
    phone_number: user.phone_number,
    language_pref: user.language_pref,
    avatar_url: user.avatar_url,
    user_type: user.user_type,
    role: "admin",
  };
}

// POST /api/auth/login
// Administrator authentication
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedEmail.length > 255) {
      return res.status(400).json({
        success: false,
        error: "Invalid email address",
      });
    }

    const { rows } = await req.app.locals.pool.query(
      `
      SELECT
        user_id,
        full_name,
        email,
        phone_number,
        password_hash,
        language_pref,
        avatar_url,
        user_type,
        is_active
      FROM users
      WHERE LOWER(email) = $1
      LIMIT 1
      `,
      [normalizedEmail],
    );

    const user = rows[0];

    // Avoid revealing whether the email exists.
    if (!user || !user.password_hash) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
    }

    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
    }

    if (user.is_active !== true) {
      return res.status(403).json({
        success: false,
        error: "Account is disabled",
      });
    }

    if (!isAdmin(user.user_type)) {
      return res.status(403).json({
        success: false,
        error: "Administrator access required",
      });
    }

    const token = signToken({
      user_id: user.user_id,
      sub: String(user.user_id),
      email: user.email,
      role: "admin",
    });

    const admin = publicUser(user);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      access_token: token,
      token_type: "Bearer",
      user: admin,
    });
  } catch (err) {
    console.error("POST /api/auth/login error:", err.message);

    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

// GET /api/auth/me
// Get authenticated user profile
router.get("/me", requireAuth, async (req, res) => {
  try {
    const { rows } = await req.app.locals.pool.query(
      `
      SELECT
        user_id,
        full_name,
        email,
        phone_number,
        language_pref,
        avatar_url,
        user_type,
        is_active
      FROM users
      WHERE user_id = $1
      LIMIT 1
      `,
      [req.user.user_id],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    const user = rows[0];

    if (!user.is_active || !isAdmin(user.user_type)) {
      return res.status(403).json({
        error: "Administrator access required",
      });
    }

    return res.json(publicUser(user));
  } catch (err) {
    console.error("GET /api/auth/me error:", err.message);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

// PATCH /api/auth/me
// Update authenticated admin profile
router.patch("/me", requireAuth, async (req, res) => {
  try {
    // Confirm account still has admin access.
    const access = await req.app.locals.pool.query(
      `
      SELECT user_type, is_active
      FROM users
      WHERE user_id = $1
      LIMIT 1
      `,
      [req.user.user_id],
    );

    if (access.rows.length === 0) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    const account = access.rows[0];

    if (!account.is_active || !isAdmin(account.user_type)) {
      return res.status(403).json({
        error: "Administrator access required",
      });
    }

    const { full_name, avatar_url, phone_number } = req.body || {};

    const updates = [];
    const params = [];

    if (full_name !== undefined) {
      if (
        typeof full_name !== "string" ||
        !full_name.trim() ||
        full_name.trim().length > 150
      ) {
        return res.status(400).json({
          error: "Invalid full name",
        });
      }

      params.push(full_name.trim());
      updates.push(`full_name = $${params.length}`);
    }

    if (avatar_url !== undefined) {
      if (avatar_url !== null && typeof avatar_url !== "string") {
        return res.status(400).json({
          error: "Invalid avatar URL",
        });
      }

      params.push(avatar_url);
      updates.push(`avatar_url = $${params.length}`);
    }

    if (phone_number !== undefined) {
      if (
        phone_number !== null &&
        (typeof phone_number !== "string" || phone_number.length > 20)
      ) {
        return res.status(400).json({
          error: "Invalid phone number",
        });
      }

      params.push(phone_number);
      updates.push(`phone_number = $${params.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: "No fields provided to update",
      });
    }

    params.push(req.user.user_id);

    const { rows } = await req.app.locals.pool.query(
      `
      UPDATE users
      SET ${updates.join(", ")},
          updated_at = NOW()
      WHERE user_id = $${params.length}
        AND is_active = TRUE
        AND LOWER(TRIM(user_type)) IN (
          'admin', 'administrator'
        )
      RETURNING
        user_id,
        full_name,
        email,
        phone_number,
        language_pref,
        avatar_url,
        user_type
      `,
      params,
    );

    if (rows.length === 0) {
      return res.status(403).json({
        error: "Account unavailable or access denied",
      });
    }

    return res.json(publicUser(rows[0]));
  } catch (err) {
    console.error("PATCH /api/auth/me error:", err.message);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

module.exports = router;

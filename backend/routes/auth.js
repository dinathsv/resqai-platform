"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

function publicAdmin(admin) {
  return {
    admin_id: admin.admin_id,
    full_name: admin.full_name,
    email: admin.email,
    agency: admin.agency,
    district: admin.district,
    is_active: admin.is_active,
    role: "admin",
  };
}

// Verify administrator JWT and current database permissions.
async function requireAdmin(req, res, next) {
  try {
    if (!JWT_SECRET) {
      return res.status(503).json({
        success: false,
        error: "Authentication is not configured",
      });
    }

    const authorization = req.headers.authorization || "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);

    if (!match) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const decoded = jwt.verify(match[1], JWT_SECRET, {
      algorithms: ["HS256"],
    });

    if (
      typeof decoded !== "object" ||
      decoded.role !== "admin" ||
      !decoded.admin_id
    ) {
      return res.status(403).json({
        success: false,
        error: "Administrator access required",
      });
    }

    const { rows } = await req.app.locals.pool.query(
      `
      SELECT
        admin_id,
        full_name,
        email,
        agency,
        district,
        is_active
      FROM administrators
      WHERE admin_id = $1
      LIMIT 1
      `,
      [decoded.admin_id],
    );

    if (rows.length === 0 || !rows[0].is_active) {
      return res.status(403).json({
        success: false,
        error: "Administrator account unavailable",
      });
    }

    req.admin = rows[0];
    next();
  } catch (err) {
    if (
      err instanceof jwt.JsonWebTokenError ||
      err instanceof jwt.TokenExpiredError
    ) {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      });
    }

    console.error("Admin authentication error:", err.message);

    return res.status(500).json({
      success: false,
      error: "Authentication service error",
    });
  }
}

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    if (!JWT_SECRET || JWT_SECRET.length < 32) {
      console.error("JWT_SECRET missing or too short");

      return res.status(503).json({
        success: false,
        error: "Authentication service unavailable",
      });
    }

    const { email, password } = req.body || {};

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password ||
      email.length > 255 ||
      password.length > 1024
    ) {
      return res.status(400).json({
        success: false,
        error: "Valid email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const { rows } = await req.app.locals.pool.query(
      `
      SELECT
        admin_id,
        full_name,
        email,
        agency,
        district,
        password_hash,
        is_active
      FROM administrators
      WHERE LOWER(email) = $1
      LIMIT 1
      `,
      [normalizedEmail],
    );

    const admin = rows[0];

    // A constant dummy bcrypt hash helps reduce obvious
    // timing differences for missing accounts.
    const dummyHash =
      "$2b$12$C6UzMDM.H6dfI/f/IKcEeOaEAKg7S30FgWI7jO8ZeDfKq7qgP8HGC";

    const passwordValid = await bcrypt.compare(
      password,
      admin?.password_hash || dummyHash,
    );

    if (!admin || !passwordValid) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
    }

    if (!admin.is_active) {
      return res.status(403).json({
        success: false,
        error: "Administrator account is disabled",
      });
    }

    const token = jwt.sign(
      {
        sub: String(admin.admin_id),
        admin_id: admin.admin_id,
        role: "admin",
      },
      JWT_SECRET,
      {
        algorithm: "HS256",
        expiresIn: "8h",
      },
    );

    console.log("Administrator authenticated successfully");

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      access_token: token,
      token_type: "Bearer",
      expires_in: 28800,
      user: publicAdmin(admin),
      admin: publicAdmin(admin),
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
router.get("/me", requireAdmin, (req, res) => {
  return res.status(200).json(publicAdmin(req.admin));
});

// PATCH /api/auth/me
router.patch("/me", requireAdmin, async (req, res) => {
  try {
    const { full_name, agency, district } = req.body || {};

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

    for (const [field, value] of [
      ["agency", agency],
      ["district", district],
    ]) {
      if (value !== undefined) {
        if (
          value !== null &&
          (typeof value !== "string" || value.length > 150)
        ) {
          return res.status(400).json({
            error: `Invalid ${field}`,
          });
        }

        params.push(value);
        updates.push(`${field} = $${params.length}`);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: "No fields provided to update",
      });
    }

    params.push(req.admin.admin_id);

    const { rows } = await req.app.locals.pool.query(
      `
      UPDATE administrators
      SET ${updates.join(", ")},
          updated_at = NOW()
      WHERE admin_id = $${params.length}
        AND is_active = TRUE
      RETURNING
        admin_id,
        full_name,
        email,
        agency,
        district,
        is_active
      `,
      params,
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: "Administrator not found",
      });
    }

    return res.status(200).json(publicAdmin(rows[0]));
  } catch (err) {
    console.error("PATCH /api/auth/me error:", err.message);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

module.exports = router;

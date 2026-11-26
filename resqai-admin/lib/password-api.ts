const hostedAdminApi = "https://resqai-platform-backend.onrender.com";
const adminApi =
  process.env.NEXT_PUBLIC_AUTH_API_URL || process.env.NEXT_PUBLIC_API_URL;

export const PASSWORD_API_URL =
  process.env.NEXT_PUBLIC_PASSWORD_API_URL?.replace(/\/+$/, "") ||
  (adminApi?.replace(/\/+$/, "") === hostedAdminApi
    ? "https://resqai-platform-api.onrender.com"
    : "http://localhost:8000");

// In development, Vite's dev-server proxy forwards '/api' to localhost:5000,
// so a relative path works. In production the frontend and backend are on
// two different domains (e.g. Vercel + Render), so VITE_API_URL must point
// at the deployed API's origin — set it in the hosting platform's env vars.
const API_ORIGIN = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '';

export const API_BASE_URL = `${API_ORIGIN}/api/v1`;

import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
export const api = axios.create({ baseURL, withCredentials: true });
let accessToken = null;
let refreshPromise = null;

export function setAccessToken(token) {
  accessToken = token;
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status !== 401 ||
      !original ||
      original._retried ||
      original.url?.includes("/auth/login/") ||
      original.url?.includes("/auth/refresh/") ||
      original.url?.includes("/auth/register/")
    ) {
      return Promise.reject(error);
    }

    original._retried = true;
    try {
      if (!refreshPromise) {
        refreshPromise = axios
          .post(`${baseURL}/auth/refresh/`, null, { withCredentials: true })
          .then((response) => {
            accessToken = response.data.access;
            return accessToken;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }
      const token = await refreshPromise;
      original.headers.Authorization = `Bearer ${token}`;
      return api(original);
    } catch (refreshError) {
      accessToken = null;
      window.dispatchEvent(new Event("vetcare:session-expired"));
      return Promise.reject(refreshError);
    }
  },
);

export function getErrorMessage(error) {
  const data = error.response?.data;
  if (typeof data?.detail === "string") return data.detail;
  if (data && typeof data === "object") {
    return Object.entries(data)
      .map(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(", ") : value}`)
      .join(" ");
  }
  return "Something went wrong. Please try again.";
}

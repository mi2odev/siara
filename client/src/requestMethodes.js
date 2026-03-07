import axios from "axios";

const BASE_URL = "http://localhost:5000/api/";

function getStoredAccessToken() {
  const directToken = localStorage.getItem("accessToken");

  if (directToken) {
    return directToken;
  }

  try {
    const storedUser =
      localStorage.getItem("siara_user") || sessionStorage.getItem("siara_user");

    if (!storedUser) {
      return null;
    }

    const parsedUser = JSON.parse(storedUser);
    return parsedUser?.token || null;
  } catch {
    return null;
  }
}

export const publicRequest = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

export const userRequest = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

userRequest.interceptors.request.use(
  (config) => {
    const token = getStoredAccessToken();
    const nextConfig = { ...config };
    nextConfig.headers = nextConfig.headers || {};

    if (token) {
      nextConfig.headers.Authorization = `Bearer ${token}`;
    } else {
      delete nextConfig.headers.Authorization;
    }

    return nextConfig;
  },
  (error) => Promise.reject(error)
);

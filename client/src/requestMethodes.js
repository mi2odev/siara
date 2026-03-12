import axios from "axios";
import { getStoredAccessToken } from "./stores/authStorage";

const BASE_URL = "http://localhost:5000/api/";

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

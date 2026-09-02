import axios from 'axios';

export const BASE_URL = 'http://YOUR_IP:8000';
export const AI_URL = BASE_URL;

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

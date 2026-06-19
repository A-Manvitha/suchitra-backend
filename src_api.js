// src/api.js — Frontend API service for Suchitra Financial Services
// Import this in your React components to call the backend.
//
// Usage:
//   import api from './api';
//   const res = await api.submitLead({ name, phone, loanType, ... });

const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

// ── Helper ────────────────────────────────────────────────────────────────────
const getToken = () => localStorage.getItem("sfs_token");

const fetchJSON = async (endpoint, options = {}) => {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/** Submit a loan application / contact form */
export const submitLead = (payload) =>
  fetchJSON("/leads/submit", { method: "POST", body: JSON.stringify(payload) });

/** Send a contact message (Contact page) */
export const sendContact = (payload) =>
  fetchJSON("/email/contact", { method: "POST", body: JSON.stringify(payload) });

/** Health check */
export const checkHealth = () => fetchJSON("/health");

// ─────────────────────────────────────────────────────────────────────────────
// AUTH ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/** Login as admin; stores JWT in localStorage */
export const login = async (email, password) => {
  const data = await fetchJSON("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (data.token) localStorage.setItem("sfs_token", data.token);
  return data;
};

/** Logout — remove token */
export const logout = () => localStorage.removeItem("sfs_token");

/** Get current admin profile */
export const getMe = () => fetchJSON("/auth/me");

/** Change password */
export const changePassword = (currentPassword, newPassword) =>
  fetchJSON("/auth/change-password", {
    method: "PUT",
    body: JSON.stringify({ currentPassword, newPassword }),
  });

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: LEAD MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch paginated leads
 * @param {object} params — { page, limit, status, loanType, search, startDate, endDate }
 */
export const getLeads = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return fetchJSON(`/leads?${qs}`);
};

/** Get dashboard stats */
export const getStats = () => fetchJSON("/leads/stats");

/** Get single lead */
export const getLead = (id) => fetchJSON(`/leads/${id}`);

/** Update lead status */
export const updateLeadStatus = (id, status) =>
  fetchJSON(`/leads/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

/** Update lead details (notes, assignment, etc.) */
export const updateLead = (id, payload) =>
  fetchJSON(`/leads/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

/** Soft-delete a lead */
export const deleteLead = (id) => fetchJSON(`/leads/${id}`, { method: "DELETE" });

/** Download leads CSV — opens a download link */
export const exportCSV = () => {
  const token = getToken();
  window.open(`${BASE_URL}/leads/export/csv?token=${token}`, "_blank");
};

// ── Default export (all methods as object) ───────────────────────────────────
const api = {
  submitLead, sendContact, checkHealth,
  login, logout, getMe, changePassword,
  getLeads, getStats, getLead, updateLeadStatus, updateLead, deleteLead, exportCSV,
};

export default api;

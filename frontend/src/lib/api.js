import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 0,
});

export async function uploadFiles(files) {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const { data } = await api.post("/api/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function analyze(payload) {
  const { data } = await api.post("/api/analyze", payload);
  return data;
}

export async function completeAnalysis(payload) {
  const { data } = await api.post("/api/complete", payload);
  return data;
}

export async function requestFollowUp(payload) {
  const { data } = await api.post("/api/follow-up", payload);
  return data;
}

export async function getHealth() {
  const { data } = await api.get("/api/health");
  return data;
}

export async function getPatients() {
  const { data } = await api.get("/api/patients");
  return data;
}

export async function getPatient(patientId) {
  const { data } = await api.get(`/api/patients/${patientId}`);
  return data;
}

export async function savePatientProfile(payload) {
  const { data } = await api.post("/api/patients/save-profile", payload);
  return data;
}

export function getApiErrorMessage(error, fallback = "İşlem tamamlanamadı.") {
  const detail = error?.response?.data?.detail;
  if (!detail) return error?.message || fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        const path = Array.isArray(item.loc) ? item.loc.filter((part) => part !== "body").join(".") : "";
        return [path, item.msg].filter(Boolean).join(": ");
      })
      .filter(Boolean)
      .join(" | ") || fallback;
  }
  if (typeof detail === "object") {
    return detail.message || JSON.stringify(detail);
  }
  return fallback;
}

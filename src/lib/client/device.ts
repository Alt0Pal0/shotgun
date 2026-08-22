"use client";
import { api } from "./api";

const KEY = "ldp_device_key";
const ID = "ldp_device_id";

/** Anonymous, per-browser device key (no hardware identifiers). Registered server-side to obtain a device id. */
export function deviceKey(): string {
  let k = localStorage.getItem(KEY);
  if (!k) {
    k = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(KEY, k);
  }
  return k;
}

export function platformLabel(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "web";
}

export async function ensureDeviceId(): Promise<string> {
  const cached = sessionStorage.getItem(ID);
  if (cached) return cached;
  const { id } = await api.post<{ id: string }>("/api/devices", {
    key: deviceKey(),
    platform: platformLabel(),
    label: "This phone",
  });
  sessionStorage.setItem(ID, id);
  return id;
}

export function isStandalonePwa(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

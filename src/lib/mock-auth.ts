import { MOCK_USERS } from "@/lib/mock-data";

const STORAGE_KEY = "palpay_mock_user";

type MockUser = {
  id: string;
  full_name: string;
  role: "admin" | "worker";
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function resolveMockUserFromEmail(email: string): MockUser {
  const normalizedEmail = normalize(email);
  const emailPrefix = normalize(email.split("@")[0] ?? "");

  if (normalizedEmail.includes("admin")) {
    return MOCK_USERS.admin;
  }

  const workerMatch = MOCK_USERS.workers.find((worker) => {
    const normalizedName = normalize(worker.full_name);
    return normalizedEmail.includes(normalizedName) || normalizedName.includes(emailPrefix);
  });

  return workerMatch ?? MOCK_USERS.workers[0];
}

export function setMockUserSession(user: MockUser) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function clearMockUserSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function getMockUserSession() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as MockUser;
    if (!parsed?.id || !parsed?.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

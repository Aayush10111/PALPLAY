import { MOCK_USERS } from "@/lib/mock-data";

const STORAGE_KEY = "palpay_mock_user";
export const SIMPLE_LOGIN_PASSWORD = "123456";
export const SIMPLE_LOGIN_EMAILS = [
  "amy@palplay.com",
  "dino@palplay.com",
  "ellen@palplay.com",
  "hustel@palplay.com",
] as const;

type MockUser = {
  id: string;
  full_name: string;
  role: "admin" | "worker";
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function resolveSimpleMockUser(email: string, password: string): MockUser | null {
  const normalizedEmail = normalize(email.trim());
  const normalizedPassword = password.trim();
  const normalizedAllowedEmails = SIMPLE_LOGIN_EMAILS.map((item) => normalize(item));

  if (!normalizedAllowedEmails.includes(normalizedEmail) || normalizedPassword !== SIMPLE_LOGIN_PASSWORD) {
    return null;
  }

  const emailToWorkerName: Record<(typeof SIMPLE_LOGIN_EMAILS)[number], string> = {
    "amy@palplay.com": "AMY",
    "dino@palplay.com": "DINO",
    "ellen@palplay.com": "ELLEN",
    "hustel@palplay.com": "PAL PAY HUSTEL",
  };

  const matchedEmail =
    SIMPLE_LOGIN_EMAILS.find((item) => normalize(item) === normalizedEmail) ?? SIMPLE_LOGIN_EMAILS[0];
  const workerName = emailToWorkerName[matchedEmail];

  return MOCK_USERS.workers.find((worker) => worker.full_name === workerName) ?? MOCK_USERS.workers[0];
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

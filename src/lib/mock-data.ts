export const MOCK_USERS = {
  admin: { id: "58e5d439-4884-4a56-88f4-88e6247976e7", full_name: "PAL PAY HUSTEL ADMIN", role: "admin" as const },
  workers: [
    { id: "04f2c57a-e400-476a-b101-03eabc01bbfd", full_name: "AMY", role: "worker" as const },
    { id: "7627d83a-8c7b-4060-84f5-d5ea7c5f4af2", full_name: "DINO", role: "worker" as const },
    { id: "8a3023b9-11b7-49c1-8c90-7c78c01e7991", full_name: "ELLEN", role: "worker" as const },
    { id: "0ee3e45c-58a7-4e63-b10e-a021ce86485f", full_name: "PAL PAY HUSTEL", role: "worker" as const },
  ],
};

export const MOCK_TRANSACTIONS = [];
export const MOCK_SHIFTS = [];
export const MOCK_TASKS = [];

export function getMockProfiles() {
  return [MOCK_USERS.admin, ...MOCK_USERS.workers];
}

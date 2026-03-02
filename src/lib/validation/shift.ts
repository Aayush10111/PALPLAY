import { z } from "zod";

export const clockInSchema = z.object({
  notes: z.string().max(300).optional(),
});

export const clockOutSchema = z.object({
  shiftId: z.uuid(),
});



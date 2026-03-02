import { z } from "zod";

const baseSchema = z.object({
  occurred_at: z.iso.datetime(),
  customer_name: z.string().trim().min(1, "Customer name is required."),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export const incomeTransactionSchema = baseSchema.extend({
  type: z.literal("income"),
  amount_received: z.coerce.number().positive("Amount received must be greater than 0."),
  credit_loaded: z.coerce.number().min(0, "Credit loaded cannot be negative."),
  payment_tag_used: z.string().trim().min(1, "Payment tag is required."),
  game_played: z.string().trim().min(1, "Game played is required."),
});

export const cashoutTransactionSchema = baseSchema.extend({
  type: z.literal("cashout"),
  amount_cashed_out: z.coerce.number().positive("Amount cashed out must be greater than 0."),
  redeemed: z.boolean(),
  amount_redeemed: z.coerce.number().min(0, "Amount redeemed cannot be negative."),
}).superRefine((value, ctx) => {
  if (!value.redeemed && value.amount_redeemed !== 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["amount_redeemed"],
      message: "Amount redeemed must be 0 when redeemed is false.",
    });
  }

  if (value.redeemed && value.amount_redeemed > value.amount_cashed_out) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["amount_redeemed"],
      message: "Amount redeemed cannot exceed cashout amount.",
    });
  }
});

export type IncomeTransactionInput = z.infer<typeof incomeTransactionSchema>;
export type CashoutTransactionInput = z.infer<typeof cashoutTransactionSchema>;



import { z } from "zod";

export const lineItemSchema = z.object({
  description: z.string().trim().min(1),
  quantity: z.coerce.number().finite().positive(),
  unitPrice: z.coerce.number().finite().nonnegative(),
  total: z.coerce.number().finite().nonnegative(),
});

export const transactionInputSchema = z.object({
  supplierName: z.string().trim().min(1),
  supplierEmail: z.string().email(),
  invoiceNumber: z.string().trim().min(1),
  description: z.string().trim().min(1),
  amount: z.coerce.number().finite().positive(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  paymentTerms: z.string().trim().max(500).optional().nullable(),
  tax: z.coerce.number().finite().nonnegative().optional().nullable(),
  discount: z.coerce.number().finite().nonnegative().optional().nullable(),
  lineItems: z.array(lineItemSchema).default([]),
}).superRefine((value, context) => {
  if (value.dueDate < value.issueDate) {
    context.addIssue({ code: "custom", path: ["dueDate"], message: "Due date cannot precede issue date" });
  }
});

export const approvalSchema = z.object({
  approvedBy: z.string().trim().min(1).default("workspace-user"),
});

export const rejectionSchema = z.object({
  reason: z.string().trim().max(500).default(""),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(8).max(200),
    companyName: z.string().trim().min(2).max(120),
    role: z.enum(["PREPARER", "APPROVER"]).default("PREPARER"),
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const assistantQuestionSchema = z.object({
  question: z.string().trim().min(1).max(2000),
});

export type TransactionInput = z.infer<typeof transactionInputSchema>;

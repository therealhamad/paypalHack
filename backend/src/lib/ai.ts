import OpenAI from "openai";
import { z } from "zod";
import { db } from "./db";

// LLMs frequently emit numeric values as strings ("2850.00", "$1,180.40").
// Coerce defensively instead of rejecting the whole extraction.
const coerceNumber = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const cleaned = value.replace(/[$,€£\s]/g, "");
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? value : parsed;
}, z.number());

const coerceNullableNumber = z.preprocess((value) => {
  if (value === null || value === "" || value === undefined) return null;
  return value;
}, coerceNumber.nullable());

const extractedSchema = z.object({
  supplierName: z.string(),
  supplierEmail: z.string(),
  invoiceNumber: z.string(),
  description: z.string(),
  amount: coerceNumber,
  currency: z.string(),
  issueDate: z.string(),
  dueDate: z.string(),
  paymentTerms: z.string().nullable(),
  tax: coerceNullableNumber,
  discount: coerceNullableNumber,
  lineItems: z.array(z.object({ description: z.string(), quantity: coerceNumber, unitPrice: coerceNumber, total: coerceNumber })),
});

const modelResponseSchema = z.object({
  extracted: extractedSchema,
  missingInformation: z.array(z.string()).default([]),
  explanation: z.string().default(""),
  recommendedNextAction: z.string().default("Review the extracted details before approval."),
});

const analysisSchema = modelResponseSchema.extend({
  inconsistencies: z.array(z.string()),
  duplicateWarnings: z.array(z.string()),
  riskLevel: z.enum(["low", "medium", "high"]),
  findings: z.array(z.object({ severity: z.enum(["information", "needs_review", "warning", "critical"]), message: z.string(), evidence: z.string() })),
});

export type InvoiceAnalysis = z.infer<typeof analysisSchema>;

class AiProviderError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "AiProviderError";
  }
}

export function getAIClient() {
  const provider = process.env.AI_PROVIDER ?? "openrouter";
  const apiKey = provider === "openrouter" ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AiProviderError(
      provider === "openrouter"
        ? "AI integration is not configured. Set OPENROUTER_API_KEY."
        : "AI integration is not configured. Set OPENAI_API_KEY.",
    );
  }
  return new OpenAI({
    apiKey,
    ...(provider === "openrouter"
      ? {
          baseURL: "https://openrouter.ai/api/v1",
          defaultHeaders: {
            "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
            "X-Title": "RaisinPay",
          },
        }
      : {}),
  });
}

// A model spec is "<provider>:<model-id>" (e.g. "groq:openai/gpt-oss-120b"); a bare
// model id uses the default AI_PROVIDER client.
function clientForModel(spec: string): { client: OpenAI; model: string } {
  const separatorIndex = spec.indexOf(":");
  const prefix = separatorIndex > 0 ? spec.slice(0, separatorIndex) : "";
  const model = separatorIndex > 0 ? spec.slice(separatorIndex + 1) : spec;
  if (prefix === "groq") {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new AiProviderError("AI integration is not configured. Set GROQ_API_KEY.");
    return {
      client: new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" }),
      model,
    };
  }
  if (prefix === "openrouter") {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new AiProviderError("AI integration is not configured. Set OPENROUTER_API_KEY.");
    return {
      client: new OpenAI({
        apiKey,
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
          "X-Title": "RaisinPay",
        },
      }),
      model,
    };
  }
  return { client: getAIClient(), model };
}

export function getAIModel() {
  return process.env.AI_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
}

const FALLBACK_MODELS = (
  process.env.AI_FALLBACK_MODELS ?? "google/gemma-4-31b-it:free,google/gemma-4-26b-a4b-it:free,nvidia/nemotron-3.5-lightning:free"
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

export function candidateModels() {
  const candidates: string[] = [];
  // Groq first when configured — its request cap is far more generous than the
  // OpenRouter free-tier shared pools.
  if (process.env.GROQ_API_KEY) {
    candidates.push(`groq:${process.env.GROQ_AI_MODEL ?? "openai/gpt-oss-120b"}`);
  }
  candidates.push(getAIModel());
  for (const model of FALLBACK_MODELS) {
    if (!candidates.includes(model)) candidates.push(model);
  }
  return candidates;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isTransientError(error: unknown) {
  if (!(error instanceof AiProviderError)) return false;
  return error.status === undefined || error.status === 429 || (error.status !== undefined && error.status >= 500);
}

export async function chatCompletionWithFallback(
  messages: Array<{ role: "system" | "user"; content: string }>,
) {
  let lastError: unknown = null;
  for (const spec of candidateModels()) {
    const { client, model } = clientForModel(spec);
    try {
      return await client.chat.completions.create({ model, temperature: 0, messages });
    } catch (error) {
      lastError = error;
      const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number"
        ? error.status
        : undefined;
      if (status === 401 || status === 403) throw error;
      if (isTransientError(error) || status === 429 || (status !== undefined && status >= 500)) {
        await delay(1200);
        continue;
      }
      throw error;
    }
  }
  throw lastError ?? new AiProviderError("The AI provider could not be reached.");
}

function parseJson(content: string) {
  const normalized = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(normalized) as unknown;
}

function providerError(error: unknown) {
  const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number"
    ? error.status
    : undefined;
  if (status === 429) return new AiProviderError("The AI provider rate limit was reached. Please retry shortly.", status);
  if (status === 404) return new AiProviderError(`The configured AI model "${getAIModel()}" is unavailable. Check AI_MODEL.`, status);
  if (status && status >= 400) return new AiProviderError(`The AI provider rejected the request (${status}). Check the provider configuration and model.`, status);
  return new AiProviderError("The AI provider could not be reached. Please retry shortly.", status);
}

async function requestModel(invoiceText: string, structured: boolean, spec = candidateModels()[0] ?? getAIModel()) {
  const { client, model } = clientForModel(spec);
  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0,
      ...(structured ? { response_format: { type: "json_object" as const } } : {}),
      messages: [
        {
          role: "system",
          content: "Extract invoice details into the exact JSON shape requested. Do not invent values; use empty strings, null, or zero only when the document does not provide a value. All numeric values (amount, tax, discount, quantity, unitPrice, total) must be JSON numbers, never strings. Findings about arithmetic and duplicates are computed by the application, not by you. AI findings are advisory and are not fraud verification.",
        },
        {
          role: "user",
          content: JSON.stringify({
            invoiceText,
            requiredShape: {
              extracted: "supplierName, supplierEmail, invoiceNumber, description, amount, currency, issueDate, dueDate, paymentTerms, tax, discount, lineItems[{description, quantity, unitPrice, total}]",
              missingInformation: "string[]",
              explanation: "string",
              recommendedNextAction: "string",
            },
          }),
        },
      ],
    });
    const content = response.choices[0]?.message.content;
    if (!content) throw new AiProviderError("The AI provider returned an empty response.");
    return modelResponseSchema.parse(parseJson(content));
  } catch (error) {
    if (error instanceof AiProviderError || error instanceof z.ZodError || error instanceof SyntaxError) throw error;
    throw providerError(error);
  }
}

function deterministicChecks(extracted: z.infer<typeof extractedSchema>, existing: Array<{ invoiceNumber: string; supplierName: string; amount: { toString(): string }; currency: string }>) {
  const inconsistencies: string[] = [];
  const lineTotal = extracted.lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const expectedTotal = lineTotal + (extracted.tax ?? 0) - (extracted.discount ?? 0);
  if (extracted.lineItems.length > 0 && Math.abs(expectedTotal - extracted.amount) > 0.01) {
    inconsistencies.push(`Line items plus tax minus discount total ${expectedTotal.toFixed(2)}, but invoice total is ${extracted.amount.toFixed(2)}.`);
  }
  const duplicateWarnings = existing
    .filter((record) => record.invoiceNumber.trim().toLowerCase() === extracted.invoiceNumber.trim().toLowerCase())
    .map((record) => `Invoice number ${extracted.invoiceNumber} already exists for supplier ${record.supplierName}.`);
  const findings = [
    ...inconsistencies.map((message) => ({ severity: "warning" as const, message: "Arithmetic inconsistency detected.", evidence: message })),
    ...duplicateWarnings.map((message) => ({ severity: "warning" as const, message: "Possible duplicate invoice.", evidence: message })),
  ];
  return { inconsistencies, duplicateWarnings, findings };
}

export async function analyzeInvoice(text: string, transactionId?: string, useCache = false): Promise<InvoiceAnalysis> {
  const existing = await db.transaction.findMany({
    where: transactionId ? { id: { not: transactionId } } : undefined,
    select: { invoiceNumber: true, supplierName: true, amount: true, currency: true },
    take: 100,
  });
  if (useCache && transactionId) {
    const cached = await db.transaction.findUnique({ where: { id: transactionId }, select: { aiAnalysis: true } });
    const parsed = cached?.aiAnalysis ? analysisSchema.safeParse(cached.aiAnalysis) : null;
    if (parsed?.success) return parsed.data;
  }
  const models = candidateModels();
  let modelResult: z.infer<typeof modelResponseSchema> | null = null;
  let lastError: unknown = null;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        modelResult = await requestModel(text, attempt === 0, model);
        break;
      } catch (error) {
        lastError = error;
        console.warn(
          "[ai] candidate failed:",
          model,
          error instanceof Error ? `${error.name}: ${error.message.slice(0, 300)}` : error,
        );
        if (error instanceof AiProviderError && (error.status === 401 || error.status === 403)) throw error;
        if (error instanceof z.ZodError || error instanceof SyntaxError) {
          // One corrective retry without JSON mode; a malformed response is model-specific.
          try {
            modelResult = await requestModel(`${text}\n\nReturn valid JSON only. Do not wrap it in markdown.`, false, model);
            break;
          } catch (retryError) {
            lastError = retryError;
            break;
          }
        }
        if (error instanceof AiProviderError && error.status === 429) {
          // Upstream shared-pool limits do not clear quickly; move to the next model.
          break;
        }
        if (isTransientError(error) && attempt === 0) {
          await delay(1500);
          continue;
        }
        break;
      }
    }
    if (modelResult) break;
    if (models.indexOf(model) < models.length - 1) await delay(500);
  }
  if (!modelResult) {
    console.error(
      "[ai] all model candidates failed:",
      lastError instanceof Error ? `${lastError.name}: ${lastError.message}` : lastError,
    );
    if (lastError instanceof AiProviderError && lastError.status === 429) {
      throw new AiProviderError("The AI provider rate limit was reached. Please retry shortly.", 429);
    }
    throw new AiProviderError("The AI provider could not complete the analysis. Please retry shortly.");
  }
  const checks = deterministicChecks(modelResult.extracted, existing);
  const riskLevel = checks.findings.length > 0 ? "medium" : "low";
  return analysisSchema.parse({ ...modelResult, ...checks, riskLevel });
}

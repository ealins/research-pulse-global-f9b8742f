// Generic extraction engine. Every entity type goes through this one path:
// cleaned content -> content-hash cache -> callNemotron -> schema validation ->
// business-rule validation -> recorded run. Nothing else may call the model.
import { cleanPageText } from "../content-clean.server";
import { LLM_INPUT_CHARS, LLM_MAX_TOKENS, LLM_EXTRACTION_ENABLED, type LlmOperation } from "../llm-config.server";
import { callNemotron, isNvidiaConfigured } from "../nvidia.server";
import { findCachedResult, logCacheHit, recordValidatedResult } from "./validate.server";
import type { ValidationOutcome } from "./shared.server";

export type ExtractionOutcome<T> = {
  used: boolean;
  cached: boolean;
  value: T | null;
  errorCode: string | null;
  errorMessage: string | null;
  finishReason?: string | null;
  outputTokens?: number | null;
  droppedFields?: string[];
};

export type ExtractionInput = {
  url: string;
  title: string;
  text: string;
  sourceId?: string | null;
  rawRecordId?: string | null;
  contentHash?: string | null;
};

export async function runExtraction<T>(args: {
  operation: LlmOperation;
  system: string;
  validate: (completion: string, text: string) => ValidationOutcome<T> & { dropped?: string[] };
  input: ExtractionInput;
  extraUser?: string;
}): Promise<ExtractionOutcome<T>> {
  const none: ExtractionOutcome<T> = { used: false, cached: false, value: null, errorCode: null, errorMessage: null };
  if (!LLM_EXTRACTION_ENABLED) return none;
  if (!isNvidiaConfigured()) return { ...none, errorCode: "NVIDIA_SECRET_NOT_CONFIGURED" };

  // Cache: same operation + model + content hash => reuse the validated result.
  const cached = (await findCachedResult({ operation: args.operation, contentHash: args.input.contentHash ?? null })) as T | null;
  if (cached) {
    await logCacheHit({
      operation: args.operation,
      contentHash: args.input.contentHash ?? null,
      sourceId: args.input.sourceId ?? null,
      rawRecordId: args.input.rawRecordId ?? null,
      result: cached,
    });
    return { used: true, cached: true, value: cached, errorCode: null, errorMessage: null };
  }

  const cleaned = cleanPageText(args.input.text, {
    maxChars: LLM_INPUT_CHARS[args.operation],
    prioritiseJobSections: args.operation === "VACANCY_EXTRACTION",
  });

  const user = `PAGE URL: ${args.input.url}
PAGE TITLE: ${args.input.title}
${args.extraUser ? `\n${args.extraUser}\n` : ""}
PAGE TEXT:
"""
${cleaned.text}
"""`;

  const call = await callNemotron({
    system: args.system,
    user,
    operation: args.operation,
    sourceId: args.input.sourceId ?? null,
    rawRecordId: args.input.rawRecordId ?? null,
    contentHash: args.input.contentHash ?? null,
    contentReduced: cleaned.contentReduced,
    maxTokens: LLM_MAX_TOKENS[args.operation],
  });

  if (!call.ok || !call.content) {
    return {
      used: true,
      cached: false,
      value: null,
      errorCode: call.errorCode,
      errorMessage: call.errorMessage,
      finishReason: call.finishReason ?? null,
      outputTokens: call.outputTokens ?? null,
    };
  }

  const validated = args.validate(call.content, cleaned.text);
  if (!validated.ok) {
    await recordValidatedResult({
      runId: call.runId,
      result: { raw_completion: call.content.slice(0, 4000) },
      status: "VALIDATION_FAILED",
      errorCode: validated.code,
      errorMessage: validated.message,
    });
    return {
      used: true,
      cached: false,
      value: null,
      errorCode: validated.code,
      errorMessage: validated.message,
      finishReason: call.finishReason ?? null,
      outputTokens: call.outputTokens ?? null,
    };
  }

  await recordValidatedResult({ runId: call.runId, result: validated.value, status: "SUCCESS" });
  return {
    used: true,
    cached: false,
    value: validated.value,
    errorCode: null,
    errorMessage: null,
    finishReason: call.finishReason ?? null,
    outputTokens: call.outputTokens ?? null,
    droppedFields: validated.dropped ?? [],
  };
}

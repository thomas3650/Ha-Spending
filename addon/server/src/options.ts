import { readFileSync } from "node:fs";

export interface Options {
  fireflyUrl: string;
  fireflyToken: string;
  fireflyLinkUrl: string | null;
  mainGroupRuleGroup: string;
  excludedMainGroups: string[];
  /** When set, the sorter's endpoint runs (D29). */
  sorterKey: string | null;
  sorterInboxCategory: string;
  /** The tag `move_posting` adds to a posting it moves. */
  movedTag: string;
}

export const MIN_SORTER_KEY_LENGTH = 32;

/** The message names the option or the file, never a value: a value may be the token. */
export class OptionsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OptionsError";
  }
}

const REQUIRED = "firefly_url and firefly_token are required";

const withoutTrailingSlash = (url: string) => url.replace(/\/+$/, "");

function required(options: Record<string, unknown>, key: string): string {
  const value = options[key];
  if (typeof value !== "string" || value === "") throw new OptionsError(`The option ${key} is missing; ${REQUIRED}`);
  return value;
}

function optional(options: Record<string, unknown>, key: string): string | null {
  const value = options[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new OptionsError(`The option ${key} is not text`);
  return value;
}

function list(options: Record<string, unknown>, key: string): string[] | null {
  const value = options[key];
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new OptionsError(`The option ${key} is not a list of text`);
  }
  return value;
}

export function readOptions(path: string): Options {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
    throw new OptionsError(`${missing ? "No options file at" : "Cannot read the options file"} ${path}; ${REQUIRED}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // JSON.parse's message quotes the text around the fault, which may be the token.
    throw new OptionsError(`The options file ${path} is not JSON`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new OptionsError(`The options file ${path} is not a JSON object`);
  }
  const options = parsed as Record<string, unknown>;

  const fireflyUrl = withoutTrailingSlash(required(options, "firefly_url"));
  const fireflyToken = required(options, "firefly_token");
  const link = optional(options, "firefly_link_url");
  const sorterKey = optional(options, "sorter_key");
  if (sorterKey !== null && sorterKey.length < MIN_SORTER_KEY_LENGTH) {
    throw new OptionsError(`The option sorter_key is shorter than ${MIN_SORTER_KEY_LENGTH} characters`);
  }
  const sorterInboxCategory = optional(options, "sorter_inbox_category") ?? "Til sortering";
  // The name goes into a Firefly III search between double quotes.
  if (sorterInboxCategory.includes('"')) throw new OptionsError("The option sorter_inbox_category holds a double quote");
  return {
    fireflyUrl,
    fireflyToken,
    fireflyLinkUrl: link === null ? null : withoutTrailingSlash(link),
    mainGroupRuleGroup: optional(options, "main_group_rule_group") ?? "Hovedgrupper",
    excludedMainGroups: list(options, "excluded_main_groups") ?? ["Penge ind og ud"],
    sorterKey,
    sorterInboxCategory,
    movedTag: optional(options, "moved_tag") ?? "moved-by-assistant",
  };
}

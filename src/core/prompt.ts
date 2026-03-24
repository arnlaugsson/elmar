import {
  select as rawSelect,
  confirm as rawConfirm,
  input as rawInput,
  number as rawNumber,
  editor as rawEditor,
} from "@inquirer/prompts";
import { CancelPromptError } from "@inquirer/core";

type PromptFn<TArgs extends unknown[], TResult> = (...args: TArgs) => Promise<TResult>;

function withEscapeCancel<TConfig extends { message: string }>(
  fn: (config: TConfig, context?: { signal?: AbortSignal }) => Promise<unknown>
) {
  return async (config: TConfig): Promise<unknown> => {
    const ac = new AbortController();

    const onKeypress = (_chunk: unknown, key: { name?: string }) => {
      if (key?.name === "escape") {
        ac.abort();
      }
    };

    if (process.stdin.isTTY) {
      process.stdin.on("keypress", onKeypress);
    }

    try {
      return await fn(config, { signal: ac.signal });
    } catch (err) {
      if (ac.signal.aborted) {
        throw new CancelPromptError();
      }
      throw err;
    } finally {
      if (process.stdin.isTTY) {
        process.stdin.removeListener("keypress", onKeypress);
      }
    }
  };
}

export const select = withEscapeCancel(rawSelect) as typeof rawSelect;
export const confirm = withEscapeCancel(rawConfirm) as typeof rawConfirm;
export const input = withEscapeCancel(rawInput) as typeof rawInput;
export const number = withEscapeCancel(rawNumber) as typeof rawNumber;
export const editor = withEscapeCancel(rawEditor) as typeof rawEditor;
export { CancelPromptError } from "@inquirer/core";

import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

type IPromptQuestionOptions = {
  signal: AbortSignal;
};

type ICreatePromptInterfaceOptions = {
  input: typeof stdin;
  output: typeof stdout;
};

export type IPromptQuestionInterface = {
  question(query: string, options: IPromptQuestionOptions): Promise<string>;
  on(eventName: "SIGINT", listener: () => void): IPromptQuestionInterface;
  off(eventName: "SIGINT", listener: () => void): IPromptQuestionInterface;
  close(): void;
};

type ICreatePromptInterface = (options: ICreatePromptInterfaceOptions) => IPromptQuestionInterface;

type IPromptForYesNoArgs = {
  message: string;
  interruptMessage?: string;
  createPromptInterface?: ICreatePromptInterface;
};

const DEFAULT_INTERRUPT_MESSAGE = "Prompt cancelled by Ctrl+C.";

function createDefaultPromptInterface(options: ICreatePromptInterfaceOptions): IPromptQuestionInterface {
  return createInterface(options);
}

function isAbortError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.name === "AbortError";
  }

  return error instanceof DOMException && error.name === "AbortError";
}

export async function promptForYesNo(args: IPromptForYesNoArgs): Promise<boolean> {
  const abortController = new AbortController();
  const createPromptInterface = args.createPromptInterface ?? createDefaultPromptInterface;
  const promptInterface = createPromptInterface({ input: stdin, output: stdout });
  const interruptQuestion = (): void => abortController.abort();

  promptInterface.on("SIGINT", interruptQuestion);

  try {
    const answer = await promptInterface.question(`${args.message} [y/N] `, { signal: abortController.signal });
    const normalizedAnswer = answer.trim().toLowerCase();
    return normalizedAnswer === "y" || normalizedAnswer === "yes";
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(args.interruptMessage ?? DEFAULT_INTERRUPT_MESSAGE);
    }

    throw error;
  } finally {
    promptInterface.off("SIGINT", interruptQuestion);
    promptInterface.close();
  }
}

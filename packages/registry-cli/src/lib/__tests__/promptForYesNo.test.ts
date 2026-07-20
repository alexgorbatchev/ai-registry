import assert from "node:assert";
import { describe, expect, it } from "bun:test";

import { promptForYesNo, promptForOverwriteDecision, type IPromptQuestionInterface } from "../promptForYesNo";

class AnsweringPromptInterface implements IPromptQuestionInterface {
  public closed = false;
  public promptText = "";

  public constructor(private readonly answer: string) {}

  public async question(query: string): Promise<string> {
    this.promptText = query;
    return this.answer;
  }

  public on(): IPromptQuestionInterface {
    return this;
  }

  public off(): IPromptQuestionInterface {
    return this;
  }

  public close(): void {
    this.closed = true;
  }
}

class InterruptiblePromptInterface implements IPromptQuestionInterface {
  public closed = false;
  private sigintListener: () => void = () => {};

  public async question(_query: string, options: { signal: AbortSignal }): Promise<string> {
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener(
        "abort",
        () => reject(new DOMException("The operation was aborted.", "AbortError")),
        { once: true },
      );
    });
  }

  public on(eventName: "SIGINT", listener: () => void): IPromptQuestionInterface {
    assert.strictEqual(eventName, "SIGINT");
    this.sigintListener = listener;
    return this;
  }

  public off(eventName: "SIGINT", listener: () => void): IPromptQuestionInterface {
    assert.strictEqual(eventName, "SIGINT");
    assert.strictEqual(listener, this.sigintListener);
    return this;
  }

  public close(): void {
    this.closed = true;
  }

  public pressCtrlC(): void {
    this.sigintListener();
  }
}

describe("promptForYesNo", () => {
  it("returns true for yes answers and closes the interface", async () => {
    const promptInterface = new AnsweringPromptInterface("yes");

    const result = await promptForYesNo({
      message: "Proceed?",
      createPromptInterface: () => promptInterface,
    });

    expect(result).toBe(true);
    expect(promptInterface.closed).toBe(true);
    expect(promptInterface.promptText).toBe("Proceed? [y/N] ");
  });

  it("returns false for no answers and closes the interface", async () => {
    const promptInterface = new AnsweringPromptInterface("n");

    const result = await promptForYesNo({
      message: "Proceed?",
      createPromptInterface: () => promptInterface,
    });

    expect(result).toBe(false);
    expect(promptInterface.closed).toBe(true);
  });

  it("rejects and closes the interface when Ctrl+C interrupts the question", async () => {
    const promptInterface = new InterruptiblePromptInterface();
    const promptPromise = promptForYesNo({
      message: "Proceed?",
      interruptMessage: "Build cancelled by Ctrl+C.",
      createPromptInterface: () => promptInterface,
    });

    promptInterface.pressCtrlC();

    let observedError: unknown;
    try {
      await promptPromise;
    } catch (error) {
      observedError = error;
    }

    assert(observedError instanceof Error);
    expect(observedError.message).toBe("Build cancelled by Ctrl+C.");
    expect(promptInterface.closed).toBe(true);
  });
});

describe("promptForOverwriteDecision", () => {
  it("returns yes for yes answers and closes the interface", async () => {
    const promptInterface = new AnsweringPromptInterface("yes");

    const result = await promptForOverwriteDecision({
      message: "Proceed?",
      createPromptInterface: () => promptInterface,
    });

    expect(result).toBe("yes");
    expect(promptInterface.closed).toBe(true);
    expect(promptInterface.promptText).toBe("Proceed? (y)es / (n)o / (s)ync back [y/N/s]: ");
  });

  it("returns sync for s answers and closes the interface", async () => {
    const promptInterface = new AnsweringPromptInterface("s");

    const result = await promptForOverwriteDecision({
      message: "Proceed?",
      createPromptInterface: () => promptInterface,
    });

    expect(result).toBe("sync");
    expect(promptInterface.closed).toBe(true);
  });

  it("returns no for no/other answers and closes the interface", async () => {
    const promptInterface = new AnsweringPromptInterface("n");

    const result = await promptForOverwriteDecision({
      message: "Proceed?",
      createPromptInterface: () => promptInterface,
    });

    expect(result).toBe("no");
    expect(promptInterface.closed).toBe(true);
  });

  it("rejects and closes the interface when Ctrl+C interrupts the question", async () => {
    const promptInterface = new InterruptiblePromptInterface();
    const promptPromise = promptForOverwriteDecision({
      message: "Proceed?",
      interruptMessage: "Build cancelled by Ctrl+C.",
      createPromptInterface: () => promptInterface,
    });

    promptInterface.pressCtrlC();

    let observedError: unknown;
    try {
      await promptPromise;
    } catch (error) {
      observedError = error;
    }

    assert(observedError instanceof Error);
    expect(observedError.message).toBe("Build cancelled by Ctrl+C.");
    expect(promptInterface.closed).toBe(true);
  });
});

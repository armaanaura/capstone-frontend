// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Question } from "@/lib/capstone/types";
import { sampleData } from "@/lib/capstone/data";
import { CapstoneTree } from "./capstone-tree";

// Exercise the public launch boundary without duplicating canvas behavior covered in Playwright.
vi.mock("next/dynamic", async () => {
  const { createElement, forwardRef, useImperativeHandle } = await import("react");
  return { default: () => forwardRef(function MockCanvas(props: { questions: Question[]; onActivate: (id: string) => void }, ref) {
    useImperativeHandle(ref, () => ({ centerQuestion: vi.fn(), fitMap: vi.fn() }));
    return createElement("div", null, props.questions.map((question) => createElement("button", {
      key: question.id, onClick: () => props.onActivate(question.id),
    }, `Open graph question ${question.id}`)));
  }) };
});

beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("question launch integration", () => {
  it("passes stable IDs exactly once and leaves progress intact", async () => {
    const onOpenQuestion = vi.fn();
    const before = JSON.stringify(sampleData.progress);
    const user = userEvent.setup();
    render(<CapstoneTree data={sampleData} onOpenQuestion={onOpenQuestion} />);
    await user.click(screen.getByRole("button", { name: "Open graph question delivery-priority" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Start question" }));
    expect(onOpenQuestion).toHaveBeenCalledExactlyOnceWith({ topicId: "graphs", capstoneId: "delivery-network", questionId: "delivery-priority" });
    expect(JSON.stringify(sampleData.progress)).toBe(before);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("uses the selected topic's IDs for Continue", async () => {
    const onOpenQuestion = vi.fn();
    const user = userEvent.setup();
    render(<CapstoneTree data={sampleData} onOpenQuestion={onOpenQuestion} />);
    await user.click(screen.getByRole("button", { name: /Arrays.*The Inventory Room/ }));
    await user.click(screen.getByRole("button", { name: "Open graph question arrays-2" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Continue question" }));
    expect(onOpenQuestion).toHaveBeenCalledExactlyOnceWith({ topicId: "arrays", capstoneId: "arrays-capstone", questionId: "arrays-2" });
  });

  it("offers prerequisite navigation instead of launching a locked question", async () => {
    const onOpenQuestion = vi.fn();
    const user = userEvent.setup();
    render(<CapstoneTree data={sampleData} onOpenQuestion={onOpenQuestion} />);
    await user.click(screen.getByRole("button", { name: "Open graph question delivery-route" }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.queryByRole("button", { name: /Start question|Continue question/ })).toBeNull();
    await user.click(dialog.getByRole("button", { name: "Find the nearest driver" }));
    expect(onOpenQuestion).not.toHaveBeenCalled();
  });
});

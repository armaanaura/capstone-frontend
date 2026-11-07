import { describe, expect, it } from "vitest";
import { sampleData } from "./data";
import { CARD_HEIGHT, CARD_WIDTH, layoutGraph, progressionDepths, roundedPath } from "./layout";
import { currentQuestion, progressSummary, questionEdges, questionStatus, unmetPrerequisites } from "./selectors";
import type { Question, QuestionEdge } from "./types";

const questions = sampleData.questions.filter((question) => question.capstoneId === "delivery-network");
const progress = sampleData.progress.find((item) => item.capstoneId === "delivery-network")!;
const rules = sampleData.prerequisites;

describe("consistent progress across the capstone", () => {
  it("shows all four statuses and the exact solved count", () => {
    expect(questions.map((question) => questionStatus(question.id, rules, progress)))
      .toEqual(["completed", "completed", "current", "available", "locked"]);
    expect(progressSummary(questions, progress)).toEqual({ completed: 2, total: 5, percent: 40 });
    expect(currentQuestion(questions, rules, progress)?.id).toBe("delivery-driver");
  });

  it("requires both branches at the merge and reports only unmet prerequisites", () => {
    expect(unmetPrerequisites("delivery-route", rules, progress)).toEqual(["delivery-driver", "delivery-priority"]);
    const oneBranch = { ...progress, completedIds: [...progress.completedIds, "delivery-driver"] };
    expect(questionStatus("delivery-route", rules, oneBranch)).toBe("locked");
    expect(unmetPrerequisites("delivery-route", rules, oneBranch)).toEqual(["delivery-priority"]);
    expect(questionStatus("delivery-route", rules, { ...oneBranch, completedIds: [...oneBranch.completedIds, "delivery-priority"] })).toBe("available");
  });

  it("does not label an inaccessible current question as in progress", () => {
    expect(questionStatus("delivery-route", rules, { ...progress, currentQuestionId: "delivery-route" })).toBe("locked");
  });

  it("falls back to available or completed questions when no question is in progress", () => {
    expect(currentQuestion(questions, rules, { ...progress, currentQuestionId: null })?.id).toBe("delivery-driver");
    expect(currentQuestion(questions, rules, { ...progress, currentQuestionId: null, completedIds: questions.map((question) => question.id) })?.id).toBe("delivery-route");
    expect(progressSummary([], progress)).toEqual({ completed: 0, total: 0, percent: 0 });
    expect(currentQuestion([], rules, progress)).toBeUndefined();
  });

  it("keeps every sample topic valid, accessible and self-contained", () => {
    expect(new Set(sampleData.questions.map((question) => question.id)).size).toBe(sampleData.questions.length);
    for (const topic of sampleData.topics) {
      const capstone = sampleData.capstones.find((item) => item.id === topic.capstoneId)!;
      const entries = capstone.questionIds.map((id) => sampleData.questions.find((question) => question.id === id)!);
      const record = sampleData.progress.find((item) => item.capstoneId === capstone.id)!;
      expect(entries.length).toBeGreaterThanOrEqual(3);
      expect(entries.every((entry) => entry.story && entry.concept && entry.capstoneId === capstone.id)).toBe(true);
      for (const id of [...record.completedIds, record.currentQuestionId!]) expect(unmetPrerequisites(id, rules, record)).toEqual([]);
      expect(() => progressionDepths(entries.map((entry) => entry.id), questionEdges(entries, rules))).not.toThrow();
    }
  });
});

function graph(ids: string[], connections: [string, string][]) {
  return {
    nodes: ids.map((id, index) => ({ id, number: index + 1, title: id, capstoneId: "test", story: "A chapter", concept: "A concept", difficulty: "Easy" as const })),
    edges: connections.map(([source, target]) => ({ id: `${source}-${target}`, source, target })),
  };
}

function intersectsInterior(a: { x: number; y: number }, b: { x: number; y: number }, left: number, top: number) {
  const epsilon = 0.1;
  if (a.x === b.x) return a.x > left + epsilon && a.x < left + CARD_WIDTH - epsilon && Math.max(a.y, b.y) > top + epsilon && Math.min(a.y, b.y) < top + CARD_HEIGHT - epsilon;
  if (a.y === b.y) return a.y > top + epsilon && a.y < top + CARD_HEIGHT - epsilon && Math.max(a.x, b.x) > left + epsilon && Math.min(a.x, b.x) < left + CARD_WIDTH - epsilon;
  throw new Error("Expected an orthogonal connection");
}

async function verifyLayout(nodes: Question[], edges: QuestionEdge[]) {
  const layout = await layoutGraph(nodes, edges);
  const depths = progressionDepths(nodes.map((node) => node.id), edges);
  for (const a of layout.nodes) {
    for (const b of layout.nodes) {
      if (depths.get(a.id) === depths.get(b.id)) expect(a.position.y).toBe(b.position.y);
      if (depths.get(a.id)! < depths.get(b.id)!) expect(a.position.y).toBeLessThan(b.position.y);
      if (a.id !== b.id && a.position.y === b.position.y) expect(Math.abs(a.position.x - b.position.x)).toBeGreaterThanOrEqual(CARD_WIDTH + 50);
    }
  }
  for (const edge of layout.edges) {
    const source = layout.nodes.find((node) => node.id === edge.source)!;
    const target = layout.nodes.find((node) => node.id === edge.target)!;
    expect(edge.points[0]).toEqual({ x: source.position.x + CARD_WIDTH / 2, y: source.position.y + CARD_HEIGHT });
    expect(edge.points.at(-1)).toEqual({ x: target.position.x + CARD_WIDTH / 2, y: target.position.y });
    for (let i = 1; i < edge.points.length; i++) {
      for (const node of layout.nodes) expect(intersectsInterior(edge.points[i - 1], edge.points[i], node.position.x, node.position.y)).toBe(false);
    }
  }
  return layout;
}

describe("data-driven DAG layout", () => {
  it("lays out a linear sequence", async () => {
    const example = graph(["a", "b", "c"], [["a", "b"], ["b", "c"]]);
    await verifyLayout(example.nodes, example.edges);
  });

  it("lays out Delivery Network's fork and merge with exact port connections", async () => {
    const layout = await verifyLayout(questions, questionEdges(questions, rules));
    expect(layout.edges).toHaveLength(5);
    expect(layout.nodes.find((node) => node.id === "delivery-driver")!.position.y)
      .toBe(layout.nodes.find((node) => node.id === "delivery-priority")!.position.y);
  });

  it("keeps source-depth alignment and routes long edges around unequal branches", async () => {
    const example = graph(["root", "a", "b", "c", "merge"], [["root", "a"], ["a", "b"], ["root", "c"], ["b", "merge"], ["c", "merge"]]);
    await verifyLayout(example.nodes, example.edges);
  });

  it("rejects cycles, missing references and duplicate IDs", () => {
    expect(() => progressionDepths(["a", "b"], [{ id: "ab", source: "a", target: "b" }, { id: "ba", source: "b", target: "a" }])).toThrow(/cycle/);
    expect(() => progressionDepths(["a"], [{ id: "ab", source: "a", target: "b" }])).toThrow(/unknown/);
    expect(() => progressionDepths(["a", "a"], [])).toThrow(/unique/);
    expect(() => questionEdges(questions, [{ questionId: "delivery-route", requires: ["missing"] }])).toThrow(/Missing/);
  });

  it("caches layouts, handles empty data and rounds routed corners", async () => {
    const edges = questionEdges(questions, rules);
    expect(layoutGraph(questions, edges)).toBe(layoutGraph(questions, edges));
    expect(await layoutGraph([], [])).toEqual({ nodes: [], edges: [] });
    expect(roundedPath([])).toBe("");
    expect(roundedPath([{ x: 0, y: 0 }, { x: 0, y: 30 }, { x: 40, y: 30 }]))
      .toBe("M 0 0 L 0 18 Q 0 30 12 30 L 40 30");
  });
});

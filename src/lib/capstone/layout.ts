import ELK from "elkjs/lib/elk.bundled.js";
import type { ElkNode } from "elkjs/lib/elk-api";
import type { Question, QuestionEdge } from "./types";

export const CARD_WIDTH = 280;
export const CARD_HEIGHT = 160;

export interface Point { x: number; y: number }
export interface LayoutNode { id: string; position: Point }
export interface LayoutEdge extends QuestionEdge { points: Point[] }
export interface GraphLayout { nodes: LayoutNode[]; edges: LayoutEdge[] }

// Validate before ELK's cycle-breaking stage: a progression graph must really be a DAG.
export function progressionDepths(ids: string[], edges: QuestionEdge[]): Map<string, number> {
  if (new Set(ids).size !== ids.length) throw new Error("Question IDs must be unique.");
  const depth = new Map(ids.map((id) => [id, 0]));
  const incoming = new Map(ids.map((id) => [id, 0]));
  const outgoing = new Map(ids.map((id) => [id, [] as string[]]));
  for (const edge of edges) {
    if (!depth.has(edge.source) || !depth.has(edge.target)) throw new Error("An edge references an unknown question.");
    incoming.set(edge.target, incoming.get(edge.target)! + 1);
    outgoing.get(edge.source)!.push(edge.target);
  }
  const queue = ids.filter((id) => incoming.get(id) === 0);
  let visited = 0;
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    visited++;
    for (const next of outgoing.get(id)!) {
      depth.set(next, Math.max(depth.get(next)!, depth.get(id)! + 1));
      incoming.set(next, incoming.get(next)! - 1);
      if (!incoming.get(next)) queue.push(next);
    }
  }
  if (visited !== ids.length) throw new Error("Capstone prerequisites contain a cycle.");
  return depth;
}

const elk = new ELK();
const cache = new Map<string, Promise<GraphLayout>>();

export function layoutGraph(questions: Question[], edges: QuestionEdge[]): Promise<GraphLayout> {
  const key = JSON.stringify([questions.map((question) => question.id), edges]);
  const cached = cache.get(key);
  if (cached) return cached;
  const compute = async (): Promise<GraphLayout> => {
    if (!questions.length) return { nodes: [], edges: [] };
    progressionDepths(questions.map((question) => question.id), edges);
    const graph = await elk.layout<ElkNode>({
      id: "capstone",
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": "DOWN",
        "elk.edgeRouting": "ORTHOGONAL",
        "elk.layered.layering.strategy": "LONGEST_PATH_SOURCE",
        "elk.layered.spacing.nodeNodeBetweenLayers": "82",
        "elk.spacing.nodeNode": "64",
        "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
        "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
        "elk.padding": "[top=0,left=0,bottom=0,right=0]",
      },
      children: questions.map((question) => ({
        id: question.id, width: CARD_WIDTH, height: CARD_HEIGHT,
        layoutOptions: { "elk.portConstraints": "FIXED_POS" },
        ports: [
          { id: `${question.id}-in`, x: CARD_WIDTH / 2, y: 0, width: 0, height: 0, layoutOptions: { "elk.port.side": "NORTH" } },
          { id: `${question.id}-out`, x: CARD_WIDTH / 2, y: CARD_HEIGHT, width: 0, height: 0, layoutOptions: { "elk.port.side": "SOUTH" } },
        ],
      })),
      edges: edges.map((edge) => ({ id: edge.id, sources: [`${edge.source}-out`], targets: [`${edge.target}-in`] })),
    });
    return {
      nodes: (graph.children ?? []).map((node) => ({ id: node.id, position: { x: node.x ?? 0, y: node.y ?? 0 } })),
      edges: edges.map((edge) => {
        const section = graph.edges?.find((item) => item.id === edge.id)?.sections?.[0];
        if (!section) throw new Error(`Unable to route connection ${edge.id}`);
        return { ...edge, points: [section.startPoint, ...(section.bendPoints ?? []), section.endPoint] };
      }),
    };
  };
  const result = compute().catch((error: unknown) => { cache.delete(key); throw error; });
  cache.set(key, result);
  return result;
}

// Preserve ELK's obstacle-avoiding route, rounding just the corners of each segment.
export function roundedPath(points: Point[], radius = 12): string {
  if (!points.length) return "";
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const previous = points[i - 1], point = points[i], next = points[i + 1];
    const beforeLength = Math.hypot(point.x - previous.x, point.y - previous.y);
    const afterLength = Math.hypot(next.x - point.x, next.y - point.y);
    if (!beforeLength || !afterLength) continue;
    const distance = Math.min(radius, beforeLength / 2, afterLength / 2);
    const before = { x: point.x - (point.x - previous.x) / beforeLength * distance, y: point.y - (point.y - previous.y) / beforeLength * distance };
    const after = { x: point.x + (next.x - point.x) / afterLength * distance, y: point.y + (next.y - point.y) / afterLength * distance };
    path += ` L ${before.x} ${before.y} Q ${point.x} ${point.y} ${after.x} ${after.y}`;
  }
  const last = points.at(-1)!;
  return `${path} L ${last.x} ${last.y}`;
}

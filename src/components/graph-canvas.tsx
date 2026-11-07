"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import {
  Background, BackgroundVariant, BaseEdge, Handle, MarkerType, Position,
  ReactFlow, ReactFlowProvider, useReactFlow, useViewport,
  type Edge, type EdgeProps, type Node, type NodeProps,
} from "@xyflow/react";
import { ArrowDown, ArrowUpRight, Focus, LoaderCircle, Minus, MousePointer2, Plus, Scan } from "lucide-react";
import { CARD_HEIGHT, CARD_WIDTH, layoutGraph, roundedPath, type GraphLayout, type Point } from "@/lib/capstone/layout";
import { questionEdges, questionStatus, statusLabels } from "@/lib/capstone/selectors";
import type { Prerequisite, Progress, Question, QuestionStatus } from "@/lib/capstone/types";
import { StatusIcon } from "./status-icon";
import "@xyflow/react/dist/style.css";

type CardNode = Node<{ question: Question; status: QuestionStatus; highlighted: boolean }, "question">;
type RoutedEdge = Edge<{ points: Point[]; completed: boolean; active: boolean }, "routed">;

function QuestionNode({ data }: NodeProps<CardNode>) {
  const { question, status, highlighted } = data;
  return <>
    <Handle id="in" type="target" position={Position.Top} isConnectable={false} className={`question-port port-${status}`} />
    <button type="button" className={`question-node status-${status}${highlighted ? " is-selected" : ""}`}
      aria-label={`Question ${question.number}: ${question.title}, ${statusLabels[status]}`}
      aria-pressed={highlighted} data-question-id={question.id}>
      <span className="node-eyebrow"><span>QUESTION {String(question.number).padStart(2, "0")}</span><StatusIcon status={status} size={15} /></span>
      <span className="node-title">{question.title}</span>
      <span className="node-concept">{question.concept}</span>
      <span className="node-footer"><span className={`difficulty difficulty-${question.difficulty.toLowerCase()}`}>{question.difficulty}</span>
        <span className="node-status"><span>{status === "current" ? "Continue question" : statusLabels[status]}</span>{status === "current" ? <ArrowUpRight size={13} /> : null}</span>
      </span>
    </button>
    <Handle id="out" type="source" position={Position.Bottom} isConnectable={false} className={`question-port port-${status}`} />
  </>;
}

function ConnectionEdge({ id, data, markerEnd }: EdgeProps<RoutedEdge>) {
  return <BaseEdge id={id} path={roundedPath(data?.points ?? [])} markerEnd={markerEnd}
    className={`progression-edge${data?.completed ? " edge-completed" : ""}${data?.active ? " edge-active" : ""}`} />;
}

const nodeTypes = { question: QuestionNode };
const edgeTypes = { routed: ConnectionEdge };

export interface GraphCanvasHandle {
  centerQuestion: (id: string) => void;
  fitMap: () => void;
}

interface GraphCanvasProps {
  questions: Question[];
  prerequisites: Prerequisite[];
  progress: Progress;
  selectedId: string | null;
  panelExpanded: boolean;
  sidebarWidth: number;
  onActivate: (id: string) => void;
  onJump: () => void;
}

function Canvas({ apiRef, ...props }: GraphCanvasProps & { apiRef: Ref<GraphCanvasHandle> }) {
  const { questions, prerequisites, progress, selectedId, panelExpanded, sidebarWidth, onActivate, onJump } = props;
  const [layout, setLayout] = useState<GraphLayout | null>(null);
  const [error, setError] = useState("");
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const region = useRef<HTMLDivElement>(null);
  const flow = useReactFlow<CardNode, RoutedEdge>();
  const { zoom } = useViewport();
  const initialized = useRef(false);

  useEffect(() => {
    let cancelled = false;
    layoutGraph(questions, questionEdges(questions, prerequisites)).then((result) => {
      if (!cancelled) setLayout(result);
    }).catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not arrange the map."); });
    return () => { cancelled = true; };
  }, [questions, prerequisites]);

  useEffect(() => {
    const element = region.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // The viewport fills the canvas, but its useful center excludes fixed overlays.
  const safeArea = useCallback(() => {
    const compact = window.matchMedia("(max-width: 1023px)").matches;
    const right = !compact && panelExpanded ? 368 : 28;
    const top = dimensions.width < 588 ? 192 : 142;
    const bottom = compact ? 112 : 94;
    return { left: 28, top, width: Math.max(120, dimensions.width - 28 - right), height: Math.max(140, dimensions.height - top - bottom) };
  }, [dimensions, panelExpanded]);

  const duration = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 320;

  const fitMap = useCallback(() => {
    if (!layout?.nodes.length || !dimensions.width || !dimensions.height) return;
    const area = safeArea();
    const minX = Math.min(...layout.nodes.map((node) => node.position.x));
    const maxX = Math.max(...layout.nodes.map((node) => node.position.x + CARD_WIDTH));
    const minY = Math.min(...layout.nodes.map((node) => node.position.y));
    const maxY = Math.max(...layout.nodes.map((node) => node.position.y + CARD_HEIGHT));
    const nextZoom = Math.max(0.35, Math.min(1, area.width / (maxX - minX + 56), area.height / (maxY - minY + 40)));
    void flow.setViewport({
      x: area.left + area.width / 2 - (minX + maxX) / 2 * nextZoom,
      y: area.top + area.height / 2 - (minY + maxY) / 2 * nextZoom,
      zoom: nextZoom,
    }, { duration: initialized.current ? duration() : 0 });
    initialized.current = true;
  }, [layout, dimensions, safeArea, flow]);

  const centerQuestion = useCallback((id: string) => {
    const node = layout?.nodes.find((item) => item.id === id);
    if (!node) return;
    const area = safeArea();
    const nextZoom = Math.max(0.35, Math.min(1, area.width / (CARD_WIDTH + 32)));
    void flow.setViewport({
      x: area.left + area.width / 2 - (node.position.x + CARD_WIDTH / 2) * nextZoom,
      y: area.top + area.height / 2 - (node.position.y + CARD_HEIGHT / 2) * nextZoom,
      zoom: nextZoom,
    }, { duration: duration() });
  }, [flow, layout, safeArea]);

  useImperativeHandle(apiRef, () => ({ centerQuestion, fitMap }), [centerQuestion, fitMap]);

  useEffect(() => { fitMap(); }, [fitMap, sidebarWidth]);

  const nodes = useMemo<CardNode[]>(() => (layout?.nodes ?? []).map((node) => {
    const question = questions.find((item) => item.id === node.id)!;
    return { id: node.id, type: "question", position: node.position, width: CARD_WIDTH, height: CARD_HEIGHT,
      data: { question, status: questionStatus(node.id, prerequisites, progress), highlighted: node.id === selectedId },
    };
  }), [layout, questions, prerequisites, progress, selectedId]);

  const edges = useMemo<RoutedEdge[]>(() => (layout?.edges ?? []).map((edge) => {
    const completed = progress.completedIds.includes(edge.source) && progress.completedIds.includes(edge.target);
    const active = progress.completedIds.includes(edge.source) && !completed;
    return { ...edge, type: "routed", sourceHandle: "out", targetHandle: "in", selectable: false,
      data: { points: edge.points, completed, active },
      markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: completed ? "#416953" : active ? "#426391" : "#42454b" },
    };
  }), [layout, progress]);

  return <div ref={region} className="graph-region" data-testid="graph-region">
    <ReactFlow<CardNode, RoutedEdge> nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
      onNodeClick={(_, node) => onActivate(node.id)} nodesDraggable={false} nodesConnectable={false}
      nodesFocusable={false} edgesFocusable={false} elementsSelectable={false} deleteKeyCode={null}
      minZoom={0.35} maxZoom={1.8} panOnDrag zoomOnScroll zoomOnPinch preventScrolling
      nodeClickDistance={6} paneClickDistance={6} zoomOnDoubleClick={false}
      colorMode="dark" attributionPosition="bottom-right" aria-label="Capstone progression map">
      <Background id="workspace-grid" variant={BackgroundVariant.Lines} gap={20} lineWidth={1} color="rgba(255,255,255,0.035)" bgColor="#000000" />
    </ReactFlow>
    {!layout && !error && <div className="graph-loading" role="status"><LoaderCircle className="animate-spin" size={18} /> Arranging your path…</div>}
    {error && <div className="graph-loading graph-error" role="alert">{error}</div>}
    <div className="map-controls" role="group" aria-label="Map controls">
      <button className="icon-button" aria-label="Zoom out" onClick={() => void flow.zoomOut({ duration: duration() })} disabled={zoom <= 0.351}><Minus size={16} /></button>
      <output className="zoom-percentage" aria-label="Zoom percentage" data-testid="zoom-percentage">{Math.round(zoom * 100)}%</output>
      <button className="icon-button" aria-label="Zoom in" onClick={() => void flow.zoomIn({ duration: duration() })} disabled={zoom >= 1.799}><Plus size={16} /></button>
      <span className="control-divider" />
      <button className="text-control" onClick={fitMap}><Scan size={15} /><span>Fit map</span></button>
      <span className="control-divider" />
      <button className="icon-button" aria-label="Jump to current question" title="Jump to current question" onClick={onJump}><Focus size={17} /></button>
    </div>
    <div className="canvas-hint" aria-hidden="true"><MousePointer2 size={12} /><span>Drag to explore</span><span className="hint-dot">·</span><span>Scroll to zoom</span></div>
  </div>;
}

const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>((props, ref) => (
  <ReactFlowProvider><Canvas {...props} apiRef={ref} /></ReactFlowProvider>
));
GraphCanvas.displayName = "GraphCanvas";
export default GraphCanvas;

"use client";

import dynamic from "next/dynamic";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowRight, ArrowUpRight, BookOpen, Braces, Check, ChevronDown, ChevronRight,
  CodeXml, GitBranch, Keyboard, Layers2, ListChecks, LockKeyhole, Network,
  PanelLeftClose, PanelLeftOpen, Search, Sparkles, Workflow, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { sampleData } from "@/lib/capstone/data";
import { currentQuestion, progressSummary, questionStatus, statusLabels, unmetPrerequisites } from "@/lib/capstone/selectors";
import type { CapstoneData, OpenQuestionPayload, Question, Topic } from "@/lib/capstone/types";
import type { GraphCanvasHandle } from "./graph-canvas";
import { StatusIcon } from "./status-icon";

const GraphCanvas = dynamic(() => import("./graph-canvas"), {
  ssr: false,
  loading: () => <div className="graph-loading" role="status">Preparing your workspace…</div>,
});

export interface CapstoneTreeProps {
  data: CapstoneData;
  onOpenQuestion: (payload: OpenQuestionPayload) => void;
}

function TopicIcon({ topic, size = 17 }: { topic: Topic; size?: number }) {
  const Icon = topic.id === "graphs" ? Network : topic.id === "trees" ? GitBranch : topic.id === "dynamic-programming" ? Workflow : topic.id === "arrays" ? Braces : null;
  return Icon ? <Icon size={size} strokeWidth={1.6} aria-hidden="true" /> : <span className="topic-letter" aria-hidden="true">{topic.abbreviation}</span>;
}

export function CapstoneDemo() {
  const [notice, setNotice] = useState<{ title: string; key: number } | null>(null);
  const handleOpen = useCallback((payload: OpenQuestionPayload) => {
    const question = sampleData.questions.find((item) => item.id === payload.questionId);
    setNotice({ title: question?.title ?? "Question", key: Date.now() });
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 6500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return <>
    <CapstoneTree data={sampleData} onOpenQuestion={handleOpen} />
    {notice && <div key={notice.key} className="question-notice" role="status" aria-live="polite">
      <span className="notice-icon"><Check size={16} /></span><div><strong>Question selected</strong><p>{notice.title}</p><span>Keep exploring your capstone, or choose another chapter.</span></div>
      <button className="icon-button" aria-label="Dismiss notification" onClick={() => setNotice(null)}><X size={15} /></button>
    </div>}
  </>;
}

export function CapstoneTree({ data, onOpenQuestion }: CapstoneTreeProps) {
  const [topicId, setTopicId] = useState("graphs");
  const [selectedId, setSelectedId] = useState<string | null>("delivery-driver");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [panelExpanded, setPanelExpanded] = useState(true);
  const [compact, setCompact] = useState(false);
  const [mobileOverlay, setMobileOverlay] = useState<"topics" | "questions" | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [resizing, setResizing] = useState(false);
  const graph = useRef<GraphCanvasHandle>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const questionRows = useRef(new Map<string, HTMLButtonElement>());
  const lastQuestionTrigger = useRef<HTMLElement | null>(null);
  const lastGuideTrigger = useRef<HTMLElement | null>(null);
  const sidebarToggle = useRef<HTMLButtonElement>(null);
  const panelToggle = useRef<HTMLButtonElement>(null);

  const topic = data.topics.find((item) => item.id === topicId) ?? data.topics[0];
  const capstone = data.capstones.find((item) => item.id === topic.capstoneId)!;
  const questions = useMemo(() => capstone.questionIds.map((id) => data.questions.find((item) => item.id === id)!), [capstone, data.questions]);
  const progress = data.progress.find((item) => item.capstoneId === capstone.id)!;
  const summary = progressSummary(questions, progress);
  const current = currentQuestion(questions, data.prerequisites, progress);
  const preview = questions.find((question) => question.id === previewId);
  const previewStatus = preview ? questionStatus(preview.id, data.prerequisites, progress) : null;
  const visibleTopics = data.topics.filter((item) => item.title.toLowerCase().includes(search.trim().toLowerCase()));
  const sidebarVisible = !compact && sidebarExpanded;
  const panelVisible = !compact ? panelExpanded : mobileOverlay === "questions";

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1023px)");
    const update = () => { setCompact(query.matches); setMobileOverlay(null); };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const row = selectedId ? questionRows.current.get(selectedId) : null;
    row?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [selectedId, panelVisible]);

  const jumpToCurrent = useCallback(() => {
    if (!current) return;
    setSelectedId(current.id);
    setMobileOverlay(null);
    graph.current?.centerQuestion(current.id);
  }, [current]);

  const openTopics = useCallback(() => {
    if (compact) setMobileOverlay((value) => value === "topics" ? null : "topics");
    else setSidebarExpanded((value) => !value);
  }, [compact]);

  const focusSearch = useCallback(() => {
    if (compact) setMobileOverlay("topics");
    else setSidebarExpanded(true);
    window.requestAnimationFrame(() => searchInput.current?.focus());
  }, [compact]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable=true], [role=dialog]") || previewId || guideOpen || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() === "f") { event.preventDefault(); graph.current?.fitMap(); }
      if (event.key.toLowerCase() === "j") { event.preventDefault(); jumpToCurrent(); }
      if (event.key === "/") { event.preventDefault(); focusSearch(); }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [jumpToCurrent, focusSearch, previewId, guideOpen]);

  const switchTopic = (nextId: string) => {
    const nextTopic = data.topics.find((item) => item.id === nextId)!;
    const nextCapstone = data.capstones.find((item) => item.id === nextTopic.capstoneId)!;
    const nextQuestions = nextCapstone.questionIds.map((id) => data.questions.find((item) => item.id === id)!);
    const nextProgress = data.progress.find((item) => item.capstoneId === nextCapstone.id)!;
    setTopicId(nextId);
    setSelectedId(currentQuestion(nextQuestions, data.prerequisites, nextProgress)?.id ?? null);
    setPreviewId(null);
    setMobileOverlay(null);
  };

  const activateQuestion = (id: string) => {
    lastQuestionTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedId(id);
    setMobileOverlay(null);
    setPreviewId(id);
  };

  const selectFromPanel = (id: string) => {
    setSelectedId(id);
    setMobileOverlay(null);
    graph.current?.centerQuestion(id);
  };

  const launchQuestion = (question: Question) => {
    if (questionStatus(question.id, data.prerequisites, progress) === "locked") return;
    onOpenQuestion({ topicId: topic.id, capstoneId: capstone.id, questionId: question.id });
    setPreviewId(null);
  };

  const openGuide = () => {
    lastGuideTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setGuideOpen(true);
    setMobileOverlay(null);
    setPreviewId(null);
  };

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const startX = event.clientX, startWidth = sidebarWidth;
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizing(true);
    const target = event.currentTarget;
    const move = (moveEvent: PointerEvent) => setSidebarWidth(Math.max(220, Math.min(360, startWidth + moveEvent.clientX - startX)));
    const end = () => { setResizing(false); target.removeEventListener("pointermove", move); target.removeEventListener("pointerup", end); target.removeEventListener("pointercancel", end); };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", end);
    target.addEventListener("pointercancel", end);
  };

  const sidebarContents = <>
    <div className="sidebar-brand"><span>CodeCapstone<span className="brand-dot">.</span></span>
      {!compact && <button className="icon-button" aria-label="Collapse topic sidebar" onClick={() => setSidebarExpanded(false)}><PanelLeftClose size={17} /></button>}
    </div>
    <div className="sidebar-intro"><span className="workspace-label">YOUR WORKSPACE</span><span className="workspace-name"><Layers2 size={16} />Capstone library</span></div>
    <label className="topic-search"><Search size={15} aria-hidden="true" /><input ref={searchInput} placeholder="Find a topic…" aria-label="Search topics" value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>/</kbd></label>
    <div className="topics-heading"><span>TOPICS</span><span>{data.topics.length}</span></div>
    <nav className="topic-list" aria-label="Coding topics">
      {visibleTopics.map((item) => {
        const topicCapstone = data.capstones.find((entry) => entry.id === item.capstoneId)!;
        const topicQuestions = data.questions.filter((entry) => entry.capstoneId === item.capstoneId);
        const topicProgress = data.progress.find((entry) => entry.capstoneId === item.capstoneId)!;
        const count = progressSummary(topicQuestions, topicProgress);
        return <button key={item.id} className={`topic-item${item.id === topicId ? " active" : ""}`} aria-current={item.id === topicId ? "page" : undefined} onClick={() => switchTopic(item.id)}>
          <span className="topic-item-icon"><TopicIcon topic={item} /></span><span className="topic-item-text"><span>{item.title}</span><small>{topicCapstone.title}</small></span>
          <span className="topic-count" aria-label={`${count.completed} of ${count.total} solved`}>{count.completed}<span>/{count.total}</span></span>
        </button>;
      })}
      {!visibleTopics.length && <div className="topic-empty"><Search size={22} /><strong>No topics found</strong><span>Try a different search.</span><button onClick={() => setSearch("")}>Clear search</button></div>}
    </nav>
    <div className="sidebar-bottom"><div className="story-note"><span className="story-note-icon"><GitBranch size={18} /></span><strong>Small steps. Bigger things.</strong><p>Every question is a chapter.<br />Every capstone, something you built.</p></div><button className="sidebar-guide" onClick={openGuide}><BookOpen size={15} /><span>How capstones work</span><ArrowUpRight size={13} /></button><div className="sidebar-footer"><span className="tiny-status" />A little progress, every day.</div></div>
  </>;

  const panelContents = <>
    <div className="question-panel-header"><span className="panel-eyebrow"><ListChecks size={14} />YOUR CAPSTONE</span>
      {compact ? <button className="icon-button" aria-label="Close question panel" onClick={() => setMobileOverlay(null)}><X size={16} /></button> : <button ref={panelToggle} className="icon-button" aria-label="Collapse question panel" aria-expanded="true" onClick={() => setPanelExpanded(false)}><ChevronDown size={16} /></button>}
    </div>
    <div className="question-panel-title"><h2>Progress</h2><div className="progress-caption"><span><strong>{summary.completed}</strong> of {summary.total} completed</span><span>{summary.percent}%</span></div>
      <div className="progress-track" role="progressbar" aria-label="Capstone progress" aria-valuemin={0} aria-valuemax={summary.total} aria-valuenow={summary.completed}><span style={{ width: `${summary.percent}%` }} /></div>
    </div>
    <div className="question-list" aria-label="Capstone questions">
      {questions.map((question) => {
        const status = questionStatus(question.id, data.prerequisites, progress);
        return <button key={question.id} ref={(element) => { if (element) questionRows.current.set(question.id, element); else questionRows.current.delete(question.id); }}
          className={`question-row row-${status}${selectedId === question.id ? " selected" : ""}`} aria-label={`Select question ${question.number}: ${question.title}, ${statusLabels[status]}`} aria-pressed={selectedId === question.id}
          onClick={() => selectFromPanel(question.id)} data-testid={`question-row-${question.id}`}>
          <span className="row-status"><StatusIcon status={status} size={14} /></span><span className="row-content"><span className="row-title">{question.title}</span><small>{status === "current" ? "In progress" : status === "locked" ? "Complete prerequisites" : status === "completed" ? "Completed" : "Ready to start"}</small></span><span className="row-number">{String(question.number).padStart(2, "0")}</span>
        </button>;
      })}
    </div>
  </>;

  return <div className={`app-shell${resizing ? " is-resizing" : ""}`} style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
    <a className="skip-link" href="#capstone-workspace">Skip to capstone map</a>
    <aside className="icon-rail" aria-label="Application navigation">
      <button className="rail-logo" aria-label="CodeCapstone, open Graphs" onClick={() => switchTopic("graphs")}><CodeXml size={25} strokeWidth={1.8} /></button>
      <div className="rail-main"><button ref={sidebarToggle} className="rail-button" aria-label={sidebarVisible || mobileOverlay === "topics" ? "Hide topics" : "Show topics"} aria-expanded={compact ? mobileOverlay === "topics" : sidebarExpanded} onClick={openTopics}><PanelLeftOpen size={19} /></button>
        <button className="rail-button rail-active" aria-label="Capstone Tree, fit map" aria-current="page" title="Capstone Tree" onClick={() => graph.current?.fitMap()}><Network size={21} /></button>
        <button className="rail-button" aria-label="About capstones" title="About capstones" onClick={openGuide}><BookOpen size={19} /></button></div>
      <div className="rail-bottom"><button className="rail-button" aria-label="Keyboard shortcuts" title="Keyboard shortcuts" onClick={openGuide}><Keyboard size={19} /></button><span className="rail-avatar" aria-label="Sample learner workspace">C</span></div>
    </aside>

    {sidebarVisible && <aside className="topic-sidebar" aria-label="Topic sidebar">{sidebarContents}
      <div role="separator" aria-label="Resize topic sidebar" aria-orientation="vertical" aria-valuemin={220} aria-valuemax={360} aria-valuenow={sidebarWidth} tabIndex={0} className="sidebar-resize" onPointerDown={startResize}
        onKeyDown={(event) => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); setSidebarWidth((value) => Math.max(220, Math.min(360, value + (event.key === "ArrowRight" ? 10 : -10)))); } }} />
    </aside>}

    <main id="capstone-workspace" className="workspace" tabIndex={-1} aria-label={`${capstone.title} capstone workspace`}>
      <header className="workspace-heading"><div className="workspace-title"><h1>{topic.title}</h1></div><p>{capstone.description}</p></header>
      <GraphCanvas key={capstone.id} ref={graph} questions={questions} prerequisites={data.prerequisites} progress={progress} selectedId={selectedId} panelExpanded={!compact && panelVisible} sidebarWidth={sidebarVisible ? sidebarWidth : 0} onActivate={activateQuestion} onJump={jumpToCurrent} />

      {!compact && panelExpanded && <aside className="question-panel" aria-label="Question progress panel">{panelContents}</aside>}
      {((!compact && !panelExpanded) || compact) && <button ref={panelToggle} className="collapsed-panel-button" aria-expanded={compact ? mobileOverlay === "questions" : panelExpanded} aria-label="Open question panel" onClick={() => compact ? setMobileOverlay((value) => value === "questions" ? null : "questions") : setPanelExpanded(true)}><ListChecks size={16} /><span>Questions</span><span className="collapsed-count">{summary.completed}/{summary.total}</span><ChevronDown size={14} /></button>}

      <div className="canvas-legend" aria-label="Question status legend"><span><i className="legend-completed"><Check size={10} /></i>Completed</span><span><i className="legend-current" />In progress</span><span><i className="legend-available" />Available</span><span><LockKeyhole size={11} />Locked</span></div>
    </main>

    <Dialog.Root open={compact && mobileOverlay === "topics"} onOpenChange={(open) => { if (!open) setMobileOverlay(null); }}><Dialog.Portal><Dialog.Overlay className="mobile-scrim" /><Dialog.Content className="mobile-topic-drawer" onCloseAutoFocus={(event) => { event.preventDefault(); sidebarToggle.current?.focus(); }}><Dialog.Title className="sr-only">Choose a coding topic</Dialog.Title><Dialog.Description className="sr-only">Search topics and switch to another capstone.</Dialog.Description><Dialog.Close className="icon-button mobile-drawer-close" aria-label="Close topics"><X size={18} /></Dialog.Close>{compact && sidebarContents}</Dialog.Content></Dialog.Portal></Dialog.Root>

    <Dialog.Root open={compact && mobileOverlay === "questions"} onOpenChange={(open) => { if (!open) setMobileOverlay(null); }}><Dialog.Portal><Dialog.Overlay className="mobile-scrim question-scrim" /><Dialog.Content className="question-panel mobile-question-panel" onCloseAutoFocus={(event) => { event.preventDefault(); panelToggle.current?.focus(); }}><Dialog.Title className="sr-only">Capstone question list</Dialog.Title><Dialog.Description className="sr-only">Choose a question to center it on the map.</Dialog.Description>{compact && panelContents}</Dialog.Content></Dialog.Portal></Dialog.Root>

    <Dialog.Root open={!!preview} onOpenChange={(open) => { if (!open) setPreviewId(null); }}><Dialog.Portal><Dialog.Overlay className="dialog-scrim" /><Dialog.Content className="preview-dialog" onCloseAutoFocus={(event) => {
      event.preventDefault();
      const button = lastQuestionTrigger.current;
      if (button?.isConnected) button.focus({ preventScroll: true });
      else document.querySelector<HTMLButtonElement>(`[data-question-id="${selectedId}"]`)?.focus({ preventScroll: true });
    }}>
      {preview && previewStatus && <>
        <div className="preview-top"><span className="panel-eyebrow">{topic.title}<ChevronRight size={12} />QUESTION {String(preview.number).padStart(2, "0")}</span><Dialog.Close className="icon-button" aria-label="Close question preview"><X size={18} /></Dialog.Close></div>
        <div className={`preview-status status-text-${previewStatus}`}><StatusIcon status={previewStatus} size={14} /><span>{previewStatus === "current" ? "In progress" : statusLabels[previewStatus]}</span></div>
        <Dialog.Title>{preview.title}</Dialog.Title><div className="preview-tags"><span className={`difficulty difficulty-${preview.difficulty.toLowerCase()}`}>{preview.difficulty}</span><span>{preview.concept}</span></div>
        <div className="preview-story"><span className="section-eyebrow"><BookOpen size={13} />THE NEXT CHAPTER</span><Dialog.Description>{preview.story}</Dialog.Description></div>
        {previewStatus === "locked" ? <div className="prerequisite-box"><strong><LockKeyhole size={14} />Unlock this chapter</strong><p>Complete these questions first:</p><ul>{unmetPrerequisites(preview.id, data.prerequisites, progress).map((id) => <li key={id}><button onClick={() => { setPreviewId(null); setSelectedId(id); graph.current?.centerQuestion(id); }}>{questions.find((question) => question.id === id)?.title}<ArrowUpRight size={13} /></button></li>)}</ul></div> : <button className="primary-button preview-action" onClick={() => launchQuestion(preview)}>{previewStatus === "current" ? "Continue question" : "Start question"}<ArrowRight size={16} /></button>}
        <span className="preview-footer"><GitBranch size={12} />Part of {capstone.title}</span>
      </>}
    </Dialog.Content></Dialog.Portal></Dialog.Root>

    <Dialog.Root open={guideOpen} onOpenChange={setGuideOpen}><Dialog.Portal><Dialog.Overlay className="dialog-scrim" /><Dialog.Content className="preview-dialog guide-dialog" onCloseAutoFocus={(event) => { event.preventDefault(); if (lastGuideTrigger.current?.isConnected) lastGuideTrigger.current.focus({ preventScroll: true }); else sidebarToggle.current?.focus(); }}><div className="preview-top"><span className="panel-eyebrow"><Sparkles size={14} />A DIFFERENT WAY TO PRACTICE</span><Dialog.Close className="icon-button" aria-label="Close capstone guide"><X size={18} /></Dialog.Close></div><Dialog.Title>Build something bigger.</Dialog.Title><Dialog.Description>A capstone is one project, told through connected coding challenges. Each solution adds a working piece to the same story.</Dialog.Description><div className="guide-steps"><span><span>01</span>Follow the connections, one question at a time.</span><span><span>02</span>Explore branches. Bring your solutions together.</span><span><span>03</span>Finish with something you understand and built.</span></div><div className="keyboard-shortcuts"><span><kbd>F</kbd>Fit map</span><span><kbd>J</kbd>Jump to current</span><span><kbd>/</kbd>Find a topic</span></div><button className="primary-button" onClick={() => setGuideOpen(false)}>Back to your path<ArrowRight size={15} /></button></Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>;
}

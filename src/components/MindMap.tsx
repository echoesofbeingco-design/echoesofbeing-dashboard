"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";

interface Client {
  id: string;
  name: string;
  desiredOutcomes: string;
  occupation: string;
  symptoms: string;
  concerns: string;
  stressors: string;
  interpersonalHistory: {
    strengths: string;
    challenges: string;
    significantChanges: string;
    romanticPatterns: string;
    familyPatterns: string;
    friendsPatterns: string;
    workplacePatterns: string;
  };
  keyThemes: {
    thoughts: string;
    emotions: string;
    behaviors: string;
    environmental: string;
  };
  theoreticalLens: {
    origin: string;
    maintainingProcesses: string;
    focusOfIntervention: string;
  };
  treatmentFocus: string;
}

interface SessionSummary {
  id: string;
  date: string;
  sessionNumber: number;
  summary: string;
  presentingProblem: string;
  therapistHomework: string;
  clientHomework: string;
}

interface MindMapNode {
  id: string;
  label: string;
  fullLabel: string;
  category: string;
  color: string;
  textColor: string;
  radius: number;
  x: number;
  y: number;
  floatX: number;
  floatY: number;
  children: string[];
}

// Color palette matching the app theme
const CATEGORY_COLORS: Record<string, { bg: string; text: string; line: string }> = {
  center: { bg: "#2d352d", text: "#f7f5ec", line: "#2d352d" },
  goals: { bg: "#617962", text: "#f7f5ec", line: "#617962" },
  presenting: { bg: "#8b5e3c", text: "#f7f5ec", line: "#8b5e3c" },
  themes: { bg: "#6b5b8a", text: "#f7f5ec", line: "#6b5b8a" },
  strengths: { bg: "#3d7c6b", text: "#f7f5ec", line: "#3d7c6b" },
  stressors: { bg: "#c0594a", text: "#f7f5ec", line: "#c0594a" },
  interpersonal: { bg: "#4a7a9b", text: "#f7f5ec", line: "#4a7a9b" },
  treatment: { bg: "#7a6b4e", text: "#f7f5ec", line: "#7a6b4e" },
};

function extractKeyPhrases(text: string, max: number = 3): string[] {
  if (!text || !text.trim()) return [];
  const parts = text
    .split(/[.,;\n•\-–—]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2 && s.length < 60);
  const unique = [...new Set(parts)];
  return unique.slice(0, max);
}

function truncateLabel(text: string, maxLen: number = 22): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1).trim() + "…";
}

// Clamp a value between min and max
function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max);
}

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;

export default function MindMap({
  client,
  sessions,
}: {
  client: Client;
  sessions: SessionSummary[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const nodesRef = useRef<MindMapNode[]>([]);
  const hoveredNodeRef = useRef<MindMapNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<MindMapNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // ── Pan & Zoom state (refs to avoid re-render on every frame) ──
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const [zoomDisplay, setZoomDisplay] = useState(100);
  const isDraggingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  // Pinch zoom state
  const lastPinchDistRef = useRef<number | null>(null);
  const lastPinchCenterRef = useRef<{ x: number; y: number } | null>(null);

  // Build mind map data from client & sessions
  const mindMapData = useMemo(() => {
    const nodes: MindMapNode[] = [];

    // ── Center node = client name
    nodes.push({
      id: "center",
      label: client.name,
      fullLabel: client.name,
      category: "center",
      color: CATEGORY_COLORS.center.bg,
      textColor: CATEGORY_COLORS.center.text,
      radius: 52,
      x: 0,
      y: 0,
      floatX: 0,
      floatY: 0,
      children: [],
    });

    // ── Read clinical data from client (client-level, not per-session)
    const allProblems = [
      ...extractKeyPhrases(client.symptoms),
      ...extractKeyPhrases(client.concerns),
      ...sessions.flatMap((s) => extractKeyPhrases(s.presentingProblem)),
    ];
    const ih = client.interpersonalHistory;
    const allStrengths = ih ? extractKeyPhrases(ih.strengths) : [];
    const allStressors = extractKeyPhrases(client.stressors);
    const kt = client.keyThemes;
    const allThoughts = kt ? extractKeyPhrases(kt.thoughts) : [];
    const allEmotions = kt ? extractKeyPhrases(kt.emotions) : [];
    const allBehaviors = kt ? extractKeyPhrases(kt.behaviors) : [];
    const allPatterns = ih ? [
      ...extractKeyPhrases(ih.romanticPatterns),
      ...extractKeyPhrases(ih.familyPatterns),
      ...extractKeyPhrases(ih.friendsPatterns),
      ...extractKeyPhrases(ih.workplacePatterns),
    ] : [];
    const tl = client.theoreticalLens;
    const allTreatment = [
      ...extractKeyPhrases(client.treatmentFocus),
      ...(tl ? extractKeyPhrases(tl.focusOfIntervention) : []),
    ];

    const goals = extractKeyPhrases(client.desiredOutcomes, 4);

    // ── Build branches
    const branches: { id: string; label: string; category: string; items: string[]; angle: number }[] = [];

    const addBranch = (id: string, label: string, cat: string, items: string[]) => {
      const uniqueItems = [...new Set(items)].slice(0, 4);
      if (uniqueItems.length === 0 && id !== "goals") return;
      branches.push({ id, label, category: cat, items: uniqueItems, angle: 0 });
    };

    addBranch("goals", "Goals", "goals", goals);
    addBranch("presenting", "Presenting Problems", "presenting", [...new Set(allProblems)].slice(0, 4));
    addBranch("strengths", "Strengths", "strengths", [...new Set(allStrengths)].slice(0, 4));
    addBranch("stressors", "Stressors & Concerns", "stressors", [...new Set(allStressors)].slice(0, 4));
    addBranch("themes", "Key Themes", "themes", [...new Set([...allThoughts, ...allEmotions, ...allBehaviors])].slice(0, 4));
    addBranch("interpersonal", "Relationship Patterns", "interpersonal", [...new Set(allPatterns)].slice(0, 4));
    addBranch("treatment", "Treatment Focus", "treatment", [...new Set(allTreatment)].slice(0, 4));

    const activeBranches = branches.filter((b) => b.items.length > 0 || b.id === "goals");

    const angleStep = (2 * Math.PI) / Math.max(activeBranches.length, 1);
    activeBranches.forEach((b, i) => {
      b.angle = -Math.PI / 2 + i * angleStep;
    });

    const branchDist = 180;
    const leafDist = 100;

    for (const branch of activeBranches) {
      const bx = Math.cos(branch.angle) * branchDist;
      const by = Math.sin(branch.angle) * branchDist;
      const colors = CATEGORY_COLORS[branch.category] || CATEGORY_COLORS.center;

      const branchNode: MindMapNode = {
        id: branch.id,
        label: branch.label,
        fullLabel: branch.label,
        category: branch.category,
        color: colors.bg,
        textColor: colors.text,
        radius: 40,
        x: bx,
        y: by,
        floatX: 0,
        floatY: 0,
        children: [],
      };
      nodes[0].children.push(branch.id);
      nodes.push(branchNode);

      const leafAngleSpread = Math.PI * 0.5;
      const leafAngleStart = branch.angle - leafAngleSpread / 2;
      const leafAngleStep = branch.items.length > 1 ? leafAngleSpread / (branch.items.length - 1) : 0;

      for (let i = 0; i < branch.items.length; i++) {
        const leafAngle = branch.items.length === 1 ? branch.angle : leafAngleStart + i * leafAngleStep;
        const lx = bx + Math.cos(leafAngle) * leafDist;
        const ly = by + Math.sin(leafAngle) * leafDist;
        const leafId = `${branch.id}-${i}`;

        nodes.push({
          id: leafId,
          label: truncateLabel(branch.items[i]),
          fullLabel: branch.items[i],
          category: branch.category,
          color: colors.bg + "cc",
          textColor: colors.text,
          radius: 30,
          x: lx,
          y: ly,
          floatX: 0,
          floatY: 0,
          children: [],
        });

        branchNode.children.push(leafId);
      }
    }

    return nodes;
  }, [client, sessions]);

  // ── Auto-fit: compute initial zoom so all nodes fit in view ──
  const computeAutoFit = useCallback(
    (canvasW: number, canvasH: number) => {
      if (mindMapData.length <= 1) return { zoom: 1, panX: 0, panY: 0 };
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const n of mindMapData) {
        minX = Math.min(minX, n.x - n.radius);
        maxX = Math.max(maxX, n.x + n.radius);
        minY = Math.min(minY, n.y - n.radius);
        maxY = Math.max(maxY, n.y + n.radius);
      }
      const contentW = maxX - minX + 80; // padding
      const contentH = maxY - minY + 80;
      const scaleX = canvasW / contentW;
      const scaleY = canvasH / contentH;
      const zoom = clamp(Math.min(scaleX, scaleY), MIN_ZOOM, 1.5);
      const centerOffsetX = (minX + maxX) / 2;
      const centerOffsetY = (minY + maxY) / 2;
      return { zoom, panX: -centerOffsetX * zoom, panY: -centerOffsetY * zoom };
    },
    [mindMapData]
  );

  // ── Canvas rendering + animation ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let canvasW = 0;
    let canvasH = 0;

    const resizeCanvas = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      const dpr = window.devicePixelRatio || 1;
      canvasW = rect.width;
      canvasH = rect.height;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resizeCanvas();

    // Auto-fit on first load
    const fit = computeAutoFit(canvasW, canvasH);
    zoomRef.current = fit.zoom;
    panRef.current = { x: fit.panX, y: fit.panY };
    setZoomDisplay(Math.round(fit.zoom * 100));

    nodesRef.current = mindMapData.map((n) => ({ ...n }));

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);

    function draw(t: number) {
      if (!ctx) return;
      const w = canvasW;
      const h = canvasH;
      const zoom = zoomRef.current;
      const pan = panRef.current;
      const cx = w / 2 + pan.x;
      const cy = h / 2 + pan.y;

      ctx.clearRect(0, 0, w, h);
      ctx.save();

      const nodes = nodesRef.current;

      // Floating animation
      for (const node of nodes) {
        const seed = node.id.length * 1.7 + node.x * 0.01;
        node.floatX = Math.sin(t * 0.0005 + seed) * 3;
        node.floatY = Math.cos(t * 0.0007 + seed * 1.3) * 3;
      }

      // ── Draw connections ──
      for (const node of nodes) {
        if (node.children.length === 0) continue;
        for (const childId of node.children) {
          const child = nodes.find((n) => n.id === childId);
          if (!child) continue;

          const fromX = cx + (node.x + node.floatX) * zoom;
          const fromY = cy + (node.y + node.floatY) * zoom;
          const toX = cx + (child.x + child.floatX) * zoom;
          const toY = cy + (child.y + child.floatY) * zoom;

          const colors = CATEGORY_COLORS[child.category] || CATEGORY_COLORS.center;

          ctx.beginPath();
          const midX = (fromX + toX) / 2;
          const midY = (fromY + toY) / 2;
          const offsetX = (toY - fromY) * 0.1;
          const offsetY = (fromX - toX) * 0.1;
          ctx.moveTo(fromX, fromY);
          ctx.quadraticCurveTo(midX + offsetX, midY + offsetY, toX, toY);
          ctx.strokeStyle = colors.line + "40";
          ctx.lineWidth = (node.id === "center" ? 2.5 : 1.5) * Math.min(zoom, 1.5);
          ctx.stroke();
        }
      }

      // ── Draw nodes ──
      for (const node of nodes) {
        const nx = cx + (node.x + node.floatX) * zoom;
        const ny = cy + (node.y + node.floatY) * zoom;
        const r = node.radius * zoom;

        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.08)";
        ctx.shadowBlur = 12 * zoom;
        ctx.shadowOffsetY = 4 * zoom;

        ctx.beginPath();
        ctx.arc(nx, ny, r, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();
        ctx.restore();

        // Border glow for hovered
        const hovered = hoveredNodeRef.current;
        if (hovered && hovered.id === node.id) {
          ctx.beginPath();
          ctx.arc(nx, ny, r + 3 * zoom, 0, Math.PI * 2);
          ctx.strokeStyle = node.color;
          ctx.lineWidth = 2 * zoom;
          ctx.stroke();
        }

        // Label
        ctx.fillStyle = node.textColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const fontSize = node.id === "center" ? 14 : node.children.length > 0 ? 11 : 10;
        const fontWeight = node.id === "center" ? "bold" : node.children.length > 0 ? "600" : "400";
        const scaledFontSize = Math.max(fontSize * zoom, 6);
        ctx.font = `${fontWeight} ${scaledFontSize}px 'Nunito Sans', sans-serif`;

        const maxWidth = r * 1.6;
        const words = node.label.split(" ");
        const lines: string[] = [];
        let currentLine = "";

        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) lines.push(currentLine);

        const lineHeight = (node.id === "center" ? 16 : 13) * zoom;
        const totalHeight = lines.length * lineHeight;
        const startY = ny - totalHeight / 2 + lineHeight / 2;

        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], nx, startY + i * lineHeight);
        }
      }

      ctx.restore();
      animFrameRef.current = requestAnimationFrame(draw);
    }

    animFrameRef.current = requestAnimationFrame(draw);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [mindMapData, computeAutoFit]);

  // ── Zoom via wheel (mouse & trackpad) ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const oldZoom = zoomRef.current;

      // Trackpads send small deltaY with ctrlKey for pinch-to-zoom.
      // Regular scroll wheel sends larger deltaY.
      // We handle both: ctrlKey = pinch gesture on trackpad, else = scroll wheel zoom.
      let zoomDelta: number;
      if (e.ctrlKey) {
        // Trackpad pinch — deltaY is small and inverted
        zoomDelta = -e.deltaY * 0.01;
      } else {
        // Scroll wheel — normalize
        zoomDelta = -e.deltaY * 0.001;
      }

      const newZoom = clamp(oldZoom * (1 + zoomDelta * 3), MIN_ZOOM, MAX_ZOOM);

      // Zoom towards mouse/pinch center
      const wx = mouseX - rect.width / 2 - panRef.current.x;
      const wy = mouseY - rect.height / 2 - panRef.current.y;
      const scale = newZoom / oldZoom;
      panRef.current.x -= wx * (scale - 1);
      panRef.current.y -= wy * (scale - 1);

      zoomRef.current = newZoom;
      setZoomDisplay(Math.round(newZoom * 100));
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, []);

  // ── Pan via mouse drag ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handlePointerDown = (e: PointerEvent) => {
      // Only primary button (left click / single touch)
      if (e.button !== 0) return;
      isDraggingRef.current = true;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = "grabbing";
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - lastPointerRef.current.x;
      const dy = e.clientY - lastPointerRef.current.y;
      panRef.current.x += dx;
      panRef.current.y += dy;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
      canvas.style.cursor = "grab";
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointercancel", handlePointerUp);

    canvas.style.cursor = "grab";
    // Touch-action none so the browser doesn't scroll/zoom the page while we handle gestures
    canvas.style.touchAction = "none";

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointercancel", handlePointerUp);
    };
  }, []);

  // ── Pinch-to-zoom on touch ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastPinchDistRef.current = Math.sqrt(dx * dx + dy * dy);
        lastPinchCenterRef.current = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && lastPinchDistRef.current !== null && lastPinchCenterRef.current !== null) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const pinchCenter = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };

        const rect = canvas.getBoundingClientRect();
        const scale = dist / lastPinchDistRef.current;
        const oldZoom = zoomRef.current;
        const newZoom = clamp(oldZoom * scale, MIN_ZOOM, MAX_ZOOM);

        // Zoom toward pinch center
        const cx = pinchCenter.x - rect.left - rect.width / 2 - panRef.current.x;
        const cy = pinchCenter.y - rect.top - rect.height / 2 - panRef.current.y;
        const zoomScale = newZoom / oldZoom;
        panRef.current.x -= cx * (zoomScale - 1);
        panRef.current.y -= cy * (zoomScale - 1);

        // Also pan with pinch drag
        panRef.current.x += pinchCenter.x - lastPinchCenterRef.current.x;
        panRef.current.y += pinchCenter.y - lastPinchCenterRef.current.y;

        zoomRef.current = newZoom;
        setZoomDisplay(Math.round(newZoom * 100));
        lastPinchDistRef.current = dist;
        lastPinchCenterRef.current = pinchCenter;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        lastPinchDistRef.current = null;
        lastPinchCenterRef.current = null;
      }
    };

    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd);
    canvas.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
      canvas.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, []);

  // ── Hover detection (desktop) ──
  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (isDraggingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const zoom = zoomRef.current;
    const pan = panRef.current;
    const cx = rect.width / 2 + pan.x;
    const cy = rect.height / 2 + pan.y;

    let found: MindMapNode | null = null;
    for (const node of nodesRef.current) {
      const nx = cx + (node.x + node.floatX) * zoom;
      const ny = cy + (node.y + node.floatY) * zoom;
      const r = node.radius * zoom;
      const dist = Math.sqrt((mx - nx) ** 2 + (my - ny) ** 2);
      if (dist <= r) {
        found = node;
        break;
      }
    }

    hoveredNodeRef.current = found;
    setHoveredNode(found);
    if (found) {
      setTooltipPos({ x: e.clientX, y: e.clientY });
    }
  }

  // ── Zoom buttons ──
  function handleZoomIn() {
    const newZoom = clamp(zoomRef.current * 1.3, MIN_ZOOM, MAX_ZOOM);
    zoomRef.current = newZoom;
    setZoomDisplay(Math.round(newZoom * 100));
  }

  function handleZoomOut() {
    const newZoom = clamp(zoomRef.current / 1.3, MIN_ZOOM, MAX_ZOOM);
    zoomRef.current = newZoom;
    setZoomDisplay(Math.round(newZoom * 100));
  }

  function handleResetView() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const fit = computeAutoFit(rect.width, rect.height);
    zoomRef.current = fit.zoom;
    panRef.current = { x: fit.panX, y: fit.panY };
    setZoomDisplay(Math.round(fit.zoom * 100));
  }

  // ── Download mind map as PNG ──
  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create an off-screen canvas at higher resolution for a crisp export
    const exportCanvas = document.createElement("canvas");
    const exportCtx = exportCanvas.getContext("2d");
    if (!exportCtx) return;

    const nodes = nodesRef.current;
    if (nodes.length === 0) return;

    // Compute bounding box of all nodes
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x - n.radius);
      maxX = Math.max(maxX, n.x + n.radius);
      minY = Math.min(minY, n.y - n.radius);
      maxY = Math.max(maxY, n.y + n.radius);
    }

    const padding = 60;
    const contentW = maxX - minX + padding * 2;
    const contentH = maxY - minY + padding * 2;
    const exportScale = 2; // 2x for crisp output

    exportCanvas.width = contentW * exportScale;
    exportCanvas.height = contentH * exportScale;
    exportCtx.scale(exportScale, exportScale);

    // Background
    exportCtx.fillStyle = "#f7f5ec"; // cream background
    exportCtx.fillRect(0, 0, contentW, contentH);

    const cx = -minX + padding;
    const cy = -minY + padding;

    // Draw connections
    for (const node of nodes) {
      if (node.children.length === 0) continue;
      for (const childId of node.children) {
        const child = nodes.find((n) => n.id === childId);
        if (!child) continue;

        const fromX = cx + node.x;
        const fromY = cy + node.y;
        const toX = cx + child.x;
        const toY = cy + child.y;

        const colors = CATEGORY_COLORS[child.category] || CATEGORY_COLORS.center;
        exportCtx.beginPath();
        const midX = (fromX + toX) / 2;
        const midY = (fromY + toY) / 2;
        const offsetX = (toY - fromY) * 0.1;
        const offsetY = (fromX - toX) * 0.1;
        exportCtx.moveTo(fromX, fromY);
        exportCtx.quadraticCurveTo(midX + offsetX, midY + offsetY, toX, toY);
        exportCtx.strokeStyle = colors.line + "40";
        exportCtx.lineWidth = node.id === "center" ? 2.5 : 1.5;
        exportCtx.stroke();
      }
    }

    // Draw nodes
    for (const node of nodes) {
      const nx = cx + node.x;
      const ny = cy + node.y;
      const r = node.radius;

      exportCtx.save();
      exportCtx.shadowColor = "rgba(0,0,0,0.08)";
      exportCtx.shadowBlur = 12;
      exportCtx.shadowOffsetY = 4;

      exportCtx.beginPath();
      exportCtx.arc(nx, ny, r, 0, Math.PI * 2);
      exportCtx.fillStyle = node.color;
      exportCtx.fill();
      exportCtx.restore();

      // Label
      exportCtx.fillStyle = node.textColor;
      exportCtx.textAlign = "center";
      exportCtx.textBaseline = "middle";

      const fontSize = node.id === "center" ? 14 : node.children.length > 0 ? 11 : 10;
      const fontWeight = node.id === "center" ? "bold" : node.children.length > 0 ? "600" : "400";
      exportCtx.font = `${fontWeight} ${fontSize}px 'Nunito Sans', sans-serif`;

      const maxWidth = r * 1.6;
      const words = node.label.split(" ");
      const lines: string[] = [];
      let currentLine = "";

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = exportCtx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);

      const lineHeight = node.id === "center" ? 16 : 13;
      const totalHeight = lines.length * lineHeight;
      const startY = ny - totalHeight / 2 + lineHeight / 2;

      for (let i = 0; i < lines.length; i++) {
        exportCtx.fillText(lines[i], nx, startY + i * lineHeight);
      }
    }

    // Watermark
    exportCtx.fillStyle = "#5a605580";
    exportCtx.font = "10px 'Nunito Sans', sans-serif";
    exportCtx.textAlign = "right";
    exportCtx.textBaseline = "bottom";
    exportCtx.fillText("Echos of Being — Mind Map", contentW - 12, contentH - 8);

    // Trigger download
    const link = document.createElement("a");
    const clientSlug = client.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    link.download = `mindmap-${clientSlug}.png`;
    link.href = exportCanvas.toDataURL("image/png");
    link.click();
  }

  // Show mind map if there is ANY clinical data on the client or sessions
  const hasData = sessions.length > 0 || !!(
    client.symptoms || client.concerns || client.stressors || client.desiredOutcomes ||
    client.treatmentFocus ||
    (client.interpersonalHistory && Object.values(client.interpersonalHistory).some((v) => v && v.trim())) ||
    (client.keyThemes && Object.values(client.keyThemes).some((v) => v && v.trim())) ||
    (client.theoreticalLens && Object.values(client.theoreticalLens).some((v) => v && v.trim()))
  );

  if (!hasData) {
    return (
      <div className="border border-border rounded-xl bg-cream-light px-6 py-16 text-center">
        <svg className="w-16 h-16 mx-auto text-muted/20 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
        </svg>
        <h3 className="font-serif text-lg font-medium mb-2">Mind Map</h3>
        <p className="text-muted text-sm mb-1">No clinical data available yet.</p>
        <p className="text-xs text-muted/70">
          Fill in client details (symptoms, themes, interpersonal history) to generate an interactive mind map.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-lg font-medium">Client Mind Map</h2>
          <p className="text-xs text-muted mt-1">
            Visual overview of {client.name}&apos;s therapy journey &mdash; scroll to zoom, drag to pan
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Legend */}
          <div className="hidden md:flex items-center gap-3 flex-wrap">
            {Object.entries(CATEGORY_COLORS)
              .filter(([k]) => k !== "center")
              .map(([key, c]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.bg }} />
                  <span className="text-[10px] capitalize text-muted">{key}</span>
                </div>
              ))}
          </div>
          {/* Download button */}
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted hover:text-forest hover:border-sage-400 hover:bg-accent-bg/50 transition-all"
            title="Download mind map as image"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            <span className="hidden sm:inline">Download</span>
          </button>
        </div>
      </div>

      <div className="border border-border rounded-xl bg-cream-light overflow-hidden relative" style={{ height: "clamp(400px, 60vh, 650px)" }}>
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => { hoveredNodeRef.current = null; setHoveredNode(null); }}
          className="w-full h-full block"
        />

        {/* ── Zoom controls (bottom-right) ── */}
        <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-cream/90 backdrop-blur-sm border border-border rounded-lg shadow-sm p-1">
          <button
            onClick={handleZoomOut}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-accent-bg transition-colors text-muted hover:text-forest"
            title="Zoom out"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
            </svg>
          </button>
          <button
            onClick={handleResetView}
            className="min-w-[48px] h-8 px-2 flex items-center justify-center rounded-md hover:bg-accent-bg transition-colors text-xs font-medium text-muted hover:text-forest"
            title="Reset view"
          >
            {zoomDisplay}%
          </button>
          <button
            onClick={handleZoomIn}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-accent-bg transition-colors text-muted hover:text-forest"
            title="Zoom in"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>

        {/* ── Mobile hint (bottom-left) ── */}
        <div className="absolute bottom-4 left-4 md:hidden">
          <p className="text-[10px] text-muted/60 bg-cream/80 backdrop-blur-sm rounded-md px-2 py-1 border border-border/50">
            Pinch to zoom · Drag to pan
          </p>
        </div>

        {/* Tooltip */}
        {hoveredNode && hoveredNode.id !== "center" && (
          <div
            className="fixed z-50 pointer-events-none bg-forest text-cream px-3 py-2 rounded-lg shadow-lg text-xs max-w-[220px]"
            style={{
              left: tooltipPos.x + 12,
              top: tooltipPos.y - 8,
            }}
          >
            <p className="font-medium">{hoveredNode.fullLabel}</p>
            <p className="text-cream/70 capitalize text-[10px] mt-0.5">{hoveredNode.category}</p>
          </div>
        )}
      </div>
    </div>
  );
}

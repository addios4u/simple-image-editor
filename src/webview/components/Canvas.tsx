import React, { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { useEditorStore, type ToolType } from '../state/editorStore';
import Minimap from './Minimap';
import ContextMenu, { type ContextMenuAction } from './ContextMenu';
import FillDialog, { type FillDialogResult } from './FillDialog';
import StrokeDialog, { type StrokeDialogResult } from './StrokeDialog';
import { BaseTool, type PointerEvent as ToolPointerEvent } from '../tools/BaseTool';
import { MoveTool, type MoveToolConfig } from '../tools/MoveTool';
import { MarqueeTool, type MarqueeToolConfig } from '../tools/MarqueeTool';
import { BrushTool, type BrushToolConfig } from '../tools/BrushTool';
import { TextTool, type TextToolConfig } from '../tools/TextTool';
import {
  setupCanvas, setupRenderLoop, compositeAndRender, brushStrokeLayer,
  requestRender, getCanvasSize, setLayerOffset,
  extractMaskedPixels, stampBufferOntoLayer,
  setFloatingLayer, setFloatingOffset, clearFloatingLayer,
  captureLayerRegion, restoreLayerRegion,
  clearMaskedPixels, fillMaskedPixels, strokeMaskedBoundary,
  cropCanvas, copySelectionToBlob, pasteImageAsNewLayer,
  addLayer, removeLayer as engineRemoveLayer, resampleBuffer, setInternalClipboard, getInternalClipboard,
  renderTextToLayer, bakeLayerOffset,
} from '../engine/engineContext';
import TextInputDialog from './TextInputDialog';
import type { TextData } from '../state/layerStore';
import { RenderLoop } from '../engine/renderLoop';
import { hexToPackedRGBA } from '../engine/helpers';
import { useLayerStore } from '../state/layerStore';
import { useHistoryStore } from '../state/historyStore';
import { getSelectionMask } from '../engine/selectionMask';

/** Lazy config — getters read current store state on each call. */
const brushConfig: BrushToolConfig = {
  getColor: () => hexToPackedRGBA(useEditorStore.getState().fillColor),
  getSize: () => useEditorStore.getState().strokeWidth,
  getHardness: () => 1.0,
  getActiveLayerId: () => useLayerStore.getState().activeLayerId,
  isLayerLocked: () => {
    const { layers, activeLayerId } = useLayerStore.getState();
    const layer = layers.find((l) => l.id === activeLayerId);
    return layer?.locked ?? false;
  },
  brushStrokeLayer,
  requestRender,
  getCanvasSize: () => ({
    width: useEditorStore.getState().canvasWidth,
    height: useEditorStore.getState().canvasHeight,
  }),
  captureLayerRegion,
  pushEditWithSnapshot: (label, layerId, before, region) =>
    useHistoryStore.getState().pushEditWithSnapshot(label, layerId, before, region),
  commitSnapshot: (entryId, after) =>
    useHistoryStore.getState().commitSnapshot(entryId, after),
  bakeOffsetIfNeeded: (layerId) => {
    const layer = useLayerStore.getState().layers.find((l) => l.id === layerId);
    if (!layer || (layer.offsetX === 0 && layer.offsetY === 0)) return;
    bakeLayerOffset(layerId);
    useLayerStore.getState().setLayerOffset(layerId, 0, 0);
  },
};

const moveConfig: MoveToolConfig = {
  getActiveLayerId: () => useLayerStore.getState().activeLayerId,
  getLayerOffset: (layerId) => {
    const layer = useLayerStore.getState().layers.find((l) => l.id === layerId);
    return { x: layer?.offsetX ?? 0, y: layer?.offsetY ?? 0 };
  },
  isLayerLocked: () => {
    const { layers, activeLayerId } = useLayerStore.getState();
    const layer = layers.find((l) => l.id === activeLayerId);
    return layer?.locked ?? false;
  },
  setLayerOffset: (layerId, x, y) => {
    useLayerStore.getState().setLayerOffset(layerId, x, y);
    setLayerOffset(layerId, x, y);
  },
  requestRender,
  // Selection-move support
  getMask: () => getSelectionMask(),
  getCanvasSize: () => ({
    width: useEditorStore.getState().canvasWidth,
    height: useEditorStore.getState().canvasHeight,
  }),
  extractMaskedPixels,
  stampBufferOntoLayer,
  setFloatingLayer,
  setFloatingOffset,
  clearFloatingLayer,
  captureLayerRegion,
  restoreLayerRegion,
  onContourChange: (contour) => {
    sharedContour = contour;
  },
  // History
  pushEditWithSnapshot: (label, layerId, before, region, maskBefore?) =>
    useHistoryStore.getState().pushEditWithSnapshot(label, layerId, before, region, maskBefore),
  commitSnapshot: (entryId, after, maskAfter?) =>
    useHistoryStore.getState().commitSnapshot(entryId, after, maskAfter),
  pushEditWithAction: (label, undoFn, redoFn) =>
    useHistoryStore.getState().pushEditWithAction(label, undoFn, redoFn),
};

// Shared mutable ref for contour data — written by MarqueeTool, read by overlay renderer.
let sharedContour: Array<Array<[number, number]>> | null = null;
// Source canvas for free transform overlay rendering (originalPixels pre-rendered).
let sharedFloatingSrcCanvas: HTMLCanvasElement | null = null;

/** 픽셀 버퍼에서 알파 > 0인 픽셀의 tight bounding box를 반환. */
function tightBounds(
  pixels: Uint8Array,
  w: number,
  h: number,
): { x: number; y: number; width: number; height: number } | null {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (pixels[(y * w + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

// Module-level opener — set by Canvas component on mount.
let _openTextEditor: ((x: number, y: number, layerId: string | null, existing?: TextData) => void) | null = null;

const textConfig: TextToolConfig = {
  getActiveLayerId: () => useLayerStore.getState().activeLayerId,
  getLayerTextData: (id) => useLayerStore.getState().layers.find((l) => l.id === id)?.textData,
  getLayerOffset: (id) => {
    const layer = useLayerStore.getState().layers.find((l) => l.id === id);
    return { x: layer?.offsetX ?? 0, y: layer?.offsetY ?? 0 };
  },
  openTextEditor: (x, y, layerId, existing) => _openTextEditor?.(x, y, layerId, existing),
};

function hexToRgba(hex: string): [number, number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b, 255];
}

/**
 * 캔버스 좌표계 마스크를 레이어-로컬 좌표계로 변환.
 * 레이어가 (offsetX, offsetY)만큼 이동된 경우, 레이어 픽셀 (lx, ly)에
 * 해당하는 캔버스 픽셀은 (lx + offsetX, ly + offsetY)이다.
 */
function adjustMaskForOffset(
  canvasMask: Uint8Array,
  canvasW: number,
  canvasH: number,
  offsetX: number,
  offsetY: number,
): Uint8Array {
  if (offsetX === 0 && offsetY === 0) return canvasMask;
  const layerMask = new Uint8Array(canvasW * canvasH);
  for (let ly = 0; ly < canvasH; ly++) {
    const cx0 = offsetX;
    const cy = ly + offsetY;
    if (cy < 0 || cy >= canvasH) continue;
    for (let lx = 0; lx < canvasW; lx++) {
      const cx = lx + cx0;
      if (cx < 0 || cx >= canvasW) continue;
      layerMask[ly * canvasW + lx] = canvasMask[cy * canvasW + cx];
    }
  }
  return layerMask;
}

const marqueeConfig: MarqueeToolConfig = {
  setSelection: (rect) => useEditorStore.getState().setSelection(rect),
  getSelectionShape: () => useEditorStore.getState().selectionShape,
  getCanvasSize: () => ({
    width: useEditorStore.getState().canvasWidth,
    height: useEditorStore.getState().canvasHeight,
  }),
  getMask: () => getSelectionMask(),
  onContourChange: (contour) => {
    sharedContour = contour;
  },
};

function createTool(type: ToolType): BaseTool {
  switch (type) {
    case 'move':
      return new MoveTool(moveConfig);
    case 'select':
      return new MarqueeTool(marqueeConfig);
    case 'brush':
      return new BrushTool(brushConfig);
    case 'text':
      return new TextTool(textConfig);
    default:
      return new MoveTool(moveConfig);
  }
}

function toToolEvent(
  e: React.PointerEvent<HTMLCanvasElement>,
  zoom: number,
): ToolPointerEvent {
  const rect = e.currentTarget.getBoundingClientRect();
  // getBoundingClientRect already reflects CSS transforms, so dividing
  // by zoom converts the screen-pixel offset back to canvas pixels.
  return {
    x: (e.clientX - rect.left) / zoom,
    y: (e.clientY - rect.top) / zoom,
    button: e.button,
    shiftKey: e.shiftKey,
    ctrlKey: e.ctrlKey,
    altKey: e.altKey,
  };
}

type HandleId = 'tl' | 't' | 'tr' | 'r' | 'br' | 'b' | 'bl' | 'l' | 'move' | 'rotate';

interface FreeTransformState {
  layerId: string;
  originalPixels: Uint8Array;
  originalW: number;
  originalH: number;
  originalX: number;  // layer-local
  originalY: number;  // layer-local
  layerOffsetX: number;  // layer offset at init time (for canvas↔layer-local conversion)
  layerOffsetY: number;
  currentBounds: { x: number; y: number; width: number; height: number };  // canvas coords
  rotation: number;  // degrees
  rotationAtDragStart: number;
  dragStartAngle: number;
  activeHandle: HandleId | null;
  dragStartX: number;
  dragStartY: number;
  boundsAtDragStart: { x: number; y: number; width: number; height: number };
}

function getHitHandle(
  x: number,
  y: number,
  bounds: { x: number; y: number; width: number; height: number },
  rotation: number,
  zoom: number,
): HandleId | null {
  const HANDLE_RADIUS = 6 / zoom;
  const { x: bx, y: by, width: bw, height: bh } = bounds;
  const cx = bx + bw / 2;
  const cy = by + bh / 2;

  // Transform mouse to local (unrotated) frame
  const θ = -rotation * Math.PI / 180;
  const dx = x - cx;
  const dy = y - cy;
  const lx = cx + dx * Math.cos(θ) - dy * Math.sin(θ);
  const ly = cy + dx * Math.sin(θ) + dy * Math.cos(θ);

  // Rotation handle: above center-top in local frame
  const ROTATE_DIST = 20 / zoom;
  const rhx = cx;
  const rhy = by - ROTATE_DIST;
  if (Math.hypot(lx - rhx, ly - rhy) <= HANDLE_RADIUS * 1.5) return 'rotate';

  // Scale handles (in local frame)
  const handles: Array<{ id: HandleId; hx: number; hy: number }> = [
    { id: 'tl', hx: bx,          hy: by },
    { id: 't',  hx: bx + bw / 2, hy: by },
    { id: 'tr', hx: bx + bw,     hy: by },
    { id: 'r',  hx: bx + bw,     hy: by + bh / 2 },
    { id: 'br', hx: bx + bw,     hy: by + bh },
    { id: 'b',  hx: bx + bw / 2, hy: by + bh },
    { id: 'bl', hx: bx,          hy: by + bh },
    { id: 'l',  hx: bx,          hy: by + bh / 2 },
  ];
  for (const h of handles) {
    if (Math.abs(lx - h.hx) <= HANDLE_RADIUS && Math.abs(ly - h.hy) <= HANDLE_RADIUS) {
      return h.id;
    }
  }
  // Inside box = move (check in local frame)
  if (lx >= bx && lx <= bx + bw && ly >= by && ly <= by + bh) return 'move';
  return null;
}

const Canvas: React.FC = () => {
  const canvasWidth = useEditorStore((s) => s.canvasWidth);
  const canvasHeight = useEditorStore((s) => s.canvasHeight);
  const zoom = useEditorStore((s) => s.zoom);
  const activeTool = useEditorStore((s) => s.activeTool);

  const selection = useEditorStore((s) => s.selection);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const toolRef = useRef<{ type: ToolType; instance: BaseTool } | null>(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [freeTransformState, setFreeTransformState] = useState<FreeTransformState | null>(null);
  const freeTransformRef = useRef<FreeTransformState | null>(null);

  type TextOverlay = { x: number; y: number; layerId: string | null; existing?: TextData };
  const [textOverlayState, setTextOverlayState] = useState<TextOverlay | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    freeTransformRef.current = freeTransformState;
  }, [freeTransformState]);

  // 텍스트 편집 opener를 module-level ref에 바인딩
  useEffect(() => {
    _openTextEditor = (x, y, layerId, existing) => setTextOverlayState({ x, y, layerId, existing });
    return () => { _openTextEditor = null; };
  }, []);

  // LayerPanel 더블클릭 등으로 요청된 텍스트 편집
  const requestTextEditLayerId = useEditorStore((s) => s.requestTextEditLayerId);
  useEffect(() => {
    if (!requestTextEditLayerId) return;
    const layer = useLayerStore.getState().layers.find((l) => l.id === requestTextEditLayerId);
    if (layer?.textData) {
      setTextOverlayState({
        x: layer.textData.x + (layer.offsetX ?? 0),
        y: layer.textData.y + (layer.offsetY ?? 0),
        layerId: layer.id,
        existing: layer.textData,
      });
    }
    useEditorStore.getState().setRequestTextEditLayerId(null);
  }, [requestTextEditLayerId]);
  const fillColor = useEditorStore((s) => s.fillColor);
  const strokeColor = useEditorStore((s) => s.strokeColor);
  const strokeWidth = useEditorStore((s) => s.strokeWidth);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [fillDialogOpen, setFillDialogOpen] = useState(false);
  const [strokeDialogOpen, setStrokeDialogOpen] = useState(false);
  const pendingMaskRef = useRef<Uint8Array | null>(null);
  const pendingLayerIdRef = useRef<string | null>(null);
  const pendingSelectionRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const pendingOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const antsOffsetRef = useRef(0);
  const antsRafRef = useRef<number>(0);

  // Setup canvas 2D context and render loop on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setupCanvas(ctx);
    const loop = new RenderLoop(compositeAndRender);
    setupRenderLoop(loop);
    loop.start();

    const engineSize = getCanvasSize();
    if (engineSize.width > 0 && engineSize.height > 0) {
      useEditorStore.getState().setCanvasSize(engineSize.width, engineSize.height);
    }

    requestRender();

    return () => {
      loop.stop();
    };
  }, []);

  // Marching ants animation on the overlay canvas
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;

    let lastTime = 0;
    const ANTS_SPEED = 40; // pixels per second

    const animate = (time: number) => {
      const dt = time - lastTime;
      if (dt > 16) {
        lastTime = time;
        antsOffsetRef.current = (antsOffsetRef.current - (dt * ANTS_SPEED) / 1000) % 8;

        ctx.clearRect(0, 0, overlay.width, overlay.height);
        const contour = sharedContour;
        if (contour && contour.length > 0) {
          ctx.save();
          ctx.lineWidth = 1;
          ctx.strokeStyle = '#000000';
          ctx.setLineDash([4, 4]);
          ctx.lineDashOffset = antsOffsetRef.current;

          for (const loop of contour) {
            if (loop.length < 2) continue;
            ctx.beginPath();
            ctx.moveTo(loop[0][0], loop[0][1]);
            for (let i = 1; i < loop.length; i++) {
              ctx.lineTo(loop[i][0], loop[i][1]);
            }
            ctx.stroke();
          }

          // White pass for visibility on dark backgrounds
          ctx.strokeStyle = '#ffffff';
          ctx.lineDashOffset = antsOffsetRef.current + 4;
          for (const loop of contour) {
            if (loop.length < 2) continue;
            ctx.beginPath();
            ctx.moveTo(loop[0][0], loop[0][1]);
            for (let i = 1; i < loop.length; i++) {
              ctx.lineTo(loop[i][0], loop[i][1]);
            }
            ctx.stroke();
          }
          ctx.restore();
        }

        // Free Transform: floating layer + handles (overlay-based with rotation)
        const tf = freeTransformRef.current;
        const floatSrc = sharedFloatingSrcCanvas;
        if (tf) {
          const { currentBounds: cb, rotation } = tf;
          const { x, y, width: bw, height: bh } = cb;
          const cx = x + bw / 2;
          const cy = y + bh / 2;
          const θ = rotation * Math.PI / 180;

          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(θ);

          // Draw floating layer pixels
          if (floatSrc) {
            ctx.drawImage(floatSrc, -bw / 2, -bh / 2, bw, bh);
          }

          // Rotated transform box
          ctx.strokeStyle = '#0088ff';
          ctx.lineWidth = 1 / zoom;
          ctx.setLineDash([5 / zoom, 3 / zoom]);
          ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
          ctx.setLineDash([]);

          // Scale handles (in local/rotated frame)
          const hs = 4 / zoom;
          const scaleHandles = [
            { hx: -bw / 2, hy: -bh / 2 },
            { hx: 0,       hy: -bh / 2 },
            { hx:  bw / 2, hy: -bh / 2 },
            { hx:  bw / 2, hy: 0 },
            { hx:  bw / 2, hy:  bh / 2 },
            { hx: 0,       hy:  bh / 2 },
            { hx: -bw / 2, hy:  bh / 2 },
            { hx: -bw / 2, hy: 0 },
          ];
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#0088ff';
          ctx.lineWidth = 1 / zoom;
          for (const h of scaleHandles) {
            ctx.fillRect(h.hx - hs, h.hy - hs, hs * 2, hs * 2);
            ctx.strokeRect(h.hx - hs, h.hy - hs, hs * 2, hs * 2);
          }

          // Rotation handle (circle above center-top)
          const ROTATE_DIST = 20 / zoom;
          const rhy = -bh / 2 - ROTATE_DIST;
          ctx.strokeStyle = '#0088ff';
          ctx.lineWidth = 1 / zoom;
          ctx.beginPath();
          ctx.moveTo(0, -bh / 2);
          ctx.lineTo(0, rhy);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, rhy, hs * 1.5, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.strokeStyle = '#0088ff';
          ctx.stroke();

          ctx.restore();
        }
      }
      antsRafRef.current = requestAnimationFrame(animate);
    };

    antsRafRef.current = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(antsRafRef.current);
    };
  }, [canvasWidth, canvasHeight, zoom]);

  // Free Transform keyboard handler (Enter = commit, Escape = cancel)
  // Also handles: Cmd+T = initiate free transform, Cmd+Enter = crop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      const isMod = e.metaKey || e.ctrlKey;
      const tf = freeTransformRef.current;

      if (tf) {
        // Free transform active — Enter commits, Escape cancels
        if (e.key === 'Enter' && !isMod) {
          e.preventDefault();
          const { currentBounds, originalPixels, originalW, originalH, layerId, rotation } = tf;
          // Rasterize with scale + rotation using canvas 2D
          const θ = rotation * Math.PI / 180;
          const cos = Math.abs(Math.cos(θ));
          const sin = Math.abs(Math.sin(θ));
          const sw = currentBounds.width;
          const sh = currentBounds.height;
          const aabbW = Math.max(1, Math.round(sw * cos + sh * sin));
          const aabbH = Math.max(1, Math.round(sw * sin + sh * cos));
          const cx = currentBounds.x + sw / 2;
          const cy = currentBounds.y + sh / 2;
          const aabbX = Math.round(cx - aabbW / 2);
          const aabbY = Math.round(cy - aabbH / 2);

          const srcCvs = document.createElement('canvas');
          srcCvs.width = originalW; srcCvs.height = originalH;
          srcCvs.getContext('2d')!.putImageData(
            new ImageData(new Uint8ClampedArray(originalPixels), originalW, originalH), 0, 0,
          );
          const dstCvs = document.createElement('canvas');
          dstCvs.width = aabbW; dstCvs.height = aabbH;
          const dstCtx = dstCvs.getContext('2d')!;
          dstCtx.translate(aabbW / 2, aabbH / 2);
          dstCtx.rotate(θ);
          dstCtx.drawImage(srcCvs, -sw / 2, -sh / 2, sw, sh);
          const rasterized = new Uint8Array(dstCtx.getImageData(0, 0, aabbW, aabbH).data.buffer);
          stampBufferOntoLayer(layerId, rasterized, aabbW, aabbH, aabbX, aabbY);

          sharedFloatingSrcCanvas = null;
          setFreeTransformState(null);
          freeTransformRef.current = null;
          useEditorStore.getState().setSelection(null);
          requestRender();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          const { originalPixels, originalW, originalH, layerId, originalX, originalY } = tf;
          stampBufferOntoLayer(layerId, originalPixels, originalW, originalH, originalX, originalY);
          sharedFloatingSrcCanvas = null;
          setFreeTransformState(null);
          freeTransformRef.current = null;
          requestRender();
        }
        return;
      }

      if (!isMod) return;

      // Cmd+T: initiate Free Transform (works with or without selection)
      if (e.code === 'KeyT') {
        e.preventDefault();
        const { selection, canvasWidth: cw, canvasHeight: ch, setSelection } = useEditorStore.getState();
        const { activeLayerId } = useLayerStore.getState();
        if (!activeLayerId) return;

        bakeLayerOffset(activeLayerId);
        useLayerStore.getState().setLayerOffset(activeLayerId, 0, 0);

        let bx: number, by: number, bw: number, bh: number;
        let extracted: Uint8Array | null;

        if (selection) {
          const selMask = getSelectionMask();
          if (!selMask) return;
          const maskData = selMask.getMaskData();
          const bounds = selMask.getBounds();
          if (!bounds) return;
          extracted = extractMaskedPixels(activeLayerId, maskData);
          if (!extracted) return;
          ({ x: bx, y: by, width: bw, height: bh } = bounds);
          sharedContour = null;
          getSelectionMask()?.clear();
          setSelection(null);
        } else {
          // No selection: free transform the entire layer
          const fullMask = new Uint8Array(cw * ch).fill(1);
          extracted = extractMaskedPixels(activeLayerId, fullMask);
          if (!extracted) return;
          bx = 0; by = 0; bw = cw; bh = ch;
        }

        const rawPixels = new Uint8Array(bw * bh * 4);
        for (let row = 0; row < bh; row++) {
          const srcOff = ((by + row) * cw + bx) * 4;
          rawPixels.set(extracted.subarray(srcOff, srcOff + bw * 4), row * bw * 4);
        }

        // Crop to tight non-transparent bounding box
        const tight = tightBounds(rawPixels, bw, bh);
        if (!tight) return;
        const tbx = bx + tight.x, tby = by + tight.y;
        const tbw = tight.width, tbh = tight.height;
        const originalPixels = new Uint8Array(tbw * tbh * 4);
        for (let row = 0; row < tbh; row++) {
          const srcOff = ((tight.y + row) * bw + tight.x) * 4;
          originalPixels.set(rawPixels.subarray(srcOff, srcOff + tbw * 4), row * tbw * 4);
        }

        // Build source canvas for overlay rendering
        const srcCvs = document.createElement('canvas');
        srcCvs.width = tbw; srcCvs.height = tbh;
        srcCvs.getContext('2d')!.putImageData(
          new ImageData(new Uint8ClampedArray(originalPixels), tbw, tbh), 0, 0,
        );
        sharedFloatingSrcCanvas = srcCvs;
        requestRender();

        const transformState: FreeTransformState = {
          layerId: activeLayerId,
          originalPixels,
          originalW: tbw,
          originalH: tbh,
          originalX: tbx,
          originalY: tby,
          layerOffsetX: 0,
          layerOffsetY: 0,
          rotation: 0,
          rotationAtDragStart: 0,
          dragStartAngle: 0,
          currentBounds: { x: tbx, y: tby, width: tbw, height: tbh },
          activeHandle: null,
          dragStartX: 0,
          dragStartY: 0,
          boundsAtDragStart: { x: tbx, y: tby, width: tbw, height: tbh },
        };
        setFreeTransformState(transformState);
        freeTransformRef.current = transformState;
        return;
      }

      // Cmd+Enter: Crop
      if (e.key === 'Enter') {
        e.preventDefault();
        const { selection, setSelection, setCanvasSize } = useEditorStore.getState();
        if (!selection) return;
        const { x, y, width: w, height: h } = selection;
        if (w <= 0 || h <= 0) return;
        cropCanvas(x, y, w, h);
        setCanvasSize(w, h);
        sharedContour = null;
        getSelectionMask()?.clear();
        setSelection(null);
        useLayerStore.getState().bumpThumbnailVersion();
        requestRender();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setFreeTransformState]);

  const handleTextConfirm = useCallback((text: string) => {
    if (!textOverlayState) return;
    const { x, y, layerId } = textOverlayState;
    const { fontFamily, fontSize, fontBold, fontItalic, fillColor } = useEditorStore.getState();
    // x, y는 캔버스 좌표 (= layer-local + offset). textData에는 layer-local 좌표를 저장해야 함.
    const existingLayer = layerId ? useLayerStore.getState().layers.find((l) => l.id === layerId) : null;
    const localX = x - (existingLayer?.offsetX ?? 0);
    const localY = y - (existingLayer?.offsetY ?? 0);
    const textData: TextData = { text, fontFamily, fontSize, bold: fontBold, italic: fontItalic, x: localX, y: localY };

    if (layerId) {
      // 기존 텍스트 레이어 갱신
      const { canvasWidth, canvasHeight } = useEditorStore.getState();
      const before = captureLayerRegion(layerId, 0, 0, canvasWidth, canvasHeight);
      const entryId = before
        ? useHistoryStore.getState().pushEditWithSnapshot(
            'Edit Text', layerId, before,
            { x: 0, y: 0, w: canvasWidth, h: canvasHeight },
          )
        : null;
      renderTextToLayer(layerId, textData, fillColor);
      useLayerStore.getState().setLayerTextData(layerId, textData);
      if (entryId) {
        const after = captureLayerRegion(layerId, 0, 0, canvasWidth, canvasHeight);
        if (after) useHistoryStore.getState().commitSnapshot(entryId, after);
      }
    } else {
      // 새 텍스트 레이어 생성
      useLayerStore.getState().addLayer();
      const newLayers = useLayerStore.getState().layers;
      const newLayer = newLayers[newLayers.length - 1];
      addLayer(newLayer.id);
      renderTextToLayer(newLayer.id, textData, fillColor);
      useLayerStore.getState().setLayerTextData(newLayer.id, textData);
      useLayerStore.getState().setActiveLayer(newLayer.id);
      useHistoryStore.getState().pushEdit('Add Text');
    }

    useLayerStore.getState().bumpThumbnailVersion();
    requestRender();
    setTextOverlayState(null);
  }, [textOverlayState]);

  const handleTextCancel = useCallback(() => {
    setTextOverlayState(null);
  }, []);

  const tool = useMemo(() => {
    if (!toolRef.current || toolRef.current.type !== activeTool) {
      const instance = createTool(activeTool);
      toolRef.current = { type: activeTool, instance };
    }
    return toolRef.current.instance;
  }, [activeTool]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (textOverlayState) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      const evt = toToolEvent(e, zoom);

      const tf = freeTransformRef.current;
      if (tf) {
        const hit = getHitHandle(evt.x, evt.y, tf.currentBounds, tf.rotation, zoom);
        if (hit) {
          const { currentBounds: cb } = tf;
          const startAngle = hit === 'rotate'
            ? Math.atan2(evt.y - (cb.y + cb.height / 2), evt.x - (cb.x + cb.width / 2)) * 180 / Math.PI
            : 0;
          setFreeTransformState((prev) => {
            if (!prev) return prev;
            const next: FreeTransformState = {
              ...prev,
              activeHandle: hit,
              dragStartX: evt.x,
              dragStartY: evt.y,
              boundsAtDragStart: { ...prev.currentBounds },
              dragStartAngle: startAngle,
              rotationAtDragStart: prev.rotation,
            };
            freeTransformRef.current = next;
            return next;
          });
          return;
        }
      }

      tool.onPointerDown(evt);
    },
    [tool, zoom],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const evt = toToolEvent(e, zoom);
      setCursorPos({ x: Math.round(evt.x), y: Math.round(evt.y) });

      const tf = freeTransformRef.current;
      if (tf && tf.activeHandle) {
        // Rotation handle drag
        if (tf.activeHandle === 'rotate') {
          const { currentBounds: cb, rotationAtDragStart, dragStartAngle } = tf;
          const cx = cb.x + cb.width / 2;
          const cy = cb.y + cb.height / 2;
          const currentAngle = Math.atan2(evt.y - cy, evt.x - cx) * 180 / Math.PI;
          const newRotation = rotationAtDragStart + (currentAngle - dragStartAngle);
          setFreeTransformState((prev) => {
            if (!prev) return prev;
            const next: FreeTransformState = { ...prev, rotation: newRotation };
            freeTransformRef.current = next;
            return next;
          });
          return;
        }

        const dx = evt.x - tf.dragStartX;
        const dy = evt.y - tf.dragStartY;
        const { x: bx, y: by, width: bw, height: bh } = tf.boundsAtDragStart;
        const cx0 = bx + bw / 2;
        const cy0 = by + bh / 2;

        // Transform delta to local (unrotated) frame for scale handles
        const θ = tf.rotation * Math.PI / 180;
        const cosA = Math.cos(-θ);
        const sinA = Math.sin(-θ);
        const ldx = tf.activeHandle === 'move' ? dx : dx * cosA - dy * sinA;
        const ldy = tf.activeHandle === 'move' ? dy : dx * sinA + dy * cosA;

        let nx = bx, ny = by, nw = bw, nh = bh;
        switch (tf.activeHandle) {
          case 'move': nx = bx + ldx; ny = by + ldy; break;
          case 'tl':   nw = bw - ldx; nh = bh - ldy; break;
          case 't':    nh = bh - ldy; break;
          case 'tr':   nw = bw + ldx; nh = bh - ldy; break;
          case 'r':    nw = bw + ldx; break;
          case 'br':   nw = bw + ldx; nh = bh + ldy; break;
          case 'b':    nh = bh + ldy; break;
          case 'bl':   nw = bw - ldx; nh = bh + ldy; break;
          case 'l':    nw = bw - ldx; break;
        }

        if (nw < 4) nw = 4;
        if (nh < 4) nh = 4;

        // Keep center fixed for scale handles
        if (tf.activeHandle !== 'move') {
          nx = cx0 - nw / 2;
          ny = cy0 - nh / 2;
        }

        const newBounds = {
          x: Math.round(nx),
          y: Math.round(ny),
          width: Math.round(nw),
          height: Math.round(nh),
        };

        setFreeTransformState((prev) => {
          if (!prev) return prev;
          const next: FreeTransformState = { ...prev, currentBounds: newBounds };
          freeTransformRef.current = next;
          return next;
        });
        return;
      }

      tool.onPointerMove(evt);
    },
    [tool, zoom],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.currentTarget.releasePointerCapture(e.pointerId);
      const evt = toToolEvent(e, zoom);

      if (freeTransformRef.current?.activeHandle) {
        setFreeTransformState((prev) => {
          if (!prev) return prev;
          const next: FreeTransformState = { ...prev, activeHandle: null };
          freeTransformRef.current = next;
          return next;
        });
        return;
      }

      tool.onPointerUp(evt);
    },
    [tool, zoom],
  );

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  return (
    <div className="canvas-area-wrapper">
      <div
        ref={containerRef}
        className="editor-canvas-area"
      >
        <div
          className="canvas-container"
          style={{
            position: 'relative',
            width: canvasWidth * zoom,
            height: canvasHeight * zoom,
          }}
        >
          <div
            className="canvas-wrapper"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            <canvas
              ref={canvasRef}
              data-testid="editor-canvas"
              width={canvasWidth}
              height={canvasHeight}
              style={{ cursor: tool.getCursor() }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onContextMenu={handleContextMenu}
            />
            <canvas
              ref={overlayRef}
              data-testid="selection-overlay"
              width={canvasWidth}
              height={canvasHeight}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                pointerEvents: 'none',
              }}
            />
          </div>
          {textOverlayState && (
            <TextInputDialog
              existing={textOverlayState.existing}
              onConfirm={handleTextConfirm}
              onCancel={handleTextCancel}
            />
          )}
        </div>
      </div>
      <Minimap
        mode="scroll"
        sourceCanvas={canvasRef.current}
        containerEl={containerRef.current}
        zoom={zoom}
        docWidth={canvasWidth}
        docHeight={canvasHeight}
        cursorX={cursorPos.x}
        cursorY={cursorPos.y}
      />
      {fillDialogOpen && (
        <FillDialog
          initialColor={fillColor}
          onCancel={() => setFillDialogOpen(false)}
          onConfirm={(result: FillDialogResult) => {
            setFillDialogOpen(false);
            const maskData = pendingMaskRef.current;
            const layerId = pendingLayerIdRef.current;
            const sel = pendingSelectionRef.current;
            const off = pendingOffsetRef.current;
            if (!maskData || !layerId || !sel) return;
            try {
              const [r, g, b] = hexToRgba(result.color);
              const a = Math.round((result.opacity / 100) * 255);
              const { pushEditWithSnapshot, commitSnapshot } = useHistoryStore.getState();
              const lx = sel.x - off.x;
              const ly = sel.y - off.y;
              const before = captureLayerRegion(layerId, lx, ly, sel.width, sel.height);
              if (!before) return;
              const entryId = pushEditWithSnapshot('Fill Selection', layerId, before,
                { x: lx, y: ly, w: sel.width, h: sel.height });
              const adjMask = adjustMaskForOffset(maskData, canvasWidth, canvasHeight, off.x, off.y);
              fillMaskedPixels(layerId, adjMask, r, g, b, a);
              const after = captureLayerRegion(layerId, lx, ly, sel.width, sel.height);
              if (after) commitSnapshot(entryId, after);
              useEditorStore.getState().setFillColor(result.color);
              useLayerStore.getState().bumpThumbnailVersion();
              requestRender();
            } catch (e) { console.error('Fill error:', e); }
          }}
        />
      )}
      {strokeDialogOpen && (
        <StrokeDialog
          initialColor={strokeColor}
          initialWidth={strokeWidth}
          onCancel={() => setStrokeDialogOpen(false)}
          onConfirm={(result: StrokeDialogResult) => {
            setStrokeDialogOpen(false);
            const maskData = pendingMaskRef.current;
            const layerId = pendingLayerIdRef.current;
            const sel = pendingSelectionRef.current;
            const off = pendingOffsetRef.current;
            if (!maskData || !layerId || !sel) return;
            try {
              const [r, g, b, a] = hexToRgba(result.color);
              const { pushEditWithSnapshot, commitSnapshot } = useHistoryStore.getState();
              const lx = sel.x - off.x;
              const ly = sel.y - off.y;
              const before = captureLayerRegion(layerId, lx, ly, sel.width, sel.height);
              if (!before) return;
              const entryId = pushEditWithSnapshot('Stroke Selection', layerId, before,
                { x: lx, y: ly, w: sel.width, h: sel.height });
              const adjMask = adjustMaskForOffset(maskData, canvasWidth, canvasHeight, off.x, off.y);
              strokeMaskedBoundary(layerId, adjMask, r, g, b, a, result.width);
              const after = captureLayerRegion(layerId, lx, ly, sel.width, sel.height);
              if (after) commitSnapshot(entryId, after);
              useEditorStore.getState().setStrokeColor(result.color);
              useEditorStore.getState().setStrokeWidth(result.width);
              useLayerStore.getState().bumpThumbnailVersion();
              requestRender();
            } catch (e) { console.error('Stroke error:', e); }
          }}
        />
      )}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          hasSelection={!!selection}
          onClose={() => setContextMenu(null)}
          onAction={async (action: ContextMenuAction) => {
            setContextMenu(null);
            try {
            const mask = getSelectionMask();
            const maskData = mask?.getMaskData();
            const { activeLayerId } = useLayerStore.getState();
            const { pushEditWithSnapshot, commitSnapshot } = useHistoryStore.getState();
            const { setSelection, setCanvasSize } = useEditorStore.getState();

            switch (action) {
              case 'copy': {
                if (!mask || !selection) break;
                const bounds = mask.getBounds();
                if (!bounds) break;
                const blob = await copySelectionToBlob({
                  x: bounds.x, y: bounds.y, w: bounds.width, h: bounds.height,
                });
                if (!blob) break;
                setInternalClipboard(blob);
                try {
                  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                } catch (e) {
                  console.warn('System clipboard not available:', e);
                }
                break;
              }
              case 'paste': {
                let blobToPaste: Blob | null = null;
                try {
                  const items = await navigator.clipboard.read();
                  for (const item of items) {
                    const imageType = item.types.find((t) => t.startsWith('image/'));
                    if (imageType) {
                      blobToPaste = await item.getType(imageType);
                      break;
                    }
                    if (item.types.includes('text/plain')) {
                      const text = await item.getType('text/plain').then((b) => b.text());
                      console.log('텍스트 클립보드 - TextTool 구현 후 연동 예정:', text);
                      break;
                    }
                  }
                } catch (e) {
                  console.warn('System clipboard read failed:', e);
                }
                // 시스템 클립보드에 이미지 없으면 내부 클립보드 사용
                if (!blobToPaste) {
                  blobToPaste = getInternalClipboard();
                }
                if (!blobToPaste) break;
                const newLayerStore = useLayerStore.getState();
                newLayerStore.addLayer();
                const newLayers = useLayerStore.getState().layers;
                const newLayer = newLayers[newLayers.length - 1];
                if (!newLayer) break;
                const ok = await pasteImageAsNewLayer(blobToPaste, newLayer.id);
                if (ok) {
                  useLayerStore.getState().setActiveLayer(newLayer.id);
                  useLayerStore.getState().bumpThumbnailVersion();
                  requestRender();
                  let currentLayerId = newLayer.id;
                  const savedBlob = blobToPaste;
                  useHistoryStore.getState().pushEditWithAction(
                    'Paste',
                    () => {
                      engineRemoveLayer(currentLayerId);
                      useLayerStore.getState().removeLayer(currentLayerId);
                      requestRender();
                    },
                    () => {
                      void (async () => {
                        useLayerStore.getState().addLayer();
                        const redoLayers = useLayerStore.getState().layers;
                        const redoLayer = redoLayers[redoLayers.length - 1];
                        if (!redoLayer) return;
                        const redoOk = await pasteImageAsNewLayer(savedBlob, redoLayer.id);
                        if (redoOk) {
                          currentLayerId = redoLayer.id;
                          useLayerStore.getState().setActiveLayer(redoLayer.id);
                          useLayerStore.getState().bumpThumbnailVersion();
                          requestRender();
                        } else {
                          useLayerStore.getState().removeLayer(redoLayer.id);
                        }
                      })();
                    },
                  );
                } else {
                  useLayerStore.getState().removeLayer(newLayer.id);
                }
                break;
              }
              case 'clear': {
                if (!maskData || !activeLayerId || !selection) break;
                const clearLayer = useLayerStore.getState().layers.find(l => l.id === activeLayerId);
                const clearOffX = clearLayer?.offsetX ?? 0;
                const clearOffY = clearLayer?.offsetY ?? 0;
                const clearLx = selection.x - clearOffX;
                const clearLy = selection.y - clearOffY;
                const before = captureLayerRegion(activeLayerId, clearLx, clearLy, selection.width, selection.height);
                if (!before) break;
                const entryId = pushEditWithSnapshot(
                  'Clear Selection', activeLayerId, before,
                  { x: clearLx, y: clearLy, w: selection.width, h: selection.height },
                );
                const clearAdjMask = adjustMaskForOffset(maskData, canvasWidth, canvasHeight, clearOffX, clearOffY);
                clearMaskedPixels(activeLayerId, clearAdjMask);
                const after = captureLayerRegion(activeLayerId, clearLx, clearLy, selection.width, selection.height);
                if (after) commitSnapshot(entryId, after);
                useLayerStore.getState().bumpThumbnailVersion();
                requestRender();
                break;
              }
              case 'fill': {
                if (!maskData || !activeLayerId || !selection) break;
                const fillLayer = useLayerStore.getState().layers.find(l => l.id === activeLayerId);
                pendingMaskRef.current = new Uint8Array(maskData);
                pendingLayerIdRef.current = activeLayerId;
                pendingSelectionRef.current = { ...selection };
                pendingOffsetRef.current = { x: fillLayer?.offsetX ?? 0, y: fillLayer?.offsetY ?? 0 };
                setFillDialogOpen(true);
                break;
              }
              case 'stroke': {
                if (!maskData || !activeLayerId || !selection) break;
                const strokeLayer = useLayerStore.getState().layers.find(l => l.id === activeLayerId);
                pendingMaskRef.current = new Uint8Array(maskData);
                pendingLayerIdRef.current = activeLayerId;
                pendingSelectionRef.current = { ...selection };
                pendingOffsetRef.current = { x: strokeLayer?.offsetX ?? 0, y: strokeLayer?.offsetY ?? 0 };
                setStrokeDialogOpen(true);
                break;
              }
              case 'crop': {
                if (!selection) break;
                const { x, y, width: w, height: h } = selection;
                // Capture full-canvas snapshot using a 1x1 fallback region for history
                const before = captureLayerRegion(activeLayerId, 0, 0, 1, 1);
                if (before) {
                  const entryId = pushEditWithSnapshot(
                    'Crop Canvas', activeLayerId, before,
                    { x: 0, y: 0, w: 1, h: 1 },
                  );
                  cropCanvas(x, y, w, h);
                  setCanvasSize(w, h);
                  setSelection(null);
                  const after = captureLayerRegion(activeLayerId, 0, 0, 1, 1);
                  if (after) commitSnapshot(entryId, after);
                } else {
                  cropCanvas(x, y, w, h);
                  setCanvasSize(w, h);
                  setSelection(null);
                }
                useLayerStore.getState().bumpThumbnailVersion();
                requestRender();
                break;
              }
              case 'freeTransform': {
                if (!maskData || !activeLayerId || !selection) break;
                const mask = getSelectionMask()!;
                const bounds = mask.getBounds();
                if (!bounds) break;

                // Bake layer offset: shift pixels into canvas-space coords and reset offset to (0,0).
                bakeLayerOffset(activeLayerId);
                useLayerStore.getState().setLayerOffset(activeLayerId, 0, 0);

                const { canvasWidth: cw } = useEditorStore.getState();
                const extracted = extractMaskedPixels(activeLayerId, maskData);
                if (!extracted) break;

                const { x: bx, y: by, width: bw, height: bh } = bounds;
                const rawPixels = new Uint8Array(bw * bh * 4);
                for (let row = 0; row < bh; row++) {
                  const srcOff = ((by + row) * cw + bx) * 4;
                  rawPixels.set(extracted.subarray(srcOff, srcOff + bw * 4), row * bw * 4);
                }

                // Crop to tight non-transparent bounding box
                const tight = tightBounds(rawPixels, bw, bh);
                if (!tight) break;
                const tbx = bx + tight.x, tby = by + tight.y;
                const tbw = tight.width, tbh = tight.height;
                const originalPixels = new Uint8Array(tbw * tbh * 4);
                for (let row = 0; row < tbh; row++) {
                  const srcOff = ((tight.y + row) * bw + tight.x) * 4;
                  originalPixels.set(rawPixels.subarray(srcOff, srcOff + tbw * 4), row * tbw * 4);
                }

                // Build source canvas for overlay rendering (no WASM floating layer)
                const srcCvs = document.createElement('canvas');
                srcCvs.width = tbw; srcCvs.height = tbh;
                srcCvs.getContext('2d')!.putImageData(
                  new ImageData(new Uint8ClampedArray(originalPixels), tbw, tbh), 0, 0,
                );
                sharedFloatingSrcCanvas = srcCvs;
                requestRender();

                // 선택 animation 제거
                sharedContour = null;
                getSelectionMask()?.clear();
                setSelection(null);

                const transformState: FreeTransformState = {
                  layerId: activeLayerId,
                  originalPixels,
                  originalW: tbw,
                  originalH: tbh,
                  originalX: tbx,
                  originalY: tby,
                  layerOffsetX: 0,
                  layerOffsetY: 0,
                  rotation: 0,
                  rotationAtDragStart: 0,
                  dragStartAngle: 0,
                  currentBounds: { x: tbx, y: tby, width: tbw, height: tbh },
                  activeHandle: null,
                  dragStartX: 0,
                  dragStartY: 0,
                  boundsAtDragStart: { x: tbx, y: tby, width: tbw, height: tbh },
                };
                setFreeTransformState(transformState);
                freeTransformRef.current = transformState;
                break;
              }
            }
            } catch (e) {
              console.error('Context menu action error:', e);
            }
          }}
        />
      )}
    </div>
  );
};

export default Canvas;
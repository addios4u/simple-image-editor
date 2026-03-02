import React, { useRef, useEffect, useCallback, useState } from 'react';

interface MinimapBaseProps {
  sourceCanvas: HTMLCanvasElement | null;
  zoom: number;
  docWidth: number;
  docHeight: number;
  cursorX: number;
  cursorY: number;
}

interface ScrollMinimapProps extends MinimapBaseProps {
  mode: 'scroll';
  containerEl: HTMLDivElement | null;
}

interface TransformMinimapProps extends MinimapBaseProps {
  mode: 'transform';
  containerEl: HTMLDivElement | null;
  panX: number;
  panY: number;
  setPan: (x: number, y: number) => void;
}

type MinimapProps = ScrollMinimapProps | TransformMinimapProps;

const MINIMAP_W = 200;
const THUMB_H = 120;

function getImageLayout(srcW: number, srcH: number) {
  const scale = Math.min(MINIMAP_W / srcW, THUMB_H / srcH);
  const drawW = srcW * scale;
  const drawH = srcH * scale;
  const offsetX = (MINIMAP_W - drawW) / 2;
  const offsetY = (THUMB_H - drawH) / 2;
  return { scale, drawW, drawH, offsetX, offsetY };
}

const Minimap: React.FC<MinimapProps> = (props) => {
  const { sourceCanvas, zoom, containerEl, docWidth, docHeight, cursorX, cursorY } = props;
  const thumbRef = useRef<HTMLCanvasElement>(null);
  const isDragging = useRef(false);
  const [viewport, setViewport] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [viewportPx, setViewportPx] = useState({ w: 0, h: 0 });

  // Draw thumbnail
  useEffect(() => {
    if (!sourceCanvas || !thumbRef.current) return;
    const thumb = thumbRef.current;
    const ctx = thumb.getContext('2d');
    if (!ctx) return;

    thumb.width = MINIMAP_W;
    thumb.height = THUMB_H;

    const srcW = sourceCanvas.width;
    const srcH = sourceCanvas.height;
    if (srcW === 0 || srcH === 0) return;

    const { drawW, drawH, offsetX, offsetY } = getImageLayout(srcW, srcH);

    ctx.clearRect(0, 0, MINIMAP_W, THUMB_H);
    ctx.drawImage(sourceCanvas, offsetX, offsetY, drawW, drawH);
  }, [sourceCanvas, sourceCanvas?.width, sourceCanvas?.height]);

  // Update viewport rect
  useEffect(() => {
    if (!sourceCanvas || !containerEl) return;

    const srcW = sourceCanvas.width;
    const srcH = sourceCanvas.height;
    if (srcW === 0 || srcH === 0) return;

    const { drawW, drawH, offsetX, offsetY } = getImageLayout(srcW, srcH);

    const updateViewport = () => {
      const visibleW = containerEl.clientWidth;
      const visibleH = containerEl.clientHeight;
      const contentW = srcW * zoom;
      const contentH = srcH * zoom;

      // Viewport size in image pixels
      const vpPxW = Math.round(Math.min(visibleW / zoom, srcW));
      const vpPxH = Math.round(Math.min(visibleH / zoom, srcH));
      setViewportPx({ w: vpPxW, h: vpPxH });

      if (contentW <= visibleW && contentH <= visibleH) {
        setViewport({ x: offsetX, y: offsetY, w: drawW, h: drawH });
        return;
      }

      const vpW = Math.min(drawW, (visibleW / contentW) * drawW);
      const vpH = Math.min(drawH, (visibleH / contentH) * drawH);

      if (props.mode === 'scroll') {
        const scrollRatioX = contentW > visibleW
          ? containerEl.scrollLeft / (contentW - visibleW) : 0;
        const scrollRatioY = contentH > visibleH
          ? containerEl.scrollTop / (contentH - visibleH) : 0;
        setViewport({
          x: offsetX + scrollRatioX * (drawW - vpW),
          y: offsetY + scrollRatioY * (drawH - vpH),
          w: vpW, h: vpH,
        });
      } else {
        const centerX = 0.5 - (props.panX / srcW);
        const centerY = 0.5 - (props.panY / srcH);
        setViewport({
          x: offsetX + (centerX - vpW / drawW / 2) * drawW,
          y: offsetY + (centerY - vpH / drawH / 2) * drawH,
          w: vpW, h: vpH,
        });
      }
    };

    updateViewport();

    if (props.mode === 'scroll') {
      containerEl.addEventListener('scroll', updateViewport);
      window.addEventListener('resize', updateViewport);
      return () => {
        containerEl.removeEventListener('scroll', updateViewport);
        window.removeEventListener('resize', updateViewport);
      };
    }
  }, [sourceCanvas, containerEl, zoom,
    props.mode === 'transform' ? props.panX : undefined,
    props.mode === 'transform' ? props.panY : undefined,
  ]);

  // Click/drag to navigate
  const navigateTo = useCallback((clientX: number, clientY: number) => {
    if (!sourceCanvas || !containerEl || !thumbRef.current) return;

    const rect = thumbRef.current.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    const srcW = sourceCanvas.width;
    const srcH = sourceCanvas.height;
    const { drawW, drawH, offsetX, offsetY } = getImageLayout(srcW, srcH);

    const ratioX = (mx - offsetX) / drawW;
    const ratioY = (my - offsetY) / drawH;

    if (props.mode === 'scroll') {
      const contentW = srcW * zoom;
      const contentH = srcH * zoom;
      const visibleW = containerEl.clientWidth;
      const visibleH = containerEl.clientHeight;
      containerEl.scrollLeft = ratioX * contentW - visibleW / 2;
      containerEl.scrollTop = ratioY * contentH - visibleH / 2;
    } else {
      const newPanX = -(ratioX - 0.5) * srcW;
      const newPanY = -(ratioY - 0.5) * srcH;
      props.setPan(newPanX, newPanY);
    }
  }, [sourceCanvas, containerEl, zoom, props]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDragging.current = true;
    navigateTo(e.clientX, e.clientY);

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      navigateTo(ev.clientX, ev.clientY);
    };
    const handleMouseUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [navigateTo]);

  if (!sourceCanvas) return null;

  return (
    <div className="minimap">
      <div className="minimap-thumb" onMouseDown={handleMouseDown}>
        <canvas ref={thumbRef} width={MINIMAP_W} height={THUMB_H} />
        <div
          className="minimap-viewport"
          style={{
            left: viewport.x,
            top: viewport.y,
            width: viewport.w,
            height: viewport.h,
          }}
        />
      </div>
      <div className="minimap-info">
        <div className="minimap-info-row">
          <span className="minimap-info-label">문서 크기</span>
          <span className="minimap-info-value">{docWidth} x {docHeight} px</span>
        </div>
        <div className="minimap-info-row">
          <span className="minimap-info-label">뷰포트</span>
          <span className="minimap-info-value">{viewportPx.w} x {viewportPx.h} px</span>
        </div>
        <div className="minimap-info-row">
          <span className="minimap-info-label">커서 위치</span>
          <span className="minimap-info-value">X: {cursorX}, Y: {cursorY}</span>
        </div>
      </div>
    </div>
  );
};

export default Minimap;

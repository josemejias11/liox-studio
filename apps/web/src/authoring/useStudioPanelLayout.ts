'use client';

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { usePersistentPanelSize } from './usePersistentPanelSize';

const outlineMinimum = 240;
const outlineMaximum = 420;
const toolsMinimum = 240;
const defaultToolsMaximum = 260;
const desktopBreakpoint = 1280;

function getViewportToolsMaximum(): number {
  return Math.max(toolsMinimum, Math.floor(window.innerHeight * 0.6));
}

interface ResizeControl {
  value: number;
  minimum: number;
  maximum: number;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
}

export function useStudioPanelLayout() {
  const [toolsMaximum, setToolsMaximum] = useState(defaultToolsMaximum);
  const [toolsMaximumReady, setToolsMaximumReady] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const outlinePointerId = useRef<number | null>(null);
  const toolsPointerId = useRef<number | null>(null);
  const [outlineWidth, setOutlineWidth] = usePersistentPanelSize({
    key: 'lb-studio:course-studio:outline-width',
    defaultValue: 320,
    minimum: outlineMinimum,
    maximum: outlineMaximum,
  });
  const [toolsHeight, setToolsHeight] = usePersistentPanelSize({
    key: 'lb-studio:course-studio:tools-height',
    defaultValue: 260,
    minimum: toolsMinimum,
    maximum: toolsMaximum,
    restoreWhen: toolsMaximumReady,
  });

  useEffect(() => {
    const updateToolsMaximum = () => {
      setToolsMaximum(getViewportToolsMaximum());
      setToolsMaximumReady(true);
    };
    const animationFrame = window.requestAnimationFrame(updateToolsMaximum);
    window.addEventListener('resize', updateToolsMaximum);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', updateToolsMaximum);
    };
  }, []);

  function updateOutlineWidth(clientX: number): void {
    const bounds = workspaceRef.current?.getBoundingClientRect();
    if (bounds) setOutlineWidth(clientX - bounds.left);
  }

  function updateToolsHeight(clientY: number): void {
    const bounds = workspaceRef.current?.getBoundingClientRect();
    if (bounds) setToolsHeight(bounds.bottom - clientY);
  }

  function isDesktopEditor(): boolean {
    return typeof window !== 'undefined' && window.innerWidth >= desktopBreakpoint;
  }

  function adjustWithKeyboard(
    event: KeyboardEvent<HTMLDivElement>,
    value: number,
    setValue: (nextValue: number) => void,
    minimum: number,
    maximum: number,
  ): void {
    const increment = event.shiftKey ? 48 : 16;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      setValue(value - increment);
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      setValue(value + increment);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setValue(minimum);
    } else if (event.key === 'End') {
      event.preventDefault();
      setValue(maximum);
    }
  }

  const endOutlineResize = (event: PointerEvent<HTMLDivElement>): void => {
    if (outlinePointerId.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    outlinePointerId.current = null;
  };
  const endToolsResize = (event: PointerEvent<HTMLDivElement>): void => {
    if (toolsPointerId.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    toolsPointerId.current = null;
  };

  return {
    desktopGridStyle: {
      '--course-studio-outline-width': `${outlineWidth}px`,
      '--course-studio-tools-height': `${toolsHeight}px`,
    } as CSSProperties,
    outline: {
      value: outlineWidth,
      minimum: outlineMinimum,
      maximum: outlineMaximum,
      onKeyDown: (event) =>
        adjustWithKeyboard(event, outlineWidth, setOutlineWidth, outlineMinimum, outlineMaximum),
      onPointerCancel: endOutlineResize,
      onPointerDown: (event) => {
        if (!isDesktopEditor()) return;
        outlinePointerId.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        updateOutlineWidth(event.clientX);
      },
      onPointerMove: (event) => {
        if (outlinePointerId.current === event.pointerId) updateOutlineWidth(event.clientX);
      },
      onPointerUp: endOutlineResize,
    } satisfies ResizeControl,
    tools: {
      value: toolsHeight,
      minimum: toolsMinimum,
      maximum: toolsMaximum,
      onKeyDown: (event) =>
        adjustWithKeyboard(event, toolsHeight, setToolsHeight, toolsMinimum, toolsMaximum),
      onPointerCancel: endToolsResize,
      onPointerDown: (event) => {
        if (!isDesktopEditor()) return;
        toolsPointerId.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        updateToolsHeight(event.clientY);
      },
      onPointerMove: (event) => {
        if (toolsPointerId.current === event.pointerId) updateToolsHeight(event.clientY);
      },
      onPointerUp: endToolsResize,
    } satisfies ResizeControl,
    workspaceRef,
  };
}

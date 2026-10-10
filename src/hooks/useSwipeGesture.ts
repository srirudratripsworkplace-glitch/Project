import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

type SwipeDirection = -1 | 1;

export function useSwipeGesture(onSwipe: (direction: SwipeDirection) => void) {
  const [offset, setOffset] = useState(0);
  const startX = useRef<number | null>(null);
  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    startX.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (startX.current === null) return;
    setOffset(event.clientX - startX.current);
  }

  function finishSwipe(event: ReactPointerEvent<HTMLDivElement>) {
    if (startX.current === null) return;
    const distance = event.clientX - startX.current;
    startX.current = null;
    setOffset(0);
    if (Math.abs(distance) >= 45) onSwipeRef.current(distance < 0 ? 1 : -1);
  }

  function cancelSwipe() {
    startX.current = null;
    setOffset(0);
  }

  return {
    offset,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: finishSwipe,
      onPointerCancel: cancelSwipe,
      onLostPointerCapture: cancelSwipe,
    },
  };
}

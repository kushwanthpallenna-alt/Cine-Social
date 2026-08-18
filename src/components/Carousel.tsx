"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";

interface CarouselProps {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  showArrows?: boolean;
}

export default function Carousel({
  children,
  className = "",
  containerClassName = "",
  onScroll,
  showArrows = true,
}: CarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Mouse drag state — refs only, no touch state at all
  const isMouseDown = useRef(false);
  const startX = useRef(0);
  const scrollLeftPos = useRef(0);
  const hasDragged = useRef(false);
  const [isDraggingState, setIsDraggingState] = useState(false);

  const checkScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  useEffect(() => {
    checkScroll();
    const container = scrollRef.current;
    if (!container) return;
    const handleResize = () => checkScroll();
    window.addEventListener("resize", handleResize);
    const resizeObserver = new ResizeObserver(() => checkScroll());
    resizeObserver.observe(container);
    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
    };
  }, [checkScroll, children]);

  // Shift+scroll → horizontal on desktop
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
      if (!e.shiftKey) return;
      if (e.deltaY !== 0) {
        const canLeft = container.scrollLeft > 0;
        const canRight = container.scrollLeft + container.clientWidth < container.scrollWidth - 1;
        if ((e.deltaY < 0 && canLeft) || (e.deltaY > 0 && canRight)) {
          e.preventDefault();
          container.scrollLeft += e.deltaY;
          checkScroll();
        }
      }
    };
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [checkScroll]);

  // ── Pointer handlers — mouse only, never fires for touch/stylus ─────────────
  // Using pointerType guard means zero interference with native touch scroll.
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const container = scrollRef.current;
    if (!container) return;
    isMouseDown.current = true;
    hasDragged.current = false;
    startX.current = e.clientX;
    scrollLeftPos.current = container.scrollLeft;
    // Capture pointer so drag works even if mouse leaves the element
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isMouseDown.current || e.pointerType !== "mouse") return;
    const container = scrollRef.current;
    if (!container) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > 5) {
      if (!hasDragged.current) {
        hasDragged.current = true;
        setIsDraggingState(true);
      }
      e.preventDefault();
      container.scrollLeft = scrollLeftPos.current - dx * 1.2;
      checkScroll();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    isMouseDown.current = false;
    setTimeout(() => setIsDraggingState(false), 50);
  };

  const handleClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (hasDragged.current) {
      e.preventDefault();
      e.stopPropagation();
      hasDragged.current = false;
    }
  };

  const scrollByAmount = (direction: "left" | "right") => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollBy({
      left: direction === "left" ? -container.clientWidth * 0.75 : container.clientWidth * 0.75,
      behavior: "smooth",
    });
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    checkScroll();
    if (onScroll) onScroll(e);
  };

  return (
    /*
     * Outer wrapper: touch-action: pan-y
     *
     * WHY: iOS Safari classifies a touch gesture based on the element where
     * the finger first lands. If the wrapper has no touch-action, and the
     * inner scroll container says pan-x, iOS can decide the whole gesture
     * tree is "horizontal only" and refuse to propagate vertical swipes to
     * the document. Explicitly setting pan-y on the wrapper tells iOS:
     * "vertical swipes starting anywhere in here should scroll the page."
     *
     * IMPORTANT: No overflow:hidden here. overflow:hidden on a parent creates
     * a new scroll-blocking stacking context on iOS Safari that absorbs touch
     * events before they reach the inner scroller.
     */
    <div
      className={`relative group/carousel ${className}`}
      style={{ touchAction: "pan-y" }}
    >
      {/* Left Arrow Button */}
      {showArrows && (
        <button
          type="button"
          onClick={() => scrollByAmount("left")}
          disabled={!canScrollLeft}
          aria-label="Scroll left"
          className={`absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/70 hover:bg-black/90 text-white backdrop-blur-md flex items-center justify-center border border-white/20 shadow-2xl transition-all duration-300 cursor-pointer ${
            canScrollLeft
              ? "opacity-0 group-hover/carousel:opacity-100 hover:scale-110 active:scale-95"
              : "opacity-0 pointer-events-none"
          }`}
        >
          <span className="material-symbols-outlined text-2xl select-none">chevron_left</span>
        </button>
      )}

      {/*
       * Scroll Container — 100% native touch scroll, zero JS touch handlers.
       *
       * touch-action: pan-x pan-y
       *   • pan-x  → this element scrolls horizontally on left/right swipe
       *   • pan-y  → vertical swipes are NOT captured here; they propagate
       *              upward to the document scroll
       *
       * Using only "pan-x" is the classic iOS bug: the browser then treats
       * ALL gestures starting in this element as horizontal candidates and
       * can refuse to hand off a vertical swipe to the page scroller.
       *
       * No onTouchStart/Move/End handlers anywhere. Even passive handlers
       * can delay gesture classification on some WebKit builds and cause
       * the browser to swallow the vertical component of a diagonal swipe.
       *
       * Pointer events are gated on pointerType === "mouse", so they are
       * completely transparent to the touch gesture pipeline.
       */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClickCapture={handleClickCapture}
        className={`flex overflow-x-auto no-scrollbar ${
          isDraggingState ? "cursor-grabbing" : "cursor-grab"
        } ${containerClassName}`}
        style={{
          // pan-x: horizontal swipe scrolls this element
          // pan-y: vertical swipe bubbles up to page — BOTH values are needed
          touchAction: "pan-x pan-y",
          overscrollBehaviorX: "contain",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {children}
      </div>

      {/* Right Arrow Button */}
      {showArrows && (
        <button
          type="button"
          onClick={() => scrollByAmount("right")}
          disabled={!canScrollRight}
          aria-label="Scroll right"
          className={`absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/70 hover:bg-black/90 text-white backdrop-blur-md flex items-center justify-center border border-white/20 shadow-2xl transition-all duration-300 cursor-pointer ${
            canScrollRight
              ? "opacity-0 group-hover/carousel:opacity-100 hover:scale-110 active:scale-95"
              : "opacity-0 pointer-events-none"
          }`}
        >
          <span className="material-symbols-outlined text-2xl select-none">chevron_right</span>
        </button>
      )}
    </div>
  );
}

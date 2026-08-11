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

  // Mouse drag state (desktop only)
  const isMouseDown = useRef(false);
  const startX = useRef(0);
  const scrollLeftPos = useRef(0);
  const hasDragged = useRef(false);
  const [isDraggingState, setIsDraggingState] = useState(false);

  // Touch state — used only to detect swipe direction so we can block
  // accidental link-clicks after a horizontal swipe. We do NOT call
  // preventDefault on touch events; the browser's native pan-x handles scroll.
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchHasDragged = useRef(false);

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

    const resizeObserver = new ResizeObserver(() => {
      checkScroll();
    });
    resizeObserver.observe(container);

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
    };
  }, [checkScroll, children]);

  // Wheel event listener: only intercept Shift+scroll for horizontal scrolling.
  // Plain vertical wheel events are intentionally ignored so the page scrolls normally.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Only hijack the wheel event when Shift is held — this is the explicit
      // "scroll carousel horizontally" gesture. Without Shift, let the event
      // bubble up so the browser performs its normal vertical page scroll.
      if (!e.shiftKey) return;

      if (e.deltaY !== 0) {
        const canLeft = container.scrollLeft > 0;
        const canRight =
          container.scrollLeft + container.clientWidth < container.scrollWidth - 1;

        if ((e.deltaY < 0 && canLeft) || (e.deltaY > 0 && canRight)) {
          e.preventDefault();
          container.scrollLeft += e.deltaY;
          checkScroll();
        }
      }
    };

    // passive: false is still required so we can call preventDefault() on Shift+wheel.
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [checkScroll]);

  // ── Mouse drag handlers (desktop) ─────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const container = scrollRef.current;
    if (!container) return;

    isMouseDown.current = true;
    hasDragged.current = false;
    startX.current = e.pageX - container.offsetLeft;
    scrollLeftPos.current = container.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMouseDown.current) return;
    const container = scrollRef.current;
    if (!container) return;

    const x = e.pageX - container.offsetLeft;
    const walk = (x - startX.current) * 1.2;

    if (Math.abs(x - startX.current) > 5) {
      if (!hasDragged.current) {
        hasDragged.current = true;
        setIsDraggingState(true);
      }
      e.preventDefault();
      container.scrollLeft = scrollLeftPos.current - walk;
      checkScroll();
    }
  };

  const handleMouseUpOrLeave = () => {
    if (isMouseDown.current) {
      isMouseDown.current = false;
      setTimeout(() => {
        setIsDraggingState(false);
      }, 50);
    }
  };

  const handleClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (hasDragged.current) {
      e.preventDefault();
      e.stopPropagation();
      hasDragged.current = false;
    }
  };

  // ── Touch handlers (mobile) ───────────────────────────────────────────────
  // We do NOT call preventDefault here — touch-action: pan-x on the container
  // tells the browser to handle horizontal swipe natively (scrolls the
  // carousel) while vertical swipes are passed through to page scroll.
  // These handlers only track whether a swipe happened so we can block
  // accidental tap-through navigation after a horizontal swipe.
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchHasDragged.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
    // Mark as a horizontal drag only when horizontal movement dominates
    if (dx > dy && dx > 8) {
      touchHasDragged.current = true;
    }
  };

  const handleTouchEnd = () => {
    // Reset after a short delay (same pattern as mouse drag)
    setTimeout(() => {
      touchHasDragged.current = false;
    }, 50);
  };

  // Capture touch-originated clicks that followed a horizontal swipe
  const handleTouchClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (touchHasDragged.current) {
      e.preventDefault();
      e.stopPropagation();
      touchHasDragged.current = false;
    }
  };

  const scrollByAmount = (direction: "left" | "right") => {
    const container = scrollRef.current;
    if (!container) return;
    const amount = container.clientWidth * 0.75;
    container.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    checkScroll();
    if (onScroll) {
      onScroll(e);
    }
  };

  return (
    <div className={`relative group/carousel ${className}`}>
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

      {/* Scroll Container
          touch-action: pan-x  →  browser handles horizontal swipe natively
                                   (scrolls this container) while vertical
                                   swipes pass through to the page scroller.
          We apply it both inline and via the .touch-pan-x CSS class to
          maximise compatibility across Safari/Chrome/Firefox on iOS & Android. */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        onClickCapture={(e) => {
          handleClickCapture(e);
          handleTouchClickCapture(e);
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`flex overflow-x-auto no-scrollbar touch-pan-x select-none ${
          isDraggingState ? "cursor-grabbing" : "cursor-grab"
        } ${containerClassName}`}
        style={{
          // Belt-and-braces: also set via inline style so JS-disabled SSR
          // and any CSS-specificity fights don't clobber it.
          touchAction: "pan-x",
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

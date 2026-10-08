import { useEffect, useState, type PropsWithChildren } from 'react';

// Mobile browsers shrink the visual viewport, not necessarily the page, for the keyboard.
export function KeyboardViewport({ children }: PropsWithChildren) {
  const [bounds, setBounds] = useState<{ height: number; top: number }>();
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      // The keyboard can pan the visual viewport as well as shrink it. Keeping
      // the shell at layout-viewport y=0 puts inputs above the visible screen.
      // Do not resize the app around the viewport while the user pinch-zooms.
      const unzoomed = !viewport || viewport.scale === 1;
      setBounds({
        height: unzoomed ? (viewport?.height ?? window.innerHeight) : window.innerHeight,
        top: unzoomed ? (viewport?.offsetTop ?? 0) : 0,
      });
    };
    update();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  return (
    <div
      data-testid="keyboard-viewport"
      style={{
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: bounds?.top ?? 0,
        left: 0,
        right: 0,
        height: bounds?.height ?? '100%',
        flexShrink: 0,
        minHeight: 0,
      }}
    >
      {children}
    </div>
  );
}

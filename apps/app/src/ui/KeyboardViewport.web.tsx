import { useEffect, useState, type PropsWithChildren } from 'react';

// Mobile browsers shrink the visual viewport, not necessarily the page, for the keyboard.
export function KeyboardViewport({ children }: PropsWithChildren) {
  const [height, setHeight] = useState<number>();
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => setHeight(viewport?.height ?? window.innerHeight);
    update();
    viewport?.addEventListener('resize', update);
    window.addEventListener('resize', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: height ?? '100%',
        flexShrink: 0,
        minHeight: 0,
      }}
    >
      {children}
    </div>
  );
}

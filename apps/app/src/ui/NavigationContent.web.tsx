import type { PropsWithChildren } from 'react';

export function NavigationContent({ blocked, children }: PropsWithChildren<{ blocked: boolean }>) {
  return (
    <div
      inert={blocked}
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

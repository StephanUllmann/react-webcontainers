import type { RefObject } from 'react';

interface PreviewProps {
  iFrameRef: RefObject<HTMLIFrameElement | null>;
  isDragging: boolean;
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
  col1: number;
  setCol2: React.Dispatch<React.SetStateAction<number>>;
}

/**
 * The Preview component renders an iframe showing the running project.
 *
 * It also renders a drag handle on its left edge to allow resizing the
 * split between the editor and the preview panes.
 */
export default function Preview({
  iFrameRef,
  isDragging,
  setIsDragging,
  col1,
  setCol2,
}: PreviewProps) {
  const handleMouseDownCol2 = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const minCol2 = col1 + 200;
      const maxCol2 = window.innerWidth - 200;
      const newCol2 = Math.max(minCol2, Math.min(moveEvent.clientX, maxCol2));
      setCol2(newCol2);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="relative flex h-full w-full">
      <div
        className="absolute top-0 bottom-0 left-0 z-10 h-full w-1 cursor-col-resize bg-slate-800 transition-all hover:bg-slate-700 active:bg-slate-700"
        onMouseDown={handleMouseDownCol2}
      />
      <iframe
        className="ml-1 h-full w-full"
        ref={iFrameRef}
        src="loading.html"
        style={{ pointerEvents: isDragging ? 'none' : 'auto' }}
      />
    </div>
  );
}

import type { FitAddon } from '@xterm/addon-fit';
import type { RefObject } from 'react';

interface TerminalContainerProps {
  terminalDivRef: RefObject<HTMLDivElement | null>;
  row: number;
  setRow: React.Dispatch<React.SetStateAction<number>>;
  setIsDragging: (isDragging: boolean) => void;
  terminalAddonRef: React.RefObject<FitAddon | null>;
}

export default function TerminalContainer({
  terminalDivRef,
  row,
  setRow,
  setIsDragging,
  terminalAddonRef,
}: TerminalContainerProps) {
  const handleMouseDownRow = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      setRow(moveEvent.clientY);
    };

    const handleMouseUp = () => {
      setIsDragging(false);

      terminalAddonRef.current?.fit();

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="relative col-span-2 col-start-2 bg-black text-start">
      <div
        className="absolute top-0 right-0 left-0 z-10 h-1 w-full cursor-row-resize bg-slate-800 transition-all hover:bg-slate-700 active:bg-slate-700"
        onMouseDown={handleMouseDownRow}
      />
      <div
        ref={terminalDivRef}
        id="terminal"
        className="pt-1 text-start"
        style={{
          height: `${window.innerHeight - row}px`,
        }}
      ></div>
    </div>
  );
}

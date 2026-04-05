import FileTree from './FileTree';
import type { MonacoFiles } from '../types';

interface SidebarProps {
  monacoFiles: MonacoFiles;
  fileName: string;
  setFileName: React.Dispatch<React.SetStateAction<string>>;
  setCol1: React.Dispatch<React.SetStateAction<number>>;
  setCol2: React.Dispatch<React.SetStateAction<number>>;
  setIsDragging: (isDragging: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  monacoFiles,
  fileName,
  setFileName,
  setCol1,
  setCol2,
  setIsDragging,
}) => {
  const handleMouseDownCol1 = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newCol1 = Math.max(10, Math.min(moveEvent.clientX, 300));
      setCol1(newCol1);

      setCol2((prevCol2) => Math.max(prevCol2, newCol1 + 200));
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
    <aside className="relative row-span-2 h-full w-full">
      {monacoFiles ? (
        <FileTree
          files={monacoFiles}
          activeFile={fileName}
          setActiveFile={setFileName}
        />
      ) : (
        <h2>Loading...</h2>
      )}
      <div
        className="absolute top-0 right-0 bottom-0 z-10 h-full w-1 cursor-col-resize bg-slate-800 transition-all hover:w-2 hover:bg-slate-700 active:w-2 active:bg-slate-700"
        onMouseDown={handleMouseDownCol1}
      />
    </aside>
  );
};

export default Sidebar;

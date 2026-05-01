import FileTree from './FileTree';
import type { MonacoFiles } from '../types';
import type { WebContainer } from '@webcontainer/api';
import FileTreeBar from './FileTreeBar';

interface SidebarProps {
  monacoFiles: MonacoFiles;
  fileName: string;
  setFileName: React.Dispatch<React.SetStateAction<string>>;
  setCol1: React.Dispatch<React.SetStateAction<number>>;
  col1: number;
  setCol2: React.Dispatch<React.SetStateAction<number>>;
  setIsDragging: (isDragging: boolean) => void;
  webContainer: React.RefObject<WebContainer | null>;
}

/**
 * Sidebar component containing the FileTree and a drag handle to resize the
 * file tree pane.
 */
export default function Sidebar({
  monacoFiles,
  fileName,
  setFileName,
  setCol1,
  col1,
  setCol2,
  setIsDragging,
  webContainer,
}: SidebarProps) {
  const handleMouseDownCol1 = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newCol1 = Math.max(5, Math.min(moveEvent.clientX, 300));
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

  const closeSidebar = () => {
    setCol1(2);
  };

  return (
    <>
      {col1 < 40 && (
        <button
          className="item-center absolute top-0 left-1 z-50 flex h-7 w-7 cursor-pointer justify-center bg-(--bg-primary)"
          onClick={() => setCol1(200)}
        >
          &rarr;
        </button>
      )}
      <aside className="relative row-span-2 flex h-screen w-full flex-col overflow-hidden">
        <FileTreeBar webContainer={webContainer} closeSidebar={closeSidebar} />
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
          className="absolute top-0 right-0 bottom-0 z-10 h-screen w-1 cursor-col-resize bg-slate-800 transition-all hover:bg-slate-700 active:bg-slate-700"
          onMouseDown={handleMouseDownCol1}
        />
        {/*{isExpress && (
        <FetchDialog webContainer={webContainer} iFrameRef={iFrameRef} />
      )}*/}
      </aside>
    </>
  );
}

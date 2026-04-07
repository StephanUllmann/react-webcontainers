import FileTree from './FileTree';
import type { MonacoFiles } from '../types';
import {
  fetchFromContainerAPI,
  renderResponseInIframe,
} from '../services/requests';

interface SidebarProps {
  monacoFiles: MonacoFiles;
  fileName: string;
  setFileName: React.Dispatch<React.SetStateAction<string>>;
  setCol1: React.Dispatch<React.SetStateAction<number>>;
  setCol2: React.Dispatch<React.SetStateAction<number>>;
  setIsDragging: (isDragging: boolean) => void;
  webContainer: any;
  iFrameRef: any;
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
  setCol2,
  setIsDragging,
  webContainer,
  iFrameRef,
}: SidebarProps) {
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

  async function handleTestFetch() {
    const url = sessionStorage.getItem('container_url');
    if (!url || !iFrameRef.current) return;

    try {
      // 1. Fetch the data using the safe Node Base64 script
      const response = await fetchFromContainerAPI(
        webContainer.current!,
        // `${url}/echo`,
        `http://localhost:3000/echo`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ bla: 'Jorge' }),
        }
      );

      console.log('Got response from container API:', response);

      // 2. Redirect that response into the iframe!
      renderResponseInIframe(iFrameRef.current, url, response);
    } catch (err) {
      console.error('Error on fetch: ', err);
    }
  }

  return (
    <aside className="relative row-span-2 h-screen w-full overflow-hidden">
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
      <button onClick={handleTestFetch}>Fetch</button>
    </aside>
  );
}

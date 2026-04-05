import { useEffect, useRef, useState } from 'react';
import { WebContainer } from '@webcontainer/api';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

import Editor, { type Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { mockData } from './services/mock';
import {
  initWebContainer,
  installDependencies,
  startDevServer,
  writeToWebContainer,
} from './services/webContainer';
import { convertToMonacoFiles } from './services/monacoConverter';
import type { MonacoFiles } from './types';
import FileTree from './components/FileTree';

const url =
  new URL(window.location.href).searchParams.get('q') ??
  'SDG-027/04_React_Intro/main/04-react-state-korrekturen/002-light-bulb';

const isDev = true;

function App() {
  const iFrameRef = useRef<HTMLIFrameElement>(null);
  const terminalDivRef = useRef<HTMLDivElement>(null);

  const terminalRef = useRef(
    new Terminal({
      convertEol: true,
    })
  );
  const terminalAddonRef = useRef(new FitAddon());
  const webContainer = useRef<WebContainer>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const files = useRef(mockData);
  const [monacoFiles, setMonacoFiles] = useState<MonacoFiles>({});
  const [fileName, setFileName] = useState('');

  const file = monacoFiles[fileName];

  // Editor
  const editorRef = useRef<editor.IStandaloneCodeEditor>(null);

  // Layout State
  const [col1, setCol1] = useState(250); // File Tree width
  const [col2, setCol2] = useState(1000); // Editor + File Tree width
  const [row, setRow] = useState(() => window.innerHeight * 0.75); // Editor + File Tree width
  const [isDragging, setIsDragging] = useState(false); // Crucial for iframe fix

  // Resizing Handlers
  const handleMouseDownRow = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newRow = moveEvent.clientY;
      console.log('newRow:', newRow);
      setRow(newRow);
    };

    const handleMouseUp = () => {
      setIsDragging(false);

      terminalAddonRef.current.fit();

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  //
  const handleMouseDownCol1 = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newCol1 = Math.max(10, Math.min(moveEvent.clientX, 300));
      setCol1(newCol1);

      // Ensure col2 gets pushed if col1 becomes too large
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

  async function handleEditorDidMount(
    editor: editor.IStandaloneCodeEditor,
    _monaco: Monaco
  ) {
    const mFiles = convertToMonacoFiles(files.current);
    setMonacoFiles(mFiles);

    editorRef.current = editor;
    if (webContainer.current) return;
    if (!iFrameRef.current || !terminalDivRef.current || !editorRef.current)
      return;
    await initWebContainer(
      terminalRef,
      terminalAddonRef,
      terminalDivRef,
      webContainer,
      files,
      iFrameRef
    );
    setFileName('src/App.jsx');
    terminalAddonRef.current.fit();
    const isNode = 'package.json' in mFiles;
    if (isNode && !isDev) {
      const installCode = await installDependencies(
        webContainer.current!,
        terminalRef.current
      );
      if (installCode !== 0) return;
      startDevServer(
        webContainer.current!,
        terminalRef.current,
        iFrameRef.current
      );
    }
  }

  async function handleEditorChange(
    value: string | undefined,
    _e: editor.IModelContentChangedEvent
  ) {
    if (value && fileName) {
      setMonacoFiles((prev) => ({
        ...prev,
        [fileName]: {
          ...prev[fileName],
          value: value,
        },
      }));

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(async () => {
        if (webContainer.current) {
          await writeToWebContainer(webContainer.current, fileName, value);
        }
      }, 50);
    }
  }

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      webContainer.current?.teardown();
    };
  }, []);

  return (
    <div
      className={`grid min-h-screen`}
      style={{
        gridTemplateColumns: `${col1}px ${col2 - col1}px 1fr`,
        gridTemplateRows: `${row}px 1fr`,
        cursor: isDragging ? 'col-resize' : 'auto',
      }}
    >
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
      <Editor
        className="h-full"
        theme="vs-dark"
        path={file?.name}
        defaultLanguage={file?.language}
        defaultValue={file?.value}
        onMount={handleEditorDidMount}
        onChange={handleEditorChange}
        options={{
          automaticLayout: true,
          minimap: { enabled: false },
          fontSize: 14,
          wordWrap: 'on',
          scrollBeyondLastLine: false,
        }}
      />
      <div className="relative flex h-full w-full">
        <div
          className="absolute top-0 bottom-0 left-0 z-10 h-full w-1.5 cursor-col-resize bg-slate-800 transition-all hover:bg-slate-700 active:w-2 active:bg-slate-700"
          onMouseDown={handleMouseDownCol2}
        />
        <iframe
          className="ml-1.5 h-full w-full"
          ref={iFrameRef}
          src="loading.html"
          style={{ pointerEvents: isDragging ? 'none' : 'auto' }}
        />
      </div>
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
    </div>
  );
}

export default App;
// className="col col-span-2 col-start-2 h-[20dvh] text-start"

import { use, useEffect, useRef, useState } from 'react';
import { WebContainer, type FileSystemTree } from '@webcontainer/api';
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
import Sidebar from './components/Sidebar';
import Preview from './components/Preview';
import TerminalContainer from './components/TerminalContainer';

const url =
  new URL(window.location.href).searchParams.get('q') ??
  'SDG-027/04_React_Intro/main/04-react-state-korrekturen/002-light-bulb';

const isDev = import.meta.env.VITE_IS_DEV === 'true';

const data = isDev
  ? null
  : fetch(`https://gh-proxy.stephan-ullmann.workers.dev/files/${url}`).then(
      (res) => {
        console.log('fetching...');
        return res.json();
      }
    );

function App() {
  const iFrameRef = useRef<HTMLIFrameElement>(null);
  const terminalDivRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const terminalAddonRef = useRef<FitAddon | null>(null);
  const webContainer = useRef<WebContainer | null>(null);

  const files = useRef<FileSystemTree>(null);
  const [monacoFiles, setMonacoFiles] = useState<MonacoFiles>({});
  const [fileName, setFileName] = useState('');

  const activeFile = monacoFiles[fileName];

  const editorRef = useRef<editor.IStandaloneCodeEditor>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Layout State
  const [col1, setCol1] = useState(250); // File Tree width
  const [col2, setCol2] = useState(() => (window.innerWidth + 250) / 2); // Editor + File Tree width
  const [row, setRow] = useState(() => window.innerHeight * 0.75); // Editor + File Tree height
  const [isDragging, setIsDragging] = useState(false);

  async function handleEditorDidMount(
    editor: editor.IStandaloneCodeEditor,
    _monaco: Monaco
  ) {
    if (webContainer.current) return;
    files.current = isDev ? mockData : await data;

    const mFiles = convertToMonacoFiles(files.current!);
    setMonacoFiles(mFiles);

    editorRef.current = editor;
    if (
      !iFrameRef.current ||
      !terminalDivRef.current ||
      !editorRef.current ||
      !terminalRef
    )
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
    terminalAddonRef.current?.fit();
    const isNode = 'package.json' in mFiles;
    if (isNode && !isDev) {
      const installCode = await installDependencies(
        webContainer.current!,
        terminalRef.current!
      );
      if (installCode !== 0) return;
      startDevServer(
        webContainer.current!,
        terminalRef.current!,
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
    terminalRef.current = new Terminal({
      convertEol: true,
    });
    terminalAddonRef.current = new FitAddon();

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
      <Sidebar
        monacoFiles={monacoFiles}
        fileName={fileName}
        setFileName={setFileName}
        setCol1={setCol1}
        setCol2={setCol2}
        setIsDragging={setIsDragging}
      />
      <Editor
        className="h-full"
        theme="vs-dark"
        path={activeFile?.name}
        defaultLanguage={activeFile?.language}
        defaultValue={activeFile?.value}
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
      <Preview
        iFrameRef={iFrameRef}
        isDragging={isDragging}
        setIsDragging={setIsDragging}
        col1={col1}
        setCol2={setCol2}
      />
      <TerminalContainer
        terminalDivRef={terminalDivRef}
        row={row}
        setRow={setRow}
        setIsDragging={setIsDragging}
        terminalAddonRef={terminalAddonRef}
      />
    </div>
  );
}

export default App;

import { useEffect, useRef, useState } from 'react';
import { WebContainer } from '@webcontainer/api';
import type { FileSystemTree } from '@webcontainer/api';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

import Editor from '@monaco-editor/react';
import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { mockData } from './services/mock';
import {
  initWebContainer,
  installDependencies,
  startDevServer,
  watchWebContainerFiles,
  writeToWebContainer,
} from './services/webContainer';
import {
  convertToMonacoFiles,
  fsToMonaco,
  getMonacoLanguage,
} from './services/monacoConverter';
import type { MonacoFiles } from './types';
import Sidebar from './components/Sidebar';
import Preview from './components/Preview';
import TerminalContainer from './components/TerminalContainer';
import { handleEditorWillMount } from './services/editor';
import { terminalOptions } from './services/terminal';

const url =
  new URL(window.location.href).searchParams.get('q') ??
  'SDG-027/04_React_Intro/main/04-react-state-korrekturen/002-light-bulb';

const isDev = import.meta.env.VITE_IS_DEV === 'true';

/**
 * Main application component that orchestrates the WebContainer, code editor,
 * file tree, terminal, and preview pane iframe.
 */
function App() {
  const iFrameRef = useRef<HTMLIFrameElement>(null);
  const terminalDivRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const terminalAddonRef = useRef<FitAddon | null>(null);
  const webContainer = useRef<WebContainer | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);

  const files = useRef<FileSystemTree | null>(null);
  const watchFsCleanupRef = useRef<{ close: () => void } | null>(null);
  const [monacoFiles, setMonacoFiles] = useState<MonacoFiles>({});
  const [fileName, setFileName] = useState('');

  const [isFetchingProject, setIsFetchingProject] = useState(!isDev);
  const [projectData, setProjectData] = useState<FileSystemTree | null>(null);

  const activeFile = monacoFiles[fileName];

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeFileNameRef = useRef(fileName);
  useEffect(() => {
    activeFileNameRef.current = fileName;
  }, [fileName]);

  useEffect(() => {
    if (isDev) return;

    let isMounted = true;
    fetch(`https://gh-proxy.stephan-ullmann.workers.dev/files/${url}`)
      .then((res) => res.json())
      .then((json) => {
        if (isMounted) {
          setProjectData(json);
          setIsFetchingProject(false);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch project:', err);
        if (isMounted) setIsFetchingProject(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

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
    files.current = isDev ? mockData : projectData;
    if (!files.current) return;
    const mFiles = convertToMonacoFiles(files.current);
    setMonacoFiles(mFiles);
    editorRef.current = editor;

    if (
      !iFrameRef.current ||
      !terminalDivRef.current ||
      !terminalRef.current ||
      !terminalAddonRef.current ||
      !webContainer
    )
      return;

    const cleanup = await initWebContainer(
      terminalRef,
      terminalAddonRef,
      terminalDivRef,
      webContainer,
      files,
      iFrameRef
    );

    if (cleanup) resizeCleanupRef.current = cleanup;

    if ('src/App.jsx' in mFiles) setFileName('src/App.jsx');
    else if ('src/App.tsx' in mFiles) setFileName('src/App.tsx');
    else if ('src/index.ts' in mFiles) setFileName('src/index.ts');

    if (webContainer.current) {
      const fsWatcher = watchWebContainerFiles(
        webContainer.current,
        (path, content) => {
          setMonacoFiles((prev) => fsToMonaco(prev, path, content));
        },
        () => activeFileNameRef.current
      );
      if (fsWatcher) {
        watchFsCleanupRef.current = fsWatcher;
      }
    }

    terminalAddonRef.current.fit();
    const isNode = 'package.json' in mFiles;

    if (
      isNode &&
      !isDev &&
      webContainer.current &&
      terminalRef.current &&
      iFrameRef.current
    ) {
      const installCode = await installDependencies(
        webContainer.current,
        terminalRef.current
      );
      if (installCode !== 0) return;
      startDevServer(
        webContainer.current,
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
    terminalRef.current = new Terminal(terminalOptions);
    terminalAddonRef.current = new FitAddon();

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (resizeCleanupRef.current) {
        resizeCleanupRef.current();
      }
      if (watchFsCleanupRef.current) {
        watchFsCleanupRef.current.close();
      }
      webContainer.current?.teardown();
    };
  }, []);

  console.log(activeFile);
  return (
    <div
      className={`grid min-h-screen bg-(--bg-primary)`}
      style={
        {
          gridTemplateColumns: `${col1}px ${col2 - col1}px 1fr`,
          gridTemplateRows: `${row}px 1fr`,
          cursor: isDragging ? 'col-resize' : 'auto',
          '--bg-primary': '#1e1e2e',
        } as React.CSSProperties
      }
    >
      <Sidebar
        monacoFiles={monacoFiles}
        fileName={fileName}
        setFileName={setFileName}
        setCol1={setCol1}
        setCol2={setCol2}
        setIsDragging={setIsDragging}
      />
      {isFetchingProject ? (
        <div className="flex h-full items-center justify-center bg-[#1e1e2e]">
          <div className="loader-wrapper">
            <div className="spinner"></div>
            <div className="loading-text text-white">Fetching Project</div>
          </div>
        </div>
      ) : (
        <Editor
          className="h-full"
          theme="catppuccin-mocha"
          path={activeFile?.name}
          loading={
            <div className="loader-wrapper">
              <div className="spinner"></div>
              <div className="loading-text">Initializing Editor</div>
            </div>
          }
          defaultLanguage={getMonacoLanguage(activeFile?.language)}
          defaultValue={activeFile?.value}
          beforeMount={handleEditorWillMount}
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
      )}
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

import { useEffect, useRef, useState } from 'react';
import { WebContainer } from '@webcontainer/api';
import type { FileSystemTree } from '@webcontainer/api';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
// import { loadPyodide } from 'pyodide';
import { mockData } from './services/mock';
import {
  initWebContainer,
  installDependencies,
  startDevServer,
  watchWebContainerFiles,
} from './services/webContainer';
import {
  convertToMonacoFiles,
  fsToMonaco,
  injectTypesFromWebContainer,
} from './services/monaco';
import type { MonacoFiles } from './types';
import Sidebar from './components/Sidebar';
import Preview from './components/Preview';
import TerminalContainer from './components/TerminalContainer';
import CodeEditor from './components/CodeEditor';
import { terminalOptions } from './services/terminal';
import {
  runPyOdideAndRender,
  runPythonAndRender,
} from './services/pythonRunner';
import type { PyodideAPI } from 'pyodide';

const params = new URL(window.location.href).searchParams;

const url = (
  params.get('q') ?? 'StephanUllmann/webcontainer-demos/tree/main/some-backend'
).replace('/tree/', '/');
const startFile = params.get('file') ?? '';
const loadOnStart = params.get('load') === 'true';

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
  const pyodidePromiseRef = useRef<Promise<any> | null>(null);
  const pyodideRef = useRef<PyodideAPI | null>(null);

  const [isExpress, setIsExpress] = useState(false);
  const [isPy, setIsPy] = useState(false);

  const activeFileNameRef = useRef(fileName);

  // Layout State
  const [col1, setCol1] = useState(250); // File Tree width
  const [col2, setCol2] = useState(() => (window.innerWidth + 250) / 2); // Editor + File Tree width
  const [row, setRow] = useState(() => window.innerHeight * 0.75); // Editor + File Tree height
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    activeFileNameRef.current = fileName;
    if (resizeCleanupRef.current && fileName.endsWith('.py')) {
      // runPythonAndRender(webContainer.current!, iFrameRef.current!, fileName);
      runPyOdideAndRender(
        webContainer.current!,
        pyodideRef.current!,
        iFrameRef.current!,
        fileName
      );
    }
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

    if (startFile in mFiles) setFileName(startFile);
    else if ('src/App.jsx' in mFiles) setFileName('src/App.jsx');
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
    let preparePy = false;

    if (!isNode && Object.keys(files.current).some((f) => f.endsWith('.py'))) {
      preparePy = true;
      setIsPy(true);
    }

    // --- NODE.JS FLOW ---
    if (isNode && mFiles['package.json'].value.includes('express'))
      setIsExpress(true);

    if (isNode && loadOnStart) {
      const installCode = await installDependencies(
        webContainer.current!,
        terminalRef.current,
        iFrameRef.current
      );
      if (installCode !== 0) return;
      startDevServer(webContainer.current!, terminalRef.current);
    }

    if (preparePy) {
      const { loadPyodide } = await import('pyodide');
      // 1. Define the lazy-loader function right here for now
      const initPyodide = () => {
        if (!pyodidePromiseRef.current) {
          pyodidePromiseRef.current = (async () => {
            terminalRef.current!.write(
              '\x1b[33mDownloading Pyodide (Background)...\x1b[0m\r\n'
            );

            try {
              // Fetch the WASM core
              const pyodide = await loadPyodide({
                indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/',
              });

              // Handle requirements.txt quietly in the background
              if ('requirements.txt' in files.current!) {
                terminalRef.current!.write(
                  '\x1b[33mInstalling Python dependencies...\x1b[0m\r\n'
                );
                const reqContent =
                  files.current['requirements.txt'].file.contents;

                await pyodide.loadPackage('micropip');
                const micropip = pyodide.pyimport('micropip');

                console.log(reqContent);
                const packages = reqContent
                  .split('\n')
                  .map((p: string) => p.trim())
                  .filter(Boolean); // removes empty lines

                if (packages.length > 0) {
                  await micropip.install(packages);
                }
              }

              terminalRef.current!.write(
                '\x1b[32mPyodide Environment Ready!\x1b[0m\r\n'
              );
              pyodideRef.current = pyodide;
              return pyodide;
            } catch (error) {
              terminalRef.current!.write(
                `\x1b[31mPyodide Initialization Failed: ${error}\x1b[0m\r\n`
              );
              throw error;
            }
          })();
        }
        return pyodidePromiseRef.current;
      };

      // 2. Fire and forget: kick off the download in the background without blocking Monaco
      initPyodide();

      // 3. Handle the initial script execution
      if (fileName.endsWith('.py')) {
        // Wrap in an IIFE (Immediately Invoked Function Expression) so we can await locally
        // without forcing the parent handleEditorDidMount function to pause.
        (async () => {
          terminalRef.current!.write(
            '\x1b[90mWaiting for Python environment to boot before running script...\x1b[0m\r\n'
          );

          try {
            // This will pause *only this inline block* until the background download completes
            const pyodide = await initPyodide();

            // Execute the file and push the results to the iframe
            await runPyOdideAndRender(
              webContainer.current!,
              pyodide,
              iFrameRef.current!,
              fileName
            );
          } catch (error) {
            // If the background loader failed, or the execution failed, catch it safely
            console.error('Failed to execute initial Python script:', error);
          }
        })();
      }
    }

    // if (preparePy && fileName.endsWith('.py')) {
    //   runPythonAndRender(webContainer.current!, iFrameRef.current!, fileName);
    // }

    webContainer.current!.on('server-ready', (_port, url) => {
      injectTypesFromWebContainer(webContainer.current!, _monaco);
      sessionStorage.setItem('container_url', url);
      iFrameRef.current!.src = url;
    });
  }

  useEffect(() => {
    terminalRef.current = new Terminal(terminalOptions);
    terminalAddonRef.current = new FitAddon();

    const container = webContainer.current;

    return () => {
      if (resizeCleanupRef.current) {
        resizeCleanupRef.current();
      }
      if (watchFsCleanupRef.current) {
        watchFsCleanupRef.current.close();
      }
      container?.teardown();
    };
  }, []);

  return (
    <div
      className={`grid h-screen bg-(--bg-primary)`}
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
        col1={col1}
        setCol2={setCol2}
        setIsDragging={setIsDragging}
        webContainer={webContainer}
      />
      {isFetchingProject ? (
        <div className="bg-(--bg-primary flex h-full items-center justify-center">
          <div className="loader-wrapper">
            <div className="spinner"></div>
            <div className="loading-text text-white">Fetching Project</div>
          </div>
        </div>
      ) : (
        <CodeEditor
          activeFile={activeFile}
          fileName={fileName}
          webContainerRef={webContainer}
          onMount={handleEditorDidMount}
        />
      )}
      {isPy && (
        <button
          className="absolute top-2 right-5 z-50 cursor-pointer"
          onClick={() =>
            runPyOdideAndRender(
              webContainer.current!,
              pyodideRef.current!,
              iFrameRef.current!,
              fileName
            )
          }
        >
          <svg
            width="40px"
            height="40px"
            viewBox="0 0 32 32"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            stroke="currentcolor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          >
            <path d="M10 30 L26 16 10 2 Z" />
          </svg>
        </button>
      )}
      <Preview
        iFrameRef={iFrameRef}
        isDragging={isDragging}
        setIsDragging={setIsDragging}
        col1={col1}
        setCol2={setCol2}
        isExpress={isExpress}
        webContainer={webContainer}
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

import { WebContainer } from '@webcontainer/api';
import type { FileSystemTree } from '@webcontainer/api';
import type { FitAddon } from '@xterm/addon-fit';
import type { Terminal } from '@xterm/xterm';

export async function startShell(
  terminal: Terminal,
  webContainer: WebContainer
) {
  const shProcess = await webContainer.spawn('jsh', {
    terminal: {
      cols: terminal.cols,
      rows: terminal.rows / 2,
    },
  });
  shProcess.output.pipeTo(
    new WritableStream({
      write(data) {
        terminal.write(data);
      },
    })
  );

  const input = shProcess.input.getWriter();
  terminal.onData((data) => {
    input.write(data);
  });

  return shProcess;
}

export async function initWebContainer(
  terminalRef: React.RefObject<Terminal | null>,
  terminalAddonRef: React.RefObject<FitAddon | null>,
  terminalDivRef: React.RefObject<HTMLDivElement | null>,
  webContainer: React.RefObject<WebContainer | null>,
  files: React.RefObject<FileSystemTree | null>,
  iFrameRef: React.RefObject<HTMLIFrameElement | null>
) {
  if (
    !terminalRef.current ||
    !terminalAddonRef.current ||
    !terminalDivRef.current ||
    !files.current ||
    !iFrameRef.current
  ) {
    return null;
  }

  terminalRef.current.loadAddon(terminalAddonRef.current);
  terminalRef.current.open(terminalDivRef.current);

  webContainer.current = await WebContainer.boot();
  await webContainer.current.mount(files.current);

  iFrameRef.current.src = 'setup.html';
  const currentIFrame = iFrameRef.current;
  webContainer.current.on('server-ready', async (_port, url) => {
    currentIFrame.src = url;
  });

  const shProcess = await startShell(terminalRef.current, webContainer.current);

  const resizeListener = () => {
    if (!terminalAddonRef.current || !terminalRef.current) return;
    terminalAddonRef.current.fit();

    shProcess.resize({
      cols: terminalRef.current.cols,
      rows: terminalRef.current.rows / 2,
    });
  };

  window.addEventListener('resize', resizeListener);

  return () => {
    window.removeEventListener('resize', resizeListener);
  };
}

export function watchWebContainerFiles(
  webcontainerInstance: WebContainer,
  dispatchUpdate: (path: string, content: string | null) => void,
  getActiveFileName: () => string
) {
  if (!webcontainerInstance) return null;

  const watcher = webcontainerInstance.fs.watch(
    '/',
    { recursive: true },
    async (event, filename) => {
      if (!filename) return;
      const filenameStr =
        typeof filename === 'string'
          ? filename
          : new TextDecoder().decode(filename);
      const relativePath = filenameStr.startsWith('/')
        ? filenameStr.slice(1)
        : filenameStr;
      const absolutePath = filenameStr.startsWith('/')
        ? filenameStr
        : `/${filenameStr}`;

      if (
        relativePath.startsWith('node_modules/') ||
        relativePath.startsWith('.next/') ||
        relativePath.startsWith('dist/') ||
        relativePath.startsWith('.git/') ||
        relativePath === 'package-lock.json' ||
        relativePath === 'yarn.lock' ||
        relativePath === 'pnpm-lock.yaml'
      ) {
        return;
      }

      if (event === 'change' && relativePath === getActiveFileName()) {
        return;
      }

      console.log('RUNNING WATCHER', filename);

      try {
        if (event === 'rename') {
          try {
            const contentRaw = await webcontainerInstance.fs.readFile(
              absolutePath,
              'utf-8'
            );
            const content =
              typeof contentRaw === 'string'
                ? contentRaw
                : new TextDecoder().decode(contentRaw);
            dispatchUpdate(relativePath, content);
          } catch {
            dispatchUpdate(relativePath, null);
          }
        } else if (event === 'change') {
          const contentRaw = await webcontainerInstance.fs.readFile(
            absolutePath,
            'utf-8'
          );
          const content =
            typeof contentRaw === 'string'
              ? contentRaw
              : new TextDecoder().decode(contentRaw);
          dispatchUpdate(relativePath, content);
        }
      } catch (error) {
        console.warn(
          `Error reading file during watch event for ${filenameStr}:`,
          error
        );
      }
    }
  );

  return watcher;
}

export async function installDependencies(
  webcontainer: WebContainer,
  terminal: Terminal
) {
  const installProcess = await webcontainer.spawn('pnpm', ['install']);
  installProcess.output.pipeTo(
    new WritableStream({
      write(data) {
        terminal.write(data);
      },
    })
  );
  return installProcess.exit;
}

export async function startDevServer(
  webcontainer: WebContainer,
  terminal: Terminal,
  iFrame: HTMLIFrameElement
) {
  const serverProcess = await webcontainer.spawn('pnpm', ['run', 'dev']);

  serverProcess.output.pipeTo(
    new WritableStream({
      write(data) {
        terminal.write(data);
      },
    })
  );

  webcontainer.on('server-ready', (_port, url) => {
    iFrame.src = url;
  });
}

export async function writeToWebContainer(
  webcontainerInstance: WebContainer,
  filePath: string,
  content: string
) {
  if (!webcontainerInstance) {
    console.error('WebContainer is not booted yet.');
    return;
  }

  const absolutePath = filePath.startsWith('/') ? filePath : `/${filePath}`;

  try {
    await webcontainerInstance.fs.writeFile(absolutePath, content);
  } catch (error) {
    console.error(`Failed to write to ${absolutePath}:`, error);
  }
}

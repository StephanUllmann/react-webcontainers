import { WebContainer } from '@webcontainer/api';
import type { FileSystemTree } from '@webcontainer/api';
import type { FitAddon } from '@xterm/addon-fit';
import type { Terminal } from '@xterm/xterm';

/**
 * Starts an interactive jsh shell session within a WebContainer.
 * Connects the given xterm Terminal object to the shell's input/output streams.
 *
 * @param terminal - xterm Terminal instance to attach to the shell
 * @param webContainer - Active WebContainer instance
 * @returns The shell process spawned by WebContainer
 */
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

/**
 * Initializes and mounts the WebContainer, opening the xterm terminal
 * and starting the jsh shell session within it. Mounts the initial file system tree.
 *
 * Returns a cleanup function to remove the window resize listener attached.
 *
 * @param terminalRef - Ref containing the xterm Terminal instance
 * @param terminalAddonRef - Ref containing the xterm FitAddon
 * @param terminalDivRef - Ref pointing to the DOM container of the terminal
 * @param webContainer - Ref to hold the booted WebContainer instance
 * @param files - Ref containing the initial FileSystemTree to mount
 * @param iFrameRef - Ref to the preview iframe
 * @returns A cleanup function removing the resize event listener, or null if dependencies are missing
 */
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

/**
 * Starts a file system watcher on the WebContainer instance.
 * Triggers `dispatchUpdate` whenever files are changed or renamed,
 * except for specific ignored directories (node_modules, .git, etc.)
 * and the currently active/focused file in the editor to avoid looping.
 *
 * @param webcontainerInstance - Active WebContainer instance
 * @param dispatchUpdate - Callback to update the React state with new file content
 * @param getActiveFileName - A getter that returns the name of the currently active file in the editor
 * @returns The fs watcher instance returned by WebContainer
 */
export function watchWebContainerFiles(
  webcontainerInstance: WebContainer,
  // ADD isActiveFile flag to the callback signature
  dispatchUpdate: (
    path: string,
    content: string | null,
    isActiveFile: boolean
  ) => void,
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

      // 1. DETERMINE IF THIS IS THE ACTIVE FILE
      const isActiveFile = relativePath === getActiveFileName();

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
            // 3. PASS THE FLAG
            dispatchUpdate(relativePath, content, isActiveFile);
          } catch {
            // 3. PASS THE FLAG
            dispatchUpdate(relativePath, null, isActiveFile);
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
          // 3. PASS THE FLAG
          dispatchUpdate(relativePath, content, isActiveFile);
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

/**
 * Spawns an npm/pnpm install process within the given WebContainer
 * and pipes the output into the provided terminal.
 *
 * @param webcontainer - Active WebContainer instance
 * @param terminal - Terminal instance to stream the install command output into
 * @returns The exit code of the install process
 */
export async function installDependencies(
  webcontainer: WebContainer,
  terminal: Terminal,
  iFrameRef: HTMLIFrameElement
) {
  const installProcess = await webcontainer.spawn('npm', ['install']);
  iFrameRef.src = 'installing.html';
  installProcess.output.pipeTo(
    new WritableStream({
      write(data) {
        terminal.write(data);
      },
    })
  );
  return installProcess.exit;
}

/**
 * Spawns a dev server (e.g., `pnpm run dev`) inside the WebContainer.
 * Pipes its stdout to the terminal. When the 'server-ready' event fires,
 * it updates the provided iframe src to display the running server preview.
 *
 * @param webcontainer - Active WebContainer instance
 * @param terminal - Terminal instance to stream the dev server logs
 * @param iFrame - The preview iframe DOM element to update on 'server-ready'
 */
export async function startDevServer(
  webcontainer: WebContainer,
  terminal: Terminal
) {
  const serverProcess = await webcontainer.spawn('npm', ['run', 'dev']);

  serverProcess.output.pipeTo(
    new WritableStream({
      write(data) {
        terminal.write(data);
      },
    })
  );
}

export async function createFile(webcontainer: WebContainer, filename: string) {
  const lastSlashIndex = filename.lastIndexOf('/');

  if (lastSlashIndex !== -1) {
    const dirPath = filename.substring(0, lastSlashIndex);

    await webcontainer.fs.mkdir(dirPath, { recursive: true });
  }

  await webcontainer.fs.writeFile(filename, '');
}
/**
 * Writes text content to a specific file inside the WebContainer virtual file system.
 *
 * @param webcontainerInstance - Active WebContainer instance
 * @param filePath - Path to the file to write
 * @param content - Text content to write into the file
 */
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

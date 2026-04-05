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
  terminalRef: React.RefObject<Terminal>,
  terminalAddonRef: React.RefObject<FitAddon>,
  terminalDivRef: React.RefObject<HTMLDivElement | null>,
  webContainer: React.RefObject<WebContainer | null>,
  files: React.RefObject<any>,
  iFrameRef: React.RefObject<HTMLIFrameElement | null>
) {
  terminalRef.current.loadAddon(terminalAddonRef.current);
  terminalRef.current.open(terminalDivRef.current!);

  webContainer.current = await WebContainer.boot();
  await webContainer.current.mount(files.current as FileSystemTree);

  webContainer.current.on('server-ready', async (port, url) => {
    iFrameRef.current!.src = url;
  });

  const shProcess = await startShell(terminalRef.current, webContainer.current);

  window.addEventListener('resize', () => {
    terminalAddonRef.current.fit();

    shProcess.resize({
      cols: terminalRef.current.cols,
      rows: terminalRef.current.rows / 2,
    });
  });
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

  webcontainer.on('server-ready', (port, url) => {
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

  // Ensure the path is absolute for the WebContainer FS
  const absolutePath = filePath.startsWith('/') ? filePath : `/${filePath}`;

  try {
    await webcontainerInstance.fs.writeFile(absolutePath, content);
  } catch (error) {
    console.error(`Failed to write to ${absolutePath}:`, error);
  }
}

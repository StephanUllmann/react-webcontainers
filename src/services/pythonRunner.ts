import { WebContainer, type FileSystemTree } from '@webcontainer/api';
import type { Terminal } from '@xterm/xterm';
import type { PyodideAPI } from 'pyodide';

// Store the promise at the module level so hot-reloads or repeated calls
// during the same session don't trigger multiple downloads.
let pyodideInitPromise: Promise<PyodideAPI> | null = null;

export async function runPyOdideAndRender(
  pyodide: PyodideAPI,
  iframeElement: HTMLIFrameElement,
  filename: string
) {
  let terminalOutput = '';

  pyodide.setStdout({
    batched: (msg: string) => (terminalOutput += msg + '\n'),
  });
  pyodide.setStderr({
    batched: (msg: string) => (terminalOutput += msg + '\n'),
  });
  pyodide.setStdin({
    stdin: () => {
      const userInput = window.prompt('Python is requesting input:');
      const result = userInput !== null ? userInput : '';

      terminalOutput += result + '\n';
      return result + '\n';
    },
  });

  const innerDoc = iframeElement.contentDocument;
  if (!innerDoc) {
    terminalOutput += '\nError: Cannot access iframe document.';
    return;
  }

  // 1. Synchronously reset and prepare the iframe's DOM layout
  // This destroys old plots in the UI and ensures we don't have to wait for 'srcdoc'
  innerDoc.open();
  innerDoc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { background: #1e1e1e; color: #d4d4d4; font-family: monospace; padding: 20px; }
          pre { margin: 0; white-space: pre-wrap; word-wrap: break-word; }
          .error { color: #f44336; }
          .success { color: #4caf50; }
          #plot-container { margin-top: 20px; border-top: 1px solid #333; padding-top: 20px; }
          #plot-container:empty { display: none; margin: 0; padding: 0; border: none; }

          #plot-container > div { background: white; padding: 10px; border-radius: 4px; display: inline-block; }
        </style>
      </head>
      <body>
        <h2>Python Execution Output</h2>
        <pre id="terminal-output">Running...</pre>
        <div id="plot-container"></div>
      </body>
    </html>
  `);
  innerDoc.close();

  const terminalEl = innerDoc.getElementById('terminal-output');
  const plotContainer = innerDoc.getElementById('plot-container');

  // 2. Clear Python's Matplotlib memory to prevent duplicate canvases
  try {
    await pyodide.runPythonAsync(`
      import sys
      if 'matplotlib.pyplot' in sys.modules:
          sys.modules['matplotlib.pyplot'].close('all')
    `);
  } catch (e) {
    // Fails safely if matplotlib isn't installed/imported
  }

  // 3. Setup the Synchronous DOM Interceptor
  const originalAppend = document.body.appendChild.bind(document.body);

  // @ts-ignore - Intercepting the DOM
  document.body.appendChild = (node: Node) => {
    if (node instanceof HTMLElement) {
      // Adopt and append IMMEDIATELY, before Matplotlib draws to the canvas.
      // This prevents the browser from wiping the drawing buffer!
      const adoptedNode = innerDoc.adoptNode(node);
      plotContainer?.appendChild(adoptedNode);
      return adoptedNode;
    }
    return originalAppend(node);
  };

  try {
    const code = pyodide.FS.readFile(filename, { encoding: 'utf8' });
    await pyodide.runPythonAsync(code);
  } catch (error) {
    terminalOutput += `\nError: ${error}`;
  } finally {
    // 4. Restore normal DOM behavior
    // @ts-ignore
    document.body.appendChild = originalAppend;

    // 5. Update the terminal output text and styling
    if (terminalEl) {
      terminalEl.innerHTML =
        terminalOutput.replace(/</g, '&lt;').replace(/>/g, '&gt;') ||
        'No output';
      terminalEl.className = terminalOutput.includes('Error:')
        ? 'error'
        : 'success';
    }
  }
}

export async function syncFilesToPyodide(
  webContainer: WebContainer,
  pyodide: PyodideAPI,
  dirPath = '.'
) {
  const entries = await webContainer.fs.readdir(dirPath, {
    withFileTypes: true,
  });

  for (const entry of entries) {
    const fullPath = dirPath === '.' ? entry.name : `${dirPath}/${entry.name}`;

    if (entry.isDirectory()) {
      if (['node_modules', '.git', '.venv', '__pycache__'].includes(entry.name))
        continue;
      try {
        pyodide.FS.mkdir(fullPath);
      } catch {}
      await syncFilesToPyodide(webContainer, pyodide, fullPath);
    } else {
      const fileData = await webContainer.fs.readFile(fullPath);
      pyodide.FS.writeFile(fullPath, fileData);
    }
  }
}

// Single, clean initialization function
export async function initPyodide(
  terminal: Terminal,
  files: FileSystemTree,
  webContainer: WebContainer
): Promise<PyodideAPI> {
  if (pyodideInitPromise) return pyodideInitPromise;

  pyodideInitPromise = (async () => {
    const { loadPyodide } = await import('pyodide');
    terminal.write('\x1b[33mDownloading Pyodide (Background)...\x1b[0m\r\n');

    try {
      const pyodide = await loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/',
      });

      if ('requirements.txt' in files) {
        terminal.write('\x1b[33mInstalling Python dependencies...\x1b[0m\r\n');
        // @ts-ignore - File exists based on your mock structure
        const reqContent = files['requirements.txt'].file.contents as string;

        await pyodide.loadPackage('micropip');
        const micropip = pyodide.pyimport('micropip');

        const packages = reqContent
          .split('\n')
          .map((p) => p.trim())
          .filter(Boolean);

        // if (packages.includes('Flask')) packages.push('sqlite3');

        if (packages.length > 0) {
          await micropip.install(packages);
        }
      }

      terminal.write('\x1b[32mPyodide Environment Ready!\x1b[0m\r\n');
      await syncFilesToPyodide(webContainer, pyodide);

      return pyodide;
    } catch (error) {
      terminal.write(
        `\x1b[31mPyodide Initialization Failed: ${error}\x1b[0m\r\n`
      );
      pyodideInitPromise = null; // Reset on failure so we can try again
      throw error;
    }
  })();

  return pyodideInitPromise;
}

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
  let base64Image = '';

  pyodide.setStdout({
    batched: (msg: string) => (terminalOutput += msg + '\n'),
  });
  pyodide.setStderr({
    batched: (msg: string) => (terminalOutput += msg + '\n'),
  });

  try {
    try {
      pyodide.FS.unlink('plot.png');
    } catch {} // Cleanup old plot

    const code = pyodide.FS.readFile(filename, { encoding: 'utf8' });
    await pyodide.runPythonAsync(code);

    try {
      const fileData = pyodide.FS.readFile('plot.png');
      const binaryString = Array.from(fileData, (byte: number) =>
        String.fromCharCode(byte)
      ).join('');
      base64Image = btoa(binaryString);
    } catch {} // No plot
  } catch (error) {
    terminalOutput += `\nError: ${error}`;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { background: #1e1e1e; color: #d4d4d4; font-family: monospace; padding: 20px; }
          pre { margin: 0; white-space: pre-wrap; word-wrap: break-word; }
          .error { color: #f44336; }
          .success { color: #4caf50; }
        </style>
      </head>
      <body>
        <h2>Python Execution Output</h2>
        <pre class="${terminalOutput.includes('Error:') ? 'error' : 'success'}">${
          terminalOutput.replace(/</g, '&lt;').replace(/>/g, '&gt;') ||
          'No output'
        }</pre>
        ${
          base64Image
            ? `
        <hr style="border-color: #333; margin: 20px 0;" />
        <h3>Generated Plot</h3>
        <img src="data:image/png;base64,${base64Image}" style="max-width: 100%; border: 1px solid #555;" />
        `
            : ''
        }
      </body>
    </html>
  `;

  iframeElement.srcdoc = htmlContent;
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

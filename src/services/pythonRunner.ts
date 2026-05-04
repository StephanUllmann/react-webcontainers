import { WebContainer, type FileSystemTree } from '@webcontainer/api';
import type { Terminal } from '@xterm/xterm';
import type { PyodideAPI } from 'pyodide';

export async function runPyOdideAndRender(
  webContainer: WebContainer,
  pyodide: PyodideAPI, // Pass the initialized Pyodide instance
  iframeElement: HTMLIFrameElement,
  filename: string
) {
  let terminalOutput = '';
  let base64Image = '';
  console.log(pyodide);
  // 1. Redirect Pyodide's stdout to capture print() statements
  pyodide.setStdout({
    batched: (msg: string) => (terminalOutput += msg + '\n'),
  });
  pyodide.setStderr({
    batched: (msg: string) => (terminalOutput += msg + '\n'),
  });

  try {
    // 3. Clean up old plots in PYODIDE'S virtual file system (not WebContainer)
    try {
      pyodide.FS.unlink('plot.png');
    } catch {
      // Ignore if it doesn't exist
    }

    // 4. Execute the code directly in the browser via Pyodide
    const code = pyodide.FS.readFile(filename, { encoding: 'utf8' });
    await pyodide.runPythonAsync(code);

    // 5. Check if the script generated a plot in Pyodide's File System
    try {
      const fileData = pyodide.FS.readFile('plot.png'); // Returns Uint8Array

      const binaryString = Array.from(fileData, (byte: number) =>
        String.fromCharCode(byte)
      ).join('');
      base64Image = btoa(binaryString);
    } catch {
      // No plot generated
    }
  } catch (error) {
    // Catch syntax errors or runtime exceptions from Python
    terminalOutput += `\nError: ${error}`;
  }

  // 6. Build and inject the HTML content (Same as your original code!)
  let htmlContent = `
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
  `;

  if (base64Image) {
    htmlContent += `
        <hr style="border-color: #333; margin: 20px 0;" />
        <h3>Generated Plot</h3>
        <img src="data:image/png;base64,${base64Image}" style="max-width: 100%; border: 1px solid #555;" />
    `;
  }

  htmlContent += `
      </body>
    </html>
  `;
  console.log(htmlContent);
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
      // Skip heavy/irrelevant directories to save memory and time
      if (
        ['node_modules', '.git', '.venv', '__pycache__'].includes(entry.name)
      ) {
        continue;
      }

      try {
        pyodide.FS.mkdir(fullPath);
      } catch {
        // Pyodide throws if the directory already exists, which is totally fine
      }
      await syncFilesToPyodide(webContainer, pyodide, fullPath);
    } else {
      // Read the raw bytes from WebContainer
      const fileData = await webContainer.fs.readFile(fullPath);
      // Write the raw bytes directly into Pyodide's filesystem
      pyodide.FS.writeFile(fullPath, fileData);
    }
  }
}

export async function initPyodide(
  pyodidePromise: Promise<unknown> | null,
  terminal: Terminal,
  files: FileSystemTree,
  pyodideRef: React.RefObject<PyodideAPI | null>,
  webContainer: WebContainer
) {
  if (!pyodidePromise) {
    const { loadPyodide } = await import('pyodide');
    pyodidePromise = (async () => {
      terminal!.write('\x1b[33mDownloading Pyodide (Background)...\x1b[0m\r\n');

      try {
        // Fetch the WASM core
        const _pyodide = await loadPyodide({
          indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/',
        });

        // Handle requirements.txt quietly in the background
        if ('requirements.txt' in files!) {
          terminal!.write(
            '\x1b[33mInstalling Python dependencies...\x1b[0m\r\n'
          );
          const reqContent = files['requirements.txt'].file.contents;

          await _pyodide.loadPackage('micropip');
          const micropip = _pyodide.pyimport('micropip');

          console.log({ reqContent });
          const packages = reqContent
            .split('\n')
            .map((p: string) => p.trim())
            .filter(Boolean); // removes empty lines

          if (packages.length > 0) {
            await micropip.install(packages);
          }
        }

        terminal!.write('\x1b[32mPyodide Environment Ready!\x1b[0m\r\n');
        syncFilesToPyodide(webContainer, _pyodide);
        pyodideRef.current = _pyodide;
        return _pyodide;
      } catch (error) {
        terminal!.write(
          `\x1b[31mPyodide Initialization Failed: ${error}\x1b[0m\r\n`
        );
        throw error;
      }
    })();
  }
  return pyodidePromise;
}

export async function initializePyodite(
  pyodidePromise: Promise<unknown> | null,
  terminal: Terminal,
  files: FileSystemTree,
  pyodideRef: React.RefObject<PyodideAPI | null>,
  fileName: string,
  webContainer: WebContainer,
  iFrame: HTMLIFrameElement
) {
  initPyodide(pyodidePromise, terminal, files, pyodideRef, webContainer);

  if (fileName.endsWith('.py')) {
    // Wrap in an IIFE (Immediately Invoked Function Expression) so we can await locally
    // without forcing the parent handleEditorDidMount function to pause.
    (async () => {
      terminal!.write(
        '\x1b[90mWaiting for Python environment to boot before running script...\x1b[0m\r\n'
      );

      try {
        // This will pause *only this inline block* until the background download completes
        const pyodide = (await initPyodide(
          pyodidePromise,
          terminal,
          files,
          pyodideRef,
          webContainer
        )) as PyodideAPI;

        // Execute the file and push the results to the iframe
        await runPyOdideAndRender(webContainer!, pyodide, iFrame!, fileName);
      } catch (error) {
        // If the background loader failed, or the execution failed, catch it safely
        console.error('Failed to execute initial Python script:', error);
      }
    })();
  }
}

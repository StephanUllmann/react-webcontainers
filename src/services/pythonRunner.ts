import { WebContainer } from '@webcontainer/api';

export async function runPythonAndRender(
  webContainer: WebContainer,
  iframeElement: HTMLIFrameElement,
  filename: string
) {
  // 1. Clean up old plots to prevent false positives from previous runs
  try {
    await webContainer.fs.rm('plot.png');
  } catch {
    // Ignore error if file doesn't exist yet
  }
  // 2. Spawn the python process directly
  // The '-u' flag forces unbuffered output so we get prints immediately
  const process = await webContainer.spawn('jsh', [
    '-c',
    `python -u ${filename}`,
  ]);

  let terminalOutput = '';
  // 3. Capture stdout and stderr streams directly
  process.output.pipeTo(
    new WritableStream({
      write(data) {
        terminalOutput += data;
      },
    })
  );

  // Wait for the script to finish executing
  const exitCode = await process.exit;
  // 4. Check if the script generated a plot
  let base64Image = '';
  try {
    // fs.readFile returns a Uint8Array
    const fileData = await webContainer.fs.readFile('plot.png');

    // Convert Uint8Array to a Base64 string so we can embed it in HTML
    const binaryString = Array.from(fileData, (byte) =>
      String.fromCharCode(byte)
    ).join('');
    base64Image = btoa(binaryString);
  } catch {
    // No plot generated, safely ignore
  }

  // 5. Build the HTML content
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
        <pre class="${exitCode !== 0 ? 'error' : 'success'}">${
          terminalOutput.replace(/</g, '&lt;').replace(/>/g, '&gt;') ||
          'No output'
        }</pre>
  `;

  // 6. Inject the image if it exists
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

  // 7. Render instantly via srcdoc
  iframeElement.srcdoc = htmlContent;
}

export async function runPyOdideAndRender(
  webContainer: WebContainer,
  pyodide: any, // Pass the initialized Pyodide instance
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
    // 2. Read the actual python code from the WebContainer file system
    const fileBytes = await webContainer.fs.readFile(filename);
    const code = new TextDecoder().decode(fileBytes);

    // 3. Clean up old plots in PYODIDE'S virtual file system (not WebContainer)
    try {
      pyodide.FS.unlink('plot.png');
    } catch {
      // Ignore if it doesn't exist
    }

    // 4. Execute the code directly in the browser via Pyodide
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

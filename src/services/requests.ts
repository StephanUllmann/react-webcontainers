import { WebContainer } from '@webcontainer/api';

export async function fetchFromContainerAPI(
  webContainer: WebContainer,
  url: string,
  init?: RequestInit
) {
  const cleanInit = init ? { ...init } : undefined;
  if (cleanInit && cleanInit.headers === null) {
    delete cleanInit.headers;
  }

  const encodedInit = cleanInit ? btoa(JSON.stringify(cleanInit)) : '';

  const nodeScript = `
    async function run() {
      try {
        const b64 = '${encodedInit}';
        const initObj = b64 ? JSON.parse(Buffer.from(b64, 'base64').toString('utf-8')) : undefined;

        const res = await fetch('${url}', initObj);
        const text = await res.text();

        // Wrap the response in a structured object.
        // This guarantees we always output valid JSON back to the host!
        const result = {
          ok: res.ok,
          status: res.status,
          headers: Object.fromEntries(res.headers.entries()),
          body: text
        };

        process.stdout.write(JSON.stringify(result));
      } catch (err) {
        process.stderr.write(err.message);
        process.exit(1);
      }
    }
    run();
  `;

  const process = await webContainer.spawn('node', ['-e', nodeScript]);

  let output = '';
  process.output.pipeTo(
    new WritableStream({
      write(data) {
        output += data;
      },
    })
  );

  const exitCode = await process.exit;

  if (exitCode !== 0) {
    throw new Error(`Fetch script failed to execute: ${output}`);
  }

  const responseData = JSON.parse(output);

  // or return the raw HTML/text if it failed (like a 404)
  if (!responseData.ok) {
    console.warn(
      `Request failed with status ${responseData.status}:`,
      responseData.body
    );
  }

  try {
    return {
      ...responseData,
      data: JSON.parse(responseData.body),
    };
  } catch {
    return {
      ...responseData,
      data: responseData.body,
    };
  }
}

export function renderResponseInIframe(
  iframeElement: HTMLIFrameElement,
  containerUrl: string,
  response: any
) {
  let htmlContent = '';
  const contentType = response.headers?.['content-type'] || '';

  // 1. Handle JSON Responses (Format them nicely like an API playground)
  if (contentType.includes('application/json')) {
    htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <base href="${containerUrl}/">
          <style>
            body { background: #1e1e1e; color: #d4d4d4; font-family: monospace; padding: 20px; }
            pre { margin: 0; white-space: pre-wrap; word-wrap: break-word; }
          </style>
        </head>
        <body>
          <pre>${JSON.stringify(response.data, null, 2)}</pre>
        </body>
      </html>
    `;
  }

  // 2. Handle HTML or Plain Text Responses
  else {
    htmlContent = response.body;

    // Inject the <base> tag so relative CSS/JS/Images load from the WebContainer,
    // not from your localhost:5173 wrapper!
    const baseTag = `<base href="${containerUrl}/">`;

    if (htmlContent.includes('<head>')) {
      htmlContent = htmlContent.replace('<head>', `<head>\n  ${baseTag}`);
    } else {
      htmlContent = `${baseTag}\n${htmlContent}`;
    }
  }

  // 3. Inject the compiled HTML directly into the iframe
  iframeElement.srcdoc = htmlContent;
}

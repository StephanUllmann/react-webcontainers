import type { WebContainer } from '@webcontainer/api';
import {
  fetchFromContainerAPI,
  renderResponseInIframe,
} from '../services/requests';
import { useState } from 'react';

interface FetchDialogProps {
  webContainer: React.RefObject<WebContainer | null>;
  iFrameRef: React.RefObject<HTMLIFrameElement | null>;
}

interface FetchElements extends HTMLFormControlsCollection {
  path: HTMLInputElement;
  method: HTMLSelectElement;
  body?: HTMLTextAreaElement;
  headers: HTMLInputElement;
}

interface FetchElement extends HTMLFormElement {
  readonly elements: FetchElements;
}

type Init = { path: string; method: string; body?: string; headers: string };

async function handleFetch(
  webContainer: WebContainer,
  iFrame: HTMLIFrameElement,
  init: Init
) {
  const url = sessionStorage.getItem('container_url');
  if (!url) return;

  try {
    const response = await fetchFromContainerAPI(
      webContainer,
      url + init.path,
      {
        method: init.method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: init.body,
      }
    );

    console.log('Got response from container API:', response);
    renderResponseInIframe(iFrame, url, response);
  } catch (err) {
    console.error('Error on fetch: ', err);
  }
}

export default function FetchForm({
  webContainer,
  iFrameRef,
}: FetchDialogProps) {
  const [method, setMethod] = useState('GET');
  const needsBody = ['POST', 'PUT'].includes(method);

  async function handleSubmit(e: React.SubmitEvent<FetchElement>) {
    e.preventDefault();
    const {
      path,
      method: formMethod,
      body,
      headers,
    } = e.currentTarget.elements;

    const init: Init = {
      path: path.value,
      method: formMethod.value,
      headers: headers.value,
    };

    if (['POST', 'PUT'].includes(formMethod.value) && body?.value) {
      init.body = JSON.stringify(JSON.parse(body.value));
    }

    const wc = webContainer.current;
    const iFrame = iFrameRef.current;
    if (!wc || !iFrame) return;

    handleFetch(wc, iFrame, init);
  }

  return (
    <form
      className="flex w-full flex-col gap-2 border border-slate-800 bg-(--bg-primary) pt-0 pr-0 pl-0.5"
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col items-start gap-1.5">
        <div className="flex w-full border border-slate-800 bg-slate-950 focus-within:border-slate-700 focus-within:ring-1 focus-within:ring-slate-800">
          <select
            name="method"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="cursor-pointer border-r border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 outline-none"
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
          </select>
          <input
            type="text"
            name="path"
            defaultValue="/"
            placeholder="/"
            className="flex-1 bg-transparent px-3 py-2 text-xs text-slate-200 outline-none placeholder:text-slate-600"
          />
          <div className="m-0.5 flex justify-end">
            <button
              type="submit"
              className="h-full bg-slate-700 px-3 py-1 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-600 active:bg-slate-700"
            >
              Request
            </button>
          </div>
        </div>
      </div>

      {/* Grid Area Layout */}
      <div
        className="relative grid pt-0"
        style={{
          gridTemplateColumns: '1fr 1fr',
          gridTemplateAreas: needsBody
            ? '"tab-a tab-b " "content content "'
            : '". tab-b" "content content "',
        }}
      >
        {needsBody && (
          <details name="request-options" className="contents">
            <summary
              style={{ gridArea: 'tab-a' }}
              className="cursor-pointer border-transparent px-1 text-xs font-medium text-slate-400 transition-colors outline-none select-none hover:text-slate-200"
            >
              Body
            </summary>
            <textarea
              name="body"
              style={{ gridArea: 'content' }}
              className="absolute inset-0 min-h-20 w-full border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
              defaultValue={JSON.stringify({ '': '' }, null, 2)}
            ></textarea>
          </details>
        )}

        <details name="request-options" className="contents">
          <summary
            style={{ gridArea: 'tab-b' }}
            className="cursor-pointer border-transparent px-1 pb-1 text-xs font-medium text-slate-400 transition-colors outline-none select-none hover:text-slate-200"
          >
            Headers
          </summary>
          <textarea
            name="headers"
            style={{ gridArea: 'content' }}
            defaultValue={JSON.stringify(
              { 'Content-Type': 'application/json' },
              null,
              2
            )}
            className="absolute inset-0 min-h-20 w-full border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
          ></textarea>
        </details>
      </div>
    </form>
  );
}

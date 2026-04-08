import type { WebContainer } from '@webcontainer/api';
import {
  fetchFromContainerAPI,
  renderResponseInIframe,
} from '../services/requests';
import { useRef } from 'react';

interface FetchDialogProps {
  webContainer: React.RefObject<WebContainer | null>;
  iFrameRef: React.RefObject<HTMLIFrameElement | null>;
}

interface FetchElements extends HTMLFormControlsCollection {
  path: HTMLInputElement;
  method: HTMLSelectElement;
  body: HTMLTextAreaElement;
  headers: HTMLInputElement;
}

interface FetchElement extends HTMLFormElement {
  readonly elements: FetchElements;
}

type Init = { path: string; method: string; body?: string; headers: string };

async function handleTestFetch(
  webContainer: WebContainer,
  iFrame: HTMLIFrameElement,
  init: Init
) {
  const url = sessionStorage.getItem('container_url');
  if (!url) return;

  try {
    // 1. Fetch the data using the safe Node Base64 script
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

    // 2. Redirect that response into the iframe!
    renderResponseInIframe(iFrame, url, response);
  } catch (err) {
    console.error('Error on fetch: ', err);
  }
}

export default function FetchDialog({
  webContainer,
  iFrameRef,
}: FetchDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  async function handleSubmit(e: React.SubmitEvent<FetchElement>) {
    e.preventDefault();
    dialogRef.current?.close();
    const { path, method, body, headers } = e.currentTarget.elements;
    const init: Init = {
      path: path.value,
      method: method.value,

      headers: headers.value,
    };
    if ('GET' !== method.value)
      init.body = JSON.stringify(JSON.parse(body.value));
    const wc = webContainer.current;
    const iFrame = iFrameRef.current;
    if (!wc || !iFrame) return;
    handleTestFetch(wc, iFrame, init);
  }

  return (
    <>
      <button
        className="mt-auto cursor-pointer rounded px-3 py-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
        onClick={() => {
          dialogRef.current?.showModal();
        }}
      >
        Fetch
      </button>
      <dialog
        className="m-auto w-full max-w-2xl rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-2xl backdrop:backdrop-blur-xs"
        ref={dialogRef}
      >
        <button
          type="button"
          className="absolute top-4 right-4 flex h-7 w-7 cursor-pointer items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
          onClick={() => {
            dialogRef.current?.close();
          }}
        >
          ✕
        </button>

        <h2 className="mb-6 text-xl font-semibold text-slate-100">
          Fetch stuff
        </h2>

        <form
          className="flex flex-col gap-4"
          action="dialog"
          onSubmit={handleSubmit}
        >
          <label className="flex flex-col items-start gap-1.5">
            <span className="text-xs font-medium text-slate-400">Path</span>
            <input
              type="text"
              name="path"
              defaultValue="/echo"
              placeholder="/echo"
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </label>

          <label className="flex flex-col items-start gap-1.5">
            <span className="text-xs font-medium text-slate-400">Method</span>
            <select
              name="method"
              defaultValue=""
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="" disabled>
                -- Select a method --
              </option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
          </label>

          <label className="flex flex-col items-start gap-1.5">
            <span className="text-xs font-medium text-slate-400">Body</span>
            <textarea
              name="body"
              className="min-h-20 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            ></textarea>
          </label>

          <label className="flex flex-col items-start gap-1.5">
            <span className="text-xs font-medium text-slate-400">Headers</span>
            <textarea
              name="headers"
              className="min-h-20 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            ></textarea>
          </label>

          {/* Action area */}
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              className="rounded bg-amber-600 px-5 py-2 text-xs font-medium text-white transition-colors hover:bg-amber-500 active:bg-amber-700"
              onClick={() => {
                dialogRef.current?.close();
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded bg-blue-600 px-5 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-500 active:bg-blue-700"
            >
              Fetch
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

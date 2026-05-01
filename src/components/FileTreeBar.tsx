import { useState } from 'react';
import { createFile } from '../services/webContainer';
import type { WebContainer } from '@webcontainer/api';

type Props = {
  webContainer: React.RefObject<WebContainer | null>;
  closeSidebar: () => void;
};

export default function FileTreeBar({ webContainer, closeSidebar }: Props) {
  const [fileInput, setFileInput] = useState(false);

  const handleKeydown: React.KeyboardEventHandler<
    HTMLParagraphElement
  > = async (e) => {
    if (e.key === 'Escape') {
      setFileInput(false);

      return;
    }
    if (e.key !== 'Enter') return;
    const newFileName = e.currentTarget.textContent;
    await createFile(webContainer.current!, newFileName);
    setFileInput(false);
  };

  return (
    <div className="flex max-w-[90%] items-center gap-2">
      {fileInput ? (
        <p
          contentEditable
          spellCheck="false"
          className="h-6 w-full rounded border border-slate-700 p-1 text-left text-xs text-nowrap"
          onKeyDown={handleKeydown}
        ></p>
      ) : (
        <div className="h-6 w-full p-1"></div>
      )}
      <button
        className={`ml-auto ${fileInput ? '' : 'rotate-45'} cursor-pointer`}
        onClick={() => setFileInput((f) => !f)}
      >
        &times;
      </button>
      <button className="cursor-pointer" onClick={closeSidebar}>
        &larr;
      </button>
    </div>
  );
}

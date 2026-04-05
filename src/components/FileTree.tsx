import { memo, useMemo } from 'react';
import type { MonacoFiles } from '../types';

type FileTree = {
  [key: string]: FileTree | null;
};

/**
 * Component that renders a recursive file tree view.
 * 
 * Takes a flat dictionary of files from Monaco and computes a nested tree
 * structure to display.
 */
function FileTreeComponent({
  files,
  activeFile,
  setActiveFile,
}: {
  files: MonacoFiles;
  activeFile: string;
  setActiveFile: React.Dispatch<React.SetStateAction<string>>;
}) {
  const fileKeys = Object.keys(files).sort().join(',');

  const computedTree = useMemo(() => {
    const fileTree: FileTree = {};
    Object.keys(files).forEach((filePath) => {
      const parts = filePath.split('/');
      let current = fileTree;

      parts.forEach((part, index) => {
        if (!current[part]) {
          current[part] = index === parts.length - 1 ? null : {};
        }
        current = current[part] as FileTree;
      });
    });
    return fileTree;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileKeys]);

  const renderTree = (tree: FileTree, path = '') => {
    return Object.entries(tree).map(([key, value]) => {
      const fullPath = path ? `${path}/${key}` : key;
      if (value === null) {
        return (
          <li key={fullPath}>
            <button
              onClick={() => {
                setActiveFile(fullPath);
              }}
              className={`w-full cursor-pointer px-4 py-1 text-left text-sm transition-colors duration-150 select-none ${
                activeFile === fullPath
                  ? 'bg-slate-700/60 text-blue-400'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              {key}
            </button>
          </li>
        );
      }

      return (
        <li key={fullPath}>
          <details open className="group">
            <summary className="cursor-pointer px-4 py-1 text-start text-sm font-medium text-slate-300 transition-colors select-none hover:text-slate-100">
              {key}
            </summary>
            <ul className="ml-3 flex flex-col border-l border-slate-700/50 pl-1">
              {renderTree(value, fullPath)}
            </ul>
          </details>
        </li>
      );
    });
  };

  return (
    <div>
      <ul className="flex grow flex-col overflow-y-auto py-2">
        {renderTree(computedTree)}
      </ul>
    </div>
  );
}

export default memo(FileTreeComponent);

import type { MonacoFiles } from '../types';

type FileTree = {
  [key: string]: FileTree | null;
};

const renderFileTree = (
  files: MonacoFiles,
  activeFile: string,
  setActiveFile: React.Dispatch<React.SetStateAction<string>>
) => {
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
    <ul className="flex grow flex-col overflow-y-auto py-2">
      {renderTree(fileTree)}
    </ul>
  );
};

export default function FileTree({
  files,
  activeFile,
  setActiveFile,
}: {
  files: MonacoFiles;
  activeFile: string;
  setActiveFile: React.Dispatch<React.SetStateAction<string>>;
}) {
  return <div>{renderFileTree(files, activeFile, setActiveFile)}</div>;
}

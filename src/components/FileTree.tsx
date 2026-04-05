import type { MonacoFiles } from '../types';

type FileTree = {
  [key: string]: FileTree | null;
};

const renderFileTree = (
  files: MonacoFiles,
  activeFile: string,
  setActiveFile: React.Dispatch<React.SetStateAction<string>>
  // pathname: string,
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
                // router.push(`${pathname}?file=${fullPath}`);
                setActiveFile(fullPath);
              }}
              className={`w-full cursor-pointer px-4 py-2 text-left text-sm ${
                activeFile === fullPath
                  ? 'bg-primary text-white'
                  : 'hover:bg-gray-200 hover:text-gray-900'
              }`}
            >
              {key}
            </button>
          </li>
        );
      }

      return (
        <li key={fullPath}>
          <div className="px-4 py-2 font-bold">{key}</div>
          <ul className="pl-4">{renderTree(value, fullPath)}</ul>
        </li>
      );
    });
  };

  return <ul className="grow overflow-y-auto">{renderTree(fileTree)}</ul>;
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

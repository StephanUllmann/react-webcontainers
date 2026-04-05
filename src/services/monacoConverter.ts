import type { FileSystemTree } from '@webcontainer/api';
import type { MonacoFiles } from '../types';

function getMonacoLanguage(filename: string) {
  const ext = filename.split('.').pop()!.toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'css':
      return 'css';
    case 'html':
      return 'html';
    case 'json':
      return 'json';
    case 'md':
      return 'markdown';
    default:
      return 'plaintext';
  }
}

export function convertToMonacoFiles(tree: FileSystemTree, basePath = '') {
  let monacoFiles: MonacoFiles = {};

  for (const [name, node] of Object.entries(tree)) {
    const fullPath = basePath ? `${basePath}/${name}` : name;

    if ('file' in node && 'contents' in node.file) {
      const contents = node.file.contents;
      monacoFiles[fullPath] = {
        name: name,
        language: getMonacoLanguage(name),
        value:
          typeof contents === 'string'
            ? contents
            : new TextDecoder().decode(contents),
      };
    } else if ('directory' in node) {
      monacoFiles = {
        ...monacoFiles,
        ...convertToMonacoFiles(node.directory, fullPath),
      };
    }
  }

  return monacoFiles;
}

export function fsToMonaco(
  prev: MonacoFiles,
  path: string,
  content: string | null
) {
  // If content is identical to what we have, skip update to prevent infinite loops with monaco change events
  if (content !== null && prev[path] && prev[path].value === content) {
    return prev;
  }

  if (content === null) {
    // File deleted
    const updated = { ...prev };
    delete updated[path];
    return updated;
  }

  // File added or changed
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const language =
    ext === 'jsx' || ext === 'js'
      ? 'javascript'
      : ext === 'tsx' || ext === 'ts'
        ? 'typescript'
        : ext;

  return {
    ...prev,
    [path]: {
      name: path,
      language: prev[path]?.language || language,
      value: content,
    },
  };
}

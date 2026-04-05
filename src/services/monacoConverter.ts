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

/**
 * Recursively flattens a WebContainer FileSystemTree into a flat dictionary
 * suitable for the Monaco editor and the file tree component.
 *
 * It infers the language of each file based on its extension.
 *
 * @param tree - The WebContainer FileSystemTree
 * @param basePath - Current base path during recursion
 * @returns A flat dictionary of MonacoFiles
 */
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

/**
 * Updates a MonacoFiles dictionary given a file path and new content.
 * 
 * If content is null, it interprets it as a file deletion and removes
 * it from the resulting dictionary.
 * Otherwise, it adds or updates the file, inferring its language.
 *
 * @param prev - Previous MonacoFiles dictionary state
 * @param path - Path of the file updated or deleted
 * @param content - New file content, or null if deleted
 * @returns Updated MonacoFiles dictionary
 */
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

import type { FileSystemTree, WebContainer } from '@webcontainer/api';
import type { MonacoFiles } from '../types';
import type { Monaco } from '@monaco-editor/react';

const languageMap = {
  js: 'javascript',
  jsx: 'javascript',
  javascript: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  typescript: 'typescript',
  css: 'css',
  html: 'html',
  json: 'json',
  md: 'markdown',
  markdown: 'markdown',
  py: 'python',
  python: 'python',
  cs: 'csharp',
  csharp: 'csharp',
  sql: 'sql',
};

export function getMonacoLanguage(filename = 'plaintext') {
  const ext = filename
    .split('.')
    .pop()!
    .toLowerCase() as keyof typeof languageMap;
  return languageMap[ext] || 'plaintext';
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
        name: fullPath,
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

export async function injectTypesFromWebContainer(
  wc: WebContainer,
  monaco: Monaco
) {
  try {
    // 1. Read and parse the project's package.json
    const pkgJsonRaw = await wc.fs.readFile('package.json', 'utf-8');
    const pkgJson = JSON.parse(pkgJsonRaw);

    // 2. Combine dependencies and devDependencies
    const allDependencies = {
      ...pkgJson.dependencies,
      ...pkgJson.devDependencies,
    };
    const depNames = Object.keys(allDependencies);

    // 3. Loop through each dependency to find its types
    for (const dep of depNames) {
      // Handle DefinitelyTyped naming for scoped packages (e.g., @types/testing-library__react)
      const dtName = dep.startsWith('@')
        ? dep.replace('@', '').replace('/', '__')
        : dep;

      const dtTypesDir = `node_modules/@types/${dtName}`;

      // Approach A: Try loading from @types first
      try {
        const dirEntries = await wc.fs.readdir(dtTypesDir, {
          withFileTypes: true,
        });
        let loadedTypes = false;

        for (const entry of dirEntries) {
          if (entry.isFile() && entry.name.endsWith('.d.ts')) {
            const filePath = `${dtTypesDir}/${entry.name}`;
            const dtContent = await wc.fs.readFile(filePath, 'utf-8');

            monaco.languages.typescript.typescriptDefaults.addExtraLib(
              dtContent,
              `file:///${filePath}`
            );
            loadedTypes = true;
          }
        }

        // If we found and loaded at least one .d.ts file, we consider it a success
        if (loadedTypes) continue;
      } catch {
        // Failed to find @types, fallback to checking bundled types
      }

      // Approach B: Try finding bundled types in the package's own package.json
      try {
        const depPkgRaw = await wc.fs.readFile(
          `node_modules/${dep}/package.json`,
          'utf-8'
        );
        const depPkg = JSON.parse(depPkgRaw);
        const bundledTypesFile = depPkg.types || depPkg.typings;

        if (bundledTypesFile) {
          // Clean up paths like "./index.d.ts" to "index.d.ts"
          const cleanPath = bundledTypesFile.startsWith('./')
            ? bundledTypesFile.slice(2)
            : bundledTypesFile;

          const fullPath = `node_modules/${dep}/${cleanPath}`;

          const bundledContent = await wc.fs.readFile(fullPath, 'utf-8');
          monaco.languages.typescript.typescriptDefaults.addExtraLib(
            bundledContent,
            `file:///${fullPath}`
          );
        }
      } catch {
        console.debug(`No types found for dependency: ${dep}`);
      }
    }

    // 4. Load deeply nested peer types that TS often relies on implicitly
    // e.g., 'express' relies heavily on 'express-serve-static-core' and 'node'
    const commonPeerTypes = [
      'node_modules/@types/express-serve-static-core/index.d.ts',
      'node_modules/@types/node/index.d.ts',
    ];

    for (const peerType of commonPeerTypes) {
      try {
        const content = await wc.fs.readFile(peerType, 'utf-8');
        monaco.languages.typescript.typescriptDefaults.addExtraLib(
          content,
          `file:///${peerType}`
        );
      } catch {
        // Fail silently if these specific peer types aren't installed
      }
    }
  } catch (err) {
    console.error('Error injecting types into Monaco:', err);
  }
}

import type { Monaco } from '@monaco-editor/react';

export function handleEditorWillMount(monaco: Monaco) {
  monaco.editor.defineTheme('catppuccin-mocha', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { background: '1e1e2e' },
      { token: 'comment', foreground: '6c7086', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'cba6f7' },
      { token: 'string', foreground: 'a6e3a1' },
      { token: 'number', foreground: 'fab387' },
      { token: 'type', foreground: 'f9e2af' },
    ],
    colors: {
      'editor.background': '#1e1e2e',
      'editor.foreground': '#cdd6f4',
      'editorCursor.foreground': '#f5e0dc',
      'editor.lineHighlightBackground': '#313244',
      'editorLineNumber.foreground': '#6c7086',
      'editorLineNumber.activeForeground': '#cba6f7',
      'editorIndentGuide.background': '#313244',
      'editorIndentGuide.activeBackground': '#585b70',
    },
  });

  const compilerOptions = {
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    allowNonTsExtensions: true,
    allowImportingTsExtensions: true,
    allowSyntheticDefaultImports: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    allowJs: true,
    jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
  };
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions(
    compilerOptions
  );
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    diagnosticCodesToIgnore: [2307],
  });
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions(
    compilerOptions
  );
}

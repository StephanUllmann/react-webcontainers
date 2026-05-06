import { useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import type { OnMount, OnChange } from '@monaco-editor/react';
import { WebContainer } from '@webcontainer/api';
import { writeToWebContainer } from '../services/webContainer';
import { getMonacoLanguage } from '../services/monaco';
import { handleEditorWillMount } from '../services/editor';
import type { MonacoFile } from '../types';

interface CodeEditorProps {
  activeFile?: MonacoFile;
  fileName: string;
  webContainerRef: React.RefObject<WebContainer | null>;
  onMount: OnMount;
}

export default function CodeEditor({
  activeFile,
  fileName,
  webContainerRef,
  onMount,
}: CodeEditorProps) {
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleEditorChange: OnChange = (value) => {
    if (value && fileName) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(async () => {
        if (webContainerRef.current) {
          await writeToWebContainer(webContainerRef.current, fileName, value);
        }
      }, 500);
    }
  };

  return (
    <Editor
      className="-ml-2 h-full pt-2.5 shadow-transparent drop-shadow-transparent"
      theme="catppuccin-mocha"
      path={activeFile?.name}
      loading={
        <div className="loader-wrapper">
          <div className="spinner"></div>
          <div className="loading-text">Initializing Editor</div>
        </div>
      }
      defaultLanguage={getMonacoLanguage(activeFile?.language)}
      defaultValue={activeFile?.value}
      beforeMount={handleEditorWillMount}
      onMount={onMount}
      onChange={handleEditorChange}
      options={{
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 14,
        wordWrap: 'on',
        scrollBeyondLastLine: false,
        // formatOnType: true,
      }}
    />
  );
}

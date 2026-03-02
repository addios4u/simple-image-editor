// Extension -> Webview messages
export type ExtToWebviewMessage =
  | { type: 'init'; body: { data: number[]; fileName: string; isUntitled: boolean } }
  | { type: 'update'; body: { edits: EditOperation[] } }
  | { type: 'getFileDataResponse'; requestId: string; body: number[] }
  | { type: 'aiGenerateResult'; body: { imageData?: string; error?: string } }
  | { type: 'triggerUndo' }
  | { type: 'triggerRedo' };

// Webview -> Extension messages
export type WebviewToExtMessage =
  | { type: 'ready' }
  | { type: 'edit'; body: EditOperation }
  | { type: 'getFileData'; requestId: string }
  | { type: 'requestSaveAs'; body: { format: string } }
  | { type: 'aiGenerate'; body: { prompt: string; provider: string; size: string } }
  | { type: 'aiConfigureKey'; body: { provider: string } };

export interface EditOperation {
  id: string;
  kind: string;
  data: unknown;
  timestamp: number;
}

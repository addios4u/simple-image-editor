// Extension -> Webview messages
export type ExtToWebviewMessage =
  | { type: 'init'; body: { data: number[]; fileName: string; isUntitled: boolean; oraData?: number[]; isOra?: boolean } }
  | { type: 'update'; body: { edits: EditOperation[] } }
  | { type: 'getFileData'; body: { requestId: string; format: string } }
  | { type: 'getOraData'; body: { requestId: string } }
  | { type: 'aiGenerateResult'; body: { imageData?: string; error?: string } }
  | { type: 'triggerUndo' }
  | { type: 'triggerRedo' }
  | { type: 'saved' };

// Webview -> Extension messages
export type WebviewToExtMessage =
  | { type: 'ready' }
  | { type: 'edit'; body: EditOperation }
  | { type: 'getFileDataResponse'; body: { requestId: string; data: number[]; error?: string } }
  | { type: 'getOraDataResponse'; body: { requestId: string; data: number[]; layerCount: number } }
  | { type: 'requestSaveAs'; body: { format: string } }
  | { type: 'aiGenerate'; body: { prompt: string; provider: string; size: string } }
  | { type: 'aiConfigureKey'; body: { provider: string; action: 'save' | 'remove'; key?: string } };

export interface EditOperation {
  id: string;
  kind: string;
  data: unknown;
  timestamp: number;
}

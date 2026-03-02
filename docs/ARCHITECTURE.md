# Architecture

## System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                      VSCode Extension Host                       │
│                      (TypeScript / Node.js)                      │
│                                                                  │
│  ┌──────────────────┐  ┌──────────┐  ┌────────────────────────┐ │
│  │ ImageEditor       │  │ Commands │  │ AIService              │ │
│  │ Provider          │  │          │  │                        │ │
│  │                   │  │ newImage │  │ OpenAI DALL-E API      │ │
│  │ openCustomDoc()   │  │          │  │ Google Imagen API      │ │
│  │ resolveEditor()   │  └──────────┘  │                        │ │
│  │ saveCustomDoc()   │                │ SecretStorage (API keys)│ │
│  └────────┬─────────┘                └──────────┬─────────────┘ │
│           │                                      │               │
│           │         postMessage / onMessage       │               │
└───────────┼──────────────────────────────────────┼───────────────┘
            │                                      │
            ▼                                      ▼
┌──────────────────────────────────────────────────────────────────┐
│                       Webview (React.js)                         │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                        App.tsx                               │ │
│  │                                                             │ │
│  │  mode === 'viewer' ? <ViewerMode /> : <EditorMode />        │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌──────────────────── EditorMode Layout ─────────────────────┐ │
│  │                                                             │ │
│  │  ┌─────────────────────────────────────────────────────┐   │ │
│  │  │                   Toolbar                            │   │ │
│  │  │  [Select][Marquee][Brush][Text][Zoom] [Undo][Redo]  │   │ │
│  │  └─────────────────────────────────────────────────────┘   │ │
│  │                                                             │ │
│  │  ┌───────────────────────────┐  ┌───────────────────────┐ │ │
│  │  │                           │  │    SidebarTabs         │ │ │
│  │  │       Canvas              │  │                       │ │ │
│  │  │                           │  │  [Layers][Props][AI]  │ │ │
│  │  │  ┌─────────────────────┐  │  │                       │ │ │
│  │  │  │  Image Canvas       │  │  │  ┌─────────────────┐ │ │ │
│  │  │  │  (putImageData)     │  │  │  │ Active Tab      │ │ │ │
│  │  │  └─────────────────────┘  │  │  │ Content         │ │ │ │
│  │  │  ┌─────────────────────┐  │  │  │                 │ │ │ │
│  │  │  │  Overlay Canvas     │  │  │  │ - LayerPanel    │ │ │ │
│  │  │  │  (selection, tools) │  │  │  │ - PropertyPanel │ │ │ │
│  │  │  └─────────────────────┘  │  │  │ - AIPanel       │ │ │ │
│  │  │                           │  │  └─────────────────┘ │ │ │
│  │  └───────────────────────────┘  └───────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌──────────── State (Zustand) ──────────────────────────────┐  │
│  │ editorStore  │ layerStore  │ historyStore  │ aiStore       │  │
│  └──────────────────────────────────────────────────────────────┘ │
│                          │                                       │
│                          │ wasm-bindgen                           │
│                          ▼                                       │
│  ┌──────────── WASM Bridge ──────────────────────────────────┐  │
│  │ wasmBridge.ts  │  renderLoop.ts  │  workerManager.ts      │  │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────────────┐
│                   Image Engine (Rust → WASM)                     │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐│
│  │ canvas   │  │ image_io │  │ layers   │  │ brush            ││
│  │          │  │          │  │          │  │                  ││
│  │ Pixel    │  │ decode() │  │ Layer    │  │ brush_stroke()   ││
│  │ Buffer   │  │ encode() │  │Compositor│  │ anti-alias       ││
│  │ (RGBA)   │  │ PNG/JPEG │  │ alpha    │  │ hardness         ││
│  │          │  │ GIF/SVG  │  │ blend    │  │                  ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘│
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐│
│  │ text     │  │ filters  │  │clipboard │  │ history          ││
│  │          │  │          │  │          │  │                  ││
│  │ render   │  │ gaussian │  │ copy()   │  │ capture_region() ││
│  │ _text()  │  │ box      │  │ cut()    │  │ restore_region() ││
│  │ fontdue  │  │ motion   │  │ paste()  │  │                  ││
│  │          │  │ blur     │  │          │  │                  ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘│
│  ┌──────────┐                                                    │
│  │selection │                                                    │
│  │          │                                                    │
│  │ region   │                                                    │
│  │ masking  │                                                    │
│  └──────────┘                                                    │
└──────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. 이미지 파일 열기

```
User clicks image.png in Explorer
  │
  ▼
VSCode calls imageEditorProvider.openCustomDocument(uri)
  │ vscode.workspace.fs.readFile(uri) → Uint8Array
  ▼
VSCode calls imageEditorProvider.resolveCustomEditor(document, webviewPanel)
  │ Creates webview HTML with React bundle
  ▼
Webview React mounts, calls initWasm(), posts { type: 'ready' }
  │
  ▼
Extension receives 'ready', posts { type: 'init', body: { data, fileName } }
  │
  ▼
Webview receives 'init'
  │ WASM decode_image(data) → PixelBuffer
  │ LayerCompositor.add_layer() → Background layer
  │ LayerCompositor.composite() → composited PixelBuffer
  │ getBufferAsImageData(composited) → ImageData
  │ ctx.putImageData(imageData) → Canvas renders
  ▼
User sees image in Viewer Mode
```

### 2. 브러시 스트로크

```
User drags with Brush tool on Canvas
  │
  ▼
Canvas.tsx: pointerdown/pointermove events
  │ screenToCanvas(clientX, clientY, zoom, pan) → canvasX, canvasY
  ▼
BrushTool.onPointerDown(event)
  │ historyStore: beforeSnapshot = capture_region(activeLayerBuffer, bbox)
  │
  ▼
BrushTool.onPointerMove(event)
  │ Interpolate points (Catmull-Rom)
  │ WASM brush_stroke(layerBuffer, points, color, size, hardness)
  │ Set compositeDirty = true
  │
  ▼
renderLoop (requestAnimationFrame)
  │ if (compositeDirty):
  │   composited = compositor.composite()
  │   imageData = getBufferAsImageData(composited)
  │   ctx.putImageData(imageData)
  │   compositeDirty = false
  │
  ▼
BrushTool.onPointerUp(event)
  │ historyStore: afterSnapshot = capture_region(activeLayerBuffer, bbox)
  │ historyStore.pushEdit({ before, after, region, layerId })
  │ postMessage({ type: 'edit', body: editOperation })
  │
  ▼
Extension: document.makeEdit(edit) → fires onDidChangeCustomDocument
  │ VSCode shows dirty indicator (dot on tab)
```

### 3. 저장 (Cmd+S)

```
User presses Cmd+S
  │
  ▼
VSCode calls imageEditorProvider.saveCustomDocument(document)
  │
  ├── Existing file:
  │     Extension posts { type: 'getFileData', requestId }
  │       │
  │       ▼
  │     Webview: compositor.composite() → WASM encode_image(buffer, format)
  │     Webview posts { type: 'getFileDataResponse', requestId, body: encoded }
  │       │
  │       ▼
  │     Extension: vscode.workspace.fs.writeFile(uri, data)
  │
  └── Untitled (new) file:
        Extension triggers saveAs flow
          │
          ▼
        Webview shows FormatDialog → user selects PNG/JPEG/GIF
          │
          ▼
        Extension: vscode.window.showSaveDialog() → user picks path
          │
          ▼
        Same encode + write flow
```

### 4. AI 이미지 생성

```
User types prompt in AI Panel, clicks Generate
  │
  ▼
AIPanel: postMessage({ type: 'aiGenerate', body: { prompt, provider, size } })
  │
  ▼
Extension: aiService.generateImage(prompt, provider, size)
  │ Reads API key from SecretStorage
  │ POST to OpenAI/Google API → receives base64 image
  │
  ▼
Extension posts { type: 'aiGenerateResult', body: { imageData } }
  │
  ▼
Webview: shows preview thumbnail
  │ User clicks "Apply"
  │
  ▼
WASM decode_image(base64Data) → PixelBuffer
  │ Resize to canvas/selection size
  │ layerStore.addLayer("AI Generated")
  │ Paste into new layer
  │ historyStore.pushEdit(...)
  │ compositeDirty = true → re-render
```

## Memory Architecture

### WASM Linear Memory

```
┌─────────────────────────────────────────────────────┐
│                 WASM Linear Memory                   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Layer 0 (Background) PixelBuffer            │   │
│  │ width * height * 4 bytes (RGBA)             │   │
│  │ ptr: 0x1000, len: 4,194,304 (1024x1024)    │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Layer 1 PixelBuffer                         │   │
│  │ Same dimensions                             │   │
│  │ ptr: 0x401000                               │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Composited Output PixelBuffer               │   │
│  │ (Result of flattening all layers)           │   │
│  │ ptr: 0x801000                               │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Clipboard Buffer (optional)                 │   │
│  │ Variable size                               │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Zero-Copy Rendering Pipeline

```
WASM Memory → JS Uint8ClampedArray view → ImageData → Canvas putImageData

wasmBridge.ts:
  const ptr = buffer.data_ptr();       // pointer into WASM memory
  const len = buffer.data_len();
  const pixels = new Uint8ClampedArray(wasmMemory.buffer, ptr, len);
  const imageData = new ImageData(pixels, width, height);
  ctx.putImageData(imageData, 0, 0);   // no copy needed
```

## State Management

### Zustand Stores

```
editorStore
  ├── mode: 'viewer' | 'editor'
  ├── activeTool: 'select' | 'marquee' | 'brush' | 'text' | 'zoom'
  ├── zoom: number
  ├── panOffset: { x, y }
  ├── canvasSize: { width, height }
  ├── fileName: string
  ├── isUntitled: boolean
  ├── isDirty: boolean
  ├── fillColor: RGBA
  ├── strokeColor: RGBA
  └── strokeWidth: number

layerStore
  ├── layers: Layer[]
  │     ├── id: string
  │     ├── name: string
  │     ├── visible: boolean
  │     ├── opacity: number (0-1)
  │     ├── locked: boolean
  │     └── bufferIndex: number (WASM layer index)
  ├── activeLayerId: string
  └── selection: { x, y, width, height } | null

historyStore
  ├── undoStack: EditCommand[] (max 50)
  ├── redoStack: EditCommand[]
  └── EditCommand:
        ├── id, label, timestamp
        ├── layerId
        ├── region: { x, y, w, h }
        ├── beforeData: Uint8Array
        └── afterData: Uint8Array

aiStore
  ├── provider: 'openai' | 'google'
  ├── isGenerating: boolean
  ├── generatedPreview: Uint8Array | null
  └── recentPrompts: { prompt, timestamp }[]
```

## Extension ↔ Webview Protocol

### Extension → Webview

| Type | Payload | When |
|------|---------|------|
| `init` | `{ data: number[], fileName, isUntitled }` | 파일 열기 직후 |
| `update` | `{ edits: EditOperation[] }` | 외부 변경 반영 |
| `getFileDataResponse` | `{ requestId, body: number[] }` | 저장 데이터 응답 |
| `aiGenerateResult` | `{ imageData: string, error?: string }` | AI 생성 결과 |
| `triggerUndo` / `triggerRedo` | - | VSCode Cmd+Z/Shift+Z |

### Webview → Extension

| Type | Payload | When |
|------|---------|------|
| `ready` | - | WASM 초기화 완료 |
| `edit` | `{ id, kind, data }` | 편집 작업 발생 |
| `getFileData` | `{ requestId }` | 저장 요청 |
| `requestSaveAs` | `{ format }` | 형식 변환 저장 |
| `aiGenerate` | `{ prompt, provider, size }` | AI 이미지 생성 요청 |
| `aiConfigureKey` | `{ provider }` | API 키 설정 요청 |

## Build Pipeline

```
Source Code
  │
  ├── src/engine/ (Rust)
  │     │
  │     └── wasm-pack build --target web --out-dir ../../dist/wasm
  │           │
  │           └── dist/wasm/
  │                 ├── image_engine_bg.wasm
  │                 ├── image_engine.js
  │                 └── image_engine.d.ts
  │
  ├── src/extension/ (TypeScript)
  │     │
  │     └── webpack (target: node, commonjs2)
  │           │
  │           └── dist/extension/extension.js
  │
  └── src/webview/ (React + TypeScript)
        │
        └── webpack (target: web, imports WASM)
              │
              └── dist/webview/
                    ├── webview.js
                    └── *.wasm (copied)

Final Output: dist/
  ├── extension/extension.js    (Extension Host entry)
  ├── webview/webview.js        (Webview bundle)
  └── wasm/                     (WASM module)
```

## Security

### Content Security Policy (Webview)

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'none';
  script-src 'nonce-${nonce}' 'wasm-unsafe-eval';
  style-src ${webview.cspSource} 'unsafe-inline';
  img-src ${webview.cspSource} blob: data:;
  font-src ${webview.cspSource};
">
```

### API Key Security
- API 키는 Extension Host의 `context.secrets` (SecretStorage)에 저장
- Webview에 API 키를 절대 전달하지 않음
- 모든 AI API 호출은 Extension Host에서 수행
- Webview → Extension 메시지에는 프롬프트와 설정만 포함

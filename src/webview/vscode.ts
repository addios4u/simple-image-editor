/** Minimal type for the VSCode webview API */
interface WebviewApi<T = unknown> {
    postMessage(message: unknown): void;
    getState(): T | undefined;
    setState<S extends T>(state: S): S;
}

declare function acquireVsCodeApi<T = unknown>(): WebviewApi<T>;

const vscodeApi = acquireVsCodeApi();
export default vscodeApi;

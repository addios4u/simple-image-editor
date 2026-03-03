import * as vscode from 'vscode';
import { EditOperation } from './protocol';

export class ImageDocument implements vscode.CustomDocument {
    private readonly _uri: vscode.Uri;
    private _data: Uint8Array;
    private _edits: EditOperation[] = [];

    constructor(uri: vscode.Uri, data: Uint8Array) {
        this._uri = uri;
        this._data = data;
    }

    public get uri(): vscode.Uri {
        return this._uri;
    }

    public get edits(): readonly EditOperation[] {
        return this._edits;
    }

    public get isDirty(): boolean {
        return this._edits.length > 0;
    }

    public applyEdit(edit: EditOperation): void {
        this._edits.push(edit);
    }

    public clearEdits(): void {
        this._edits = [];
    }

    public getData(): Uint8Array {
        return this._data;
    }

    public setData(data: Uint8Array): void {
        this._data = data;
    }

    public dispose(): void {
        // Clean up resources
    }
}

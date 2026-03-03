import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module
vi.mock('vscode', () => ({
    Uri: {
        parse: (str: string) => ({ scheme: 'file', path: str, toString: () => str }),
        file: (path: string) => ({ scheme: 'file', path, toString: () => `file://${path}` }),
    },
    Disposable: {
        from: vi.fn(),
    },
}));

import { ImageDocument } from '../imageDocument';

describe('ImageDocument', () => {
    const mockUri = { scheme: 'file', path: '/test/image.png', toString: () => 'file:///test/image.png' } as any;
    const mockData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG header bytes

    let document: ImageDocument;

    beforeEach(() => {
        document = new ImageDocument(mockUri, mockData);
    });

    it('should create with URI and data', () => {
        expect(document.uri).toBe(mockUri);
    });

    it('should have initial state: not dirty', () => {
        expect(document.isDirty).toBe(false);
    });

    it('should have initial state: empty edits array', () => {
        expect(document.edits).toEqual([]);
    });

    it('should apply edits and track them', () => {
        const edit = {
            id: 'edit-1',
            kind: 'brush',
            data: { x: 10, y: 20 },
            timestamp: Date.now(),
        };

        document.applyEdit(edit);

        expect(document.edits).toHaveLength(1);
        expect(document.edits[0]).toEqual(edit);
    });

    it('should become dirty after applying an edit', () => {
        const edit = {
            id: 'edit-1',
            kind: 'brush',
            data: { x: 10, y: 20 },
            timestamp: Date.now(),
        };

        document.applyEdit(edit);

        expect(document.isDirty).toBe(true);
    });

    it('should track multiple edits', () => {
        const edit1 = { id: 'edit-1', kind: 'brush', data: {}, timestamp: 1 };
        const edit2 = { id: 'edit-2', kind: 'filter', data: {}, timestamp: 2 };

        document.applyEdit(edit1);
        document.applyEdit(edit2);

        expect(document.edits).toHaveLength(2);
        expect(document.edits[0].id).toBe('edit-1');
        expect(document.edits[1].id).toBe('edit-2');
    });

    it('should return file data via getData()', () => {
        const data = document.getData();
        expect(data).toBeInstanceOf(Uint8Array);
        expect(data).toEqual(mockData);
    });

    it('should update data via setData()', () => {
        const newData = new Uint8Array([0xFF, 0xD8, 0xFF]); // JPEG header
        document.setData(newData);
        expect(document.getData()).toEqual(newData);
    });

    it('should clear edits and become not dirty', () => {
        document.applyEdit({ id: 'e1', kind: 'brush', data: {}, timestamp: 1 });
        expect(document.isDirty).toBe(true);

        document.clearEdits();
        expect(document.isDirty).toBe(false);
        expect(document.edits).toEqual([]);
    });

    it('should implement dispose without throwing', () => {
        expect(() => document.dispose()).not.toThrow();
    });
});

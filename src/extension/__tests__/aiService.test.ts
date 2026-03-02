import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted so mocks are available when vi.mock factory runs
const { mockStore, mockRetrieve, mockDelete } = vi.hoisted(() => ({
    mockStore: vi.fn(),
    mockRetrieve: vi.fn(),
    mockDelete: vi.fn(),
}));

vi.mock('vscode', () => ({
    workspace: {
        getConfiguration: () => ({
            get: (key: string) => {
                if (key === 'openaiModel') return 'dall-e-3';
                if (key === 'googleModel') return 'imagen-3.0-generate-001';
                return undefined;
            },
        }),
    },
}));

import { createAIService, AIService } from '../aiService';

describe('aiService', () => {
    let mockSecrets: { store: typeof mockStore; get: typeof mockRetrieve; delete: typeof mockDelete };
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
        vi.clearAllMocks();
        mockSecrets = {
            store: mockStore,
            get: mockRetrieve,
            delete: mockDelete,
        };
        originalFetch = globalThis.fetch;
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('createAIService returns a service object', () => {
        const service = createAIService('openai', mockSecrets as any);
        expect(service).toBeDefined();
        expect(typeof service.generateImage).toBe('function');
        expect(typeof service.setApiKey).toBe('function');
        expect(typeof service.getApiKey).toBe('function');
        expect(typeof service.deleteApiKey).toBe('function');
    });

    it('generateImage with openai provider constructs correct API call', async () => {
        mockRetrieve.mockResolvedValue('test-openai-key');

        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: [{ b64_json: 'base64ImageDataHere' }],
            }),
        });
        globalThis.fetch = mockFetch;

        const service = createAIService('openai', mockSecrets as any);
        await service.generateImage('a cat in space', '1024x1024');

        expect(mockFetch).toHaveBeenCalledWith(
            'https://api.openai.com/v1/images/generations',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer test-openai-key',
                }),
                body: expect.any(String),
            })
        );

        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.prompt).toBe('a cat in space');
        expect(body.size).toBe('1024x1024');
        expect(body.response_format).toBe('b64_json');
        expect(body.model).toBe('dall-e-3');
    });

    it('generateImage with google provider constructs correct API call', async () => {
        mockRetrieve.mockResolvedValue('test-google-key');

        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                predictions: [{ bytesBase64Encoded: 'googleBase64Data' }],
            }),
        });
        globalThis.fetch = mockFetch;

        const service = createAIService('google', mockSecrets as any);
        await service.generateImage('a sunset over mountains', '1024x1024');

        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('generativelanguage.googleapis.com'),
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'Content-Type': 'application/json',
                }),
            })
        );

        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.prompt).toBe('a sunset over mountains');
    });

    it('generateImage without API key throws descriptive error', async () => {
        mockRetrieve.mockResolvedValue(undefined);

        const service = createAIService('openai', mockSecrets as any);
        await expect(service.generateImage('test prompt', '1024x1024'))
            .rejects.toThrow('No API key configured for openai');
    });

    it('generateImage handles API error response gracefully', async () => {
        mockRetrieve.mockResolvedValue('test-key');

        const mockFetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 401,
            json: async () => ({
                error: { message: 'Invalid API key' },
            }),
        });
        globalThis.fetch = mockFetch;

        const service = createAIService('openai', mockSecrets as any);
        await expect(service.generateImage('test', '1024x1024'))
            .rejects.toThrow('Invalid API key');
    });

    it('generateImage returns base64 image data on success', async () => {
        mockRetrieve.mockResolvedValue('test-key');

        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: [{ b64_json: 'successBase64Data' }],
            }),
        });
        globalThis.fetch = mockFetch;

        const service = createAIService('openai', mockSecrets as any);
        const result = await service.generateImage('a dog', '512x512');
        expect(result).toBe('successBase64Data');
    });

    it('setApiKey stores key in SecretStorage', async () => {
        mockStore.mockResolvedValue(undefined);

        const service = createAIService('openai', mockSecrets as any);
        await service.setApiKey('my-secret-key');

        expect(mockStore).toHaveBeenCalledWith(
            'simpleImageEditor.openai.apiKey',
            'my-secret-key'
        );
    });

    it('getApiKey retrieves key from SecretStorage', async () => {
        mockRetrieve.mockResolvedValue('stored-key');

        const service = createAIService('openai', mockSecrets as any);
        const key = await service.getApiKey();

        expect(mockRetrieve).toHaveBeenCalledWith('simpleImageEditor.openai.apiKey');
        expect(key).toBe('stored-key');
    });

    it('deleteApiKey removes key from SecretStorage', async () => {
        mockDelete.mockResolvedValue(undefined);

        const service = createAIService('openai', mockSecrets as any);
        await service.deleteApiKey();

        expect(mockDelete).toHaveBeenCalledWith('simpleImageEditor.openai.apiKey');
    });

    it('google provider uses correct SecretStorage key', async () => {
        mockStore.mockResolvedValue(undefined);
        mockRetrieve.mockResolvedValue('google-key');

        const service = createAIService('google', mockSecrets as any);
        await service.setApiKey('my-google-key');
        await service.getApiKey();

        expect(mockStore).toHaveBeenCalledWith(
            'simpleImageEditor.google.apiKey',
            'my-google-key'
        );
        expect(mockRetrieve).toHaveBeenCalledWith('simpleImageEditor.google.apiKey');
    });

    it('generateImage handles network errors gracefully', async () => {
        mockRetrieve.mockResolvedValue('test-key');

        const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
        globalThis.fetch = mockFetch;

        const service = createAIService('openai', mockSecrets as any);
        await expect(service.generateImage('test', '1024x1024'))
            .rejects.toThrow('Network error');
    });
});

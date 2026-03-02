import * as vscode from 'vscode';

export interface AIService {
    generateImage(prompt: string, size: string): Promise<string>;
    setApiKey(key: string): Promise<void>;
    getApiKey(): Promise<string | undefined>;
    deleteApiKey(): Promise<void>;
}

export function createAIService(
    provider: 'openai' | 'google',
    secrets: vscode.SecretStorage
): AIService {
    const secretKey = `simpleImageEditor.${provider}.apiKey`;

    return {
        async generateImage(prompt: string, size: string): Promise<string> {
            const apiKey = await secrets.get(secretKey);
            if (!apiKey) {
                throw new Error(`No API key configured for ${provider}`);
            }

            if (provider === 'openai') {
                return generateOpenAI(apiKey, prompt, size);
            } else {
                return generateGoogle(apiKey, prompt, size);
            }
        },

        async setApiKey(key: string): Promise<void> {
            await secrets.store(secretKey, key);
        },

        async getApiKey(): Promise<string | undefined> {
            return secrets.get(secretKey);
        },

        async deleteApiKey(): Promise<void> {
            await secrets.delete(secretKey);
        },
    };
}

async function generateOpenAI(apiKey: string, prompt: string, size: string): Promise<string> {
    const config = vscode.workspace.getConfiguration('simpleImageEditor.ai');
    const model = config.get<string>('openaiModel') || 'dall-e-3';

    const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            prompt,
            size,
            response_format: 'b64_json',
            n: 1,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json() as any;
        throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json() as any;
    return data.data[0].b64_json;
}

async function generateGoogle(apiKey: string, prompt: string, size: string): Promise<string> {
    const config = vscode.workspace.getConfiguration('simpleImageEditor.ai');
    const model = config.get<string>('googleModel') || 'imagen-3.0-generate-001';

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            prompt,
            size,
            sampleCount: 1,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json() as any;
        throw new Error(errorData.error?.message || `Google API error: ${response.status}`);
    }

    const data = await response.json() as any;
    return data.predictions[0].bytesBase64Encoded;
}

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so mocks are available when vi.mock factory runs (hoisted to top)
const { mockRegisterCommand, mockShowInputBox, mockShowInformationMessage, mockExecuteCommand } = vi.hoisted(() => ({
    mockRegisterCommand: vi.fn(),
    mockShowInputBox: vi.fn(),
    mockShowInformationMessage: vi.fn(),
    mockExecuteCommand: vi.fn(),
}));

vi.mock('vscode', () => ({
    commands: {
        registerCommand: mockRegisterCommand,
        executeCommand: mockExecuteCommand,
    },
    window: {
        showInputBox: mockShowInputBox,
        showInformationMessage: mockShowInformationMessage,
    },
    Uri: {
        parse: (str: string) => ({ scheme: 'file', path: str, toString: () => str }),
    },
}));

import { registerCommands } from '../commands';

describe('registerCommands', () => {
    const mockContext = {
        subscriptions: [] as any[],
    } as any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockContext.subscriptions = [];
        mockRegisterCommand.mockReturnValue({ dispose: vi.fn() });
    });

    it('should register the newImage command', () => {
        registerCommands(mockContext);

        const registeredCommands = mockRegisterCommand.mock.calls.map(
            (call: any[]) => call[0]
        );
        expect(registeredCommands).toContain('simpleImageEditor.newImage');
    });

    it('should register the configureAI command', () => {
        registerCommands(mockContext);

        const registeredCommands = mockRegisterCommand.mock.calls.map(
            (call: any[]) => call[0]
        );
        expect(registeredCommands).toContain('simpleImageEditor.configureAI');
    });

    it('should push disposables to context.subscriptions', () => {
        registerCommands(mockContext);

        expect(mockContext.subscriptions.length).toBeGreaterThanOrEqual(2);
    });
});

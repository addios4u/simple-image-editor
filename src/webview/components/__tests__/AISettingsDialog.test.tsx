import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import AISettingsDialog from '../AISettingsDialog';

describe('AISettingsDialog', () => {
  const mockOnSave = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnRemove = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog with "AI Settings" header', () => {
    render(
      <AISettingsDialog
        provider="openai"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        onRemove={mockOnRemove}
      />
    );
    expect(screen.getByText('AI Settings')).toBeInTheDocument();
  });

  it('displays provider name', () => {
    render(
      <AISettingsDialog
        provider="openai"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        onRemove={mockOnRemove}
      />
    );
    expect(screen.getByText('OpenAI DALL-E')).toBeInTheDocument();
  });

  it('renders API key input with password type', () => {
    render(
      <AISettingsDialog
        provider="openai"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        onRemove={mockOnRemove}
      />
    );
    const input = screen.getByTestId('ai-api-key-input');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'password');
  });

  it('eye toggle switches input type between password and text', () => {
    render(
      <AISettingsDialog
        provider="openai"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        onRemove={mockOnRemove}
      />
    );
    const input = screen.getByTestId('ai-api-key-input');
    expect(input).toHaveAttribute('type', 'password');

    const eyeBtn = screen.getByRole('button', { name: /show key/i });
    fireEvent.click(eyeBtn);
    expect(input).toHaveAttribute('type', 'text');
  });

  it('shows SecretStorage hint text', () => {
    render(
      <AISettingsDialog
        provider="openai"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        onRemove={mockOnRemove}
      />
    );
    expect(screen.getByText(/SecretStorage/)).toBeInTheDocument();
  });

  it('Save button calls onSave with key value', () => {
    render(
      <AISettingsDialog
        provider="openai"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        onRemove={mockOnRemove}
      />
    );
    const input = screen.getByTestId('ai-api-key-input');
    fireEvent.change(input, { target: { value: 'sk-test-key-123' } });

    const saveBtn = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveBtn);

    expect(mockOnSave).toHaveBeenCalledWith('sk-test-key-123');
  });

  it('Cancel button calls onCancel', () => {
    render(
      <AISettingsDialog
        provider="openai"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        onRemove={mockOnRemove}
      />
    );
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('Close button calls onCancel', () => {
    render(
      <AISettingsDialog
        provider="openai"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        onRemove={mockOnRemove}
      />
    );
    const closeBtn = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeBtn);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('renders "Remove Key" button', () => {
    render(
      <AISettingsDialog
        provider="openai"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        onRemove={mockOnRemove}
      />
    );
    expect(screen.getByRole('button', { name: /remove key/i })).toBeInTheDocument();
  });

  it('Remove Key button calls onRemove', () => {
    render(
      <AISettingsDialog
        provider="openai"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        onRemove={mockOnRemove}
      />
    );
    const removeBtn = screen.getByRole('button', { name: /remove key/i });
    fireEvent.click(removeBtn);

    expect(mockOnRemove).toHaveBeenCalled();
  });

  it('renders with google provider name', () => {
    render(
      <AISettingsDialog
        provider="google"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        onRemove={mockOnRemove}
      />
    );
    expect(screen.getByText('Google Imagen')).toBeInTheDocument();
  });
});

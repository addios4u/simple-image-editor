import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import FormatDialog from '../FormatDialog';

describe('FormatDialog', () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    mockOnConfirm.mockClear();
    mockOnCancel.mockClear();
  });

  it('renders format selection (PNG, JPEG, GIF)', () => {
    render(
      <FormatDialog isOpen={true} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />
    );
    expect(screen.getByLabelText(/png/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/jpeg/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/gif/i)).toBeInTheDocument();
  });

  it('PNG is selected by default', () => {
    render(
      <FormatDialog isOpen={true} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />
    );
    const pngRadio = screen.getByLabelText(/png/i) as HTMLInputElement;
    expect(pngRadio.checked).toBe(true);
  });

  it('selecting JPEG shows quality slider', () => {
    render(
      <FormatDialog isOpen={true} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />
    );
    const jpegRadio = screen.getByLabelText(/jpeg/i);
    fireEvent.click(jpegRadio);

    expect(screen.getByLabelText(/quality/i)).toBeInTheDocument();
  });

  it('quality slider range is 1-100, default 85', () => {
    render(
      <FormatDialog isOpen={true} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />
    );
    const jpegRadio = screen.getByLabelText(/jpeg/i);
    fireEvent.click(jpegRadio);

    const slider = screen.getByLabelText(/quality/i) as HTMLInputElement;
    expect(slider.min).toBe('1');
    expect(slider.max).toBe('100');
    expect(slider.value).toBe('85');
  });

  it('selecting PNG hides quality slider', () => {
    render(
      <FormatDialog isOpen={true} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />
    );

    // Select JPEG first to show slider
    fireEvent.click(screen.getByLabelText(/jpeg/i));
    expect(screen.getByLabelText(/quality/i)).toBeInTheDocument();

    // Switch back to PNG
    fireEvent.click(screen.getByLabelText(/png/i));
    expect(screen.queryByLabelText(/quality/i)).not.toBeInTheDocument();
  });

  it('Save button calls onConfirm with selected format and quality', () => {
    render(
      <FormatDialog isOpen={true} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />
    );

    // Select JPEG and adjust quality
    fireEvent.click(screen.getByLabelText(/jpeg/i));
    const slider = screen.getByLabelText(/quality/i) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '72' } });

    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(mockOnConfirm).toHaveBeenCalledWith('jpeg', 72);
  });

  it('Save button sends default quality for PNG', () => {
    render(
      <FormatDialog isOpen={true} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />
    );

    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(mockOnConfirm).toHaveBeenCalledWith('png', 85);
  });

  it('Cancel button calls onCancel', () => {
    render(
      <FormatDialog isOpen={true} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />
    );
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('renders file size estimate section', () => {
    render(
      <FormatDialog isOpen={true} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />
    );
    expect(screen.getByText(/file size estimate/i)).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(
      <FormatDialog isOpen={false} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />
    );
    expect(screen.queryByLabelText(/png/i)).not.toBeInTheDocument();
  });

  it('uses defaultFormat when provided', () => {
    render(
      <FormatDialog
        isOpen={true}
        defaultFormat="jpeg"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );
    const jpegRadio = screen.getByLabelText(/jpeg/i) as HTMLInputElement;
    expect(jpegRadio.checked).toBe(true);
    expect(screen.getByLabelText(/quality/i)).toBeInTheDocument();
  });
});

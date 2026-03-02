import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import EditorMode from '../EditorMode';
import { useEditorStore } from '../../state/editorStore';

describe('EditorMode', () => {
  beforeEach(() => {
    useEditorStore.setState({
      mode: 'editor',
      activeTool: 'select',
      zoom: 1,
      panX: 0,
      panY: 0,
      fillColor: '#000000',
      strokeColor: '#000000',
      canvasWidth: 800,
      canvasHeight: 600,
      activeTab: 'layers',
    });
  });

  it('renders Toolbar component', () => {
    render(<EditorMode />);
    const toolbar = screen.getByTestId('toolbar');
    expect(toolbar).toBeInTheDocument();
  });

  it('renders Canvas component', () => {
    render(<EditorMode />);
    const canvas = screen.getByTestId('editor-canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('renders SidebarTabs component', () => {
    render(<EditorMode />);
    const sidebar = screen.getByTestId('sidebar-tabs');
    expect(sidebar).toBeInTheDocument();
  });

  it('has correct editor layout class', () => {
    const { container } = render(<EditorMode />);
    const editorRoot = container.firstChild as HTMLElement;
    expect(editorRoot.className).toContain('editor-mode');
  });
});

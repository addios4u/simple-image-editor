import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import SidebarTabs from '../SidebarTabs';
import { useEditorStore } from '../../state/editorStore';

describe('SidebarTabs', () => {
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

  it('renders three tabs: Layers, Properties, AI', () => {
    render(<SidebarTabs />);
    expect(screen.getByRole('tab', { name: /layers/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /properties/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /ai/i })).toBeInTheDocument();
  });

  it('default active tab is Layers', () => {
    render(<SidebarTabs />);
    const layersTab = screen.getByRole('tab', { name: /layers/i });
    expect(layersTab.getAttribute('aria-selected')).toBe('true');
  });

  it('clicking tab switches content', () => {
    render(<SidebarTabs />);
    const propertiesTab = screen.getByRole('tab', { name: /properties/i });

    fireEvent.click(propertiesTab);
    expect(propertiesTab.getAttribute('aria-selected')).toBe('true');

    const layersTab = screen.getByRole('tab', { name: /layers/i });
    expect(layersTab.getAttribute('aria-selected')).toBe('false');
  });

  it('each tab renders its panel component', () => {
    render(<SidebarTabs />);

    // Default is Layers tab
    expect(screen.getByTestId('layer-panel')).toBeInTheDocument();

    // Switch to Properties
    fireEvent.click(screen.getByRole('tab', { name: /properties/i }));
    expect(screen.getByTestId('property-panel')).toBeInTheDocument();

    // Switch to AI
    fireEvent.click(screen.getByRole('tab', { name: /ai/i }));
    expect(screen.getByTestId('ai-panel')).toBeInTheDocument();
  });
});

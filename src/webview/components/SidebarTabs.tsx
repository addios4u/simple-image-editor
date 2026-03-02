import React from 'react';
import { useEditorStore, type SidebarTab } from '../state/editorStore';
import LayerPanel from './LayerPanel';
import PropertyPanel from './PropertyPanel';
import AIPanel from './AIPanel';

interface TabDef {
  id: SidebarTab;
  label: string;
}

const tabs: TabDef[] = [
  { id: 'layers', label: 'Layers' },
  { id: 'properties', label: 'Properties' },
  { id: 'ai', label: 'AI' },
];

const panelMap: Record<SidebarTab, React.FC> = {
  layers: LayerPanel,
  properties: PropertyPanel,
  ai: AIPanel,
};

const SidebarTabs: React.FC = () => {
  const activeTab = useEditorStore((s) => s.activeTab);
  const setActiveTab = useEditorStore((s) => s.setActiveTab);
  const ActivePanel = panelMap[activeTab];

  return (
    <div className="editor-sidebar" data-testid="sidebar-tabs">
      <div className="sidebar-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`sidebar-tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="sidebar-content">
        <ActivePanel />
      </div>
    </div>
  );
};

export default SidebarTabs;

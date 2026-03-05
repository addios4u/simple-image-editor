import React from 'react';
import { useEditorStore, type SidebarTab } from '../state/editorStore';
import LayerPanel from './LayerPanel';
import HistoryPanel from './HistoryPanel';
import AIPanel from './AIPanel';
import { t } from '../i18n';

interface TabDef {
  id: SidebarTab;
  label: string;
}

function getTabs(): TabDef[] {
  return [
    { id: 'layers', label: t('Layers') },
    { id: 'history', label: t('History') },
    { id: 'ai', label: t('AI') },
  ];
}

const panelMap: Record<SidebarTab, React.FC> = {
  layers: LayerPanel,
  history: HistoryPanel,
  ai: AIPanel,
};

const SidebarTabs: React.FC = () => {
  const activeTab = useEditorStore((s) => s.activeTab);
  const setActiveTab = useEditorStore((s) => s.setActiveTab);
  const ActivePanel = panelMap[activeTab];

  return (
    <div className="editor-sidebar" data-testid="sidebar-tabs">
      <div className="sidebar-tabs" role="tablist">
        {getTabs().map((tab) => (
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

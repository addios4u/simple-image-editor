import React from 'react';
import Toolbar from './Toolbar';
import Canvas from './Canvas';
import SidebarTabs from './SidebarTabs';

const EditorMode: React.FC = () => {
  return (
    <>
      <Toolbar />
      <div className="toolbar-divider" />
      <div className="editor-layout">
        <div className="editor-canvas-area">
          <Canvas />
        </div>
        <div className="sidebar-divider" />
        <SidebarTabs />
      </div>
    </>
  );
};

export default EditorMode;

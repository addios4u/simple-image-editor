import React, { useEffect, useRef } from 'react';
import FilterDialog, { type FilterType } from './FilterDialog';
import { t } from '../i18n';

interface FilterMenuProps {
  onClose: () => void;
}

function getFilters(): { type: FilterType; label: string; description: string }[] {
  return [
    { type: 'gaussian', label: t('Gaussian Blur'), description: t('Soft blur effect') },
    { type: 'motion', label: t('Motion Blur'), description: t('Directional blur effect') },
  ];
}

const FilterMenu: React.FC<FilterMenuProps> = ({ onClose }) => {
  const [activeFilter, setActiveFilter] = React.useState<FilterType | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  if (activeFilter) {
    return (
      <FilterDialog
        filterType={activeFilter}
        onClose={() => {
          setActiveFilter(null);
          onClose();
        }}
      />
    );
  }

  return (
    <div ref={menuRef} style={menuStyle} data-testid="filter-menu">
      {getFilters().map((f) => (
        <button
          key={f.type}
          style={menuItemStyle}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#3a3a3a')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          onClick={() => setActiveFilter(f.type)}
          data-testid={`filter-btn-${f.type}`}
        >
          <span style={{ fontWeight: 500, color: '#eee' }}>{f.label}</span>
          <span style={{ fontSize: 10, color: '#888', marginTop: 1 }}>{f.description}</span>
        </button>
      ))}
    </div>
  );
};

const menuStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  background: '#2d2d2d',
  border: '1px solid #555',
  borderRadius: 4,
  boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
  zIndex: 9000,
  minWidth: 160,
  padding: '4px 0',
};

const menuItemStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  width: '100%',
  padding: '7px 14px',
  background: 'transparent',
  border: 'none',
  color: '#ccc',
  fontSize: 12,
  fontFamily: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
  gap: 2,
  transition: 'background 0.1s',
};

export default FilterMenu;

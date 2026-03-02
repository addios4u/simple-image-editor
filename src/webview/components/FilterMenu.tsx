import React, { useState } from 'react';

type FilterType = 'gaussian' | 'box' | 'motion' | null;

interface FilterParams {
  sigma: string;
  radius: string;
  angle: string;
  distance: string;
}

const FilterMenu: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<FilterType>(null);
  const [params, setParams] = useState<FilterParams>({
    sigma: '1.0',
    radius: '3',
    angle: '0',
    distance: '5',
  });

  const handleApply = () => {
    // Will connect to WASM filter functions in integration phase
    setActiveFilter(null);
  };

  const handleCancel = () => {
    setActiveFilter(null);
  };

  const handleParamChange = (key: keyof FilterParams, value: string) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="filter-menu" data-testid="filter-menu">
      <h3>Filters</h3>
      <div className="filter-list">
        <button
          className="filter-btn"
          onClick={() => setActiveFilter('gaussian')}
        >
          Gaussian Blur
        </button>
        <button
          className="filter-btn"
          onClick={() => setActiveFilter('box')}
        >
          Box Blur
        </button>
        <button
          className="filter-btn"
          onClick={() => setActiveFilter('motion')}
        >
          Motion Blur
        </button>
      </div>

      {activeFilter === 'gaussian' && (
        <div className="filter-dialog" data-testid="filter-dialog">
          <h4>Gaussian Blur Settings</h4>
          <label>
            Sigma
            <input
              type="range"
              min="0.1"
              max="20"
              step="0.1"
              value={params.sigma}
              onChange={(e) => handleParamChange('sigma', e.target.value)}
              aria-label="Sigma"
            />
            <span>{params.sigma}</span>
          </label>
          <div className="filter-actions">
            <button className="filter-apply-btn" onClick={handleApply}>
              Apply
            </button>
            <button className="filter-cancel-btn" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {activeFilter === 'box' && (
        <div className="filter-dialog" data-testid="filter-dialog">
          <h4>Box Blur Settings</h4>
          <label>
            Radius
            <input
              type="range"
              min="1"
              max="50"
              step="1"
              value={params.radius}
              onChange={(e) => handleParamChange('radius', e.target.value)}
              aria-label="Radius"
            />
            <span>{params.radius}</span>
          </label>
          <div className="filter-actions">
            <button className="filter-apply-btn" onClick={handleApply}>
              Apply
            </button>
            <button className="filter-cancel-btn" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {activeFilter === 'motion' && (
        <div className="filter-dialog" data-testid="filter-dialog">
          <h4>Motion Blur Settings</h4>
          <label>
            Angle
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={params.angle}
              onChange={(e) => handleParamChange('angle', e.target.value)}
              aria-label="Angle"
            />
            <span>{params.angle}</span>
          </label>
          <label>
            Distance
            <input
              type="range"
              min="1"
              max="50"
              step="1"
              value={params.distance}
              onChange={(e) => handleParamChange('distance', e.target.value)}
              aria-label="Distance"
            />
            <span>{params.distance}</span>
          </label>
          <div className="filter-actions">
            <button className="filter-apply-btn" onClick={handleApply}>
              Apply
            </button>
            <button className="filter-cancel-btn" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterMenu;

import React from 'react';
import { Coffee } from 'lucide-react';
import vscodeApi from '../vscode';

const BuyMeACoffee: React.FC = () => {
  const handleClick = () => {
    vscodeApi.postMessage({ type: 'open-external', body: { url: 'https://buymeacoffee.com/addios4u' } });
  };

  return (
    <button className="bmc-banner" onClick={handleClick} title="Buy me a coffee">
      <Coffee size={14} />
      <span>Buy me a coffee</span>
    </button>
  );
};

export default BuyMeACoffee;

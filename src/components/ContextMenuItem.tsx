import React from 'react';

interface ContextMenuItemProps {
  onClick: () => void;
  children: React.ReactNode;
}

const ContextMenuItem: React.FC<ContextMenuItemProps> = ({ onClick, children }) => {
  return (
    <button
      onClick={onClick}
      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-500 hover:text-white"
    >
      {children}
    </button>
  );
};

export default ContextMenuItem;

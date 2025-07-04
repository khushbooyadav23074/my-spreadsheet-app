import React, { useEffect, useRef, useCallback } from 'react';

interface CellProps {
  row: number;
  col: number;
  // Removed 'value' prop as it's no longer directly used in Cell's rendering logic
  currentEditingValue: string; // The value currently being edited/typed
  isActive: boolean;
  isSelected: boolean;
  isEditing: boolean;
  columnWidth: number;
  onSelect: (row: number, col: number) => void;
  onDoubleClick: (row: number, col: number) => void;
  onBlur: (value: string) => void;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onContextMenu: (e: React.MouseEvent, row: number, col: number) => void;
  onMouseDown: () => void;
  onMouseMove: () => void;
  evaluatedValue: string; // The evaluated display value
}

const Cell: React.FC<CellProps> = ({
  row,
  col,
  // Removed 'value' from destructuring
  currentEditingValue,
  isActive,
  isSelected,
  isEditing,
  columnWidth,
  onSelect,
  onDoubleClick,
  onBlur,
  onChange,
  onKeyDown,
  onContextMenu,
  onMouseDown,
  onMouseMove,
  evaluatedValue,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = useCallback(() => {
    onSelect(row, col);
  }, [row, col, onSelect]);

  const handleDoubleClick = useCallback(() => {
    onDoubleClick(row, col);
  }, [row, col, onDoubleClick]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    onBlur(e.target.value);
  }, [onBlur]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    onContextMenu(e, row, col);
  }, [onContextMenu, row, col]);

  return (
    <div
      className={`
        flex items-center justify-start
        px-2 py-1 border border-gray-200 text-sm overflow-hidden whitespace-nowrap
        cursor-pointer select-none
        ${isActive ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50' : ''}
        ${isSelected && !isActive ? 'bg-blue-100 border-blue-300' : ''}
        ${!isActive && !isSelected ? 'hover:bg-gray-100' : ''}
      `}
      style={{ width: `${columnWidth}px`, height: '32px' }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      data-row={row}
      data-col={col}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={currentEditingValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={onKeyDown}
          className="w-full h-full p-0 m-0 border-none outline-none focus:ring-0 bg-transparent"
        />
      ) : (
        <span className="truncate">{evaluatedValue}</span>
      )}
    </div>
  );
};

export default Cell;
import React, { useRef, useEffect, useCallback } from 'react';
import Cell from './Cell';
import { SpreadsheetData } from '../lib/types';
import { columnNames } from '../lib/constants';
import { evaluateFormula } from '../lib/helpers';

interface SpreadsheetGridProps {
  data: SpreadsheetData;
  activeCell: { row: number; col: number } | null;
  editingCell: { row: number; col: number } | null;
  cellValue: string; // This is the value being edited in App.tsx
  selectionStart: { row: number; col: number } | null;
  selectionEnd: { row: number; col: number } | null;
  columnWidths: { [key: string]: number };
  hiddenColumns: string[];
  onSelectCell: (row: number, col: number) => void;
  onDoubleClickCell: (row: number, col: number) => void;
  onUpdateCell: (row: number, col: number, value: string) => void;
  onCellValueChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onMouseDownCell: (row: number, col: number) => void;
  onMouseMoveCell: (row: number, col: number) => void;
  onMouseUpCell: () => void;
  onColumnResizeStart: (e: React.MouseEvent, colIndex: number) => void;
  onContextMenu: (e: React.MouseEvent, type: 'cell' | 'column' | 'row', target: any) => void;
  filteredAndSortedData: SpreadsheetData;
}

const SpreadsheetGrid: React.FC<SpreadsheetGridProps> = ({
  data,
  activeCell,
  editingCell,
  cellValue, // Pass this down to Cell
  selectionStart,
  selectionEnd,
  columnWidths,
  hiddenColumns,
  onSelectCell,
  onDoubleClickCell,
  onUpdateCell,
  onCellValueChange,
  onKeyDown,
  onMouseDownCell,
  onMouseMoveCell,
  onMouseUpCell,
  onColumnResizeStart,
  onContextMenu,
  filteredAndSortedData,
}) => {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeCell && gridRef.current) {
      const cellElement = gridRef.current.querySelector(
        `[data-row="${activeCell.row}"][data-col="${activeCell.col}"]`
      ) as HTMLElement;
      if (cellElement) {
        cellElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }
  }, [activeCell]);

  const handleCellBlur = useCallback((value: string) => {
    if (editingCell) {
      onUpdateCell(editingCell.row, editingCell.col, value);
    }
  }, [editingCell, onUpdateCell]);

  const handleCellKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (editingCell) {
        onUpdateCell(editingCell.row, editingCell.col, cellValue);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (editingCell) {
        onUpdateCell(editingCell.row, editingCell.col, data[editingCell.row][columnNames[editingCell.col]]);
      }
    }
  }, [editingCell, cellValue, onUpdateCell, data]);

  const isCellSelected = useCallback((row: number, col: number) => {
    if (!selectionStart || !selectionEnd) return false;

    const minRow = Math.min(selectionStart.row, selectionEnd.row);
    const maxRow = Math.max(selectionStart.row, selectionEnd.row);
    const minCol = Math.min(selectionStart.col, selectionEnd.col);
    const maxCol = Math.max(selectionStart.col, selectionEnd.col);

    return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
  }, [selectionStart, selectionEnd]);

  const visibleColumnNames = columnNames.filter(name => !hiddenColumns.includes(name));

  return (
    <div
      ref={gridRef}
      className="overflow-auto flex-grow bg-white border border-gray-200 rounded-md shadow-inner relative"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseUp={onMouseUpCell}
      onMouseLeave={onMouseUpCell}
      style={{ minHeight: '300px' }}
    >
      <div className="inline-flex flex-col">
        {/* Column Headers */}
        <div className="flex bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
          <div className="w-12 h-8 flex items-center justify-center text-xs font-semibold text-gray-500 border-r border-gray-200"></div>
          {visibleColumnNames.map((colName) => {
            const originalColIndex = columnNames.indexOf(colName);
            return (
              <div
                key={colName}
                className="relative flex items-center justify-center text-xs font-semibold text-gray-500 border-r border-gray-200"
                style={{ width: `${columnWidths[colName] || 100}px`, height: '32px' }}
                onContextMenu={(e) => onContextMenu(e, 'column', { colName, colIndex: originalColIndex })}
              >
                {colName}
                <div
                  className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-300 transition-colors duration-100"
                  onMouseDown={(e) => onColumnResizeStart(e, originalColIndex)}
                />
              </div>
            );
          })}
        </div>

        {/* Rows */}
        {filteredAndSortedData.map((row, rowIndex) => (
          <div key={rowIndex} className="flex">
            {/* Row Number */}
            <div
              className="w-12 h-8 flex items-center justify-center text-xs font-semibold text-gray-500 border-r border-gray-200 bg-gray-50 sticky left-0 z-10"
              onContextMenu={(e) => onContextMenu(e, 'row', { rowIndex })}
            >
              {rowIndex + 1}
            </div>
            {/* Cells */}
            {visibleColumnNames.map((colName) => {
              const originalColIndex = columnNames.indexOf(colName);
              const cellVal = row[colName];
              return (
                <Cell
                  key={`${rowIndex}-${originalColIndex}`}
                  row={rowIndex}
                  col={originalColIndex}
                  // Removed 'value' prop here
                  currentEditingValue={editingCell?.row === rowIndex && editingCell?.col === originalColIndex ? cellValue : cellVal}
                  isActive={activeCell?.row === rowIndex && activeCell?.col === originalColIndex}
                  isSelected={isCellSelected(rowIndex, originalColIndex)}
                  isEditing={editingCell?.row === rowIndex && editingCell?.col === originalColIndex}
                  columnWidth={columnWidths[colName] || 100}
                  onSelect={onSelectCell}
                  onDoubleClick={onDoubleClickCell}
                  onBlur={handleCellBlur}
                  onChange={onCellValueChange}
                  onKeyDown={handleCellKeyDown}
                  onContextMenu={(e) => onContextMenu(e, 'cell', { row: rowIndex, col: originalColIndex })}
                  onMouseDown={() => onMouseDownCell(rowIndex, originalColIndex)}
                  onMouseMove={() => onMouseMoveCell(rowIndex, originalColIndex)}
                  evaluatedValue={evaluateFormula(cellVal, data)}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SpreadsheetGrid;

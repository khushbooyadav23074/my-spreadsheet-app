import React, { useState } from 'react';
import SpreadsheetGrid from './SpreadsheetGrid';
import { SpreadsheetData } from '../lib/types';
import { columnNames } from '../lib/constants';

interface SpreadsheetViewProps {
  data: SpreadsheetData;
  activeCell: { row: number; col: number } | null;
  editingCell: { row: number; col: number } | null;
  cellValue: string; // This is the value being edited or selected from App.tsx
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
  onAddRow: () => void;
  onApplyFilter: (colName: string, filterValue: string) => void;
  onClearFilter: () => void;
  onApplySort: (colName: string, direction: 'asc' | 'desc') => void;
  currentSort: { colName: string; direction: 'asc' | 'desc' } | null;
  filteredAndSortedData: SpreadsheetData;
}

const SpreadsheetView: React.FC<SpreadsheetViewProps> = ({
  data,
  activeCell,
  editingCell,
  cellValue,
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
  onAddRow,
  onApplyFilter,
  onClearFilter,
  onApplySort,
  currentSort,
  filteredAndSortedData,
}) => {
  const handleButtonClick = (action: string) => {
    console.log(`${action} button clicked!`);
  };

  const formulaBarValue = cellValue;

  const [filterInput, setFilterInput] = useState<string>('');
  const [filterCol, setFilterCol] = useState<string>('');

  const handleFilterApply = () => {
    console.log('SpreadsheetView: Attempting to apply filter.', { filterCol, filterInput });
    if (filterCol && filterInput) {
      onApplyFilter(filterCol, filterInput);
    } else {
      console.log('SpreadsheetView: Filter not applied. Column or input value is empty.');
    }
  };

  return (
    <div className="flex flex-col flex-grow p-6 bg-gray-50 rounded-lg shadow-md">
      {/* Spreadsheet Toolbar */}
      <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-md shadow-sm border border-gray-200">
        <div className="flex space-x-2">
          <button
            onClick={onAddRow}
            className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-150 ease-in-out shadow-sm"
          >
            Add Row
          </button>
          <div className="relative">
            <select
              className="px-4 py-2 bg-gray-200 text-gray-800 text-sm font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-opacity-50 transition duration-150 ease-in-out shadow-sm appearance-none pr-8"
              value={filterCol}
              onChange={(e) => setFilterCol(e.target.value)}
            >
              <option value="">Select Column for Filter</option>
              {columnNames.map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
            </div>
          </div>
          <input
            type="text"
            placeholder="Filter value..."
            value={filterInput}
            onChange={(e) => setFilterInput(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <button
            onClick={handleFilterApply}
            className="px-4 py-2 bg-gray-200 text-gray-800 text-sm font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-opacity-50 transition duration-150 ease-in-out shadow-sm"
          >
            Apply Filter
          </button>
          <button
            onClick={onClearFilter}
            className="px-4 py-2 bg-gray-200 text-gray-800 text-sm font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-opacity-50 transition duration-150 ease-in-out shadow-sm"
          >
            Clear Filter
          </button>
          <div className="relative">
            <select
              className="px-4 py-2 bg-gray-200 text-gray-800 text-sm font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-opacity-50 transition duration-150 ease-in-out shadow-sm appearance-none pr-8"
              value={currentSort ? `${currentSort.colName}-${currentSort.direction}` : ''}
              onChange={(e) => {
                const [col, dir] = e.target.value.split('-');
                if (col && dir) onApplySort(col, dir as 'asc' | 'desc');
                else onApplySort('', 'asc');
              }}
            >
              <option value="">Sort By...</option>
              {columnNames.map(col => (
                <React.Fragment key={col}>
                  <option value={`${col}-asc`}>{col} (A-Z)</option>
                  <option value={`${col}-desc`}>{col} (Z-A)</option>
                </React.Fragment>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
            </div>
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => handleButtonClick('Share')}
            className="px-4 py-2 bg-gray-200 text-gray-800 text-sm font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-opacity-50 transition duration-150 ease-in-out shadow-sm"
          >
            Share
          </button>
          <button
            onClick={() => handleButtonClick('Export')}
            className="px-4 py-2 bg-gray-200 text-gray-800 text-sm font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-opacity-50 transition duration-150 ease-in-out shadow-sm"
          >
            Export
          </button>
        </div>
      </div>

      {/* Formula Bar */}
      <div className="mb-4 bg-white p-2 rounded-md shadow-sm border border-gray-200 flex items-center">
        <span className="text-gray-500 text-sm font-semibold mr-2">fx</span>
        <input
          type="text"
          value={formulaBarValue}
          onChange={(e) => onCellValueChange(e.target.value)}
          className="flex-grow p-1 border border-gray-300 rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
          placeholder="Enter formula or text"
        />
      </div>

      {/* Spreadsheet Grid */}
      <SpreadsheetGrid
        data={data}
        activeCell={activeCell}
        editingCell={editingCell}
        cellValue={cellValue}
        selectionStart={selectionStart}
        selectionEnd={selectionEnd}
        columnWidths={columnWidths}
        hiddenColumns={hiddenColumns}
        onSelectCell={onSelectCell}
        onDoubleClickCell={onDoubleClickCell}
        onUpdateCell={onUpdateCell}
        onCellValueChange={onCellValueChange}
        onKeyDown={onKeyDown}
        onMouseDownCell={onMouseDownCell}
        onMouseMoveCell={onMouseMoveCell}
        onMouseUpCell={onMouseUpCell}
        onColumnResizeStart={onColumnResizeStart}
        onContextMenu={onContextMenu}
        filteredAndSortedData={filteredAndSortedData}
      />
    </div>
  );
};

export default SpreadsheetView;

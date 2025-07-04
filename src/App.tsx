import React, { useState, useEffect, useCallback, useContext } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { FirebaseContext, FirebaseProvider } from './context/FirebaseContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import SpreadsheetView from './components/SpreadsheetView';
import ContextMenu from './components/ContextMenu';
import ContextMenuItem from './components/ContextMenuItem';
import { initialData, blankInitialData, columnNames, NUM_ROWS, NUM_COLS } from './lib/constants'; // Import blankInitialData
import { debounce, generateColumnNames } from './lib/helpers';
import { SpreadsheetData, RowData } from './lib/types';

const App: React.FC = () => {
  console.log('App component rendering...');

  const { db, userId, isAuthReady } = useContext(FirebaseContext);
  const [activeTab, setActiveTab] = useState<string>('Spreadsheet');
  const [data, setData] = useState<SpreadsheetData>(initialData);
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [cellValue, setCellValue] = useState<string>('');
  const [selectionStart, setSelectionStart] = useState<{ row: number; col: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ row: number; col: number } | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [columnWidths, setColumnWidths] = useState<{ [key: string]: number }>(
    columnNames.reduce((acc, name) => ({ ...acc, [name]: 100 }), {})
  );
  const [resizingColIndex, setResizingColIndex] = useState<number | null>(null);
  const [startX, setStartX] = useState<number>(0);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    type: 'cell' | 'column' | 'row';
    target: any;
  } | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [currentFilters, setCurrentFilters] = useState<{ [key: string]: string }>({});
  const [currentSort, setCurrentSort] = useState<{ colName: string; direction: 'asc' | 'desc' } | null>(null);

  // Debounced function to save data to Firestore
  const debouncedSaveData = useCallback(
    debounce((latestData: SpreadsheetData, latestColumnWidths: { [key: string]: number }, latestHiddenColumns: string[]) => {
      if (db && userId) {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const docRef = doc(db, `artifacts/${appId}/users/${userId}/spreadsheet_data/main_sheet`);
        setDoc(docRef, {
          data: JSON.stringify(latestData),
          columnWidths: JSON.stringify(latestColumnWidths),
          hiddenColumns: JSON.stringify(latestHiddenColumns),
          updatedAt: Date.now(),
        }).catch(e => console.error("Error saving document: ", e));
      }
    }, 1000),
    [db, userId]
  );

  // Load data from Firestore on component mount and auth ready
  useEffect(() => {
    if (db && userId && isAuthReady) {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const docRef = doc(db, `artifacts/${appId}/users/${userId}/spreadsheet_data/main_sheet`);

      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const loadedData = docSnap.data();
          try {
            setData(JSON.parse(loadedData.data));
            setColumnWidths(JSON.parse(loadedData.columnWidths || '{}'));
            setHiddenColumns(JSON.parse(loadedData.hiddenColumns || '[]'));
          } catch (e) {
            console.error("Error parsing loaded data:", e);
            setData(initialData);
            setColumnWidths(columnNames.reduce((acc, name) => ({ ...acc, [name]: 100 }), {}));
            setHiddenColumns([]);
          }
        } else {
          console.log("No spreadsheet data found, initializing with default.");
          setData(initialData);
          setColumnWidths(columnNames.reduce((acc, name) => ({ ...acc, [name]: 100 }), {}));
          setHiddenColumns([]);
          debouncedSaveData(initialData, columnNames.reduce((acc, name) => ({ ...acc, [name]: 100 }), {}), []);
        }
      }, (error) => {
        console.error("Error listening to Firestore:", error);
      });

      return () => unsubscribe();
    }
  }, [db, userId, isAuthReady, debouncedSaveData]);

  // Save data to Firestore whenever data, columnWidths, or hiddenColumns change
  useEffect(() => {
    if (db && userId && isAuthReady) {
      debouncedSaveData(data, columnWidths, hiddenColumns);
    }
  }, [data, columnWidths, hiddenColumns, db, userId, isAuthReady, debouncedSaveData]);

  const handleHeaderSearch = (query: string) => {
    console.log('Searching for:', query);
  };

  const handleHeaderButtonClick = (action: string) => {
    console.log('Header button clicked:', action);
    if (action === 'New Project') {
      // Reset all relevant states to create a blank sheet
      setData(blankInitialData); // Set to blank data
      setColumnWidths(columnNames.reduce((acc, name) => ({ ...acc, [name]: 100 }), {})); // Reset column widths
      setHiddenColumns([]); // Clear hidden columns
      setActiveCell(null); // Clear active cell
      setEditingCell(null); // Clear editing cell
      setCellValue(''); // Clear formula bar value
      setSelectionStart(null); // Clear selection
      setSelectionEnd(null); // Clear selection
      setCurrentFilters({}); // Clear filters
      setCurrentSort(null); // Clear sort
      console.log('Created a new blank spreadsheet.');
    }
  };

  const handleSelectCell = useCallback((row: number, col: number) => {
    setActiveCell({ row, col });
    setEditingCell(null);
    setCellValue(data[row][columnNames[col]]);
    setSelectionStart(null);
    setSelectionEnd(null);
  }, [data]);

  const handleDoubleClickCell = useCallback((row: number, col: number) => {
    setEditingCell({ row, col });
    setCellValue(data[row][columnNames[col]]);
  }, [data]);

  const handleUpdateCell = useCallback((row: number, col: number, value: string) => {
    setData(prevData => {
      const newData = [...prevData];
      newData[row] = { ...newData[row], [columnNames[col]]: value };
      return newData;
    });
    setEditingCell(null);
    setActiveCell({ row, col });
  }, []);

  const handleCellValueChange = useCallback((value: string) => {
    setCellValue(value);
  }, []);

  const handleMouseDownCell = useCallback((row: number, col: number) => {
    setIsDragging(true);
    setSelectionStart({ row, col });
    setSelectionEnd({ row, col });
    setActiveCell({ row, col });
    setEditingCell(null);
    setCellValue(data[row][columnNames[col]]);
  }, [data]);

  const handleMouseMoveCell = useCallback((row: number, col: number) => {
    if (isDragging) {
      setSelectionEnd({ row, col });
    }
  }, [isDragging]);

  const handleMouseUpCell = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleColumnResizeStart = useCallback((e: React.MouseEvent, colIndex: number) => {
    e.preventDefault();
    setResizingColIndex(colIndex);
    setStartX(e.clientX);
    document.addEventListener('mousemove', handleColumnResize);
    document.addEventListener('mouseup', handleColumnResizeEnd);
  }, []);

  const handleColumnResize = useCallback((e: MouseEvent) => {
    if (resizingColIndex !== null) {
      const currentColName = columnNames[resizingColIndex];
      const newWidth = Math.max(50, columnWidths[currentColName] + (e.clientX - startX));
      setColumnWidths(prevWidths => ({
        ...prevWidths,
        [currentColName]: newWidth,
      }));
      setStartX(e.clientX);
    }
  }, [resizingColIndex, columnWidths, startX]);

  const handleColumnResizeEnd = useCallback(() => {
    setResizingColIndex(null);
    document.removeEventListener('mousemove', handleColumnResize);
    document.removeEventListener('mouseup', handleColumnResizeEnd);
  }, [handleColumnResize]);

  const handleContextMenu = useCallback((e: React.MouseEvent, type: 'cell' | 'column' | 'row', target: any) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, type, target });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleAddRow = useCallback(() => {
    setData(prevData => {
      const newRow: RowData = {};
      columnNames.forEach(colName => (newRow[colName] = ''));
      return [...prevData, newRow];
    });
    handleCloseContextMenu();
  }, []);

  const handleInsertRow = useCallback((atIndex: number) => {
    setData(prevData => {
      const newRow: RowData = {};
      columnNames.forEach(colName => (newRow[colName] = ''));
      const newData = [...prevData];
      newData.splice(atIndex, 0, newRow);
      return newData;
    });
    handleCloseContextMenu();
  }, []);

  const handleDeleteRow = useCallback((rowIndex: number) => {
    setData(prevData => {
      const newData = [...prevData];
      newData.splice(rowIndex, 1);
      return newData;
    });
    setActiveCell(null);
    setEditingCell(null);
    setSelectionStart(null);
    setSelectionEnd(null);
    handleCloseContextMenu();
  }, []);

  const handleAddColumn = useCallback((atIndex: number) => {
    setData(prevData => {
      const newColName = generateColumnNames(columnNames.length + 1).slice(-1)[0];
      columnNames.splice(atIndex, 0, newColName);
      return prevData.map(row => {
        const newRow: RowData = {};
        let originalColIndex = 0;
        for (let i = 0; i < columnNames.length; i++) {
          if (i === atIndex) {
            newRow[columnNames[i]] = '';
          } else {
            newRow[columnNames[i]] = row[columnNames[originalColIndex]];
            originalColIndex++;
          }
        }
        return newRow;
      });
    });
    setColumnWidths(prevWidths => ({ ...prevWidths, [generateColumnNames(columnNames.length).slice(-1)[0]]: 100 }));
    handleCloseContextMenu();
  }, []);

  const handleDeleteColumn = useCallback((colIndex: number) => {
    setData(prevData => {
      const colToDeleteName = columnNames[colIndex];
      const newData = prevData.map(row => {
        const newRow = { ...row };
        delete newRow[colToDeleteName];
        return newRow;
      });
      columnNames.splice(colIndex, 1);
      return newData;
    });
    setColumnWidths(prevWidths => {
      const newWidths = { ...prevWidths };
      delete newWidths[columnNames[colIndex]];
      return newWidths;
    });
    setActiveCell(null);
    setEditingCell(null);
    setSelectionStart(null);
    setSelectionEnd(null);
    handleCloseContextMenu();
  }, []);

  const handleToggleColumnVisibility = useCallback((colName: string) => {
    setHiddenColumns(prevHidden => {
      if (prevHidden.includes(colName)) {
        return prevHidden.filter(name => name !== colName);
      } else {
        return [...prevHidden, colName];
      }
    });
    handleCloseContextMenu();
  }, []);

  const handleCopy = useCallback(() => {
    if (selectionStart && selectionEnd) {
      const minRow = Math.min(selectionStart.row, selectionEnd.row);
      const maxRow = Math.max(selectionStart.row, selectionEnd.row);
      const minCol = Math.min(selectionStart.col, selectionEnd.col);
      const maxCol = Math.max(selectionStart.col, selectionEnd.col);

      let copiedText = '';
      for (let r = minRow; r <= maxRow; r++) {
        let rowText = [];
        for (let c = minCol; c <= maxCol; c++) {
          rowText.push(data[r]?.[columnNames[c]] || '');
        }
        copiedText += rowText.join('\t') + '\n';
      }
      const textarea = document.createElement('textarea');
      textarea.value = copiedText;
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        console.log('Copied data to clipboard.');
      } catch (err) {
        console.error('Failed to copy text: ', err);
      }
      document.body.removeChild(textarea);
    }
    handleCloseContextMenu();
  }, [selectionStart, selectionEnd, data]);

  const handlePaste = useCallback(async () => {
    if (!activeCell) return;

    try {
      const text = await navigator.clipboard.readText();
      const rows = text.split('\n').filter(line => line.trim() !== '');
      if (rows.length === 0) return;

      const pastedData: string[][] = rows.map(row => row.split('\t'));

      setData(prevData => {
        const newData = JSON.parse(JSON.stringify(prevData));
        const startRow = activeCell.row;
        const startCol = activeCell.col;

        for (let r = 0; r < pastedData.length; r++) {
          for (let c = 0; c < pastedData[r].length; c++) {
            const targetRow = startRow + r;
            const targetCol = startCol + c;

            if (targetRow < NUM_ROWS && targetCol < NUM_COLS) {
              if (!newData[targetRow]) {
                newData[targetRow] = {};
              }
              newData[targetRow][columnNames[targetCol]] = pastedData[r][c];
            }
          }
        }
        return newData;
      });
      console.log('Pasted data from clipboard.');
    } catch (err) {
      console.error('Failed to paste text: ', err);
    }
    handleCloseContextMenu();
  }, [activeCell]);

  const handleApplyFilter = useCallback((colName: string, filterValue: string) => {
    setCurrentFilters(prev => ({ ...prev, [colName]: filterValue }));
    console.log(`Applied filter: ${colName} contains "${filterValue}"`);
  }, []);

  const handleClearFilter = useCallback(() => {
    setCurrentFilters({});
    console.log('Cleared all filters.');
  }, []);

  const handleApplySort = useCallback((colName: string, direction: 'asc' | 'desc') => {
    if (!colName) {
      setCurrentSort(null);
      console.log('Cleared sort.');
    } else {
      setCurrentSort({ colName, direction });
      console.log(`Applied sort: ${colName} ${direction}`);
    }
  }, []);

  const getFilteredAndSortedData = useCallback(() => {
    let processedData = [...data];

    Object.entries(currentFilters).forEach(([colName, filterValue]) => {
      if (filterValue) {
        processedData = processedData.filter(row =>
          row[colName]?.toLowerCase().includes(filterValue.toLowerCase())
        );
      }
    });

    if (currentSort) {
      const { colName, direction } = currentSort;
      processedData.sort((a, b) => {
        const valA = a[colName] || '';
        const valB = b[colName] || '';

        if (direction === 'asc') {
          return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
        } else {
          return valB.localeCompare(valA, undefined, { numeric: true, sensitivity: 'base' });
        }
      });
    }
    return processedData;
  }, [data, currentFilters, currentSort]);

  const filteredAndSortedData = getFilteredAndSortedData();

  const handleGridKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!activeCell) return;

    const { row, col } = activeCell;
    let newRow = row;
    let newCol = col;

    if (editingCell) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleUpdateCell(editingCell.row, editingCell.col, cellValue);
        if (activeCell.row < NUM_ROWS - 1) {
          setActiveCell(prev => prev ? { ...prev, row: prev.row + 1 } : null);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleUpdateCell(editingCell.row, editingCell.col, data[editingCell.row][columnNames[editingCell.col]]);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowUp':
        newRow = Math.max(0, row - 1);
        break;
      case 'ArrowDown':
        newRow = Math.min(NUM_ROWS - 1, row + 1);
        break;
      case 'ArrowLeft':
        newCol = Math.max(0, col - 1);
        break;
      case 'ArrowRight':
        newCol = Math.min(NUM_COLS - 1, col + 1);
        break;
      case 'Enter':
        e.preventDefault();
        handleDoubleClickCell(row, col);
        return;
      case 'c':
      case 'C':
        if (e.ctrlKey || e.metaKey) {
          handleCopy();
          return;
        }
        break;
      case 'v':
      case 'V':
        if (e.ctrlKey || e.metaKey) {
          handlePaste();
          return;
        }
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          setEditingCell({ row, col });
          setCellValue(e.key);
        }
        return;
    }

    if (newRow !== row || newCol !== col) {
      setActiveCell({ row: newRow, col: newCol });
      setCellValue(data[newRow][columnNames[newCol]]);
      e.preventDefault();
    }
  }, [activeCell, editingCell, cellValue, data, handleUpdateCell, handleDoubleClickCell, handleCopy, handlePaste]);


  return (
    <div className="min-h-screen bg-gray-100 font-inter flex flex-col">
      <Header onSearch={handleHeaderSearch} onButtonClick={handleHeaderButtonClick} userId={userId} />
      <div className="flex flex-grow mt-4 p-4">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <main className="flex-grow ml-4">
          {activeTab === 'Spreadsheet' && (
            <SpreadsheetView
              data={data}
              activeCell={activeCell}
              editingCell={editingCell}
              cellValue={cellValue}
              selectionStart={selectionStart}
              selectionEnd={selectionEnd}
              columnWidths={columnWidths}
              hiddenColumns={hiddenColumns}
              onSelectCell={handleSelectCell}
              onDoubleClickCell={handleDoubleClickCell}
              onUpdateCell={handleUpdateCell}
              onCellValueChange={handleCellValueChange}
              onKeyDown={handleGridKeyDown}
              onMouseDownCell={handleMouseDownCell}
              onMouseMoveCell={handleMouseMoveCell}
              onMouseUpCell={handleMouseUpCell}
              onColumnResizeStart={handleColumnResizeStart}
              onContextMenu={handleContextMenu}
              onAddRow={handleAddRow}
              onApplyFilter={handleApplyFilter}
              onClearFilter={handleClearFilter}
              onApplySort={handleApplySort}
              currentSort={currentSort}
              filteredAndSortedData={filteredAndSortedData}
            />
          )}
          {activeTab === 'Chat' && (
            <div className="p-6 bg-white rounded-lg shadow-md flex items-center justify-center h-full text-gray-600 text-xl">
              Chat View (Not implemented)
            </div>
          )}
          {activeTab === 'Workflows' && (
            <div className="p-6 bg-white rounded-lg shadow-md flex items-center justify-center h-full text-gray-600 text-xl">
              Workflows View (Not implemented)
            </div>
          )}
          {activeTab === 'Settings' && (
            <div className="p-6 bg-white rounded-lg shadow-md flex items-center justify-center h-full text-gray-600 text-xl">
              Settings View (Not implemented)
            </div>
          )}
        </main>
      </div>

      {/* Context Menu Render */}
      {contextMenu && contextMenu.visible && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={handleCloseContextMenu}>
          {contextMenu.type === 'cell' && (
            <>
              <ContextMenuItem onClick={() => handleInsertRow(contextMenu.target.row)}>Insert Row Above</ContextMenuItem>
              <ContextMenuItem onClick={() => handleInsertRow(contextMenu.target.row + 1)}>Insert Row Below</ContextMenuItem>
              <ContextMenuItem onClick={() => handleAddColumn(contextMenu.target.col)}>Insert Column Left</ContextMenuItem>
              <ContextMenuItem onClick={() => handleAddColumn(contextMenu.target.col + 1)}>Insert Column Right</ContextMenuItem>
              <ContextMenuItem onClick={() => handleDeleteRow(contextMenu.target.row)}>Delete Row</ContextMenuItem>
              <ContextMenuItem onClick={() => handleDeleteColumn(contextMenu.target.col)}>Delete Column</ContextMenuItem>
              <ContextMenuItem onClick={handleCopy}>Copy</ContextMenuItem>
              <ContextMenuItem onClick={handlePaste}>Paste</ContextMenuItem>
            </>
          )}
          {contextMenu.type === 'column' && (
            <>
              <ContextMenuItem onClick={() => handleAddColumn(contextMenu.target.colIndex)}>Insert Column Left</ContextMenuItem>
              <ContextMenuItem onClick={() => handleAddColumn(contextMenu.target.colIndex + 1)}>Insert Column Right</ContextMenuItem>
              <ContextMenuItem onClick={() => handleDeleteColumn(contextMenu.target.colIndex)}>Delete Column</ContextMenuItem>
              <ContextMenuItem onClick={() => handleToggleColumnVisibility(contextMenu.target.colName)}>
                {hiddenColumns.includes(contextMenu.target.colName) ? 'Show Column' : 'Hide Column'}
              </ContextMenuItem>
              <ContextMenuItem onClick={() => handleApplySort(contextMenu.target.colName, 'asc')}>Sort A-Z</ContextMenuItem>
              <ContextMenuItem onClick={() => handleApplySort(contextMenu.target.colName, 'desc')}>Sort Z-A</ContextMenuItem>
            </>
          )}
          {contextMenu.type === 'row' && (
            <>
              <ContextMenuItem onClick={() => handleInsertRow(contextMenu.target.rowIndex)}>Insert Row Above</ContextMenuItem>
              <ContextMenuItem onClick={() => handleInsertRow(contextMenu.target.rowIndex + 1)}>Insert Row Below</ContextMenuItem>
              <ContextMenuItem onClick={() => handleDeleteRow(contextMenu.target.rowIndex)}>Delete Row</ContextMenuItem>
            </>
          )}
        </ContextMenu>
      )}
    </div>
  );
};

// Wrap App with FirebaseProvider
const WrappedApp: React.FC = () => (
  <FirebaseProvider>
    <App />
  </FirebaseProvider>
);

export default WrappedApp;

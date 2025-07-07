import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { FirebaseContext, FirebaseProvider } from './context/FirebaseContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import SpreadsheetView from './components/SpreadsheetView';
import ContextMenu from './components/ContextMenu';
import ContextMenuItem from './components/ContextMenuItem';
import { initialData, blankInitialData, columnNames, NUM_ROWS, NUM_COLS } from './lib/constants';
import { debounce, generateColumnNames } from './lib/helpers';
import { SpreadsheetData, RowData } from './lib/types';

// Define a type for chat messages
interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
}

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

  // Chat states
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [currentChatMessage, setCurrentChatMessage] = useState<string>('');
  const chatMessagesEndRef = useRef<HTMLDivElement>(null); // Ref for auto-scrolling chat

  // Settings states
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState<boolean>(true);
  const [inAppAlertsEnabled, setInAppAlertsEnabled] = useState<boolean>(true);

  // State for managing last loaded timestamp from Firestore and saving status
  const [lastLoadedTimestamp, setLastLoadedTimestamp] = useState<number>(0);
  const [isSaving, setIsSaving] = useState<boolean>(false); // New state for saving indicator

  // Debounced function to save data to Firestore
  const debouncedSaveData = useCallback(
    debounce(async (latestData: SpreadsheetData, latestColumnWidths: { [key: string]: number }, latestHiddenColumns: string[]) => {
      if (db && userId) {
        setIsSaving(true); // Set saving indicator to true
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const docRef = doc(db, `artifacts/${appId}/users/${userId}/spreadsheet_data/main_sheet`);
        const newTimestamp = Date.now(); // Get current timestamp for saving
        try {
          await setDoc(docRef, {
            data: JSON.stringify(latestData),
            columnWidths: JSON.stringify(latestColumnWidths),
            hiddenColumns: JSON.stringify(latestHiddenColumns),
            updatedAt: newTimestamp, // Include the timestamp when saving
          });
          console.log("Data saved to Firestore.");
        } catch (e) {
          console.error("Error saving document: ", e);
        } finally {
          setIsSaving(false); // Set saving indicator to false after save attempt
        }
      }
    }, 500), // Reduced debounce delay to 500ms
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
          const loadedTimestamp = loadedData.updatedAt || 0; // Get timestamp from loaded data

          // Only update local state if the loaded data is newer than what we last loaded
          if (loadedTimestamp > lastLoadedTimestamp) {
            try {
              setData(JSON.parse(loadedData.data));
              setColumnWidths(JSON.parse(loadedData.columnWidths || '{}'));
              setHiddenColumns(JSON.parse(loadedData.hiddenColumns || '[]'));
              setLastLoadedTimestamp(loadedTimestamp); // Update our last loaded timestamp
              console.log("Data loaded from Firestore.");
            } catch (e) {
              console.error("Error parsing loaded data:", e);
              // Fallback to initial data if parsing fails
              setData(blankInitialData); // Fallback to blank if parsing fails
              setColumnWidths(columnNames.reduce((acc, name) => ({ ...acc, [name]: 100 }), {}));
              setHiddenColumns([]);
              setLastLoadedTimestamp(Date.now()); // Update timestamp on fallback
            }
          } else {
            console.log("Loaded data is not newer or same timestamp, skipping update from Firestore.");
          }
        } else {
          // If no data exists in Firestore, initialize with blank data
          console.log("No spreadsheet data found, initializing with blank sheet.");
          setData(blankInitialData); // Initialize with blank data
          setColumnWidths(columnNames.reduce((acc, name) => ({ ...acc, [name]: 100 }), {}));
          setHiddenColumns([]);
          setLastLoadedTimestamp(Date.now()); // Set timestamp for initial data
          debouncedSaveData(blankInitialData, columnNames.reduce((acc, name) => ({ ...acc, [name]: 100 }), {}), []);
        }
      }, (error) => {
        console.error("Error listening to Firestore:", error);
      });

      return () => unsubscribe();
    }
  }, [db, userId, isAuthReady, lastLoadedTimestamp, debouncedSaveData]); // Add lastLoadedTimestamp to dependencies

  // Trigger debounced save whenever data, columnWidths, or hiddenColumns change
  useEffect(() => {
    if (db && userId && isAuthReady) {
      debouncedSaveData(data, columnWidths, hiddenColumns);
    }
  }, [data, columnWidths, hiddenColumns, db, userId, isAuthReady, debouncedSaveData]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

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
      setLastLoadedTimestamp(Date.now()); // Update timestamp on new project
      debouncedSaveData(blankInitialData, columnNames.reduce((acc, name) => ({ ...acc, [name]: 100 }), {}), []); // Save blank data
      console.log('Created a new blank spreadsheet.');
    } else if (action === 'User Profile') { // Handle User Profile click
      setActiveTab('Settings'); // Switch to the Settings tab
      console.log('Navigated to User Profile (Settings tab).');
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

  // --- Chat Functions ---
  const handleSendMessage = useCallback(async () => {
    if (currentChatMessage.trim() === '') return;

    const userMessage: ChatMessage = { sender: 'user', text: currentChatMessage.trim() };
    setChatHistory(prev => [...prev, userMessage]);
    setCurrentChatMessage('');

    try {
      const prompt = `You are a helpful assistant in a spreadsheet application. Respond concisely to the following user message: "${userMessage.text}"`;
      let chatHistoryForApi = [];
      chatHistoryForApi.push({ role: "user", parts: [{ text: prompt }] });
      const payload = { contents: chatHistoryForApi };
      const apiKey = ""; // Leave as-is, Canvas will provide
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        const aiResponseText = result.candidates[0].content.parts[0].text;
        const aiMessage: ChatMessage = { sender: 'ai', text: aiResponseText };
        setChatHistory(prev => [...prev, aiMessage]);
      } else {
        console.error("Gemini API response structure unexpected:", result);
        const errorMessage: ChatMessage = { sender: 'ai', text: "Sorry, I couldn't generate a response." };
        setChatHistory(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      const errorMessage: ChatMessage = { sender: 'ai', text: "Error connecting to the chat service." };
      setChatHistory(prev => [...prev, errorMessage]);
    }
  }, [currentChatMessage]);

  const handleChatKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { // Allow Shift+Enter for new line
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // --- Settings Functions ---
  const handleToggleEmailNotifications = useCallback(() => {
    setEmailNotificationsEnabled(prev => !prev);
  }, []);

  const handleToggleInAppAlerts = useCallback(() => {
    setInAppAlertsEnabled(prev => !prev);
  }, []);

  const handleClearAllData = useCallback(() => {
    // Reset all relevant states to create a completely blank sheet and clear storage
    setData(blankInitialData);
    setColumnWidths(columnNames.reduce((acc, name) => ({ ...acc, [name]: 100 }), {}));
    setHiddenColumns([]);
    setActiveCell(null);
    setEditingCell(null);
    setCellValue('');
    setSelectionStart(null);
    setSelectionEnd(null);
    setCurrentFilters({});
    setCurrentSort(null);
    setChatHistory([]); // Clear chat history too
    setEmailNotificationsEnabled(true); // Reset settings to default
    setInAppAlertsEnabled(true); // Reset settings to default

    // Immediately save the blank state to Firestore with a new timestamp
    const newTimestamp = Date.now();
    debouncedSaveData(blankInitialData, columnNames.reduce((acc, name) => ({ ...acc, [name]: 100 }), {}), []);
    setLastLoadedTimestamp(newTimestamp); // Update lastLoadedTimestamp to reflect the new blank state
    console.log('All application data cleared.');
  }, [debouncedSaveData]);


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
            <div className="p-6 bg-white rounded-lg shadow-md flex flex-col h-full">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">Team Chat</h2>
              <div className="flex-grow overflow-y-auto border border-gray-200 rounded-md p-4 mb-4 bg-gray-50 flex flex-col space-y-2">
                {chatHistory.map((msg, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded-lg max-w-[80%] ${
                      msg.sender === 'user'
                        ? 'bg-blue-500 text-white self-end'
                        : 'bg-gray-200 text-gray-800 self-start'
                    }`}
                  >
                    <span className="font-medium">
                      {msg.sender === 'user' ? 'You' : 'AI Assistant'}:
                    </span>{' '}
                    {msg.text}
                  </div>
                ))}
                <div ref={chatMessagesEndRef} /> {/* For auto-scrolling */}
              </div>
              <div className="flex">
                <input
                  type="text"
                  placeholder="Type your message..."
                  className="flex-grow p-2 border border-gray-300 rounded-l-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={currentChatMessage}
                  onChange={(e) => setCurrentChatMessage(e.target.value)}
                  onKeyDown={handleChatKeyDown}
                />
                <button
                  onClick={handleSendMessage}
                  className="px-4 py-2 bg-blue-500 text-white rounded-r-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-150 ease-in-out shadow-sm"
                >
                  Send
                </button>
              </div>
            </div>
          )}
          {activeTab === 'Workflows' && (
            <div className="p-6 bg-white rounded-lg shadow-md flex flex-col h-full">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">Automated Workflows</h2>
              <p className="text-gray-600 mb-6">Streamline your tasks and automate repetitive actions.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4 shadow-sm">
                  <h3 className="font-semibold text-lg text-blue-700 mb-2">Data Entry Automation</h3>
                  <p className="text-gray-700 text-sm">Automatically populate new rows from external sources.</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-md p-4 shadow-sm">
                  <h3 className="font-semibold text-lg text-green-700 mb-2">Report Generation</h3>
                  <p className="text-gray-700 text-sm">Generate weekly or monthly reports based on spreadsheet data.</p>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 shadow-sm">
                  <h3 className="font-semibold text-lg text-yellow-700 mb-2">Email Notifications</h3>
                  <p className="text-gray-700 text-sm">Send alerts when specific cell values change or thresholds are met.</p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-md p-4 shadow-sm">
                  <h3 className="font-semibold text-lg text-purple-700 mb-2">Third-Party Integrations</h3>
                  <p className="text-gray-700 text-sm">Connect your spreadsheet with CRM, accounting, or project management tools.</p>
                </div>
              </div>
              <button
                className="mt-auto px-6 py-3 bg-blue-500 text-white text-lg font-medium rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-150 ease-in-out shadow-md self-start"
              >
                Add New Workflow
              </button>
            </div>
          )}
          {activeTab === 'Settings' && (
            <div className="p-6 bg-white rounded-lg shadow-md flex flex-col h-full">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">Application Settings</h2>
              <div className="space-y-6">
                {/* User Profile Settings */}
                <div className="border-b border-gray-200 pb-4">
                  <h3 className="text-xl font-semibold text-gray-700 mb-3">User Profile</h3>
                  <div className="flex items-center mb-3">
                    <label htmlFor="userName" className="w-32 text-gray-600 text-sm">Name:</label>
                    <input
                      type="text"
                      id="userName"
                      defaultValue="Enter your name"
                      className="flex-grow p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                  <div className="flex items-center">
                    <label htmlFor="userEmail" className="w-32 text-gray-600 text-sm">Email:</label>
                    <input
                      type="email"
                      id="userEmail"
                      defaultValue="abcd@gmail.com"
                      className="flex-grow p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                </div>

                {/* Notification Settings */}
                <div className="border-b border-gray-200 pb-4">
                  <h3 className="text-xl font-semibold text-gray-700 mb-3">Notifications</h3>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-600 text-sm">Email Notifications</span>
                    <label htmlFor="emailNotifications" className="flex items-center cursor-pointer">
                      <div className="relative">
                        <input
                          type="checkbox"
                          id="emailNotifications"
                          className="sr-only peer" // Added peer class for Tailwind styling
                          checked={emailNotificationsEnabled}
                          onChange={handleToggleEmailNotifications}
                        />
                        <div className="block w-10 h-6 bg-gray-300 rounded-full peer-checked:bg-blue-600 transition-colors duration-200"></div>
                        <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 peer-checked:translate-x-full"></div>
                      </div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 text-sm">In-App Alerts</span>
                    <label htmlFor="inAppAlerts" className="flex items-center cursor-pointer">
                      <div className="relative">
                        <input
                          type="checkbox"
                          id="inAppAlerts"
                          className="sr-only peer" // Added peer class for Tailwind styling
                          checked={inAppAlertsEnabled}
                          onChange={handleToggleInAppAlerts}
                        />
                        <div className="block w-10 h-6 bg-gray-300 rounded-full peer-checked:bg-blue-600 transition-colors duration-200"></div>
                        <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 peer-checked:translate-x-full"></div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Data & Storage Settings */}
                <div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-3">Data & Storage</h3>
                  <div className="flex items-center mb-3">
                    <span className="w-32 text-gray-600 text-sm">Storage Usage:</span>
                    <span className="text-gray-800 font-medium">1.2 GB / 5 GB</span>
                  </div>
                  <button
                    onClick={handleClearAllData} // Added onClick handler
                    className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 transition duration-150 ease-in-out shadow-sm"
                  >
                    Clear All Data
                  </button>
                </div>
              </div>
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
      {/* Saving Indicator */}
      {isSaving && (
        <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-md shadow-lg text-sm flex items-center space-x-2">
          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Saving...</span>
        </div>
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

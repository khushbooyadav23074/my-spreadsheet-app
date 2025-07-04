import { SpreadsheetData, RowData } from './types';
import { generateColumnNames } from './helpers';

export const NUM_ROWS = 20;
export const NUM_COLS = 16; 

export const columnNames = generateColumnNames(NUM_COLS);

// Initial mock data for the spreadsheet (with some content)
export const initialData: SpreadsheetData = Array.from({ length: NUM_ROWS }, (_, rowIndex) => {
  const row: RowData = {};
  columnNames.forEach((colName) => {
    row[colName] = `R${rowIndex + 1}C${colName}`;
  });
  return row;
});

// Blank initial data for a new, empty spreadsheet
export const blankInitialData: SpreadsheetData = Array.from({ length: NUM_ROWS }, () => { // Removed rowIndex
  const row: RowData = {};
  columnNames.forEach((colName) => {
    row[colName] = ''; // All cells are empty strings
  });
  return row;
});

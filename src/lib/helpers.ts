import { SpreadsheetData } from './types';
import { columnNames } from './constants';

// Helper to generate column names (A, B, C, ..., AA, AB, ...)
export const generateColumnNames = (count: number): string[] => {
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    let name = '';
    let num = i;
    while (num >= 0) {
      name = String.fromCharCode((num % 26) + 65) + name;
      num = Math.floor(num / 26) - 1;
    }
    names.push(name);
  }
  return names;
};

// Simple formula evaluator
export const evaluateFormula = (formula: string, data: SpreadsheetData): string => {
  if (!formula.startsWith('=')) {
    return formula;
  }

  const expression = formula.substring(1).trim().toUpperCase();

  // Basic SUM formula parsing: =SUM(A1:B2)
  const sumMatch = expression.match(/^SUM\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)$/);
  if (sumMatch) {
    const startColName = sumMatch[1];
    const startRowIndex = parseInt(sumMatch[2]) - 1;
    const endColName = sumMatch[3];
    const endRowIndex = parseInt(sumMatch[4]) - 1;

    const startColIndex = columnNames.indexOf(startColName);
    const endColIndex = columnNames.indexOf(endColName);

    if (startColIndex === -1 || endColIndex === -1) {
      return '#REF!'; // Invalid column name
    }

    let sum = 0;
    for (let r = Math.min(startRowIndex, endRowIndex); r <= Math.max(startRowIndex, endRowIndex); r++) {
      for (let c = Math.min(startColIndex, endColIndex); c <= Math.max(startColIndex, endColIndex); c++) {
        if (data[r] && data[r][columnNames[c]]) {
          const value = parseFloat(data[r][columnNames[c]]);
          if (!isNaN(value)) {
            sum += value;
          }
        }
      }
    }
    return sum.toString();
  }

  // Add more formula parsers here (e.g., AVG, IF, etc.)

  return '#ERROR!'; // Unknown formula or parsing error
};

// Debounce utility for Firestore writes
export const debounce = <T extends (...args: any[]) => void>(func: T, delay: number) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
};

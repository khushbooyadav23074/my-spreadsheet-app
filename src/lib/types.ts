export interface RowData {
  [key: string]: string;
}

export interface SpreadsheetData extends Array<RowData> {}

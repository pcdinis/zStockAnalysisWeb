# zStockAnalysis (SAPUI5) — Excel-backed Frontend

This UI5 frontend allows you to upload an Excel or CSV file with your trades and analyze holdings.

How to run
1. Serve the `docs` folder with a static server (or enable GitHub Pages from main/docs in repo settings):
   - Node:
     - npm i -g http-server
     - cd docs
     - http-server -c-1
   - Python:
     - cd docs
     - python -m http.server 8080
2. Open: http://localhost:8080/index.html

Header mapping UI
- After uploading a file, the app will try to auto-detect column headers. If your spreadsheet uses different column names you can click "Map headers" to open the mapping dialog and select which column maps to Date, Symbol, Quantity, etc.
- The mapping is saved in your browser's localStorage for future uploads but you can change it any time.

Excel/CSV format (flexible)
- The parser recognizes common header names (case-insensitive). Useful columns:
  - Date — e.g. 2020-05-21 or Excel date cell
  - Symbol — stock ticker
  - Name (optional)
  - Type or Side — Buy or Sell
  - Quantity or Qty
  - Price (trade price)
  - Fees or Commission (optional)

Notes & behavior
- The app parses the first sheet of the uploaded file.
- Holdings are aggregated using FIFO for computing realized P/L.
- If MarketPrice is not provided the last trade price will be used as marketPrice.
- Charts show transaction prices over time for the selected symbol.

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

Excel/CSV format (flexible)
- The parser recognizes common header names (case-insensitive). Useful columns:
  - Date (e.g., 2026-10-14 or Excel date)
  - Symbol (e.g., AAPL)
  - Name (optional)
  - Type or Side (Buy / Sell)
  - Quantity or Qty
  - Price (trade price). If you supply MarketPrice column it will be used to compute market value/unrealized.
  - Fees or Commission (optional)

Notes & behavior
- The app parses the first sheet of the uploaded file.
- Holdings are aggregated using FIFO for computing realized P/L.
- If MarketPrice is not provided the last trade price will be used as marketPrice.
- Charts show transaction prices over time for the selected symbol.

Next improvements you might want
- Add a manual override for market prices (per symbol).
- Generate a daily price series (fill gaps) if you want smooth charts.
- Add CSV upload preview and header mapping UI so users can map columns explicitly.
- Export aggregated P&L to CSV / Excel.

If you'd like, I can:
- Add a mapping UI to let you choose which columns map to Date/Symbol/Qty/Price.
- Add an "Import presets" or remember column mappings for repeated uploads.
- Implement more advanced P/L (tax lots, custom cost-basis methods).

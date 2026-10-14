sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/core/Fragment"
], function (Controller, JSONModel, Filter, FilterOperator, Fragment) {
  "use strict";

  return Controller.extend("zStockAnalysis.controller.StockList", {
    onInit: function () {
      this._oList = this.byId("stockList");
      this.getView().formatQtyAndValue = this.formatQtyAndValue.bind(this);
      this.getView().formatUnrealizedState = this.formatUnrealizedState.bind(this);
      // hold references to component models
      this._oComp = this.getOwnerComponent();
      this._oTransactionsModel = this._oComp.getModel("transactions");
      this._oHoldingsModel = this._oComp.getModel("holdings");
    },

    onSearch: function (oEvent) {
      var sValue = oEvent.getParameter("newValue") || oEvent.getSource().getValue();
      var aFilters = [];
      if (sValue && sValue.length > 0) {
        aFilters.push(new Filter({
          filters: [
            new Filter("symbol", FilterOperator.Contains, sValue),
            new Filter("name", FilterOperator.Contains, sValue)
          ],
          and: false
        }));
      }
      this._oList.getBinding("items").filter(aFilters);
    },

    onSelect: function (oEvent) {
      var oItem = oEvent.getParameter("listItem") || oEvent.getSource();
      var oCtx = oItem.getBindingContext("holdings");
      var oData = oCtx.getObject();

      // set selectedStock model
      var oSelected = this._oComp.getModel("selectedStock");
      oSelected.setData(oData);

      // also pass recent transactions for this symbol to the detail view (computed there)
      // navigate to detail
      var oSplit = this.byId("splitApp");
      // navigate to detail page (by id)
      oSplit.toDetail(this.byId("detailPage").getId());
    },

    formatQtyAndValue: function (aParts) {
      // parts: [quantity, marketPrice]
      var qty = aParts[0] || 0;
      var mkt = aParts[1] || 0;
      var val = qty * mkt;
      return qty.toFixed(2) + " / " + val.toFixed(2);
    },

    formatUnrealizedState: function (fUnrealized) {
      if (!fUnrealized && fUnrealized !== 0) { return "None"; }
      return fUnrealized > 0 ? "Success" : (fUnrealized < 0 ? "Error" : "None");
    },

    onFileChange: function (oEvent) {
      var aFiles = oEvent.getParameter("files") || [];
      if (!aFiles.length) {
        return;
      }
      var oFile = aFiles[0];
      var that = this;
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var data = new Uint8Array(e.target.result);
          var wb = XLSX.read(data, { type: 'array' });
          // take first sheet
          var sName = wb.SheetNames[0];
          var ws = wb.Sheets[sName];
          var raw = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });
          // parse rows into transaction objects
          var aTx = that._normalizeRows(raw);
          // update transactions model
          that._oTransactionsModel.setData({ transactions: aTx });
          // compute holdings
          var aHoldings = that._computeHoldings(aTx);
          that._oHoldingsModel.setData({ holdings: aHoldings });
          sap.m.MessageToast.show("File loaded: " + oFile.name);
        } catch (err) {
          sap.m.MessageBox.error("Failed to parse file: " + err.message);
        }
      };
      reader.onerror = function (err) {
        sap.m.MessageBox.error("File read error");
      };
      reader.readAsArrayBuffer(oFile);
    },

    _normalizeRows: function (aRows) {
      // Support flexible header names (case-insensitive):
      // Date, Symbol, Name, Type (Buy/Sell), Quantity (or Qty), Price, Fees, MarketPrice (optional)
      var aTx = [];
      if (!aRows || !aRows.length) { return aTx; }
      var headers = Object.keys(aRows[0]);
      var mapHeader = {};
      headers.forEach(function (h) {
        var hn = h.trim().toLowerCase();
        if (hn.match(/date/)) mapHeader.date = h;
        else if (hn.match(/symbol/)) mapHeader.symbol = h;
        else if (hn.match(/name/)) mapHeader.name = h;
        else if (hn.match(/type|side/)) mapHeader.type = h;
        else if (hn.match(/qty|quantity/)) mapHeader.quantity = h;
        else if (hn.match(/price/)) {
          // choose more specific names if both exist: marketprice vs price
          if (hn.match(/market/)) mapHeader.marketPrice = h;
          else mapHeader.price = h;
        } else if (hn.match(/fee|commission/)) mapHeader.fees = h;
      });

      aRows.forEach(function (r) {
        // skip empty rows (no symbol)
        var symbol = r[mapHeader.symbol];
        if (!symbol) { return; }
        var dtRaw = r[mapHeader.date];
        var dt = null;
        // try ISO parsing or XLS serial number fallback
        if (dtRaw instanceof Date) {
          dt = dtRaw;
        } else if (typeof dtRaw === "number") {
          dt = XLSX.SSF.parse_date_code(dtRaw);
          if (dt) dt = new Date(Date.UTC(dt.y, dt.m - 1, dt.d));
        } else if (typeof dtRaw === "string") {
          // try Date constructor
          var d2 = new Date(dtRaw);
          if (!isNaN(d2)) dt = d2;
        }
        var type = (r[mapHeader.type] || "").toString().trim().toLowerCase();
        var qty = parseFloat(r[mapHeader.quantity]) || 0;
        var price = parseFloat(r[mapHeader.price] || r[mapHeader.marketPrice]) || 0;
        var marketPrice = parseFloat(r[mapHeader.marketPrice]) || price;
        var name = r[mapHeader.name] || "";
        var fees = parseFloat(r[mapHeader.fees]) || 0;
        // normalize type
        if (type.indexOf("buy") >= 0) type = "BUY";
        else if (type.indexOf("sell") >= 0) type = "SELL";
        else {
          // if price positive and quantity positive, assume BUY; if negative qty assume SELL
          if (qty < 0) {
            type = "SELL";
            qty = Math.abs(qty);
          } else {
            type = "BUY";
          }
        }
        aTx.push({
          date: dt ? dt.toISOString().slice(0,10) : null,
          symbol: symbol.toString().toUpperCase().trim(),
          name: name,
          type: type,
          quantity: qty,
          price: price,
          fees: fees,
          marketPrice: marketPrice
        });
      });
      // sort by date ascending
      aTx.sort(function (a,b) {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(a.date) - new Date(b.date);
      });
      return aTx;
    },

    _computeHoldings: function (aTx) {
      // For each symbol: compute net quantity, average cost, realized P&L (FIFO), marketPrice (last marketPrice or last price)
      var map = {};
      aTx.forEach(function (tx) {
        var s = tx.symbol;
        if (!map[s]) {
          map[s] = {
            symbol: s,
            name: tx.name || s,
            lots: [], // queue of buy lots for FIFO: {qty, price}
            realized: 0,
            quantity: 0,
            marketPrice: tx.marketPrice || tx.price
          };
        }
        var m = map[s];
        if (tx.marketPrice) { m.marketPrice = tx.marketPrice; } // keep last marketPrice if provided
        if (tx.type === "BUY") {
          // push lot
          m.lots.push({ qty: tx.quantity, price: tx.price });
          m.quantity += tx.quantity;
        } else if (tx.type === "SELL") {
          var sellQty = tx.quantity;
          // reduce lots FIFO, calculate realized P&L
          while (sellQty > 0 && m.lots.length) {
            var lot = m.lots[0];
            if (lot.qty > sellQty) {
              // partial consume
              var costQty = sellQty;
              var cost = lot.price;
              m.realized += costQty * (tx.price - cost);
              lot.qty -= sellQty;
              m.quantity -= sellQty;
              sellQty = 0;
            } else {
              // consume whole lot
              m.realized += lot.qty * (tx.price - lot.price);
              m.quantity -= lot.qty;
              sellQty -= lot.qty;
              m.lots.shift();
            }
          }
          // if sells more than buys (short) we allow negative quantity (no cost basis)
          if (sellQty > 0) {
            // treat remaining sell as short (negative quantity)
            m.quantity -= sellQty;
            // set realized using zero cost basis (or skip)
            m.realized += sellQty * tx.price * 1; // conservative
            sellQty = 0;
          }
        }
      });
      // finalize aggregated entries
      var aHoldings = [];
      Object.keys(map).forEach(function (k) {
        var m = map[k];
        // compute avg cost (weighted by remaining lots)
        var totalCost = 0, totalQty = 0;
        m.lots.forEach(function (l) { totalCost += l.qty * l.price; totalQty += l.qty; });
        var avgCost = totalQty ? (totalCost / totalQty) : 0;
        var unrealized = m.quantity * (m.marketPrice - avgCost);
        aHoldings.push({
          symbol: m.symbol,
          name: m.name,
          quantity: m.quantity,
          avgCost: avgCost,
          marketPrice: m.marketPrice || 0,
          realized: m.realized,
          unrealized: unrealized,
          marketValue: m.quantity * (m.marketPrice || 0)
        });
      });
      // sort by marketValue desc
      aHoldings.sort(function (a,b) { return b.marketValue - a.marketValue; });
      return aHoldings;
    }
  });
});

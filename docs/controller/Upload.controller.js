sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast",
  "sap/m/MessageBox",
  "sap/ui/core/Fragment"
], function (Controller, JSONModel, MessageToast, MessageBox, Fragment) {
  "use strict";

  return Controller.extend("zStockAnalysis.controller.Upload", {
    onInit: function () {
      this._oComp = this.getOwnerComponent();
      this._oTxModel = this._oComp.getModel("transactions");
      this._oRealModel = this._oComp.getModel("realizations");
      this._oYearModel = this._oComp.getModel("summaryByYear");
      this._oTicketModel = this._oComp.getModel("summaryByTicket");
      this._mode = "year";

      // load saved mapping if present
      try {
        var saved = window.localStorage.getItem("zStockMapping");
        this._headerMap = saved ? JSON.parse(saved) : null;
      } catch (e) {
        this._headerMap = null;
      }

      this._oDetectedHeadersModel = new JSONModel({ headers: [] });
      this.getView().setModel(this._oDetectedHeadersModel, "detectedHeaders");
    },

    onModeChange: function (oEvent) {
      var idx = oEvent.getParameter("selectedIndex");
      this._mode = idx === 0 ? "year" : "ticket";
    },

    onOpenMapping: function () {
      // open mapping dialog using detected headers from last file if available
      var headers = (this._lastDetectedHeaders) ? this._lastDetectedHeaders : [];
      this._openMappingDialog(headers);
    },

    onFileChange: function (oEvent) {
      var aFiles = oEvent.getParameter("files") || [];
      if (!aFiles.length) return;
      var oFile = aFiles[0];
      var reader = new FileReader();
      var that = this;

      reader.onload = function (e) {
        try {
          var data = new Uint8Array(e.target.result);
          var wb = XLSX.read(data, { type: 'array' });
          var sName = wb.SheetNames[0];
          var ws = wb.Sheets[sName];
          var raw = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });

          // store raw and detected headers
          that._lastRaw = raw;
          var headers = (raw && raw.length) ? Object.keys(raw[0]) : [];
          that._lastDetectedHeaders = headers;
          that._oDetectedHeadersModel.setData({ headers: headers });

          // offer mapping dialog if no saved mapping or user wants to review
          if (!that._headerMap) {
            that._openMappingDialog(headers);
          } else {
            // auto-parse using saved mapping
            var aTx = that._normalizeRows(raw);
            that._oTxModel.setData({ transactions: aTx });
            MessageToast.show("File parsed: " + oFile.name + " (" + aTx.length + " rows) using saved mapping");
          }
        } catch (err) {
          MessageBox.error("Failed to parse file: " + err.message);
        }
      };

      reader.onerror = function () {
        MessageBox.error("File read error");
      };

      reader.readAsArrayBuffer(oFile);
    },

    _openMappingDialog: function (headers) {
      var that = this;
      // create mapping model with defaults (try to auto-detect)
      var defaultMap = this._autoDetectMapping(headers);
      this._mappingModel = new JSONModel(defaultMap);
      this.getView().setModel(this._mappingModel, "mapping");

      // ensure detected headers model exists
      this._oDetectedHeadersModel.setData({ headers: headers });

      // load fragment if not loaded
      if (!this._mappingDialog) {
        Fragment.load({
          name: "zStockAnalysis.view.Mapping",
          controller: this
        }).then(function (oDialog) {
          that._mappingDialog = oDialog;
          that.getView().addDependent(that._mappingDialog);
          that._mappingDialog.open();
        });
      } else {
        this._mappingDialog.open();
      }
    },

    _autoDetectMapping: function (headers) {
      // try to match common names
      var map = { date: null, symbol: null, name: null, type: null, qty: null, price: null, market: null, fees: null };
      headers.forEach(function (h) {
        var hn = h.trim().toLowerCase();
        if (!map.date && hn.match(/date/)) map.date = h;
        else if (!map.symbol && hn.match(/symbol|ticker|ticket/)) map.symbol = h;
        else if (!map.name && hn.match(/name/)) map.name = h;
        else if (!map.type && hn.match(/type|side/)) map.type = h;
        else if (!map.qty && hn.match(/qty|quantity|amount/)) map.qty = h;
        else if (!map.market && hn.match(/marketprice/)) map.market = h;
        else if (!map.price && hn.match(/price/)) map.price = h;
        else if (!map.fees && hn.match(/fee|commission/)) map.fees = h;
      });
      return map;
    },

    onMappingSave: function () {
      // save mapping from model
      var m = this._mappingModel.getData();
      this._headerMap = m;
      // persist mapping for next uploads
      try { window.localStorage.setItem('zStockMapping', JSON.stringify(m)); } catch (e) {}

      // if we have raw data waiting, parse it now
      if (this._lastRaw) {
        var aTx = this._normalizeRows(this._lastRaw);
        this._oTxModel.setData({ transactions: aTx });
        MessageToast.show("File parsed with mapping (" + aTx.length + " rows)");
        this._lastRaw = null; // consume
      }

      if (this._mappingDialog) this._mappingDialog.close();
    },

    onMappingCancel: function () {
      if (this._mappingDialog) this._mappingDialog.close();
    },

    _normalizeRows: function (aRows) {
      // Use header map if provided, otherwise auto-detect from first row
      if (!aRows || !aRows.length) return [];
      var map = this._headerMap || this._autoDetectMapping(Object.keys(aRows[0]));

      var aTx = [];
      aRows.forEach(function (r) {
        var symbol = r[map.symbol];
        if (!symbol) return;
        var dtRaw = r[map.date];
        var dt = null;
        if (dtRaw instanceof Date) dt = dtRaw;
        else if (typeof dtRaw === "number") {
          var d = XLSX.SSF.parse_date_code(dtRaw);
          if (d) dt = new Date(Date.UTC(d.y, d.m - 1, d.d));
        } else if (typeof dtRaw === "string") {
          var dd = new Date(dtRaw);
          if (!isNaN(dd)) dt = dd;
        }
        var type = (r[map.type] || "").toString().trim().toLowerCase();
        var qty = parseFloat(r[map.qty]) || 0;
        var price = parseFloat(r[map.price] || r[map.market]) || 0;
        var fees = parseFloat(r[map.fees]) || 0;
        var name = r[map.name] || "";

        if (type.indexOf("buy") >= 0) type = "BUY";
        else if (type.indexOf("sell") >= 0) type = "SELL";
        else { if (qty < 0) { type = "SELL"; qty = Math.abs(qty); } else { type = "BUY"; } }

        aTx.push({
          date: dt ? dt.toISOString().slice(0,10) : null,
          symbol: symbol.toString().toUpperCase().trim(),
          name: name,
          type: type,
          quantity: qty,
          price: price,
          fees: fees
        });
      });

      // sort by date asc
      aTx.sort(function (a,b) { if (!a.date) return 1; if (!b.date) return -1; return new Date(a.date) - new Date(b.date); });
      return aTx;
    },

    onGenerate: function () {
      var aTx = (this._oTxModel.getData() && this._oTxModel.getData().transactions) || [];
      if (!aTx.length) { MessageBox.information("No transactions loaded"); return; }

      var aReal = this._computeRealizations(aTx);
      this._oRealModel.setData({ realizations: aReal });

      // build summaries
      var byYear = {};
      aReal.forEach(function (r) {
        var year = (r.sellDate && r.sellDate.slice(0,4)) || "UNKNOWN";
        if (!byYear[year]) byYear[year] = { year: year, proceeds: 0, cost: 0, pnl: 0 };
        byYear[year].proceeds += r.proceeds;
        byYear[year].cost += r.cost;
        byYear[year].pnl += r.pnl;
      });
      var vYear = Object.keys(byYear).map(function (y) { return byYear[y]; }).sort(function(a,b){ return a.year - b.year; });
      this._oYearModel.setData({ summaryByYear: vYear });

      // summary by ticket/year/month
      var ticketMap = {};
      aReal.forEach(function (r) {
        var sym = r.symbol;
        var y = r.sellDate ? r.sellDate.slice(0,4) : "UNKNOWN";
        var m = r.sellDate ? (r.sellDate.slice(5,7)) : "00";
        if (!ticketMap[sym]) ticketMap[sym] = { symbol: sym, years: {} };
        var t = ticketMap[sym];
        var key = y + "-" + m;
        if (!t.years[key]) t.years[key] = { year: y, month: m, proceeds: 0, cost: 0, pnl: 0, realizations: [] };
        t.years[key].proceeds += r.proceeds;
        t.years[key].cost += r.cost;
        t.years[key].pnl += r.pnl;
        t.years[key].realizations.push(r);
      });

      var ticketSummary = Object.keys(ticketMap).map(function (s) {
        var t = ticketMap[s];
        var yearsArr = Object.keys(t.years).map(function (k) { return t.years[k]; }).sort(function(a,b){ if (a.year === b.year) return a.month - b.month; return a.year - b.year; });
        return { symbol: t.symbol, years: yearsArr };
      });

      this._oTicketModel.setData({ summaryByTicket: ticketSummary });

      MessageToast.show("Analysis complete (" + aReal.length + " realized chunks)");
    },

    _computeRealizations: function (aTx) {
      var map = {};
      var realizations = [];

      aTx.forEach(function (tx) {
        var s = tx.symbol;
        if (!map[s]) map[s] = { lots: [] };
        var entry = map[s];

        if (tx.type === "BUY") {
          entry.lots.push({ remainingQty: tx.quantity, originalQty: tx.quantity, price: tx.price, date: tx.date, fees: tx.fees || 0 });
        } else if (tx.type === "SELL") {
          var sellQty = tx.quantity;
          var sellPrice = tx.price;
          var sellFees = tx.fees || 0;
          var totalSellQty = sellQty;

          while (sellQty > 0 && entry.lots.length) {
            var lot = entry.lots[0];
            var matched = Math.min(lot.remainingQty, sellQty);

            var buyFeeShare = 0;
            if (lot.fees && lot.originalQty) buyFeeShare = (matched / lot.originalQty) * lot.fees;

            var sellFeeShare = 0;
            if (sellFees && totalSellQty) sellFeeShare = (matched / totalSellQty) * sellFees;

            var cost = matched * lot.price + buyFeeShare;
            var proceeds = matched * sellPrice - sellFeeShare;
            var pnl = proceeds - cost;

            realizations.push({ symbol: s, buyDate: lot.date, buyPrice: lot.price, sellDate: tx.date, sellPrice: sellPrice, quantity: matched, cost: cost, proceeds: proceeds, pnl: pnl });

            lot.remainingQty -= matched;
            if (lot.remainingQty <= 0) entry.lots.shift();
            sellQty -= matched;
          }

          if (sellQty > 0) {
            var sellFeeShare = sellFees;
            var cost = 0;
            var proceeds = sellQty * sellPrice - sellFeeShare;
            var pnl = proceeds - cost;
            realizations.push({ symbol: s, buyDate: null, buyPrice: 0, sellDate: tx.date, sellPrice: sellPrice, quantity: sellQty, cost: cost, proceeds: proceeds, pnl: pnl, unmatched: true });
            sellQty = 0;
          }
        }
      });

      return realizations;
    }
  });
});

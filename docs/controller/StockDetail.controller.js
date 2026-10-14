sap.ui.define(["sap/ui/core/mvc/Controller", "sap/ui/model/json/JSONModel"], function (Controller, JSONModel) {
  "use strict";

  return Controller.extend("zStockAnalysis.controller.StockDetail", {
    onInit: function () {
      this._oComp = this.getOwnerComponent();
      this._oTransactionsModel = this._oComp.getModel("transactions");
      this._oSelected = this._oComp.getModel("selectedStock");
      // set formatter for view
      this.getView().formatDetailSummary = this.formatDetailSummary.bind(this);
      // listen to selectedStock changes to refresh chart and transaction list
      this._oSelected.attachRequestCompleted && this._oSelected.attachRequestCompleted(function(){});
      // but better use model property change
      this._oSelected.attachPropertyChange && this._oSelected.attachPropertyChange(this._onSelectedChange, this);
    },

    onBeforeRendering: function () {
      // ensure we update when selectedStock changes
      this._onSelectedChange();
    },

    _onSelectedChange: function () {
      var oSelectedData = this._oSelected.getData() || {};
      var sSymbol = oSelectedData.symbol;
      if (!sSymbol) {
        // clear viz model
        var oViz = this.byId("priceViz");
        if (oViz) oViz.setModel(new JSONModel({ history: [] }));
        return;
      }
      // filter transactions for this symbol and pass to VizFrame and table
      var aAll = (this._oTransactionsModel.getData() && this._oTransactionsModel.getData().transactions) || [];
      var aFiltered = aAll.filter(function (t) { return t.symbol === sSymbol; });
      // create a simple history series: use transaction date and price; can be expanded to daily series
      var aHistory = aFiltered.map(function (t) {
        return { date: t.date, price: t.price };
      });
      // if there is no history, create a point from selectedStock marketPrice
      if (!aHistory.length && oSelectedData.marketPrice) {
        aHistory.push({ date: new Date().toISOString().slice(0,10), price: oSelectedData.marketPrice });
      }
      // set to VizFrame model (root path /history)
      var oVizModel = new JSONModel({ history: aHistory });
      this.byId("priceViz").setModel(oVizModel);
      // also ensure the transactions table is bound to the transactions model but filtered - easiest is to set a temporary model with only filtered TX
      var oTxModel = new JSONModel({ transactions: aFiltered });
      this.getView().setModel(oTxModel, "transactions");
    },

    formatDetailSummary: function (aParts) {
      // parts: [quantity, avgCost, marketPrice]
      var qty = aParts[0] || 0, avg = aParts[1] || 0, mkt = aParts[2] || 0;
      return "Qty: " + qty.toFixed(2) + " | Avg cost: " + avg.toFixed(2) + " | Mkt: " + mkt.toFixed(2);
    }
  });
});

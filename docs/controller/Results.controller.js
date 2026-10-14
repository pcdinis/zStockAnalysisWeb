sap.ui.define(["sap/ui/core/mvc/Controller", "sap/ui/model/json/JSONModel", "sap/m/MessageToast"], function (Controller, JSONModel, MessageToast) {
  "use strict";
  return Controller.extend("zStockAnalysis.controller.Results", {
    onInit: function () {
      this._oComp = this.getOwnerComponent();
      this._oRealModel = this._oComp.getModel("realizations");
      this._oTicketModel = this._oComp.getModel("summaryByTicket");
      this._oYearModel = this._oComp.getModel("summaryByYear");
    },

    fmt: function (v) {
      if (v == null) return "";
      return Number(v).toFixed(2);
    },

    onShowDetails: function (oEvent) {
      MessageToast.show("Scroll to Details below for rundown (export to CSV for file).");
    },

    onExportCsv: function () {
      var aData = (this._oRealModel.getData() && this._oRealModel.getData().realizations) || [];
      if (!aData.length) {
        MessageToast.show("No data to export");
        return;
      }

      var header = ["symbol","buyDate","buyPrice","sellDate","sellPrice","quantity","cost","proceeds","pnl"];
      var rows = aData.map(function (r) {
        return [
          r.symbol || "",
          r.buyDate || "",
          (r.buyPrice != null ? Number(r.buyPrice).toFixed(2) : ""),
          r.sellDate || "",
          (r.sellPrice != null ? Number(r.sellPrice).toFixed(2) : ""),
          (r.quantity != null ? r.quantity : ""),
          (r.cost != null ? Number(r.cost).toFixed(2) : ""),
          (r.proceeds != null ? Number(r.proceeds).toFixed(2) : ""),
          (r.pnl != null ? Number(r.pnl).toFixed(2) : "")
        ].map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(",");
      });

      var csv = header.join(",") + "\n" + rows.join("\n");
      var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "realizations.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  });
});

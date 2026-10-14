sap.ui.define([
  "sap/ui/core/UIComponent",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/resource/ResourceModel",
  "sap/ui/Device"
], function (UIComponent, JSONModel, ResourceModel, Device) {
  "use strict";
  return UIComponent.extend("zStockAnalysis.Component", {
    metadata: {
      manifest: "json"
    },

    init: function () {
      UIComponent.prototype.init.apply(this, arguments);

      // device model
      var oDeviceModel = new JSONModel(Device);
      oDeviceModel.setDefaultBindingMode("OneWay");
      this.setModel(oDeviceModel, "device");

      // i18n
      var oI18n = new ResourceModel({
        bundleName: "zStockAnalysis.i18n.i18n"
      });
      this.setModel(oI18n, "i18n");

      // Transactions model (empty until file uploaded)
      var oTransactions = new JSONModel({ transactions: [] });
      this.setModel(oTransactions, "transactions");

      // Aggregated holdings model
      var oHoldings = new JSONModel({ holdings: [] });
      this.setModel(oHoldings, "holdings");

      // Selected stock/detail model
      var oSelected = new JSONModel({});
      this.setModel(oSelected, "selectedStock");
    }
  });
});

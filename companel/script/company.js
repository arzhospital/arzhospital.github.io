var company = {
    Code: "COM/panel",
    Required: ["Underscore", "Moment", "ZingChart", "DataTables"],
    Responsive: true,
    Name: "Analytics Portal",
    library: "",
    OnPageLoad: () => {
        OnPageLoad();
    },
};

/* for web version */
if (window.location.href.indexOf("/nammour.com/") <= -1) {
    company.Store = "store/companel/";
}

/* for mobile version */
// company.Store = "http://www.nammour.com/store/";

var CMS_ROOT = "Hosted/" + company.Code + "/";
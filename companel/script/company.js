var company = {
    Code: "COM/panel",
    Required: ["Underscore", "Moment", "ZingChart", "DataTables", "Juxtapose"],
    Responsive: true,
    Name: "Analytics Portal",
    library: "",
    GACode: 'UA-148842067-1',
    OnPageLoad: () => {
        new window.Main().OnPageLoad();
    },
};

/* for web version */
if (window.location.href.indexOf("/nammour.com/") <= -1) {
    company.Store = "store/companel/";
}

/* for mobile version */
// company.Store = "http://www.nammour.com/store/";

var CMS_ROOT = "Hosted/" + company.Code + "/";
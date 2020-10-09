var company = {
	Code: "arzhospital",
	Required: ["NOTY", "Moment", "JQuery UI", "ZingChart", "printThis", "Underscore", "Tabulator", "JSZip"],
	Responsive: true,
	OnPageLoad: async (data) => {
		try {
			$('#tab-container').easytabs();
		} catch (ex) {}
	},
	GACode: 'UA-148842067-1',
	Name: "Arz Hospital",
	restiodbSettings: () => {
		return {
			//"async": true,
			//"crossDomain": true,
			"url": "https://headless-d8aa.restdb.io/rest/",
			"headers": {
				"content-type": "application/json",
				"x-apikey": "5d9051021ce70f6379855129",
				"cache-control": "no-cache"
			},
			"processData": false,
		};
	},
	headlesSettings: () => {
		var ret = company.restiodbSettings();
		ret.url += "postdata";
		return ret;
	},
};

/* for web version */
if (window.location.href.indexOf("/nammour.com/") <= -1) {
	company.Store = "store/" + ('arzstatus' || company.Code) + "/";
}

/* for mobile version */
// company.Store = "http://www.nammour.com/store/";

var CMS_ROOT = "Hosted/" + company.Code + "/";
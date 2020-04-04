window.ReportPage = class {
	constructor(page) {
		this.page = page;
	}

	async ShowYear(year) {
		let s = new ReportSection(year, company.Code);

		$("#chtResults-" + year).html("Fetching " + this.page.data._section + " for " + year + "...");

		zingchart.render({
			id: "chtResults-" + year,
			data: s._asZingOptions(s._data(await s._run(window.gviews.find(g => g.Name == this.page.data._section), ['taken']), 'bar', this.page.data._section)),
			height: '600',
			width: '100%'
		});

		$("#chtResults-" + year).html("");
		zingchart.exec("chtResults-" + year, "toggledimension");

		typeof (ga) !== "undefined" ? ga('send', {
			hitType: 'event',
			eventCategory: 'CorporateMeasures',
			eventAction: 'ReportSection',
			eventLabel: company.Code + "/" + this.page.data._section + "/" + year
		}): null;

		if (!window.sr.bLocal || window.sr.$_REQUEST("cacheResult") != "sr") return;
		if (typeof window.___doCache === "undefined") {
			window.___doCache = confirm('Generate Website Cache?');
		}
		if (!window.___doCache) return;

		if (year >= moment().year()) {
			year = 2014;
			for (var i = 0; i < gviews.length - 1; i++) {
				if (gviews[i].Name == this.page.data._section) {
					$("#menu-" + (i + 1)).trigger("click");
					return;
				}
			}
			return window._FrEMD.downloadSRCache();
		}
		$("#section-" + (year + 1)).trigger("click");
	}

	async main() {
		for (var i = 0; i < gviews.length; i++) {
			if (gviews[i].Name != this.page.data._section) continue;

			if (!gviews[i].KeyFields || !gviews[i].KeyFields.length) {
				// make it depth=2
				//console.log("Finding gview " + gviews[i].Name + " with depth=2");
				gviews[i] = await window.sr._("CorporateMeasures.comGroupViewFind", null, {
					Id: gviews[i].Id
				}, null, 2);
			}
		}

		await window._FrEMD.end();
		this.ShowYear(2014);
	}
}
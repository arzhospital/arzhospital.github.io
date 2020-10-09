window.MainComponent = class {
	constructor(page) {
		this.page = page;
	}

	async DoLogin(username, password) {
		let ret = await new Employee().username(username, '=').password(password, '=').findAll();

		if (ret.length) {
			window.me = ret[0];
			window._FrEMD.RenderPage({
				_code: 'index'
			});
		}
	}

	async _resolve(ar, mField, table) {
		let dFields = [];
		ar.forEach(gv => gv[mField].forEach(kf => {
			dFields.push(kf.Id);
		}));
		dFields = await sr._(`CorporateMeasures.com${table}Findall`, null, {
			THIS: [...new Set(dFields)].map(df => {
				return {
					Id: df
				};
			})
		});
		ar.forEach(gv => $.each(gv[mField], (i, kf) => gv[mField][i] = dFields.find(df => df.Id === kf.Id)));
		return ar;
	}

	async main() {
		if (typeof ReportSection === "undefined") {
			let ret = await sr._("ContentManager.cmsHTMLPageFindall", null, {
				Page: "Hosted/COM/ReportSection"
			});
			sr.runScript(ret[0].Script);
			console.log("Loaded ReportSection");
		}

		if (typeof gviews === "undefined") {
			let gviews = await sr._("CorporateMeasures.comGroupViewFindall", null, {
				Enabled: true,
				User: {
					Active: true,
					UserOrganizations: [{
						Code: company.Code
					}]
				}
			}, null, null, null, null, null, null, 2);

			gviews = await this._resolve(gviews, "KeyFields", "DataField");
			gviews = await this._resolve(gviews, "Aggregations", "Aggregation");
			gviews = await this._resolve(gviews, "DataMapValues", "DataMapValue");

			window.gviews = gviews;
			console.log("Loaded gviews", gviews.length);
		}
	}
};
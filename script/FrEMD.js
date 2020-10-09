window.FrEMD = class {
	//export default class FrEMD {
	constructor() {
		this.settings = null;
		this.bDebug = false;

		this.headerHTML = "";
		this.footerHTML = "";
		this.contentHTML = "";

		this.landingPage = true;

		this.pages = [];

		this.allHTML = "";
		this.allData = {};
		this.allOptions = null;

		this.required = [];

		this.loading = {
			steps: 15,
			loader: null,
			position: 0
		};

		this.hash = {};
		this._calls = [];

		this.endCalled = false;
	}

	validURL(str) {
		var pattern = new RegExp('^(https?:\\/\\/)?' + // protocol
			'((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
			'((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
			'(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
			'(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
			'(\\#[-a-z\\d_]*)?$', 'i'); // fragment locator
		return !!pattern.test(str);
	}

	_attr(ea) {
		try {
			return $.grep(Object.keys(ea), k => !k.indexOf("Is")).find(k => ea[k]).replace('Is', '');
		} catch (ex) {
			return null;
		}
	}

	_sqlType(ea) {
		switch (this._attr(ea)) {
		case "String":
			return "VARCHAR(255)";
		case "Text":
			return "VARCHAR(4000)";
		case "Bool":
			return "BIT";
		case "Date":
			return "DATETIME";
		case "Int":
			return "INTEGER";
		case "Long":
			return "BIGINT";
		case null:
			return "BIGINT";
		default:
			return this._attr(ea) + "(40)";
		}
	}

	async import(module, bAsync) {
		if (Array.isArray(module)) {
			for (var m of module) {
				await this.import(m, bAsync);
			}
			return;
		}

		try {
			return await import(module);
		} catch (ex) {}

		var js = null;
		try {
			js = await this.preCompile({
				_code: module
			}) || await $.ajax({
				url: "templates" + this.m() + "/" + module + ".js" + this.randURL(),
				dataType: "text",
			});
		} catch (ex) {}
		if (!js) {
			js = await sr._("ContentManager.cmsHTMLPageFind", null, {
				Page: module.indexOf('/') >= 0 ? module : (CMS_ROOT + module)
			});
			if (js) js = js.Script;
		}
		if (!js) return null;
		return await this.runScript(js, bAsync);
	}

	_toJS(o) {
		let json = JSON.stringify(o, (key, value) => {
			// if we get a function, give us the code for that function  
			if (typeof value === 'function') {
				return value.toString();
			}
			return value;
		});
		return `JSON.parse((json => typeof(atob)==="undefined"?Buffer.from(json, "base64").toString():atob(json))("${btoa(unescape(encodeURIComponent(json)))}"), (key, value) => {if (typeof value === "string" && (value.indexOf("function ") === 0 || value.indexOf("=>") > 0)) {return eval("(" + value + ")");}return value;})`;
	}

	async require(libName) {
		for await (const n of $.grep(this.hrefs, l => l.lib === libName && this._include(l))) {
			n.requires = n.requires || [];
			for await (const r of n.requires) {
				await this.require(r);
			}

			for (const c of Array.isArray(n.css) ? n.css : [n.css]) {
				this._css(c);
				//calls.push(this._css(c));
			}
			var modules = [];
			for await (const s of Array.isArray(n.src) ? n.src : [n.src]) {
				try {
					if (s.Name) {
						// stored script
						let _sc = await sr._("ContentManager.cmsStoredScriptFind", null, s);
						await sr.runScript(_sc.Script);
					} else if (n.module) {
						modules.push(await import(s));
					} else {
						await $.ajax({
							url: s,
							dataType: "script",
							cache: n.cache
						});
					}
				} catch (ex) {}
			}
			if (n.load) {
				try {
					n.load(modules);
				} catch (ex) {}
			}
		}
		console.log("require[" + libName + "]");
	}

	async preInit() {
		window.bLocal = location.href.indexOf('/nammour.com') > -1;
		this.hrefs = await this.import("../../" + (window.bLocal ? "../ems/" : "") + "script/modules");

		window._FrEMD = this;
		this.fromHash();

		$(window).on('hashchange', () => {
			this.fromHash();

			if (this.hash.pageid) this.RenderPage({
				_code: this.hash.pageid
			});
		});

		await this.require("Company");
		await this.require("ServiceRouter");
		if (company.OnBeforeRequire) await company.OnBeforeRequire();

		this._initServiceRouter();
		for await (const l of company.Required) {
			await this.require(l);
		}
		await this._loadEntityClasses();
		console.log("Done Loading");
	}

	excelToJSON(data, start, count) {
		if (typeof (XLSX) === "undefined") return [];

		try {
			var workbook = XLSX.read(data, {
				type: 'binary',
				sheetRows: 0 /*start + "-" + (start + count)*/
			});
			//var range = XLSX.utils.decode_range(workbook.Sheets[workbook.SheetNames[0]]['!ref']);
			var sheet = workbook.Sheets[workbook.SheetNames[0]];
			return XLSX.utils.sheet_to_json(sheet);
		} catch (e) {
			//throw e;
			console.log("ERROR:", e);
			return [];
		}
	}

	async downloadSRCache(code, filename) {
		code = code || company.Code
		if (typeof (JSZip) === "undefined") {
			await this.require("JSZip");
		}

		var zip = new JSZip();
		let cache = await sr._(
			'ContentManager.cmsMethodResultFindall',
			null, {
				Code: code + '-',
			}
		);
		$.each(cache, (_, r) => {
			zip.file(r.Code.replace(code + '-', '') + '.js', r.Result);
		});
		console.log(cache.length);

		zip.generateAsync({
			type: 'blob'
		}).then(function (content) {
			//location.href = 'data:application/zip;base64,' + content;
			saveAs(content, filename || 'srCache.zip');
		});
	}

	async _getBlock(block) {
		var html = null;
		var js = null;
		try {
			html = await $.get("blocks" + this.m() + "/" + block + ".htm" + this.randURL());
		} catch (ex) {
			//console.log(ex);
		}
		try {
			js = await this.preCompile({
				_code: block
			}, "blocks") || await $.ajax({
				url: "blocks" + this.m() + "/" + block + ".js" + this.randURL(),
				dataType: "text",
			});
			if (js) {
				js = await this.runScript(js);

				if (typeof (js) === "function" && typeof (js.constructor) === "function") {
					try {
						var obj = new js();
						if (obj && obj.main) {
							console.log("Calling " + block + ".main()");
							await obj.main();
						}
					} catch (ex) {
						console.log(ex);
					}
				}

			}
		} catch (ex) {
			console.log(ex);
		}

		if (js && !html && typeof (React) !== "undefined" && window[block + "Component"]) {
			html = "<" + block + "Component/>";
		}

		this.step();
		console.log(block + " loaded");
		return html || "";
	}

	async _loadContent() {
		this.mainHTML = await this._getBlock("main");
		this.headerHTML = await this._getBlock("header");
		this.footerHTML = await this._getBlock("footer");
		this.contentHTML = await this._getBlock("content");

		window.lang = this.hash.lang || company.Language || 'en';

		if (company.GACode) {
			// google analytics
			console.log("including google analytics");
			(function (i, s, o, g, r, a, m) {
				i['GoogleAnalyticsObject'] = r;
				i[r] = i[r] || function () {
					(i[r].q = i[r].q || []).push(arguments);
				}, i[r].l = 1 * new Date();
				a = s.createElement(o),
					m = s.getElementsByTagName(o)[0];
				a.async = 1;
				a.src = g;
				m.parentNode.insertBefore(a, m);
			})(window, document, 'script', 'https://www.google-analytics.com/analytics.js', 'ga');
			ga('create', company.GACode, 'auto');
		}

		return this.RenderPage({
			_code: (this.hash.page || 'index')
		});
	}

	async initDOM() {
		window._FrEMD = this;

		window.document.body.style.visibility = 'hidden';
		await this.preInit();
		try {
			await ((company && company.OnPageLoad) ? company.OnPageLoad : async () => {})();
		} catch (ex) {
			console.log("FrEMD.initDOM.OnPageLoad", ex);
		}

		if (frames[0].reRender) {
			frames[0].reRender();
		}

		await this._bindKO();
	}

	async _bindKO() {
		if (typeof (ko) !== "undefined") {
			this.fromHash();
			if (!this.hash.noBinding && company.Bindings) {
				let arBindings = await company.Bindings();
				sr.groupBy(arBindings, "_path").forEach(pb => {
					try {
						let e = window.frames[0].document.evaluate(pb.key, window.frames[0].document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

						let d_bind = [];
						pb.values.forEach(b => {
							d_bind.push(b.attribute() + ": " + b.code());
						});
						$(e).attr("data-bind", d_bind.join(', '));
						//console.log(pb.key, e);
					} catch (ex) {
						console.log(pb.key, ex);
					}
				});
			}

			setTimeout(() => {
				ko.cleanNode(window.frames[0].document.body);
				ko.applyBindings(window, window.frames[0].document.body);
				window.title = window.frames[0].document.title; //??
				window.document.body.style.visibility = 'visible';
			}, 300);
		}
	}

	async init() {
		await this.preInit();
		return await this._loadContent();
	}

	_uuid() {
		return typeof (uuid) !== "undefined" ? uuid() : Math.floor(Math.random(new Date()) * Math.pow(10, 10));
	}

	async _loadEntityClasses(ec, scope) {
		scope = scope || "window";

		let eas = [];
		if (ec && ec.library && !Array.isArray(ec)) {
			let lcs = await sr._("ContentManager.cmsGenerateLayerClass", null, ec.library);

			$.each(lcs, (_, c) => $.each(c.LayerAttributes, (_, la) => eas.push({
				Active: true,
				Enabled: true,
				Id: this._uuid(),
				Name: la.Name,
				Plural: la.Name + "s",
				//LayerAttribute: la,
				IsBool: la.NativeType == "bool",
				IsString: la.NativeType == "string",
				IsText: la.NativeType == "text",
				IsLong: la.NativeType == "long",
				IsFloat: la.NativeType == "float",
				IsInt: la.NativeType == "integer",
				IsDouble: la.NativeType == "double",
				IsDate: la.NativeType == "datetime",
				IsFile: la.NativeType == "file",
				IsImage: la.NativeType == "image",
				EntityClass: {
					Id: sr.hashCode(c.Name),
					Name: c.Name,
					Plural: c.Name + "s",
					Active: true,
					Date: new Date(),
					Remark: "",
					Company: {
						Id: sr.hashCode(company.Name),
						Name: company.Name
					},
					Group: {
						Id: sr.hashCode("Main"),
						Name: "Main"
					}
				},
			})));

			$.each(lcs, (_, c) => $.each($.grep(c.RelationAttributes, ra => !ra.IsArray), (_, ra) => eas.push({
				Active: true,
				Enabled: true,
				Id: this._uuid(),
				Name: ra.Name,
				Plural: ra.Name + "s",
				//LayerAttribute: ra,
				IsBool: false,
				IsString: false,
				IsText: false,
				IsLong: false,
				IsFloat: false,
				IsInt: false,
				IsDouble: false,
				IsDate: false,
				IsFile: false,
				IsImage: false,
				EntityType: {
					Id: sr.hashCode(ra.RelationClass.Name),
					Name: ra.RelationClass.Name,
				},
				EntityClass: {
					Id: sr.hashCode(c.Name),
					Name: c.Name,
					Plural: c.Name + "s",
					Active: true,
					Date: new Date(),
					Remark: "",
					Company: {
						Id: sr.hashCode(company.Name),
						Name: company.Name
					},
					Group: {
						Id: sr.hashCode("Main"),
						Name: "Main"
					}
				},
			})));
		} else {
			eas = await window.sr._("EnterpriseManager.emsEntityAttributeFindall", null, {
				EntityClass: ec || {
					Company: {
						Code: company.Code
					}
				}
			});
		}
		this.step();

		let ret = null;
		if (!Array.isArray(ec)) {
			var classes = window.sr.groupBy(eas, "EntityClass");
			var tClasses = window.sr.groupBy(eas, "EntityType");
			$.each(classes, (_, c) => {
				c.key.EntityAttributes = c.values;
				var tas = tClasses.find(tc => tc.key && c.key && tc.key.Id === c.key.Id);
				c.key.TypedAttributes = tas ? tas.values : [];
			});
			ret = classes.map(a => a.key);
		} else {
			$.each(ec, (_, c) => {
				if (typeof (c.TypedAttributes) === "undefined") c.TypedAttributes = [];
				if (typeof (c.Id) === "undefined") c.Id = this._uuid();
				if (typeof (c.Plural) === "undefined") c.Plural = c.Name + "s";
				$.each(c.EntityAttributes, (_, ea) => {
					if (typeof (ea.Id) === "undefined") ea.Id = this._uuid();
					if (typeof (ea.EntityClass) === "undefined") ea.EntityClass = c;
					if (typeof (ea.EntityType) !== "undefined") ea.EntityType = ec.find(_c => _c.Name == ea.EntityType.Name);
				});
				$.each(c.TypedAttributes, (_, ta) => {
					if (typeof (ta.Id) === "undefined") ta.Id = this._uuid();
					if (typeof (ta.EntityClass) === "undefined") ta.EntityClass = c;
				});
			});

			ec = $.grep(ec, c => typeof (c.Active) === "undefined" || c.Active);
			$.each(ec, (_, c) => {
				c.EntityAttributes = $.grep(c.EntityAttributes || [], ea => typeof (ea.Active) === "undefined" || ea.Active);
			});
			ret = ec;
		}

		if (typeof (window[scope]) === "undefined") window[scope] = {};
		window[scope].EntityClasses = ret;

		let html = await $.get((sr.bLocal ? "/nammour.com/ems/" : "") + "script/EntityClass.jst" + "?rand=" + Math.random());

		for await (const m of [...(html.matchAll(/(<%=).[\w\-.]+[\.](js)(%>)/gm))]) {
			let code = await $.get((sr.bLocal ? "/nammour.com/ems/" : "") + "script/" + m[0].replace("<%=", "").replace("%>", "") + "?rand=" + Math.random());
			html = html.replace(m[0], code);
		}

		this.step();
		window[scope].GenericServiceAPI = GenericServiceAPI;
		$.each(ret, (_, c) => {
			let code = this._inject(html, {
				c: c,
				scope: scope
			}) + '\n' + c.Name.replace(/ /g, '_');
			if (typeof (beautifier) !== "undefined") {
				code = beautifier.js(code);
			}
			window[scope][c.Name.replace(/ /g, '_')] = sr.runScript(code);
		});
	}

	_initServiceRouter() {
		window.sr = new ServiceRouter();
		window.sr.Store = company.Store;
		window.sr.init(null, company.library || "EnterpriseManager", true, this.bDebug);
		if (typeof srURL !== 'undefined') window.sr.srURL = srURL;

		window.sr.fLoadingStart = () => {
			if ($.mobile) $.mobile.loading('show');
		};

		window.sr.fLoadingEnd = () => {
			if ($.mobile) $.mobile.loading('hide');
		};
	}

	_include(_href) {
		return !(_href.disabled ||
			(_href.type && this.isMobile() && _href.type != "mobile") ||
			(_href.type && !this.isMobile() && _href.type == "mobile")
		);
	}

	_css(link) {
		return $("<link/>", {
			rel: "stylesheet",
			type: "text/css",
			href: link
		}).appendTo("head");
	}

	toBase64(url, data, mime) {
		mime = (mime || 'application/octet-stream');
		var prefix = 'data:' + mime + ';base64,';
		var _data = this._inject($.ajax({
			url: url + '?' + Math.random(),
			async: false
		}).responseText, data);
		//_data = 'this is a test';
		return window.URL.createObjectURL(new Blob([_data]), {
			type: mime
		});
		//return prefix + /*encodeURIComponent*/ atob();
	}

	toPDF(filename, pages) {
		if (!pages || !pages.length) pages = [document.body];
		let pdf = new jsPDF('p', 'mm', 'a4');

		var calls = $.map(pages, p => html2canvas(p, {
			scale: 1
		}));
		$.when(...calls).then((...arCanvas) => {
			$.each(arCanvas, (i, c) => {
				if (i) pdf.addPage();
				pdf.addImage(c.toDataURL('image/png'), 'PNG', 0, 0, 200, 200);
			});

			pdf.save(filename);
		});
	}

	step() {
		try {
			if (!loading.loader) {
				$("body").append("<center><div id='topLoader'></div></center>");
				loading.loader = $("#topLoader").percentageLoader({
					width: 256,
					height: 256,
					controllable: true,
					progress: 0,
					onProgressUpdate: (val) => {
						loading.loader.setValue(Math.round(val * 100.0));
					}
				});
			}
		} catch (e) {
			/*console.log("%LOADER: " + e.message);*/
		}

		try {
			loading.loader.setProgress((loading.position++) / loading.steps);
			//loading.loader.setValue(100*loading.position/loading.steps + '%');
		} catch (e) {
			/*console.log("%LOADER: " + e.message);*/
		}
	}

	setURL(url) {
		location.hash = "#" + url;
		this.fromHash();

		history.pushState({
			_code: this.allData.page._code
		}, this.allData.page._title, this.toHash());
		return this.RenderPage({
			_code: (this.hash["page"] || 'index')
		});
	}

	fromHash() {
		this.hash = {};
		$.each(window.location.hash.replace("#", "").split("&"), (i, value) => {
			value = value.split("=");
			this.hash[value[0]] = value[1];
		});
		return this.hash;
	}

	toHash() {
		var ret = "#";
		for (var p in this.hash) {
			ret += p + "=" + this.hash[p];
		}
		return ret;
	}

	stripHTML(dirtyString) {
		return dirtyString.replace(/<[^>]*>/g, "");
	}

	Equals(a, b) {
		// null and undefined are treated as the same: equal
		var _a = a || null;
		var _b = b || null;
		if (_a === _b) return true;
		if (!_a || !_b) return false; // one is null and the other is not

		// if(typeof a === 'undefined' || typeof b === 'undefined') return false; // one is undefined
		if ((_a.toEntityObject && !_b.toEntityObject) || (_b.toEntityObject && !_a.toEntityObject)) return false; // both should be either EMS or non EMS objects

		//console.log("Equals: at this point: a="+_a+", b="+_b);

		// safe: both either EMS or non EMS
		if (_a.toEntityObject) return _a.Equals(_b); // EMS bundels the Equals functions
		if (_a.Id && _b.Id && _a.Id == _b.Id) return true;
		return false;
	}

	buildTree(arNodes, sParent, sChildren, nParent) {
		// find the children of the nParent node
		var children = [];
		for (var i = 0; i < arNodes.length; i++) {
			try {
				if (nParent) {
					try {
						//console.log("Node: " + arNodes[i]._name + ", Parent: " + nParent._name + ", Equal: " + (arNodes[i][sParent].Equals(nParent)));
					} catch (e) {
						//console.log("WHAT? " + nParent._name + ", " + e.message);
					}
				}
				if (arNodes[i][sParent] == nParent || (arNodes[i][sParent] && arNodes[i][sParent].Equals && arNodes[i][sParent].Equals(nParent)) || (arNodes[i][sParent].Id && arNodes[i][sParent].Id == nParent.Id)) {
					//if(nParent) console.log("found child of " + nParent._name + ": " + arNodes[i]._name);
					//if(!nParent) console.log("found root node : " + arNodes[i]._name);
					children[children.length] = arNodes[i];
				}
			} catch (e) {
				//console.log("i=" + i + ", " + e.message);
			}
		}

		if (nParent) nParent[sChildren] = children;

		for (i = 0; i < children.length; i++) {
			//console.log("Building subtree");
			buildTree(arNodes, sParent, sChildren, children[i]);
		}
	}


	m() {
		return (this.isMobile() ? "" : "/d");
		//return "";
	}

	isMobile() {
		//return window.sr.isMobile;
		try {
			if (company.Responsive) return false;
		} catch (e) {}

		var check = false;
		((a, b) => {
			if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) check = true
		})(navigator.userAgent || navigator.vendor || window.opera);
		return check;
	}

	_error(msg, delay) {
		if (typeof (noty) !== "undefined") {
			noty({
				text: msg,
				type: 'error',
				timeout: delay
			});
		} else {
			// the default
			$("<div title='Error'><p>" + msg + "</p></div>").dialog();
		}
	}

	_alert(msg, delay) {
		if (typeof (noty) !== "undefined") {
			noty({
				text: msg,
				type: 'success',
				timeout: delay
			});
		} else {
			// the default
			$("<div title='Information'><p>" + msg + "</p></div>").dialog();
		}
	}

	myReplace(s, arFrom, arTo) {
		for (var i = 0; i < arFrom.length; i++) {
			s = s.replace(new RegExp(arFrom[i], 'g'), arTo[i]);
		}
		return s;
	}

	img(dImg) {
		return "data:image/png;base64," + dImg;
	}

	_inject(html, data) {
		if (!html) return html;

		if (typeof EJS !== 'undefined') {
			return new EJS({
				text: html
			}).render(data);
		} else if (typeof doT !== 'undefined') {
			var tempFn = doT.template(html);
			return tempFn(data);
		} else if (typeof _ === 'function' && typeof _.template !== 'undefined') {
			return _.template(html)(data);
		} else if (typeof Handlebars !== 'undefined') {
			var template = Handlebars.compile(html);
			return template(data);
		} else {
			return html;
		}
	}

	async end(fCallBack, data) {
		if (this.endCalled) return;
		this.endCalled = true;

		if (!data) data = window.page.data || {};

		//data.pages = this.allData.pages;
		//data.page = this.allData.page;

		await this.doCalls();
		if (fCallBack) {
			await fCallBack();
		}

		//console.log("end() with data", data);
		var sHTML = this._inject(this.allHTML, data);

		var oContent = $('body');

		if (!this.isMobile()) {
			oContent.html(sHTML);

			//oContent.hide();
			//oContent.fadeIn(1000);
			document.title = company.Name;
		} else {
			var oPage = $(sHTML);
			oPage.appendTo($.mobile.pageContainer);

			var old = true;
			this.allOptions = this.allOptions || {};
			if (old) {
				this.allOptions.dataUrl = this.allData.page._code;
				if ($.mobile) $.mobile.activePage.remove();
				if ($.mobile) $.mobile.changePage(oPage, this.allOptions);
			} else {
				$("document").pagecontainer("getActivePage").remove();
				oPage.enhanceWithin();
				$(":mobile-pagecontainer").pagecontainer("change", '#' + data.page._code, this.allOptions);
				console.log("showed");
			}
		}

		if (company.css) {
			if (this.isMobile() && company.css.mobile) {
				for (var i = 0; i < company.css.mobile.length; i++) {
					$("<link/>", {
						rel: "stylesheet",
						type: "text/css",
						href: company.css.mobile[i]
					}).appendTo("head");
				}
			} else if (!this.isMobile() && company.css.desktop) {
				for (var i = 0; i < company.css.desktop.length; i++) {
					$("<link/>", {
						rel: "stylesheet",
						type: "text/css",
						href: company.css.desktop[i]
					}).appendTo("head");
				}
			}
		}
		if (company.js) {
			if (this.isMobile() && company.js.mobile) {
				for (var i = 0; i < company.js.mobile.length; i++) $.getScript(company.js.mobile[i]);
			} else if (!this.isMobile() && company.js.desktop) {
				for (var i = 0; i < company.js.desktop.length; i++) $.getScript(company.js.desktop[i]);
			}
		}

		if (typeof (ReactDOM) !== "undefined") {
			if (typeof (MainComponent) !== "undefined") {
				var e = document.getElementById('mainComponent');
				if (!e) {
					e = document.createElement('div');
					e.setAttribute("id", "mainComponent");
					document.body.appendChild(e);
				}
				ReactDOM.render(React.createElement(MainComponent, null), e);
			} else {
				ReactDOM.render(React.createElement(FormComponent, null), document.getElementById('formComponent'));
			}
		}

		if (window.DForm) {
			window.DForm.init();
			window.DForm.parse();
			window.DForm.bind();
		}
		if (company.OnPageLoad) {
			try {
				await company.OnPageLoad(data);
			} catch (ex) {
				console.log("FrEMD.end.OnPageLoad", ex);
			}
		}
		console.log("Page Loaded: " + (page._code || page.Page || page));
	}

	_c(obj, fCallBack, sMethod, ...arRest) {
		this._calls.splice(0, 0, {
			Callback: fCallBack,
			obj: obj,
			Name: sMethod,
			args: arRest,
		});
	}

	async doCalls() {
		this._calls.reverse();
		var arCalls = [];
		$.each(this._calls, (_, c) => {
			if (c.Name) {
				var args = [c.obj];
				if (c.args.length) args = args.concat(c.args);
				arCalls.push(window.sr._(c.Name, null, ...args));
			} else {
				arCalls.push(window.sr._("emsFormValues", null, {
					EntityObject: (c.obj ? c.obj.toEntityObject(true) : null)
				}));
			}
		});

		return $.when(...arCalls).then((...ret) => {
			$.each(ret, (i, r) => {
				if (r && r.length && r[0].Order) {
					r.sort((a, b) => {
						if (a.Order < b.Order) return -1;
						if (a.Order > b.Order) return 1;
						return 0;
					});
				}
				if (this._calls[i].Callback) this._calls[i].Callback(r);
			});
		}).then(() => {
			this._calls = [];
		});
	}

	_o(fCallBack, obj) {
		this.step();

		return window.sr._("emsFormValues", fCallBack, {
			EntityObject: ((obj && obj.toEntityObject) ? obj.toEntityObject(true) : null)
		});
	}

	randURL() {
		return "?__rand=" + Math.random();
	}

	toSettings(s, o) {
		return s;
		for (var i = 0; i < s.length; i++) {
			if (!s[i].Parent) {

			}
		}
	}

	extType(v) {
		return ({
			html: 'html',
			htm: 'html',
			js: 'javascript',
			cs: 'csharp',
			py: 'python',
			jsx: 'javascript',
		} [v.match(/\.[^.\\/:*?"<>|\r\n]+$/)[0].replace('.', '')] || "text");
	}

	async OpenEditor(e, language, loader, saver, fData, oElement) {
		var editor = ace.edit(e);
		editor.session.setUseWrapMode(true);

		if (loader) {
			if (typeof ($.messager) !== "undefined") {
				$.messager.progress({
					title: 'Please waiting',
					msg: 'Loading data...',
					interval: oElement ? (oElement.interval || 300) : 300,
				});
			} else {
				editor.session.setValue('loading...');
			}
			try {
				let content = await loader(fData);
				editor.session.setValue(content);
			} catch (ex) {
				editor.session.setValue("Error Loading file: \n" + JSON.stringify(ex, null, 4));
				console.log(ex);
			}
			if (typeof ($.messager) !== "undefined") {
				$.messager.progress('close');
			}
		}

		let type = "";
		if (language) {
			try {
				type = language(fData);
			} catch (ex) {}
		}

		editor.session.setMode('ace/mode/' + type);
		if (saver) editor.commands.addCommand({
			name: 'save',
			bindKey: {
				win: "Ctrl-S",
				mac: "Cmd-S"
			},
			exec: async editor => {
				var value = this._beautify(editor.getValue(), type);
				if (value != editor.session.getValue()) editor.session.setValue(value);

				if (saver) {
					if (typeof ($.messager) !== "undefined") {
						$.messager.progress({
							title: 'Please waiting',
							msg: 'Saving data...',
							interval: oElement ? (oElement.interval || 600) : 600,
						});
					}
					try {
						let ret = await saver(editor.session.getValue(), fData);
					} catch (ex) {
						this._error("Unable to Save file.\n" + ex);
					}
					if (typeof ($.messager) !== "undefined") {
						$.messager.progress('close');
					}
				}
			}
		});
	}

	_beautify(value, type) {
		try {
			if (typeof (beautifier) !== "undefined") {
				var options = {
					"indent_size": "1",
					"indent_char": "\t",
					"max_preserve_newlines": "5",
					"preserve_newlines": true,
					"keep_array_indentation": false,
					"break_chained_methods": false,
					"indent_scripts": "normal",
					"brace_style": "collapse",
					"space_before_conditional": true,
					"unescape_strings": false,
					"jslint_happy": true,
					"end_with_newline": false,
					"wrap_line_length": "0",
					"indent_inner_html": false,
					"comma_first": false,
					"e4x": true,
					"indent_empty_lines": false
				};
				if (['csharp', 'javascript'].indexOf(type) > -1) {
					value = beautifier.js(value, options);
				} else if (['html'].indexOf(type) > -1) {
					value = beautifier.html(value, options);
				}
			}
		} catch (ex) {}
		return value;
	}

	_lang(code) {
		window.lang = code;
		setURL("page=" + (this.allData.page._code || 'index'));
	}

	select2SR(oSelect) {
		let s = $(oSelect);

		let calls = [];
		if (this.select2Template) {
			calls.push(this.select2Template);
		} else {
			calls.push(window.sr.Get("templates" + this.m() + "/select2-template.htm" + this.randURL()));
		}
		$.when(...calls).then((...ret) => {
			this.select2Template = ret[0];
			s.select2({
				ajax: {
					transport: (params, success, failure) => {
						var fFilter = window.sr.runScript("(o, state) => {" + s.data("sr_filter") + "}");
						$.when(window.sr._(s.data("sr_method"), null,
							fFilter({}, window.sr.runScript(s.data("c_state")))
						)).then(ret => {
							success({
								pagination: {
									more: false
								},
								results: $.map(ret, r => {
									r.id = r.Id;
									r.text = r.ToString;
									return r;
								}),
								totals: ret.length
							});
						});
					}
				},
				templateResult: (_e, _s) => {
					return this._inject(this.select2Template, {
						data: _e
					});
				}
			});
			s.on("change", e => {
				console.log(e.target);
			});
			s.on("change.select2", e => {
				//var data = e.params.data;
				var _s = $(e.target);
			});
		});
	}

	async preCompile(page, location) {
		if (typeof Babel === "undefined") return null;

		if (typeof React !== "undefined") {
			let jsx = null;
			try {
				jsx = await $.get((location || "templates") + this.m() + "/" + (page._code || page) + ".jsx" + this.randURL());
			} catch (ex) {}
			if (jsx === null || jsx === "") {
				return null;
			}
			var res = null;
			try {
				res = await Babel.transform(jsx, {
					presets: ['es2015', "react"]
				});
			} catch (ex) {
				console.log("Babel", ex);
				return null;
			}

			false && await window.sr._("ContentManager.cmsSaveFileBody", null,
				window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/')) +
				"/" + (location || "templates") + this.m() + "/" + (page._code || page) + ".js", res.code);

			//page.Script = res.code;
			return res.code;
		}
	}

	async _render(page, data, options) {
		console.log("RenderPage", page, data);
		for (var i = 0; i < this.pages.length; i++) {
			if (this.pages[i]._code == page._code && this.pages[i]._language && (this.pages[i]._language == (window.lang || company.Language || "en"))) {
				console.log((window.lang || company.Language || "en"));
				page = this.pages[i];
				break;
			}
		}

		if (!window.sr.bLocal && (page.Body || page.toEntityObject)) {
			console.log("Page " + page._code + " already loaded, serving...");
			// found the page and it is an object

			await this.runScript(page.Script);
			if (!page.Script) {
				let e = await this.end();
				return e;
			}
		}

		let ret = null;
		if (CMS_ROOT) {
			ret = await window.sr._("ContentManager.cmsHTMLPageFind", null, {
				Page: page._code.indexOf('/') >= 0 ? page._code : (CMS_ROOT + page._code)
			});
		}

		if (ret) {
			// store to avoid redundant loading
			console.log("Page " + page._code + " found in CMS, serving...");
			page = ret;
		} else {
			console.log("Page " + page._code + " not found in CMS, looking in EMS");
			var eoPage = null;
			try {
				eoPage = new Page().code(page._code, "=");
				if (eoPage.language) eoPage.language(window.lang || company.Language || "en", "=");
			} catch (e) {
				console.log("EMS does not have a Page class, failing on purpose: " + e.message);
			}

			let ret = await window.sr._("EnterpriseManager.emsFormValues", null, {
				EntityObject: (eoPage ? eoPage.toEntityObject(true) : null)
			});
			if (ret && ret.length) {
				console.log("Page " + page._code + " found in EMS, trying templates");
				page = ret[0];
			} else {
				console.log("Page " + page._code + " not found in EMS, so going local");
			}

			try {
				let html = await $.ajax({
					url: "templates" + this.m() + "/" + page._code + ".htm" + this.randURL()
				});
				console.log("Page " + page._code + " html template found");
				page.Body = html;
			} catch (ex) {
				console.log("Page " + page._code + " has no html template");
				if (!page.Body && typeof (React) !== "undefined" && typeof (MainComponent) === "undefined") {
					page.Body = "<div id='formComponent'/>";
				} else {
					page.Body = page._content || "<!--" + ("Page " + page._code + " does not exist") + "-->";
				}
			}

			try {
				let js = await this.preCompile(page) || await $.ajax({
					url: "templates" + this.m() + "/" + page._code + ".js" + this.randURL(),
					dataType: "text",
				});
				if (js) {
					//console.log(js);
					page.Script = js;
				}
				console.log("Page " + page._code + " script is retrieved");
			} catch (ex) {
				console.log(ex);
			}

			this.step();

			// only cache pages that come from EMS
			if (page.toEntityObject) this.pages.push(page);
		}
		page.data = data;
		page.Script = await this.runScript(page.Script);

		//console.log("page Body", page._body || page.Body);
		if (typeof (page.Script) === "function" && typeof (page.Script.constructor) === "function") {
			try {
				var obj = new page.Script(page);
				if (obj && obj.main) {
					console.log("Calling page[" + (page._code || page.Page || page) + "].Script.main()");
					await obj.main();
				}
			} catch (ex) {
				console.log(ex);
			}
		}

		return page;
	}

	async RenderPage(page, data, options) {
		var _page = await this._render(page, data, options);
		if (!_page) return null;

		if (typeof (ga) !== "undefined") {
			ga('send', {
				hitType: 'pageview',
				page: '/' + _page._code + '.dynamic',
				title: _page._title
			});
			console.log("Sent GA hit for page: " + (_page._code || _page.Page || _page));
		}
		window.page = _page;

		this.allHTML = this.headerHTML + (this.contentHTML || _page.Body || _page._body) + this.footerHTML;
		this.allData = {
			settings: this.settings,
			page: _page,
			pages: this.pages
		};
		this.allOptions = options;

		this.endCalled = false;
		await this.end(null, window.page.data || data);
	}

	async runScript(js, bAsync) {
		if (typeof (js) !== "string") return js;

		if (typeof (sr) !== "undefined") {
			if (js.indexOf('class ') >= 0 && !bAsync) {
				// a class definition, do not enclose it in a function
				return await sr.runScript(js);
			} else {
				return await sr.runScript("(async () => {" + js + "\n})();");
			}
		} else {
			return eval(js);
		}
	}
};
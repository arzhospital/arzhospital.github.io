window.FrEMD = class {
	//export default class FrEMD {
	constructor() {
		this.settings = null;
		this.bDebug = false;
		this.blocks = {};
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

	groupBy(ar, field) {
		if (!ar || !field) return null;

		var keys = [];
		ar.forEach(a => {
			var key = null;
			field.split('.').forEach(f => key = (key || a)[f]);
			let k = keys.find(k => this.Equals(k.key, key));
			if (k) {
				k.values.push(a);
			} else {
				keys.push({
					key: key,
					values: [a],
				});
			}
		});
		return keys;
	}

	async _getStoredScript(s, bNoRun) {
		if (this.sr()._) {
			let _sc = await this.sr()._("ContentManager.cmsStoredScriptFind", null, s);
			return _sc ? (bNoRun ? _sc.Script : await sr.runScript(_sc.Script)) : undefined;
		} else {
			console.log("_getStoredScript(): no sr() defined", s);
			return null;
		}
	}

	async _initContentManager() {
		let arClasses = await this._getStoredScript({
			Name: "Content Manager",
			Enabled: true,
		});
		await this._loadEntityClasses(arClasses, "contentmanager");
	}

	_unique(data, key) {
		return [...new Map(data.map(x => [!x ? x : x[key || 'Name'], x])).values()];
	}

	_toEntityClasses(scope) {
		let eaMap = ea => {
			let ret = {
				Name: ea.Name.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, (match, index) => {
					if (+match === 0) return "";
					return index === 0 ? match.toLowerCase() : match.toUpperCase();
				}),
				Required: ea.Required,
			};
			Object.keys(ea).filter(k => k.startsWith('Is')).forEach(k => ret[k] = ea[k]);
			Object.keys(ret).filter(k => k.startsWith('Is') && !ret[k]).forEach(k => delete ret[k]);
			if (ea.EntityType) {
				ret.EntityType = {
					Name: ea.EntityType.Name
				};
			}
			return ret;
		};

		return this.sr().__scope(scope).EntityClasses.map(c => {
			let ret = {
				Name: c.Name,
				Tools: c.Tools,
				Debug: c.Debug,
				Test: c.Test,
				Config: c.Config,
				Enabled: c.Enabled,
				EntityAttributes: c.EntityAttributes.filter(ea => !ea.EntityMethod).map(ea => eaMap(ea)),
				EntityMethods: c.EntityMethods.map(m => ({
					Name: m.Name,
					Script: m.Script,
					Routing: m.Routing,
					MethodParameters: m.MethodParameters.map(p => eaMap(p)),
					ResponseAttribute: eaMap(m.ResponseAttribute),
				})),
			};

			["Tools", "EntityMethods"].forEach(a => {
				if (!ret[a].length) delete ret[a];
			});
			["Debug", "Test", "Config"].forEach(a => {
				if (!Object.keys(ret[a]).length) delete ret[a];
			});
			ret.EntityAttributes = ret.EntityAttributes.filter(ea => ea.Name != "id");
			return ret;
		});
	}

	async _runSequences(seqs, scope) {
		let callSequences = [];
		if (!scope) return callSequences;

		for await (const seq of seqs) {
			let callSequence = {
				active: true,
				title: seq.title,
				classifier: seq.classifier,
				entities: [],
				timeline: [],
			};

			let _entities = seq.entities.filter(e => scope.EntityClasses.find(c => c.Name == e.type));

			for await (const e of _entities) {
				e.obj = new scope[e.type]()._fromDocument(e.content);
			}

			for await (const e of _entities) {
				// first level reference cleanup: make sure only one reference object is used with the same "_name". lower levels should be done recursively
				scope.EntityClasses.find(c => c.Name == e.type).EntityAttributes.filter(ea => ea.EntityType && ea.EntityType.EntityAttributes.find(_ea => _ea.Name == 'name' && _ea.IsString)).forEach(ea => {
					if (e.obj['_' + ea.Name]) {
						e.obj['_' + ea.Name] = (seq.entities.find(_e => _e !== e && _e.obj && _e.obj['_' + ea.Name]._name == e.obj['_' + ea.Name]._name) || e).obj['_' + ea.Name];
					}
				});
			}

			seq.steps = seq.steps.map(s => {
				if (!s._if) return [s];
				return s._then.map(st => $.extend(st, {
					_if: {
						label: s._if,
						value: true
					}
				})).concat(s._else.map(st => $.extend(st, {
					_if: {
						label: s._if,
						value: false
					}
				})));
			});
			seq.steps = [].concat.apply([], seq.steps);

			for await (const s of seq.steps) {
				if (s.ignore) continue;

				let _from = seq.entities.find(e => e.obj && (e.name || e.obj._name) == s.from);
				if (!_from) {
					console.log("Missing Entity Definition: " + s.from);
					continue;
				}
				_from = _from.obj;

				try {
					s.params = Object.fromEntries(Object.entries(s.params).map(et => {
						if (et[1] && et[1].name) {
							let obj = seq.entities.find(e => e.obj && (e.name || e.obj._name) == et[1].name);
							return obj ? [et[0], obj.obj] : et;
						} else {
							return et;
						}
					}));

					try {
						await _from[s.method](...Object.values(s.params));

						s._method = s.method.indexOf('.') > 0 ? scope.EntityClasses.find(c => c.Id == _from.EntityClass.Id).EntityMethods.find(m => m.Name == s.method) : scope.EntityClasses.find(c => c.Name == s.method.split('.')[0]).EntityMethods.find(m => m.Name == s.method.split('.')[1]);
					} catch (_ex) {}

					// not defined to which entity this is going, find first entity in the parameters, otherwise it is a loop to myself
					let _to = (Object.values(s.params) || []).find(p => p && p.EntityClass) || _from;

					callSequence.entities = callSequence.entities.concat([_from, _to]).filter(e => e).filter((obj, pos, arr) => {
						return arr.map(mapObj => mapObj).indexOf(obj) === pos;
					});

					let sObj = {
						date: new Date(),
						from: _from,
						to: _to,
						activate: s.activate,
						params: s.params,
						method: s.method,
						_if: s._if,
					};
					callSequence.timeline.push(sObj);
					callSequence.timeline.sort((a, b) => a.date < b.date);

					if (_from !== _to && (typeof(s.activate) === 'undefined' || s.activate)) {
						// is this call closing an activation? then define it as activated in the initial call
						let init = callSequence.timeline.find(t => t.from == sObj.to && t.to == sObj.from && t.date < sObj.date && !t.activating);
						if (init) {
							init.activating = sObj;
						}
					}
					await this._wait(s.wait || seq.wait);
				} catch (ex) {
					console.log(_from, s, ex);
				}
			}
			callSequence.timeline.forEach((t, i) => {
				t.from = t.from || "null";
				t.to = t.to || "null";
				t._previous = i ? callSequence.timeline[i - 1] : null;
				t._next = (i < callSequence.timeline.length - 1) ? callSequence.timeline[i + 1] : null;
				t._activator = callSequence.timeline.find(_t => _t.activating == t);
			});

			callSequences.push(callSequence);
		}

		return callSequences;
	}

	async _wait(ms) {
		await new Promise(resolve => setTimeout(resolve, ms));
	}

	_fileType(base64) {
		var binary_string = window.atob(base64);
		var len = binary_string.length;
		var bytes = new Uint8Array(len);
		for (var i = 0; i < len; i++) {
			bytes[i] = binary_string.charCodeAt(i);
		}

		var arr = (new Uint8Array(bytes.buffer)).subarray(0, 4);
		var header = '';
		for (var i = 0; i < arr.length; i++) {
			header += arr[i].toString(16);
		}

		// Check the file signature against known types
		var type = 'unknown';
		switch (header) {
			case '89504e47':
				type = 'image/png';
				break;
			case '47494638':
				type = 'image/gif';
				break;
			case 'ffd8ffe0':
			case 'ffd8ffe1':
			case 'ffd8ffe2':
				type = 'image/jpeg';
				break;
			case '25504446':
				type = 'application/pdf';
				break;
			case '3c737667':
				type = 'image/svg+xml';
				break;
		}
		return type;
	}

	img(dImg, mimeType) {
		return `data:${mimeType || this._fileType(dImg)};base64,` + dImg;
	}

	_fullScreen(elem) {
		try {
			if (elem.requestFullscreen) {
				elem.requestFullscreen();
			} else if (elem.webkitRequestFullscreen) {
				/* Safari */
				elem.webkitRequestFullscreen();
			} else if (elem.msRequestFullscreen) {
				/* IE11 */
				elem.msRequestFullscreen();
			}
		} catch (ex) {
			console.log(ex);
		}
	}

	_copyTextToClipboard(text) {
		if (typeof(window) !== 'undefined' && typeof(window.copy) === 'function') {
			window.copy(text);
		} else if (!navigator.clipboard) {
			var textArea = document.createElement("textarea");
			textArea.value = text;

			// Avoid scrolling to bottom
			textArea.style.top = "0";
			textArea.style.left = "0";
			textArea.style.position = "fixed";

			document.body.appendChild(textArea);
			//textArea.focus();
			textArea.select();

			try {
				var successful = document.execCommand('copy');
				var msg = successful ? 'successful' : 'unsuccessful';
				console.log('Fallback: Copying text command was ' + msg);
			} catch (err) {
				console.error('Fallback: Oops, unable to copy', err);
			}

			document.body.removeChild(textArea);
		} else {
			return new Promise((resolve, reject) => {
				navigator.clipboard.writeText(text).then(function() {
					console.log('Async: Copying to clipboard was successful!');
					resolve();
				}, function(err) {
					console.error('Async: Could not copy text: ', err);
					reject(err);
				});
			});
		}

		return text;
	}

	async _resizeImg(imgBase64, width, height, mimeType, to_mimeType) {
		if (imgBase64.split(',').length > 1) {
			imgBase64 = imgBase64.split(',')[1];
		}
		var img = new Image();
		img.src = this.img(imgBase64, mimeType);

		// create an off-screen canvas
		var canvas = document.createElement('canvas'),
			ctx = canvas.getContext('2d');

		// set its dimension to target size
		canvas.width = width || img.width;
		canvas.height = height || img.height;

		// draw source image into the off-screen canvas:
		ctx.drawImage(img, 0, 0, width, height);

		// encode image to data-uri with base64 version of compressed image
		return canvas.toDataURL(to_mimeType || mimeType, 1);
	}

	async _template(tmp, scope, data, prvFunc) {
		scope = scope || company.Scope;
		let template = tmp.Id ? tmp : (await this.sr()._("ContentManager.cmsPageTemplateFind", null, {
			Active: true,
			Type: {
				Name: "EntityTemplate"
			},
			Name: tmp.Name || tmp.name || tmp.template || tmp,
			OPERATORS: {
				Name: '='
			}
		}));
		if (!template) return null;

		let script = await this.runScript(template.Script);
		let obj = new script(template, scope, data, prvFunc);

		try {
			obj.main && await obj.main();
		} catch (ex) {
			console.log("Template.main()", ex);
		}

		try {
			obj.preInject && await obj.preInject();
		} catch (ex) {
			console.log("Template.preInject()", ex);
		}

		let ret = {
			Script: obj,
		};

		let tCache = {};
		for await (const f of ['Body', 'Footer', 'Title']) {
			for await (const m of [...(template[f].matchAll(/(\[\[%=).[\w\-.]+[\.](tmp)[\:\:]?[^(%\]\])]*[\:\:]?[^(%\]\])]*(%\]\])/gm))]) {
				let tNameParts = m[0].replace('[[%=', '').replace('%]]', '').replace('.tmp', '').split('::');
				let tName = tNameParts[0];
				let tData = Object.assign(data, {});
				if (tNameParts.length > 1) {
					tData = Object.assign(tData, await this.runScript(tNameParts[1]));
				}
				let t = await this._template(tName, scope, tData, prvFunc);
				tCache[tName] = tCache[tName] || t[f];
				template[f] = template[f].replace(m[0], tCache[tName]);
			}

			ret[f] = this._inject(template[f], obj);
		}
		console.log(tCache);

		try {
			obj.postInject && await obj.postInject(ret);
		} catch (ex) {
			console.log("Template.postInject()", ex);
		}

		return ret;
	}

	Template = class {
		constructor(template, scope, data, prvFunc, bRank) {
			this.template = template;
			this.scope = scope;
			this.oScope = window[scope];

			this.nc = this.oScope.EntityClasses.find(c => c.Name == 'Node');
			this.ec = this.oScope.EntityClasses.find(c => c.Name == 'Event');
			this.mc = this.oScope.EntityClasses.find(c => c.IsMain);

			this.dScope = (this.nc && this.nc.EntityModule) ? DotObject.pick(this.nc.EntityModule.Alias, this.oScope) : this.oScope;

			this.data = data;
			this.prvFunc = prvFunc || (() => {});
			this.mRank = 0;

			if (bRank) this.mRank = Math.max(0, ...this.oScope.EntityClasses.map(c => c.Rank)); // useful in templates

			this.mainTitle = this.data.Title.split('-')[0];
			this.subTitle = this.data.Title.indexOf('-') >= 0 ? data.Title.split('-')[1] : "";
		}

		_new(c, tool, id) {
			if (!c) c = this.oScope.EntityClasses.find(_c => _c.IsMain);
			if (typeof(c) === 'string') c = this.oScope.EntityClasses.find(_c => _c.Name == c);
			if (!c) return null;

			let mScope = c.EntityModule ? DotObject.pick(c.EntityModule.Alias, this.oScope) : this.oScope;

			return new(mScope[nName(c)])(id, tool);
		}

		cnf(_c, id, did, tool) {
			_c = _c || this.mc;
			let mScope = _c.EntityModule ? DotObject.pick(_c.EntityModule.Alias, this.oScope) : this.oScope;
			return mScope._node ? mScope._node.__config(id, did, {
				tool: tool
			}) : (this._new(_c, tool).__config(id, did, tool ? {
				tool: tool
			} : undefined));
		}

		nType(ea) {
			if (ea.IsString || ea.IsText) {
				return "string";
			} else if (ea.IsBool) {
				return "boolean";
			} else if (ea.IsFloat) {
				return "float";
			} else if (ea.IsInt || ea.IsLong) {
				return "number";
			} else if (ea.IsDate) {
				return "string";
			} else {
				return null;
			}
		}

		_t(prop, obj, search) {
			try {
				let ret = obj[prop];

			} catch (ex) {
				console.log("_t", ex);
			}
		}

		async postInjectSVG(ret) {
			this.prvFunc($(`<img style='overflow-x: auto;display: block;width:100%; height: 100%' src='${_FrEMD._svgBase64(ret.Body)}'/>`));
		}

		async postInject(ret) {
			await this.prvFunc(`<div>${ret.Body}</div>`);
		}

		async deploy(ret, typeName, lang) {
			typeName = typeName || "Browser";
			let s = ret.Body;
			if (lang) _FrEMD._beautify(ret.Body, lang);

			return await new this.dScope.Node_Type(null, 'GitHub').code(typeName.toLowerCase()).name(typeName).remark(this.dScope._node._btoa(s)).store();
		}

		async postInjectTable(ret) {
			this.prvFunc(`
<div id = "dvPostInject" style='overflowY=scroll'>` +
				DForm.renderElements(this.elements.map((s, i) => ({
					name: `ROW${i}`,
					title: ' ',
					type: "grid",
					width: "100%",
					rowNumbers: false,
					pagination: false,
					frozen: [],
					columns: [{
						title: "Property",
						width: "30%",
					}, {
						title: "Description",
						width: "70%",
					}],
					data: Object.entries(s).map(e => ({
						Property: e[0],
						Description: e[1]
					})),
				}))) + `</div>
<script>
	setTimeout(() => $.parser.parse("#dvPostInject"), 100);
</script>`);
		}
	};

	ProxyNodeTemplate = class extends this.Template {
		constructor(template, scope, data, prvFunc, bRank) {
			super(template, scope, data, prvFunc, bRank);
		}

		async preInject() {
			this.urlRegex = `((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w\-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[\w]*))?)`;
		}

		crudMethods(c, type) {
			return [{
				Name: 'store',
				ResponseAttribute: {
					EntityType: c
				}
			}, {
				Name: 'findAll',
				ResponseAttribute: {
					IsArray: true,
					EntityType: c
				}
			}, {
				Name: 'find',
				ResponseAttribute: {
					EntityType: c
				}
			}].map(m => {
				m[type] = c[type] ? c[type][m.Name] : null;
				m.IsPublic = true;
				m.MethodParameters = [];
				return m;
			});
		}
	};

	PlantUMLTemplate = class extends this.Template {
		async postInject(ret) {
			let html = ret.Body.replace(/@enduml/g, `left footer ${'\u00A9'}${new Date().getFullYear()} ${this.data.Copyright || 'Fadi Nammour'}, All rights reserved.\n\n@enduml`).split('@enduml').map(b => `<img style='overflow-x: auto;display: block; height: 100%' src='https://www.plantuml.com/plantuml/png/${this.zop(b+'@enduml')}'/>`).join('<br/>');

			this.prvFunc($(`<div style="width: 100%; height: 100%; overflow-y: scroll;">${html}</div>`));
		}

		_attr(ea) {
			return ea.EntityType ? ea.EntityType.Name : _FrEMD._attr(ea);
		}

		zop(s) {
			s = unescape(encodeURIComponent(s));
			var arr = [];
			for (var i = 0; i < s.length; i++) arr.push(s.charCodeAt(i));
			let z = new Zopfli.RawDeflate(arr).compress();
			return this.encode64_(z);
		}

		encode64_(data) {
			let r = "";
			for (var i = 0; i < data.length; i += 3) {
				if (i + 2 == data.length) {
					r += this.append3bytes(data[i], data[i + 1], 0);
				} else if (i + 1 == data.length) {
					r += this.append3bytes(data[i], 0, 0);
				} else {
					r += this.append3bytes(data[i], data[i + 1], data[i + 2]);
				}
			}
			return r;
		}

		append3bytes(b1, b2, b3) {
			let c1 = b1 >> 2;
			let c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
			let c3 = ((b2 & 0xF) << 2) | (b3 >> 6);
			let c4 = b3 & 0x3F;
			let r = "";
			r += this.encode6bit(c1 & 0x3F);
			r += this.encode6bit(c2 & 0x3F);
			r += this.encode6bit(c3 & 0x3F);
			r += this.encode6bit(c4 & 0x3F);
			return r;
		}

		encode6bit(b) {
			if (b < 10) {
				return String.fromCharCode(48 + b);
			}
			b -= 10;
			if (b < 26) {
				return String.fromCharCode(65 + b);
			}
			b -= 26;
			if (b < 26) {
				return String.fromCharCode(97 + b);
			}
			b -= 26;
			if (b == 0) {
				return '-';
			}
			if (b == 1) {
				return '_';
			}
			return '?';
		}
	}

	toBase64(url, data, mime = 'application/octet-stream', bRaw) {
		return window.URL.createObjectURL(new Blob([url ? this._inject($.ajax({
			url: url + '?' + Math.random(),
			async: false
		}).responseText, data) : (bRaw ? data : JSON.stringify(data))], {
			type: mime
		}));
	}

	_svgBase64(txt) {
		try {
			mermaid.mermaidAPI.initialize({
				"theme": "default",
				"securityLevel": "loose",
				"maxTextSize": 90000000,
			});

			return 'data:image/svg+xml;base64,' + btoa(new XMLSerializer().serializeToString($(mermaid.mermaidAPI.render('graphDiv', txt))[0]));
		} catch (ex) {
			return txt;
		}
	}

	_prune(obj) {
		if (typeof(obj) === "undefined" || obj === null) return null;
		if (typeof(obj) !== "object") return obj;
		if (Array.isArray(obj)) {
			let ret = obj.map(v => this._prune(v)).filter(v => v);
			return ret.length ? ret : null;
		}

		let ret = Object.assign({}, ...Object.entries(obj).map(([key, value]) => value ? ({
			[key]: this._prune(value)
		}) : null));
		return Object.keys(ret).length ? ret : null;
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

	_toJS(o) {
		try {
			if (typeof(o) === 'undefined') return 'undefined';

			return `JSON.parse(((typeof(this)!=="undefined" && typeof(this._atob)!=="undefined")?this._atob:(typeof(_FrEMD)!=="undefined"?_FrEMD._atob:atob))(\`${this._btoa(JSON.stringify(o, (t,n)=>"function"===typeof n?n.toString():n))}\`), (key,value)=>{if(typeof(value)==="string" && value.indexOf("=>")>0) return eval("(" + value + ")"); return value;})`;
		} catch (ex) {
			console.log("_toJS: " + ex.toString());
		}
	}

	_atob(a) {
		return typeof(atob) === "undefined" ? Buffer.from(a, 'base64').toString('binary') : atob(a);
	}

	_btoa(b) {
		return typeof(btoa) === "undefined" ? Buffer.from(b).toString('base64') : btoa(unescape(encodeURIComponent(b)));
	}

	_attr(ea) {
		try {
			if (ea.EntityType) return "Entity";
			return Object.keys(ea).filter(k => !k.indexOf("Is") && k !== "IsUnique").find(k => ea[k]).replace('Is', '');
		} catch (ex) {
			return null;
		}
	}

	_sqlType(ea, dbType) {
		let type = typeof(ea) === "string" ? ea : this._attr(ea);
		switch (type) {
			case "String":
			case '':
				return "VARCHAR(255)";
			case "Text":
			case "Object":
				return `${dbType=='sqlite'?'VARCHAR':'TEXT'}${dbType=='postgres'?'':'(4000)'}`;
			case "Bool":
				return `${dbType=='postgres'?'BIT(1)':'TINYINT'}`; //BIT
			case "Date":
				return `${dbType=='postgres'?'TIMESTAMP':'DATETIME'}`;
			case "Int":
				return "INTEGER";
			case "Long":
				return "BIGINT";
			case "Entity":
				return "VARCHAR(255)";
			case "Image":
			case "File":
				return `${dbType=='postgres'?'BYTEA':"BLOB"}`;
			default:
				return type + "(40)";
		}
	}

	async import(module, bAsync) {
		if (Array.isArray(module)) {
			for await (const m of module) {
				await this.import(m, bAsync);
			}
			return;
		}
		try {
			return await import(module);
		} catch (ex) {}
		var js = null;
		try {
			js = (await this.preCompile({
				_code: module
			})) || (await $.ajax({
				url: this.randURL("templates" + this.m() + "/" + module + ".js"),
				dataType: "text",
			}));
		} catch (ex) {}
		if (!js) {
			js = await this.sr()._("ContentManager.cmsHTMLPageFind", null, {
				Page: module.indexOf('/') >= 0 ? module : (CMS_ROOT + module)
			});
			if (js) js = js.Script;
		}
		if (!js) return null;
		return await this.runScript(js, bAsync);
	}

	async require(libName, hrefs) {
		for await (const n of (hrefs || this.hrefs).filter(l => l.lib === libName && this._include(l))) {
			n.requires = n.requires || [];
			for await (const r of n.requires.filter(r => r != libName)) {
				await this.require(r, hrefs);
			}

			if (typeof(this._css) !== 'undefined') {
				for (const c of Array.isArray(n.css) ? n.css : [n.css]) {
					this._css(c);
				}
			}
			var modules = [];
			for await (const s of Array.isArray(n.src) ? n.src : [n.src]) {
				try {
					if (s.Name) {
						// stored script
						let _sc = await this._getStoredScript(s);
					} else if (n.module) {
						modules.push(await import(s));
					} else if (typeof($) !== 'undefined' && typeof($.ajax) !== 'undefined') {

						await $.ajax({
							url: n.cache ? s : this.randURL(s),
							dataType: "script",
							cache: n.cache ? 'force-cache' : 'default'
						});
					} else if (typeof(WorkerGlobalScope) !== 'undefined') {
						// a web-worker
						importScripts(s);
					} else {
						await new Promise(r => {
							let script = document.createElement('script');
							script.onload = () => r();
							script.src = s;
							(document.body || document.head).appendChild(script);
						});
					}
				} catch (ex) {
					console.log("require[" + n.lib + "] Exception: " + ex, s);
				}
			}
			if (n.load) {
				try {
					await n.load(modules);
				} catch (ex) {
					console.log("Exception in load() of " + n.lib, ex);
				}
			}
		}
		console.log("require[" + libName + "]");
	}

	async postInit() {
		try {
			window.frames[0].reRender ? window.frames[0].reRender() : null;
		} catch (ex) {}

		try {
			let events = sr.runScript(await $.getScript("script/events.js"));
			if (!events && company.Events) {
				events = await company.Events();
			}
			(events || []).filter(this._pageFilter).forEach(ev => {
				$(ev._path, window.frames[0].document).on(ev._event, ev._handler);
			});
		} catch (ex) {}
	}

	excelToJSON(data, start, count) {
		if (typeof(XLSX) === "undefined") return [];
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

	async _unzip(file) {
		var zip = new JSZip();
		let f = await zip.load(file, {
			base64: true
		})
	}

	async _zip(files) {
		var zip = new JSZip();
		files.forEach(f => {
			zip.file(f.name, f.file);
		});
		let ret = await zip.generate({
			type: 'blob',
			compression: "DEFLATE"
		});
		return ret;
	}

	Utf8ArrayToStr(array) {
		var out, i, len, c;
		var char2, char3;

		out = "";
		len = array.length;
		i = 0;
		while (i < len) {
			c = array[i++];
			switch (c >> 4) {
				case 0:
				case 1:
				case 2:
				case 3:
				case 4:
				case 5:
				case 6:
				case 7:
					// 0xxxxxxx
					out += String.fromCharCode(c);
					break;
				case 12:
				case 13:
					// 110x xxxx   10xx xxxx
					char2 = array[i++];
					out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
					break;
				case 14:
					// 1110 xxxx  10xx xxxx  10xx xxxx
					char2 = array[i++];
					char3 = array[i++];
					out += String.fromCharCode(((c & 0x0F) << 12) |
						((char2 & 0x3F) << 6) |
						((char3 & 0x3F) << 0));
					break;
			}
		}

		return out;
	}

	async _compress(str) {
		const byteArray = new TextEncoder().encode(str);
		const cs = new CompressionStream("gzip");
		const writer = cs.writable.getWriter();
		writer.write(byteArray);
		writer.close();
		return new Response(cs.readable).arrayBuffer()

		// Convert the string to a byte stream.
		const stream = new Blob([str]).stream();

		// Create a compressed stream.
		const compressedStream = stream.pipeThrough(
			new CompressionStream("gzip")
		);

		// Read all the bytes from this stream.
		const chunks = [];
		for await (const chunk of compressedStream) {
			chunks.push(chunk);
		}
		return await new Uint8Array(await new Blob(chunks).arrayBuffer());
	}

	async _decompress(compressedBytes) {
		// Convert the bytes to a stream.
		const stream = new Blob([compressedBytes]).stream();

		// Create a decompressed stream.
		const decompressedStream = stream.pipeThrough(
			new DecompressionStream("gzip")
		);

		// Read all the bytes from this stream.
		const chunks = [];
		for await (const chunk of decompressedStream) {
			chunks.push(chunk);
		}
		const stringBytes = await new Uint8Array(await new Blob(chunks).arrayBuffer());

		// Convert the bytes to a string.
		return new TextDecoder().decode(stringBytes);
	}

	async downloadSRCache(code, filename) {
		// to be moved out of this class
		code = code || company.Code;
		let files = await this.sr()._('ContentManager.cmsMethodResultFindall', null, {
			Code: code + '-',
		});
		return await this._zip(files.map(r => ({
			name: r.Code.replace(code + '-', '') + '.js',
			file: r.Result
		})), filename || 'srCache.zip');
	}

	async _getBlock(block) {
		var js = null;
		this.blocks[block] = {
			html: "",
			obj: null,
		}
		try {
			js = await this.preCompile({
				_code: block
			}, "blocks") || await $.ajax({
				url: this.randURL("blocks" + this.m() + "/" + block + ".js"),
				dataType: "text",
			});
			if (js) {
				js = await this.runScript(js);
				if (typeof(js) === "function" && typeof(js.constructor) === "function") {
					try {
						var obj = new js();
						if (obj && obj.main) {
							this.blocks[block].obj = obj;
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
		try {
			this.blocks[block].html = await $.get(this.randURL("blocks" + this.m() + "/" + block + ".htm"));
		} catch (ex) {
			//console.log(ex);
		}
		if (js && !this.blocks[block].html && typeof(React) !== "undefined" && window[block + "Component"]) {
			this.blocks[block].html = "<" + block + "Component/>";
		}
		this.step();
		console.log(block + " loaded");
		return this.blocks[block].html || "";
	}

	async _loadContent() {
		await this._getBlock("main");
		await this._getBlock("header");
		await this._getBlock("footer");
		await this._getBlock("content");
		this.fromHash();

		window.lang = this.hash.lang || company.Language || 'en';
		if (company.GACode) {
			// google analytics
			console.log("including google analytics");
			(function(i, s, o, g, r, a, m) {
				i['GoogleAnalyticsObject'] = r;
				i[r] = i[r] || function() {
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

	async preInit() {
		window.bLocal = location.href.indexOf('/nammour.com') > -1;
		this.hrefs = await this.import("../../" + (window.bLocal ? "../ems/" : "") + "script/modules");

		window._FrEMD = this;
		this.fromHash();
		$(window).on('hashchange', async () => {
			this.fromHash();
			if (this.allData && this.allData.page && this.hash.page && this.hash.page != this.allData.page._code && this.endCalled) {
				if (window.frames.length) {
					// frame-based template
					await this.initDOM();
				} else {
					await this.RenderPage({
						_code: this.hash.page
					});
				}
			}
		});

		await this.require("Company");
		company.Scope = company.Scope || "window";
		window.document.title = company.Name + ": loading...";

		await this.require("ServiceRouter");
		this._initServiceRouter();

		if (company.OnBeforeRequire) await company.OnBeforeRequire();
		for await (const l of company.Required) {
			await this.require(l);
		}

		await this._loadEntityClasses();

		await this._initContentManager();

		await this._manifest();

		let oScope = this.sr().__scope(company.Scope); //window[company.Scope];
		oScope.hrefs = [...new Set([...new Set(oScope.EntityClasses.map(c => c.Tools).flat())].map(t => this.hrefs.filter(n => n.tools && (!n.tools.length || n.tools.indexOf(t) >= 0))).flat())];
		let mc = oScope.EntityClasses.find(c => c.IsMain);
		if (mc) {
			await new oScope[mc.Name]()._server({
				loadTools: true,
				initSelf: true,
				initNode: true
			});
		}
		console.log("Done Loading");
	}

	async _manifest(scope, json) {
		try {
			if (!json) {
				json = await this._export({
					template: "MANIFEST"
				}, scope);
			}
			let href = this.toBase64(null, json, 'application/manifest+json', true);
			if (this._manCss) {
				this._manCss.attr("href", href);
			} else {
				this._manCss = this._css(href, 'manifest');
			}
		} catch (ex) {
			console.log("Exception loading manifest", ex);
		}
	}

	async _export(tmp, scope, options = {}) {
		scope = scope || company.Scope;
		let template = tmp.content || await fetch(`${tmp.path||'templates/d/'}${tmp.template}.${tmp.ext||'jst'}?rand=${Math.random()}`);
		let ret = this._inject(template, {
			oScope: window[scope],
			me: window.me,
			scope,
			options,
		}, options.engine);

		if (this._beautify) ret = this._beautify(ret, tmp.language);
		if (!tmp.language) {
			ret = ret.replace(/^\s*$(?:\r\n?|\n)/gm, ''); // remove empty lines
		}
		return ret;
	}

	async initDOM() {
		window._FrEMD = this;
		window.document.body.style.visibility = 'hidden';
		await this.preInit();
		this.hash.page = this.hash.page || 'index';

		try {
			await ((company && company.OnPageLoad) ? company.OnPageLoad : async () => {})();
		} catch (ex) {
			console.log("FrEMD.initDOM.OnPageLoad", ex);
		}

		if (company.Required.indexOf('knockout') < 0 && !window.frames[0].location.hostname) {
			let url = 'website/' + this.hash.page + '.' + (company.extension || 'htm') + '?rand=' + Math.random();
			window.document.body.style.visibility = 'visible';

			let html = await $.get(url);
			html = this._inject(html, window.parent);

			const domp = new DOMParser();
			let doc = domp.parseFromString(html, "text/html");
			await this._applyBindings(doc);
			console.log("html binding done!");

			html = doc.documentElement.innerHTML;
			//html = 'test';

			//window.frames[0].location = url;
			window.frames[0].document.write(html);
		}

		await this._bindKO();
		await this.postInit();
	}

	async _bindKO() {
		if (company.Required.indexOf('knockout') >= 0) {
			setTimeout(async () => {
				//await this._applyBindings(window.frames[0].document, true);

				ko.cleanNode(window.frames[0].document.body);
				ko.applyBindings(window, window.frames[0].document.body);
				window.document.title = company.Name;
				window.document.body.style.visibility = 'visible';
			}, 300);
		}
	}

	_set(obj, path, val) {
		var stringToPath = function(path) {
			// If the path isn't a string, return it
			if (typeof path !== 'string') return path;
			// Create new array
			var output = [];
			// Split to an array with dot notation
			path.split('.').forEach(function(item, index) {
				// Split to an array with bracket notation
				item.split(/\[([^}]+)\]/g).forEach(function(key) {
					// Push to the new array
					if (key.length > 0) {
						output.push(key);
					}
				});
			});
			return output;
		};
		// Convert the path to an array if not already
		path = stringToPath(path);
		// Cache the path length and current spot in the object
		var length = path.length;
		var current = obj;
		// Loop through the path
		path.forEach(function(key, index) {
			// Check if the assigned key shoul be an array
			var isArray = key.slice(-2) === '[]';
			// If so, get the true key name by removing the trailing []
			key = isArray ? key.slice(0, -2) : key;
			// If the key should be an array and isn't, create an array
			if (isArray && Object.prototype.toString.call(current[key]) !== '[object Array]') {
				current[key] = [];
			}
			// If this is the last item in the loop, assign the value
			if (index === length - 1) {
				// If it's an array, push the value
				// Otherwise, assign it
				if (isArray) {
					current[key].push(val);
				} else {
					current[key] = val;
				}
			}
			// Otherwise, update the current place in the object
			else {
				// If the key doesn't exist, create it
				if (!current[key]) {
					current[key] = {};
				}
				// Update the current place in the object
				current = current[key];
			}
		});
	}

	_pageFilter(b) {
		if (!b._active) return false;
		let page = typeof(_FrEMD.hash.page) === 'undefined' ? 'index' : _FrEMD.hash.page;
		if (typeof(b._page) === 'undefined' || typeof(b._page._url) === 'undefined') return true;
		return b._page._url == page;
	}

	async _applyBindings(doc = window.frames[0].document, bAfter = false) {
		this.fromHash();
		if (this.hash.noBinding) return;
		let bindings = [];
		try {
			bindings = sr.runScript(await $.getScript("script/bindings.js"));
		} catch (ex) {}

		if (!bindings && company.Bindings) {
			bindings = await company.Bindings();
		}
		bindings = bindings || [];

		sr.groupBy(bindings.filter(this._pageFilter).filter(b => bAfter ? b._after : !b._after), "_path").forEach(pb => {
			try {
				let e = doc.evaluate(pb.key, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
				let d_bind = {};
				pb.values.forEach(b => {
					this._set(d_bind, b._attribute, b._code);
				});
				$(e).attr("data-bind", JSON.stringify(d_bind).replace(/"/g, ''));
				//console.log(pb.key, e);
			} catch (ex) {
				console.log(pb.key, ex);
			}
		});
	}

	async init() {
		await this.preInit();
		await this._loadContent();
		await this.postInit();
	}

	_uuid(id, len) {
		let ret = null;
		if (id) {
			let hc = Math.abs(Number(typeof(sr) !== 'undefined' ? sr.hashCode(id) : id.length));
			let hs = h => Number(String(h).split("").reverse().join(""));
			let u = hs(hs(hc) * hs(hc)).toString(16);

			ret = u + '' + u + '' + u;
			if (ret.length > 32) ret = ret.substring(0, 32);
		}

		if (!ret && typeof(global) !== 'undefined' && typeof(crypto) !== 'undefined') ret = crypto.randomUUID();
		if (!ret && typeof(uuidv) !== "undefined") ret = uuidv();

		if (!ret) ret = (((id ? Number(id) : new Date().getTime() / 10) | 0).toString(16)) + 'xxxxxxxxxxxxxxxx'.replace(/[x]/g, () => {
			return ((id ? id : Math.random()) * 16 | 0).toString(16);
		}).toLowerCase().substring(0, len || 24).replace(/\-/g, '');

		return ret;
	}

	async _loadEntityClasses(ec, scope = company.Scope) {
		//scope = scope || "window";
		let eas = [];

		if (ec && ec.library && !Array.isArray(ec) && this.sr()._) {
			let lcs = await this.sr()._("ContentManager.cmsGenerateLayerClass", null, ec.library);
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
				IsObject: la.NativeType == "object",
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
		} else if (company.Code && !Array.isArray(ec) && this.sr()._) {
			eas = await this.sr()._("EnterpriseManager.emsEntityAttributeFindall", null, {
				THIS: ec ? [{
					Active: true,
					EntityClass: ec
				}, {
					Active: true,
					EntityClass: {
						Active: true,
						EntityModule: {
							Active: true,
							Enabled: true,
							Companies: [{
								Active: true,
								EntityClasses: [ec]
							}]
						}
					}
				}] : [{
					Active: true,
					EntityClass: {
						Active: true,
						Company: {
							Active: true,
							Code: company.Code
						}
					}
				}, {
					Active: true,
					EntityClass: {
						Active: true,
						EntityModule: {
							Active: true,
							Enabled: true,
							Companies: [{
								Active: true,
								Code: company.Code
							}]
						}
					}
				}],
			});
		}

		this.step();

		if ((!eas || !eas.length) && (!ec || !ec.length)) {
			try {
				ec = await this.runScript(await $.getScript("script/schema.js"));
			} catch (ex) {
				await this._getStoredScript({
					Name: company.Code,
					Active: true,
					Enabled: true,
				});
			}

		}

		for await (const m of (Array.isArray(ec) ? ec : []).filter(c => !c.Name && c.EntityModule && !c.EntityModule.Ignore)) {
			await this._loadEntityModule(m, ec);
		}

		let ret = await this._correctClasses(ec, eas) || [];

		if (scope !== "window") {
			if (typeof(window[scope]) !== "undefined") {
				// cleanup the old scope
				delete window[scope];
			}
			window[scope] = {};
		}
		(scope ? window[scope] : window).EntityClasses = ret;
		(scope ? window[scope] : window).__script = (scope ? window[scope] : window).__script || {};
		(scope ? window[scope] : window).__script.Date = this.sr().serverDate();

		if (!eas.length) {
			// classes from JSON Array
			eas = eas.concat(...ret.map(c => c.EntityAttributes));
		}
		(scope ? window[scope] : window).EntityAttributes = eas;

		try {
			return await this._buildClasses(ret, scope);
		} catch (ex) {
			await this._getStoredScript({
				Name: "APISystem",
				Enabled: true,
			});
		}
	}

	async _loadEntityModule(m, ec) {
		if (!m) return;
		let mName = m.EntityModule ? m.EntityModule.Name : m.Name;
		(m.EntityModule || m).Imports = (m.EntityModule || m).Imports || 0;
		console.log("_loadEntityModule(): Loading " + mName);

		let eas = await this.sr()._("EnterpriseManager.emsEntityAttributeFindall", null, {
			Active: true,
			EntityClass: {
				Active: true,
				EntityModule: {
					Active: true,
					Enabled: true,
					Name: mName
				}
			}
		});
		if (eas.length) {
			(this["groupBy"] ? this : this.sr()).groupBy(eas, "EntityClass").forEach(g => {
				g.key.EntityAttributes = g.values;
				g.key.EntityModule = m;
				g.values.forEach(ea => ea.EntityClass = g.key);

				if (ec && Array.isArray(ec)) ec.push(g.key);
			});
		} else {
			// not stored in EMS, check if available as a stored script
			try {
				let mECs = await this._getStoredScript({
					Name: mName,
					Active: true,
					Enabled: true,
				});
				mECs = mECs.filter(c => (m.Excludes || []).indexOf(c.Name) < 0);

				mECs.filter(c => !c.EntityModule).forEach(c => {
					c.EntityRules = c.EntityRules || [];
					c.EntityRules.push(...(((m.EntityRules || {})[c.Name]) || []));
					c.EntityModule = m;
				});
				delete m.EntityRules;
				ec.push(...mECs);

				//console.log("_loadEntityModule(): Classes", ec.map(c => c.EntityModule));
				for await (const dm of ec.filter(c => !c.Name && c.EntityModule && !c.EntityModule.Ignore && c.EntityModule.Name != mName)) {
					//console.log("_loadEntityModule(): Candidate module", dm.EntityModule);
					if (ec.filter(c => c.Name && c.EntityModule && c.EntityModule.Name == dm.EntityModule.Name).length) {
						//console.log("_loadEntityModule(): Module already loaded!", dm.EntityModule);
						continue;
					}
					//console.log("_loadEntityModule(): recursive module", dm.EntityModule);
					if (dm.EntityModule) {
						(dm.EntityModule || dm).Imports++;
						await this._loadEntityModule(dm.EntityModule, ec);
					}
				}
			} catch (ex) {
				console.log("_loadEntityModule(): Failed loading module " + mName, ex);
			}
		}
	}

	_correctClasses(ec, eas) {
		let oGrouper = this["groupBy"] ? this : this.sr();
		let ret = null;

		if (Array.isArray(ec) && !(eas || []).length) {
			ec = ec.filter(c => c.Name && (typeof(c.Active) === "undefined" || c.Active));

			ec.forEach(c => {
				c.Id = c.Id || this._uuid();
				c.Plural = c.Plural || (c.Name + "s");
				c._ToString = c._ToString || c.Name;

				c.EntityAttributes = c.EntityAttributes || [];

				let _base_ = c.EntityAttributes.find(ea => ea.Name == '__BASE__');
				if (_base_) {
					let propList = ['IsUnique', 'Code', 'Default', 'Value', 'Required', 'Duplicate'];
					propList.filter(p => Array.isArray(_base_[p])).forEach(p => _base_[p] = Object.assign({}, ..._base_[p].map(_a => ({
						[_a]: true
					}))));

					let attList = [{
						Name: "active",
						IsBool: true,
						Default: true,
					}, {
						Name: "enabled",
						IsBool: true,
						Default: true,
					}, {
						Name: "code",
						IsUnique: true,
						IsString: true,
					}, {
						Name: "order",
						IsInt: true,
					}, {
						Name: "date",
						IsDate: true,
						Default: 'new Date()',
					}, {
						Name: "name",
						Required: true,
						IsString: true,
					}, {
						Name: "remark",
						IsText: true,
					}];
					attList.forEach(a => propList.filter(p => _base_[p]).forEach(p => a[p] = _base_[p][a.Name]));
					c.EntityAttributes = attList.concat(c.EntityAttributes.filter(ea => ea.Name !== "__BASE__"));
				}

				['EntityAttributes', 'EntityFields'].filter(eType => c[eType]).forEach(eType => c[eType].filter(ea => ea.Duplicate).forEach(ea => {
					let sea = ec.find(_c => _c.Name == ea.Duplicate.split('.')[0])[eType].find(sea => sea.Name == ea.Duplicate.split('.')[1]);
					Object.keys(sea).filter(k => ["EntityClass"].indexOf(k) < 0).forEach(k => {
						if (k == 'Default' && typeof(sea[k]) === 'string' && !sea[k].indexOf('/**generated**/')) return;
						ea[k] = sea[k];
					});
				}));

				c.TypedAttributes = c.TypedAttributes || [];
				c.EntityMethods = c.EntityMethods || [];
				c.EntityMethods.forEach(m => {
					m.MethodParameters = m.MethodParameters || [];
				});

				c.EntityAttributes.push(...c.EntityMethods.map(m => m.MethodParameters.filter(p => !p.Id)).flat());
				c.EntityAttributes = c.EntityAttributes.filter(ea => typeof(ea.Active) === "undefined" || ea.Active);
				c.EntityAttributes.filter(ea => ea.EntityType && !ea.EntityType.Id).forEach(ea => ea.EntityType = ec.find(_c => _c.Name == ea.EntityType.Name));
				c.EntityAttributes = c.EntityAttributes.filter(ea => !ea.EntityType || (ea.EntityType && ec.find(_c => _c.Name == ea.EntityType.Name)));
				c.EntityAttributes.forEach(ea => {
					if (!ea.Name) {
						console.log(c.Name + " has Attribute without Name", ea);
					}
					ea.Id = ea.Id || this._uuid();
					ea._ToString = ea._ToString || ea.Name;
					ea.Group = ea.Group || "Main";
					ea.EntityClass = c;
				});

				oGrouper.groupBy(c.EntityAttributes.filter(ea => ea.EntityMethod), "EntityMethod").forEach(mea => {
					let m = mea.key;

					m.EntityClass = c;
					m.MethodParameters = mea.values.filter(v => m.ResponseAttribute && v.Id != m.ResponseAttribute.Id);
					m.ResponseAttribute = mea.values.find(v => m.ResponseAttribute && v.Id == m.ResponseAttribute.Id);

					m.EntityClass.EntityMethods = m.EntityClass.EntityMethods || [];
					m.EntityClass.EntityMethods.push(m);
				});

				c.EntityMethods.forEach(m => {
					m.Id = m.Id || this._uuid();
					m._ToString = m._ToString || m.Name;

					m.EntityClass = c;

					m.MethodParameters.forEach(p => p.EntityMethod = m);
					m.MethodParameters.filter(p => p.EntityType && !p.EntityType.Id).forEach(p => {
						p.EntityType = ec.find(_c => _c.Name == p.EntityType.Name);
					});

					if (!m.ResponseAttribute) {
						if (typeof(window) !== 'undefined') console.log("_correctClasses(): Invalid ResponseAttribute for method " + m.Name + ". Defaulting to object return (ret" + m.Name + ")");
						m.ResponseAttribute = {
							IsObject: true,
						};
					}
					m.ResponseAttribute.Name = m.ResponseAttribute.Name || ("ret" + m.Name);

					if (m.ResponseAttribute && m.ResponseAttribute.EntityType) {
						let ra = ec.find(_c => _c.Name == m.ResponseAttribute.EntityType.Name);
						if (!ra) {
							console.log("_correctClasses(): Invalid EntityType Name=" + m.ResponseAttribute.EntityType);
						} else {
							m.ResponseAttribute.EntityType = ra;
						}
					}
					m.ResponseAttribute.EntityMethod = m;
				});

				c.EntityMethods = this._unique(c.EntityMethods);

				c.EntityAttributes.filter(ea => ea.IsString && !ea.EntityMethod && !ea.Default && (ea.Required || ea.IsUnique)).forEach(ea => ea.Default = c.EntityAttributes.filter(ra => !ra.EntityMethod && ra.EntityType && (ra.IsUnique || ra.Required)).map(ra => `/**generated**/(this.${ra.Name}()?this.${ra.Name}().${ea.Name}():'null')`).join(` + '-' + `));
			});

			/*oGrouper.groupBy([].concat(...ec.map(c => c.EntityAttributes.filter(ea => ea.EntityType && !ea.EntityMethod))), 'EntityType').forEach(cta => {
				ec.find(c => c.Id == cta.key.Id).TypedAttributes = cta.values;
			});*/

			ret = this._unique(ec);
		} else if (!ec || !Array.isArray(ec)) {
			var classes = oGrouper.groupBy(eas, "EntityClass");

			var tClasses = oGrouper.groupBy(eas, "EntityType");
			classes.forEach(c => {
				if (!c.key) {
					console.log("Empty key", c);
				}
				c.key.EntityAttributes = c.values;

				var tas = tClasses.find(tc => tc.key && c.key && tc.key.Id === c.key.Id);
				//c.key.TypedAttributes = tas ? tas.values : [];
				c.key.EntityMethods = c.key.EntityMethods || [];
			});
			ret = classes.map(a => a.key);

			oGrouper.groupBy(eas.filter(ea => ea.EntityMethod), "EntityMethod").forEach(mea => {
				let m = mea.key;

				m.EntityClass = ret.find(c => c.Id == m.EntityClassid);
				m.MethodParameters = mea.values.filter(v => v.Id != m.ResponseAttribute.Id);
				m.ResponseAttribute = mea.values.filter(v => v.Id == m.ResponseAttribute.Id)[0];

				m.EntityClass.EntityMethods = m.EntityClass.EntityMethods || [];
				m.EntityClass.EntityMethods.push(m);
			});
		}

		ret.forEach(c => {
			c.EntityMethods = c.EntityMethods.filter(m => !m.Ignore);
			c.EntityFields = (c.EntityFields || []).filter(f => !f.Ignore);
			c.EntityFields.forEach(ef => ef.EntityClass = c);
		});

		let trClass = ret.find(c => c.Name == "Transaction" && c.EntityModule);
		if (trClass) ret.forEach(c => c.EntityMethods.filter(m => !m.IsSync && !m.ResponseMethod).forEach(m => {
			m.ResponseMethod = {
				Name: m.Name + "Response",
				MethodParameters: [{
					Name: "transaction",
					EntityType: trClass
				}],
				Script: `return await transaction.class("${c.Name}").method("${m.Name}").asyncResult("${m.ResponseAttribute?.EntityType?.Name?.replace(/ /g, '_')}", ${m.ResponseAttribute.IsArray?"true":"false"})`,
				ResponseAttribute: m.ResponseAttribute,
			};
			c.EntityMethods.push(m.ResponseMethod);

			m.ResponseAttribute = {
				Name: `ret${m.Name}`,
				EntityType: trClass,
			}
		}));

		oGrouper.groupBy([].concat(...ret.map(c => c.EntityAttributes.filter(ea => ea.EntityType && !ea.EntityMethod))), 'EntityType').forEach(cta => {
			let _c = ret.find(c => c.Id == cta.key.Id || (c.Name == cta.key.Name /*&& c.EntityModule && cta.key.EntityModule && c.EntityModule.Name == cta.key.EntityModule.Name*/ ));
			if (!_c) {
				console.log("No class found to match " + cta.key.Name);
			} else {
				_c.TypedAttributes = cta.values;

				cta.values.forEach(ea => ea.EntityType = _c); //???
			}
		});

		if (ret && ret.length && !ret.find(c => c.IsMain)) {
			ret[0].IsMain = true;
			ret[0].Order = -Number.MAX_VALUE;
		}

		let cRank = (c, sources = []) => {
			sources.push(c.Name);
			return c.EntityAttributes.filter(ea => ea.EntityType && ea.EntityType !== c && sources.indexOf(ea.EntityType.Name) < 0).map(ea => cRank(ea.EntityType, sources)).concat([1]).reduce((sum, x) => sum + x);
		};

		// order by order
		ret.forEach(c => {
			c.Order = c.Order || 0;
			c.Rank = cRank(c);
			c.EntityAttributes.forEach(ea => ea.Order = ea.Order || 0);
			c.EntityMethods.forEach(em => em.Order = em.Order || 0);
			c.EntityFields.forEach(ef => ef.Order = ef.Order || 0);
		});
		ret.sort((a, b) => a.Order - b.Order);
		ret.forEach(c => c.EntityAttributes.sort((a, b) => a.Order - b.Order));
		ret.forEach(c => c.EntityFields.sort((a, b) => a.Order - b.Order));
		ret.forEach(c => c.EntityMethods.sort((a, b) => a.Order - b.Order));

		if (ret.length) {
			['Debug', 'Config', 'Test', 'Tools', 'Mappings', 'Routing', 'Validators', 'MethodRules', 'EntityRules'].forEach(a => {
				let mcA = ret[0][a];
				delete ret[0][a];
				ret.forEach(c => {
					c[a] = c[a] || c.EntityModule?.[a]?.[c.Name] || c.EntityModule?.[a]?.['*'] || c.EntityModule?.[a] || mcA?.[c.Name] || mcA?.['*'] || mcA || {};
					if (a.endsWith('s') && !Array.isArray(c[a])) c[a] = Object.keys(c[a]);
				});
			});

			ret.filter(c => !c.IsMain).forEach(c => c.Config = Object.assign(JSON.parse(JSON.stringify(ret.find(_c => _c.IsMain).Config)), c.Config));

			ret.filter(c => c.EntityModule && c.EntityModule.EntityModule).forEach(c => c.EntityModule = c.EntityModule.EntityModule);
		}

		return ret;
	}

	__scope(scope) {
		console.log("GOT HERE", this.sr())
		return this.sr().__scope(scope);
	}

	async _buildClasses(ret, scope) {
		let oScope = this.sr().__scope(scope);

		oScope.nName = oScope.nName || ((n, bAlias) => ((bAlias && n.EntityModule?.Alias) ? n.EntityModule?.Alias + '.' : '') + n?.Name?.replace(/ /g, '_'));
		oScope.nCode = oScope.nCode || (n => {
			if (!n) return "";
			let ret = n.Name || "";
			if (typeof(n.Code) === "string") {
				ret = n.Code;
			} else if (typeof(n.Code) === "object") {
				let o = (n.EntityClass || n);
				if (o.Tool) {
					ret = n.Code[o.Tool.Name] || n.Name;
				} else if (o.Tools.length && o.Tools[0] && o.Tools[0].type) {
					ret = n.Code[o.Tools[0].type.name] || n.Name;
				} else if (Object.keys(n.Code).length) {
					ret = n.Code[Object.keys(n.Code)[0]];
				} else {
					ret = n.Name;
				}
			}
			return ret.replace(/ /g, '_');
		});

		let html = await $.get((sr.bLocal ? "/nammour.com/ems/" : "") + "script/EntityClass.jst" + "?rand=" + Math.random());
		for await (const m of [...(html.matchAll(/(<%=).[\w\-.]+[\.](js)(%>)/gm))]) {
			let url = (sr.bLocal ? "/nammour.com/ems/" : "") + "script/" + m[0].replace("<%=", "").replace("%>", "") + "?rand=" + Math.random();

			let sName = m[0].replace("<%=", "").replace("%>", "").replace('.js', '');

			let code = await $.ajax({
				url,
				dataType: "script",
			});
			html = html.replace(m[0], code);
		}
		this.step();

		let _code = "";
		for await (const c of ret) {
			let code = this._inject(html, {
				arClasses: ret,
				c: c,
				scope: scope
			}) + '\n' + oScope.nName(c);

			code = this._beautify(code, "javascript");

			_code += code + `
${scope?'window.'+scope:'window'}.${oScope.nCode(c.EntityModule)||'x'}.${oScope.nName(c)} = ${oScope.nName(c)};
`;

			let alias = oScope;
			if (c.EntityModule && c.EntityModule.Alias) c.EntityModule.Alias.split('.').filter(a => a).forEach(a => alias = (alias[a] = alias[a] || {}));

			alias[oScope.nName(c)] = await this.runScript(code);
			if (c.IsMain) {
				//alias.GenericServiceAPI = GenericServiceAPI;
			}
		}

		return _code;
	}

	sr() {
		return (typeof(window) !== 'undefined' && window.sr) ? window.sr : this;
	}

	__time(name = "global") {
		let d = new Date() || this.sr().serverDate();
		this.sr().__scope().__times = this.sr().__scope().__times || {};
		this.sr().__scope().__times[name] = this.sr().__scope().__times[name] || d;

		let s = Math.round(((d - this.sr().__scope().__times[name]) / 1000) * 100, 2) / 100;
		this.sr().__scope().__times[name] = d;
		return (s + 's');
	}

	_cloneFunction(o, f, scope, c) {
		let code = window[o][f] ? window[o][f].toString() : `   ${f}(){
		    console.log('Error in _FrEMD._cloneFunction(${o}, ${f}): Invalid Function Name');
	    }`;
		let s = code.replace(')', ') => ');
		if (s.indexOf('function') == 0 || s.indexOf('async function') == 0) {
			s = s.replace('function', ' ');
		} else {
			s = s.replace(f, '');
		}

		if (c.IsMain && !window[o][f]) {
			console.log('Error in _FrEMD._cloneFunction(): Invalid Function Name ' + f);
		}

		return `
    ${f}(...params){
        if(typeof(window)!=="undefined" && typeof(window.${o})!=="undefined"){
            return window.${o}.${f}(...params);
        }else{
            ` + (c.IsMain ? `return (${s})(...params);` : `return new ${scope}.${window[scope].EntityClasses.find(_c => _c.IsMain).Name.replace(/ /g, '_')}().${f}(...params);`) + `
        }
	}
`;
	}

	_initServiceRouter() {
		window.sr = new ServiceRouter();

		this.sr().Store = company.Store;
		this.sr().init(null, company.library || "EnterpriseManager", true, this.bDebug);
		if (typeof srURL !== 'undefined') this.sr().srURL = srURL;
		this.sr().fLoadingStart = () => {
			if ($.mobile) $.mobile.loading('show');
		};
		this.sr().fLoadingEnd = () => {
			if ($.mobile) $.mobile.loading('hide');
		};
	}

	_include(_href) {
		return !(_href.disabled || (_href.type && this.isMobile() && _href.type != "mobile") || (_href.type && !this.isMobile() && _href.type == "mobile"));
	}

	_css(link, rel = "stylesheet") {
		return $("<link/>", {
			rel: rel,
			href: link,
		}).appendTo("head");
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

	_apply(o, fn, scope = []) {
		for (let i in o) {
			fn.apply(this, [i, o[i], scope]);
			if (o[i] !== null && typeof o[i] === "object") {
				this._apply(o[i], fn, scope.concat(i));
			}
		}
	}

	setURL(url) {
		if (this.allData.page) history.pushState({
			_code: this.allData.page._code
		}, this.allData.page._title, this.toHash());

		if (typeof(url) == "object") {
			let sURL = "";
			this._apply(url, (key, value, scope) => sURL += (typeof(value) !== "object" ? (scope.map(x => x + ".").join('') + key + "=" + value + "&") : ""));
			url = sURL;
			//console.log("setURL: url", url)
		}
		location.hash = "#" + url;
	}

	fromHash() {
		this.hash = {};
		(location.search + location.hash).replace(/#/g, "&").replace(/\?/g, '').split("&").filter(e => e).forEach(e => {
			try {
				this.hash[e.split("=")[0]] = e.split("=")[1];
			} catch (ex) {}
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
		//return (this.isMobile() ? "" : "/d");
		return "/d";
	}

	isMobile() {
		//return this.sr().isMobile;
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
		if (typeof(noty) !== "undefined") {
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
		if (typeof(noty) !== "undefined") {
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

	_inject(html, data, engine) {
		if (!html) return html;
		if (typeof(html) === 'object') {
			return $.extend({}, ...Object.keys(html).map(k => ({
				[k]: this._inject(html[k], data)
			})));
		}
		if (typeof(html) !== 'string') return html;

		try {
			if (typeof(jsonata) !== 'undefined') {
				try {
					return jsonata(html).evaluate(data);
				} catch (_ex) {}
			}

			if (typeof EJS !== 'undefined' && (typeof(engine) === 'undefined' || engine == 'EJS')) {
				return new EJS({
					text: html
				}).render(data);
			} else if (typeof doT !== 'undefined' && (typeof(engine) === 'undefined' || engine == 'doT')) {
				return doT.template(html)(data);
			} else if (typeof _ === 'function' && typeof _.template !== 'undefined' && (typeof(engine) === 'undefined' || engine == 'underscore')) {
				return _.template(html)(data);
			} else if (typeof Mustache !== 'undefined' && (typeof(engine) === 'undefined' || engine == 'Mustache')) {
				return Mustache.render(html, data);
			} else if (typeof Handlebars !== 'undefined' && (typeof(engine) === 'undefined' || engine == 'Handlebars')) {
				return Handlebars.compile(html).template(data);
			} else {
				return html;
			}
		} catch (ex) {
			console.log("_inject Exception: ", ex, data /*, html*/ );
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
				company.css.mobile.forEach(m => this._css(m));
			} else if (!this.isMobile() && company.css.desktop) {
				company.css.desktop.forEach(m => this._css(m));
			}
		}
		if (company.js) {
			if (this.isMobile() && company.js.mobile) {
				for (var i = 0; i < company.js.mobile.length; i++) $.getScript(company.js.mobile[i]);
			} else if (!this.isMobile() && company.js.desktop) {
				for (var i = 0; i < company.js.desktop.length; i++) $.getScript(company.js.desktop[i]);
			}
		}

		if (typeof(ReactDOM) !== "undefined") {
			if (typeof(MainComponent) !== "undefined") {
				var e = document.getElementById('mainComponent');
				if (!e) {
					e = document.createElement('div');
					e.setAttribute("id", "mainComponent");
					document.body.appendChild(e);
				}
				ReactDOM.render(React.createElement(MainComponent, null), e);
			} else if (typeof(FormComponent) !== 'undefined') {
				ReactDOM.render(React.createElement(FormComponent, null), document.getElementById('formComponent'));
			}
		}
		if (window.DForm) {
			try {
				window.DForm.init();
				window.DForm.parse();
				window.DForm.bind();
			} catch (ex) {
				console.log("DForm Functions failed", ex);
			}
		}
		if (company.OnPageLoad) {
			try {
				await company.OnPageLoad(data);
			} catch (ex) {
				console.log("FrEMD.end.OnPageLoad", ex);
			}
		}

		if (window.DForm) {
			await window.DForm._end();
		}

		try {
			// find a better way to re-invoke all window load events.
			let loaders = (jQuery._data || jQuery.data)(window, 'events').load || [];
			loaders.forEach(f => f.handler());
		} catch (ex) {
			console.log(ex);
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
				arCalls.push(this.sr()._(c.Name, null, ...args));
			} else {
				arCalls.push(this.sr()._("emsFormValues", null, {
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
		return this.sr()._("emsFormValues", fCallBack, {
			EntityObject: ((obj && obj.toEntityObject) ? obj.toEntityObject(true) : null)
		});
	}

	randURL(url = '') {
		return url + "?__rand=" + Math.random();
	}

	toSettings(s, o) {
		return s;
		for (var i = 0; i < s.length; i++) {
			if (!s[i].Parent) {}
		}
	}

	extType(v) {
		return ({
			html: 'html',
			htm: 'html',
			xml: 'html',
			js: 'javascript',
			cs: 'csharp',
			py: 'python',
			jsx: 'javascript',
		} [v.match(/\.[^.\\/:*?"<>|\r\n]+$/)[0].replace('.', '')] || "text");
	}

	_loading(on = true, interval = 300) {
		if (typeof($.messager) !== "undefined") {
			if (on) {
				$.messager.progress({
					title: 'Loading',
					msg: 'Loading data...',
					interval: interval,
				});
			} else {
				$.messager.progress('close');
			}
			return true;
		} else return false;
	}

	async reloadEditor(editor, loader, fData, oElement) {
		if (!editor.session.lastChanged) this._loading(true, oElement ? oElement.interval : null);
		try {
			let v = await loader(fData, oElement, editor);
			editor.session.lastLoaded = sr.serverDate();
			let diff = 0;
			if (editor.session.lastChanged && editor.session.lastSaved) diff = Math.abs(editor.session.lastChanged.getTime() - editor.session.lastSaved.getTime());
			if (diff > 0 && diff < 100) {
				// console.log("Not changed on the server");
			} else {
				// console.log("Server change, setting value", diff);
				editor.session.lastChanged = editor.session.lastSaved;
				editor.session.setValue(v);
			}
		} catch (ex) {
			this._error("Unable to Load file.\n" + ex);
		}
		this._loading(false);

		if (editor.session.lastSaved) {
			//await new Promise(r => setTimeout(r, 0.5 * 60 * 1000));
			await this._wait(0.5 * 60 * 1000);
			await this.reloadEditor(editor, loader, fData, oElement);
		}
	}

	async OpenEditor(e, language = o => "html", loader = o => {}, saver = (v, o) => {}, fData, oElement) {
		var editor = ace.edit(e);
		delete editor.session.lastChanged;

		editor.session.setUseWrapMode(true);
		//ace.config.set('basePath', '/node_modules/ace-builds/src-min-noconflict');
		editor.session.setValue('');

		editor.session.setMode('ace/mode/' + language(fData));
		editor.on("change", e => {
			let diff = Math.abs(editor.session.lastLoaded.getTime() - sr.serverDate().getTime());
			if (diff < 100 && e.start.row == 0 && e.start.column == 0) {
				return;
			}
			// console.log("Changed Event", diff);
			editor.session.lastChanged = sr.serverDate();
		});
		await this.reloadEditor(editor, loader, fData, oElement);

		if (saver) editor.commands.addCommand({
			name: 'save',
			bindKey: {
				win: "Ctrl-S",
				mac: "Cmd-S"
			},
			exec: async editor => {
				var value = this._beautify(editor.getValue(), language(fData));
				if (value != editor.session.getValue()) editor.session.setValue(value);
				if (saver) {
					if (typeof($.messager) !== "undefined") {
						$.messager.progress({
							title: 'Please waiting',
							msg: 'Saving data...',
							interval: oElement ? (oElement.interval || 600) : 600,
						});
					}
					try {
						await saver(value, fData);
						editor.lastSaved = sr.serverDate();
					} catch (ex) {
						this._error("Unable to Save file.\n" + ex);
					}
					if (typeof($.messager) !== "undefined") {
						$.messager.progress('close');
					}
				}
			}
		});
	}

	_beautify(value, type) {
		try {
			if (typeof(js_beautify) !== "undefined") {
				var options = {
					"indent_size": "1",
					"indent_char": "\t",
					"max_preserve_newlines": "2",
					"preserve_newlines": true,
					"keep_array_indentation": false,
					"break_chained_methods": false,
					"indent_scripts": "normal",
					"brace_style": "collapse",
					"space_before_conditional": true,
					"unescape_strings": false,
					"jslint_happy": false,
					"end_with_newline": false,
					"wrap_line_length": "0",
					"indent_inner_html": false,
					"comma_first": false,
					"e4x": false,
					"indent_empty_lines": false
				};

				if (typeof(value) === 'function') value = String(value);
				value = typeof(value) !== 'string' ? JSON.stringify(value) : value;
				if (['csharp', 'javascript', 'html'].indexOf(type) > -1) {
					value = js_beautify(value, options);
				}
			}
		} catch (ex) {}
		return value;
	}

	_lang(code) {
		window.lang = code;
		this.setURL("page=" + (this.allData.page._code || 'index'));
	}

	select2SR(oSelect) {
		let s = $(oSelect);
		let calls = [];
		if (this.select2Template) {
			calls.push(this.select2Template);
		} else {
			calls.push(this.sr().Get(this.randURL("templates" + this.m() + "/select2-template.htm")));
		}
		$.when(...calls).then((...ret) => {
			this.select2Template = ret[0];
			s.select2({
				ajax: {
					transport: (params, success, failure) => {
						var fFilter = this.sr().runScript("(o, state) => {" + s.data("sr_filter") + "}");
						$.when(this.sr()._(s.data("sr_method"), null, fFilter({}, this.sr().runScript(s.data("c_state"))))).then(ret => {
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
				jsx = await $.get(this.randURL((location || "templates") + this.m() + "/" + (page._code || page) + ".jsx"));
			} catch (ex) {}
			if (jsx === null || jsx === "") {
				return null;
			}
			var res = null;
			try {
				res = await Babel.transform(jsx, {
					presets: ['latest', "react"]
				});
			} catch (ex) {
				console.log("Babel", ex);
				return null;
			}
			return res.code;
		}
	}

	async _vueComponent(code) {
		if (typeof Vue === "undefined") return null;
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
		if (!this.sr().bLocal && (page.Body || page.toEntityObject)) {
			console.log("Page " + page._code + " already loaded, serving...");
			// found the page and it is an object
			if (!page.Script) {
				let e = await this.end();
				return e;
			}
			await this.runScript(page.Script);
		}
		let ret = null;
		ret = await this._vueComponent(page._code);
		if (!ret && CMS_ROOT) {
			ret = await this.sr()._("ContentManager.cmsHTMLPageFind", null, {
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
			let ret = await this.sr()._("EnterpriseManager.emsFormValues", null, {
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
					url: this.randURL("templates" + this.m() + "/" + page._code + ".htm")
				});
				console.log("Page " + page._code + " html template found");
				page.Body = html;
			} catch (ex) {
				console.log("Page " + page._code + " has no html template");
				if (!page.Body && typeof(React) !== "undefined" && typeof(MainComponent) === "undefined") {
					page.Body = "<div id='formComponent'/>";
				} else {
					page.Body = page._content || "<!--" + ("Page " + page._code + " does not exist") + "-->";
				}
			}
			try {
				let js = await this.preCompile(page) || await $.ajax({
					url: this.randURL("templates" + this.m() + "/" + page._code + ".js"),
					dataType: "text",
				});
				if (js) {
					// console.log(js);
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
		if (typeof(page.Script) === "function" && typeof(page.Script.constructor) === "function") {
			try {
				let obj = new page.Script(page);
				page.component = obj;
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
		if (typeof(ReactDOM) !== 'undefined') {
			delete window.FormComponent;
			$("#formComponent").empty();
		}
		var _page = await this._render(page, data, options);
		if (!_page) return null;
		if (typeof(ga) !== "undefined") {
			ga('send', {
				hitType: 'pageview',
				page: '/' + _page._code + '.dynamic',
				title: _page._title
			});
			console.log("Sent GA hit for page: " + (_page._code || _page.Page || _page));
		}
		window.page = _page;
		this.allHTML = this.blocks.header.html + (this.blocks.content.html || _page.Body || _page._body) + this.blocks.footer.html;
		this.allData = {
			settings: this.settings,
			page: _page,
			pages: this.pages
		};
		this.allOptions = options;

		this.endCalled = false;
		//this.setURL("page=" + _page._code);
		await this.end(null, window.page.data || data);
	}

	async runScript(js, bAsync) {
		if (typeof(js) !== "string") return js;
		if (typeof(sr) !== "undefined") {
			if (js.indexOf('class ') >= 0 && !bAsync) {
				// a class definition, do not enclose it in a function
				return await sr.runScript(js);
			} else {
				let sCode = js;
				if (sCode.indexOf('return ') != 0) {
					sCode = "return " + sCode;
				}
				return await sr.runScript("(async () => {" + sCode + "\n})();");
			}
		} else {
			return eval(js);
		}
	}
};

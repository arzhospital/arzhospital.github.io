window.DynaForm = class {
	constructor() {
		this.title = "Form Title";
		this.name = "frmForm";
		this.elements = [];
		this.selects = [];
		this.grids = [];
		this.buttons = [];
		this.zones = ['north', 'south', 'east', 'west', 'center'];
		this.sTable = null;
		this.bDebug = false;
		this.uiTypes = {
			int: "numberspinner",
			menu: "splitbutton",
			datetime: "datetimebox",
			bool: "switchbutton",
			file: "filebox",
			text: "textbox",
			password: "passwordbox",
			string: "textbox",
			image: "dialog",
			progress: "progressbar",
			link: "linkbutton",
			tree: "combotree",
			navigation: "tree",
			search: 'searchbox',
		};
		this.events = [{
			name: 'onClick',
			handler: 'onToggle',
			params: 'n=event',
			type: 'toggle',
		}, {
			name: 'onClose',
			handler: 'PanOnClose',
			params: 'n=event',
			type: 'window',
		}, {
			name: 'onSelect',
			handler: 'SelectChange',
			params: 'n',
			type: 'tabs',
		}, {
			name: 'searcher',
			handler: 'FieldChange',
			params: 'n, o',
			type: 'searchbox',
		}, {
			name: 'onBeforeExpand',
			handler: 'Expand',
			params: 'n',
			type: 'tree',
		}, {
			name: 'onChange',
			handler: 'FieldChange',
			params: 'n, o'
		}, {
			name: 'onBeforeOpen',
			handler: 'PanelOpen',
			params: '',
			type: 'window',
		}, {
			name: 'onOpen',
			handler: 'PendAfterOpen',
			params: '',
			type: 'window',
		}, {
			name: 'onClick',
			handler: 'doLink',
			params: 'n=event, o',
			type: 'link',
		}, {
			name: 'onClickRow',
			handler: 'FieldChange',
			params: 'n, o',
			type: 'grid',
		}];

		$(window).resize(this.windowResized);
		this.windowResized();
	}

	sr() {
		return typeof(_FrEMD) !== 'undefined' ? _FrEMD.sr() : window.sr;
	}

	parse() {
		$.parser.parse();
	}

	windowResized() {
		this.width = window.innerWidth;
		this.height = window.innerHeight * 0.8;
	}

	/** Components::Start **/
	CoreComponent = class {
		constructor(page) {
			this.page = page;
		}

		_me(v) {
			if (v) {
				window[company.loggedInIdentity || "me"] = v;
			}

			return window[company.loggedInIdentity || "me"];
		}

		_canView() {
			if (!this._me()) {
				window._FrEMD.setURL({
					page: 'login',
					_redirect: this.page._code,
				});
				throw `_canView: ${this.page._code} not allowed without login!`;
			}
		}

		_name() {
			if (!this._me()) return "";
			return this._me().name ? this._me().name() : this._me().ToString;
		}
	}

	IndexComponent = class extends this.CoreComponent {
		async main() {
			this._canView();

			this.page.data = {
				form: window.DForm.render('frmIndex', "Main Page", [{
					name: 'Welcome',
					required: true,
					type: "label",
					value: this._name(),
				}], [])
			};
		}
	}

	LoginComponent = class extends this.CoreComponent {
		async _authenticate(o) {
			return null;
		}

		async _loggedIn() {}

		async _notLoggedIn() {}

		async main() {
			this.page.data = {
				form: window.DForm.render('frmLogin', "User Authentication", [{
						name: 'Username',
						required: true,
						type: "string"
					},
					{
						name: 'Password',
						required: true,
						type: "password"
					}
				], [{
					name: 'Login',
					autoSubmit: true,
					onclick: async o => {
						let ret = await this._authenticate(o);

						if (ret) {
							this._me(ret);

							try {
								await this._loggedIn();
							} catch (ex) {}

							_FrEMD.setURL({
								page: _FrEMD.hash._redirect || "index"
							});
						} else {
							try {
								await this._notLoggedIn();
							} catch (ex) {}

							window.DForm.error("Invalid username or password");
						}

						window.DForm.busy(false);
					}
				}])
			}
		}
	}

	StoreComponent = class extends this.CoreComponent {
		async main() {
			this._canView();

			console.log("Generating CRUD page for: ", this.page);

			this.page.data = await window.DForm.CRUD(this.page.data);
		}
	}
	/** Components::End **/

	init() {
		var select = {
			init: function(container, options) {
				var op = null;
				var fop = null;
				for (var i = 0; i < window.DForm.grids.length; i++)
					if (window.DForm.grids[i].id == options.source) op = window.DForm.grids[i].options;
				for (i = 0; i < op.columns.length; i++)
					if (op.columns[i].name == options.field) fop = op.columns[i];
				fop.width = (window.DForm.width / 3);
				var e = $(window.DForm.select(fop));
				var input = e.appendTo(container);
				input.combogrid();
				window.DForm.bind(input);
				return input;
			},
			destroy: function(target) {
				$(target).remove();
			},
			getValue: function(target) {
				return $(target).val();
			},
			setValue: function(target, value) {
				$(target).val(value);
			},
			resize: function(target, width) {
				$(target)._outerWidth(width);
			}
		};
		$.extend($.fn.datagrid.defaults.editors, {
			datetime: {
				init: function(container, options) {
					options.width = window.DForm.cWidth(options);
					var input = $(window.DForm.datetime(options)).appendTo(container);
					input.datetimebox();
					return input;
				},
				destroy: function(target) {
					$(target).remove();
				},
				getValue: function(target) {
					return $(target).val();
				},
				setValue: function(target, value) {
					$(target).val(value);
				},
				resize: function(target, width) {
					$(target)._outerWidth(width);
				}
			},
			checkbox: {
				init: function(container, options) {
					var input = $(window.DForm.bool(options)).appendTo(container);
					input.switchbutton();
					return input;
				},
				destroy: function(target) {
					$(target).remove();
				},
				getValue: function(target) {
					return $(target).val();
				},
				setValue: function(target, value) {
					$(target).val(value);
				},
				resize: function(target, width) {
					$(target)._outerWidth(width);
				}
			},
			combotreegrid: select,
			select: select,
		});
	}

	ask(question, fAnswer = v => v, options) {
		$.messager.confirm(this.title, question, function(r) {
			if (options) {
				for (var i = 0; i < options.length; i++) {
					if (options[i].answer == r) {
						return fAnswer(options[i].value);
					}
				}
			} else {
				return fAnswer(r);
			}
		});
	}

	topData(ar, gField, vField, top) {
		if (!top) {
			return ar;
		}
		ret = [];
		$.each(this.sr().groupBy(ar, gField), function(key, values) {
			values.values.sort((a, b) => {
				if (parseFloat(a[vField]) < parseFloat(b[vField])) {
					return 1;
				} else if (parseFloat(a[vField]) > parseFloat(b[vField])) {
					return -1;
				} else {
					return 0;
				}
			});
			$.each(values.values, function(i, v) {
				if (i < top) {
					ret.push(v);
				}
			});
		});
		return ret;
	}

	async CRUD(sTable, bFixed) {
		var fields = [];
		window.DForm.sTable = sTable;
		if (company.library) {
			var ret = await this.sr()._("ContentManager.cmsGenerateLayerClass", null, company.library + "." + sTable);
			fields.push({
				group: "Main",
				attribute: {
					RelationClass: {
						Name: sTable
					}
				},
				name: window.DForm.sTable,
				type: 'select',
				select: function(o) {
					window.DForm.set(o);
				}
			});
			for (var i = 0; i < ret.LayerAttributes.length; i++) {
				if (ret.LayerAttributes[i].Name == "Id") continue;
				fields.push({
					group: "Main",
					name: ret.LayerAttributes[i].Name,
					type: ret.LayerAttributes[i].NativeType
				});
			}
			for (i = 0; i < ret.RelationAttributes.length; i++) {
				var m = ret.RelationAttributes[i].IsArray;
				var rCols = [];
				for (var p in ret.RelationAttributes[i].RelationClass) {
					if ($.inArray(p, ["ToString", "_ToString", "__ROWID", "__LOADED", "Id"]) > -1) continue;
					rCols.push({
						field: p,
						title: p
					});
				}
				fields.push({
					group: (m ? "Other" : "Relations"),
					Class: ret.RelationAttributes[i].RelationClass,
					name: ret.RelationAttributes[i].Name,
					type: 'select',
					multiple: m,
					source: function(o, fData) {
						return o;
					},
					columns: rCols
				});
			}
		} else {
			// ems
			var ec = (company.Scope ? window[company.Scope] : window).EntityClasses.find(c => c.Name.replace(' ', '_') == sTable);
			fields.push({
				name: sTable,
				title: ec.Name,
				Class: {
					Name: ec.Name,
					Id: ec.Id
				},
				type: 'select',
				select: function(o) {
					window.DForm.clear();
					window.DForm.set(o);
				}
			});
			$.each(ec.EntityAttributes, (_, ea) => {
				if (!ea.EntityType) {
					var type = "string";
					if (ea.IsBool) type = "bool";
					if (ea.IsDate) type = "datetime";
					if (ea.Is) type = "datetime";
					if (ea.IsText) type = "text";
					fields.push({
						group: ea.Group.Name,
						name: ea.Name,
						type: type
					});
				} else {
					fields.push({
						group: ea.Group.Name,
						name: ea.Name,
						Class: {
							Name: ea.EntityType.Name,
							Id: ea.EntityType.Id
						},
						source: function(o, fData) {
							return o;
						},
						type: "select"
					});
				}
			});
		}
		return {
			form: window.DForm.render(sTable, this.english(sTable), fields, [{
				name: 'Reset',
				onclick: function(o) {
					window.DForm.busy(false);
					window.DForm.clear();
				},
				icon: "cancel"
			}, {
				name: 'Save',
				onclick: function(o) {
					if (o[window.DForm.sTable] && o[window.DForm.sTable].Id) o.Id = o[window.DForm.sTable].Id;
					delete o[window.DForm.sTable];
					if (company.library) {
						this.sr()._(company.Code.toLowerCase() + "" + window.DForm.sTable + (o.Id ? "Update" : "Insert"), function(ret) {
							if (ret) {
								window.DForm.info(window.DForm.sTable + " Saved");
							} else {
								window.DForm.error("Unable to save " + window.DForm.sTable);
							}
							window.DForm.busy(false);
						}, o);
					} else {
						this.sr()._("emsEntityObject" + (o.Id ? "Update" : "Insert"), function(ret) {
							if (ret) {
								window.DForm.info(window.DForm.sTable + " Saved");
							} else {
								window.DForm.error("Unable to save " + window.DForm.sTable);
							}
							window.DForm.busy(false);
						}, o.toEntityObject());
					}
				}
			}], bFixed)
		};
	}

	async doClick(button) {
		button = this.buttons.find(b => b.name == button.name && b.group == button.group);
		this.busy(true);
		var o = this.get();
		var sMissing = this.elements.filter(e => (button.window ? button.group == e.group : true)).filter(e => e.required && !o[e.name]).map(e => "<li>" + (e.label || e.name) + "</li>").join("");
		if (sMissing) {
			window._FrEMD._error("Missing mandatory fields:<br/><ul>" + sMissing + "</ul>", 5000);
			this.busy(false);
			return;
		}
		if (button.onclick) await button.onclick(o);
		if (button.onClick) await button.onClick(o);
		this.busy(false);
	}

	busy(bBusy) {
		if (!bBusy) {
			var total = 0;
			if (typeof moment !== 'undefined') {
				total = moment().diff(moment(this.busyStamp), 'seconds');
			} else {
				// no moment, use standard Date
				total = (new Date().getTime() - this.busyStamp ? this.busyStamp.getTime() : 0) / 1000 / 3600;
			}
			if (this.bDebug) {
				window._FrEMD._alert("Execution Time: " + total + " seconds.");
			}
			delete this.busyStamp;
		} else {
			this.busyStamp = new Date();
		}

		$.each($.merge($.map(this.buttons, b => b.name), $.map(this.elements.filter(e => e.type == 'link'), e => e.name)), (_, e) => $('#' + e).linkbutton(bBusy ? 'disable' : 'enable'));
	}

	prefix(e) {
		switch (e.type) {
			case 'label':
				return 'lbl';
			case 'text':
			case 'string':
			case 'search':
			case 'password':
				return 'txt';
			case "DateTime":
			case "datetime":
				return 'dtp';
			case "int":
			case "integer":
			case "number":
			case "long":
			case "Long":
				return 'nud';
			case 'file':
				return 'fil';
			case 'image':
				return 'img';
			case "bool":
				return 'chk';
			case "window":
				return 'pnl';
			case "progress":
				return 'prg';
			case "grid":
			case "tree":
			case "select":
				return 'cmb';
			default:
				return '';
		}
	}

	clear(group) {
		var o = {};
		$.each(this.elements.filter(e => group ? e.group == group : true), (_, e) => {
			var name = (e.emsSource ? "_" : "") + e.name;
			switch (e.type) {
				case 'text':
				case 'string':
				case 'search':
				case 'password':
				case "DateTime":
				case "datetime":
					o[name] = "";
					break;
				case "int":
				case "number":
				case "integer":
				case "long":
				case "Long":
				case "progress":
					o[name] = 0;
					break;
				case "tree":
				case "select":
					o[name] = null;
					break;
				case "grid":
					o[name] ? o[name].data = [] : null;
					break;
				case "bool":
					o[name] = false;
					break;
				default:
					break;
			}
		});
		//console.log("clear", o);
		this.set(o);
		this.busy(false);
	}

	set(o, eName) {
		if (eName) {
			var oElement = this.byName(eName);
			if (!oElement) return;
			var att = null;
			if (o && o.Id && o.EntityAttribute) {
				// an EntityValue
				for (var p in o)
					if (p.endsWith("Value")) att = p;
				oElement.emsSource = o;
			}
			try {
				switch (oElement.type) {
					case 'label':
						if (att) {
							$("#" + this.prefix(oElement) + oElement.name).html(o[att]);
						} else {
							$("#" + this.prefix(oElement) + oElement.name).html((o && o.EntityAttribute) ? "" : o);
						}
						break;
					case 'text':
					case 'string':
					case 'password':
					case "int":
					case "search":
					case "integer":
					case "number":
					case "long":
					case "Long":
						if (att) {
							$("#" + this.prefix(oElement) + oElement.name)[this.uiTypes[oElement.type]]("setValue", o[att]);
						} else {
							$("#" + this.prefix(oElement) + oElement.name)[this.uiTypes[oElement.type]]("setValue", (o && o.EntityAttribute) ? "" : o);
						}
						break;
					case "DateTime":
					case "datetime":
						if (att) {
							$("#" + this.prefix(oElement) + oElement.name)[this.uiTypes[oElement.type]]('setValue', (o[att] ? this.sr().toDateTime(o[att]) : ""));
						} else {
							$("#" + this.prefix(oElement) + oElement.name)[this.uiTypes[oElement.type]]('setValue', (o && o.EntityAttribute) ? "" : (o ? this.sr().toDateTime(o) : ""));
						}
						break;
					case "bool":
						if (att) {
							$("#" + this.prefix(oElement) + oElement.name)[this.uiTypes[oElement.type]]((o[att] ? '' : 'un') + 'check');
						} else {
							$("#" + this.prefix(oElement) + oElement.name)[this.uiTypes[oElement.type]]((((o && o.EntityAttribute) ? "" : o) ? '' : 'un') + 'check');
						}
						break;
					case "window":
						if (att) {
							oElement.value = o[att];
						} else {
							oElement.value = (o && o.EntityAttribute) ? "" : o;
						}
						break;
					case "progress":
						var v = 0;
						if (att) {
							v = o[att];
						} else {
							v = (o && o.EntityAttribute) ? "" : o;
						}
						$("#" + this.prefix(oElement) + oElement.name)[this.uiTypes[oElement.type]]('setValue', Math.round(v * 10) / 10);
						break;
					case "grid":
						let cols = JSON.parse("{" + this.mapColumns(oElement, true) + "}");
						$.each(cols.columns[0], (_, c) => c.formatter = this.sr().runScript(this.formatter(oElement.name, c)));
						$("#" + this.prefix(oElement) + oElement.name).datagrid(cols);
						if (att) {
							$("#" + this.prefix(oElement) + oElement.name).datagrid({
								data: o[att]
							});
						} else {
							$("#" + this.prefix(oElement) + oElement.name).datagrid({
								data: (o && o.EntityAttribute) ? "" : o
							});
						}
						$("#" + this.prefix(oElement) + oElement.name).datagrid("unselectAll");
						$("#" + this.prefix(oElement) + oElement.name).datagrid();
						break;
					case "tree":
						var v = att ? o[att] : ((o && o.EntityAttribute) ? "" : o);
						if (Array.isArray(v)) {
							$("#" + this.prefix(oElement) + oElement.name)[this.uiTypes[oElement.type]]("tree").tree("loadData", v);
						} else {
							$("#" + this.prefix(oElement) + oElement.name)[this.uiTypes[oElement.type]]('setValue', v);
						}
						break;
					case "select":
						if (att) {
							if (oElement.options) {
								$("#" + this.prefix(oElement) + oElement.name).combo('setValue' + (oElement.multiple ? 's' : ''), (o[att] ? o[att] : ""));
								$("#" + this.prefix(oElement) + oElement.name).combo('setValue' + (oElement.multiple ? 's' : ''), (o[att] ? o[att] : ""));
							} else {
								$("#" + this.prefix(oElement) + oElement.name).combogrid('setValue' + (oElement.multiple ? 's' : ''), (o[att] ? o[att] : ""));
							}
						} else {
							v = null;
							if (o === null) {

							} else if (o.constructor === Array) {

							} else if (!o.EntityAttribute) {
								v = o || {
									Id: o.Id,
									_ToString: o._ToString,
									toString: function() {
										return this._ToString;
									}
								};
							}
							if (oElement.options) {
								$("#" + this.prefix(oElement) + oElement.name).combo('setValue' + (oElement.multiple ? 's' : ''), v);
								$("#" + this.prefix(oElement) + oElement.name).combo('setText' + (oElement.multiple ? 's' : ''), v);
							} else {
								$("#" + this.prefix(oElement) + oElement.name).combogrid('setValue' + (oElement.multiple ? 's' : ''), v);
							}
						}
						break;
					default:
						break;
				}
			} catch (ex) {
				console.log(ex);
			}
		} else {
			for (var p in o) {
				if (p.indexOf('_') === 0) p = p.substring(1);
				var e = this.byName(p);
				if (!e || !e.name) continue;
				var value = o[p];
				if (e.name == this.sTable) {
					value = o;
					value.Date = new Date();
				}
				if (p == "EntityValues") {
					// an emsFormValues source
					// find the EntityValue for this element and set it
					for (var j = 0; j < o.EntityValues.length; j++) {
						if (o.EntityValues[j].EntityAttribute.Name == e.name) {
							// found the EntityValue for this element
							_v = o.EntityValues[j];
							for (var q in _v) {
								if (q.endsWith("Value")) {
									_v[q] = value;
								}
							}
							break;
						}
					}
				}
				this.set(value, e.name);
			}
		}
	}

	get() {
		var o = {};
		if (this.sTable && window[this.sTable]) o = new window[this.sTable]();
		for (var i = 0; i < this.elements.length; i++) {
			var cn = null;
			var v = null;
			try {
				switch (this.elements[i].type) {
					case 'label':
						cn = $("#lbl" + this.elements[i].name);
						v = cn.html();
						break;
					case 'text':
					case 'string':
					case 'search':
					case 'password':
						cn = $("#" + this.prefix(this.elements[i]) + this.elements[i].name);
						v = cn.val();
						break;
					case "file":
					case "image":
						cn = $("#" + this.prefix(this.elements[i]) + this.elements[i].name);
						v = this.elements[i].data;
						break;
					case "DateTime":
					case "datetime":
						v = new Date($("#" + this.prefix(this.elements[i]) + this.elements[i].name).datetimebox('getValue'));
						cn = $("#" + this.prefix(this.elements[i]) + this.elements[i].name);
						break;
					case "progress":
						cn = $("#" + this.prefix(this.elements[i]) + this.elements[i].name);
						v = cn.progressbar('getValue');
						break;
					case "int":
					case "integer":
					case "number":
					case "long":
					case "Long":
						cn = $("#" + this.prefix(this.elements[i]) + this.elements[i].name);
						v = parseFloat(cn.val());
						if (isNaN(v)) v = 0;
						break;
					case "grid":
						cn = $("#" + this.prefix(this.elements[i]) + this.elements[i].name);
						v = cn.datagrid('getData');
						v.selected = cn.datagrid("getSelected");
						break;
					case "tree":
						cn = $("#" + this.prefix(this.elements[i]) + this.elements[i].name);
						v = cn.combotree("tree").tree("getSelected");
						break;
					case "window":
						v = this.elements[i].value;
						break;
					case "select":
						if (this.elements[i].options) {
							v = $("#" + this.prefix(this.elements[i]) + this.elements[i].name).combogrid('getValue' + (this.elements[i].multiple ? 's' : ''));
							v = this.sr().runScript(v);
						} else {
							v = $("#" + this.prefix(this.elements[i]) + this.elements[i].name).combogrid('grid').datagrid('getSelections');
							if (!v || !v.length) {
								v = $("#" + this.prefix(this.elements[i]) + this.elements[i].name).combogrid('getValue' + (this.elements[i].multiple ? 's' : ''));
							} else {
								if (!this.elements[i].multiple) v = v[0];
							}
						}
						cn = $("#" + this.prefix(this.elements[i]) + this.elements[i].name);
						break;
					case "bool":
						cn = $("#" + this.prefix(this.elements[i]) + this.elements[i].name);
						v = cn.switchbutton('options').checked;
						break;
					default:
						break;
				}
				o[this.elements[i].name](v);
			} catch (e) {
				//console.log(this.elements[i].name, e);
				o[this.elements[i].name] = v;
			}
			if (cn) {
				if (o.EntityValues) {
					for (var j = 0; j < o.EntityValues.length; j++) {
						if (this.elements[i].name == this.sTable && this.elements[i].emsSource) o.Id = this.elements[i].emsSource.Id;
						if (o.EntityValues[j].EntityAttribute.Name == this.elements[i].name && this.elements[i].emsSource) {
							o.EntityValues[j].Id = this.elements[i].emsSource.Id;
						}
					}
				}
			}
		}
		return o;
	}

	cHeight(options) {
		if (options && options.editor) return window.innerHeight;
		if (options && options.height && typeof(options.height) === 'string') return this.height;
		if (options && options.type == 'window' && !options.height) return this.height * 0.9;
		return Math.floor(((options ? options.height : null) || (this.height / 3)));
	}

	search(options) {
		return this.string(options);
	}

	string(options) {
		options.height = 20;
		options.simple = true;
		return this.text(options);
	}

	datetime(options) {
		return `<input id="dtp${options.name}" class="easyui-${this.uiTypes[options.type]}" required="${options.required ? 'true' : 'false'}" value="${this.value(options)}" style="width:${this.cWidth(options)}px">`;
	}

	query(options) {
		return "<div id='vs" + options.name + "'></div>";
	}

	DateTime(options) {
		return this.datetime(options);
	}

	long(options) {
		return this.int(options);
	}

	Long(options) {
		return this.long(options);
	}

	value(options) {
		if (typeof options.value === 'function') {
			try {
				return options.value(this.get());
			} catch (ex) {
				console.log(`DForm.value(${options.name}): ${ex}`);
				return '';
			}
		} else {
			switch (options.type) {
				case 'int':
				case 'progress':
					return options.value || options.min || 0;
				case 'string':
				case 'text':
				case 'datetime':
				case 'label':
					return options.value || "";
				default:
					return options.value;
			}
		}
	}

	int(options) {
		let ret = `<input id="nud${options.name}" class="easyui-${this.uiTypes[options.type]}" required="${options.required ? 'true' : 'false'}" value="${this.value(options)}" data-options="min:${options.min || 0},max:${options.max || 100},increment:${options.increment || 1}" style="width:${this.cWidth(options)}px;"></input>`;
		//console.log(ret);
		return ret;
	}

	menu(options) {
		var ret = "";
		ret += '<div class="easyui-panel" id="mnu' + options.name + '" style="padding:5px;">\n';
		$.each(options.menu, (_, m) => ret += `<a href="#" class="easyui-${this.uiTypes[options.type || 'menu']}" data-options="menu:'#mm${m.label.replace(/ /g, '')}',iconCls:'icon-${m.icon || 'none'}'">${m.label}</a>\n`);
		ret += "</div>\n";
		let dv = m => {
			let ret = '<div' + (m.subMenus ? '' : ` data-options="iconCls:'icon-${m.icon || 'none'}'"`) + '>\n';
			ret += m.subMenus ? '<span>' + (m.label || this.english(m.code)) + '</span>\n<div>' : (`<span width='100%' onclick='(async () => {let m = ${_FrEMD._toJS(m)}; if(m.action){return await m.action(DForm.get(), m);} if (m.subMenus) return; await _FrEMD.RenderPage({_code: m.code || m.label.replace(/ /g, "").toLowerCase()}, m.data);})()'>${m.label || this.english(m.code)}</span>`);
			$.each(m.subMenus, (_, s) => ret += dv(s));
			ret += (m.subMenus ? "</div>\n" : "") + `</div>\n`;
			return ret;
		};
		for (var i = 0; i < options.menu.length; i++) {
			var m = options.menu[i];
			ret += '<div id="mm' + m.label.replace(/ /g, '') + '" style="width:150px;">';
			for (var j = 0; j < m.subMenus.length; j++) {
				var sm = m.subMenus[j];
				ret += dv(sm);
			}
			ret += '</div>\n';
		}
		return ret;
	}

	integer(options) {
		return this.int(options);
	}

	number(options) {
		return this.int(options);
	}

	Integer(options) {
		return this.int(options);
	}

	bool(options) {
		return `<input id="${this.prefix(options)}${options.name}" data-dform="element:${options.name}" required="${options.required?'true':'false'}" data-options='disabled:${options.disabled?'true':'false'},${this.eventHandlers(options)}' class="easyui-${this.uiTypes[options.type]}" ${options.checked?'checked':''} />`;
	}

	label(options) {
		return `<span id="${this.prefix(options)}${options.name}" style="width:${this.cWidth(options)}px" data-options="disabled:${options.disabled?'true':'false'}">${this.value(options)}</span>`;
	}

	url(options) {
		return this.string(options).replace("FieldChange", "URLChange");
	}

	text(options) {
		return `<input id="${this.prefix(options)}${options.name}" class="easyui-${options.editor || this.uiTypes[options.type]}" data-options='disabled:${options.disabled?'true':'false'},${this.eventHandlers(options)}' multiline="${options.simple ? 'false' : 'true'}" style="white-space:pre-wrap;width:${this.cWidth(options)}px;height:${this.cHeight(options)}px" required="${options.required ? 'true' : 'false'}" value="${this.value(options)}" />`;
	}

	password(options) {
		var ret = this.string(options);
		ret = ret.replace('<input ', '<input type="password" ');
		return ret;
	}

	file(options) {
		return `<input id="${this.prefix(options)}${options.name}" class="easyui-${this.uiTypes[options.type]}" data-options="onChange:function(n,o){var s = $('#' + this.id).filebox('options'); window.DForm.UploadFile(s, window.DForm.byName('${options.name}'));}" style="width:${this.cWidth(options)}px">`;
	}

	image(options) {
		return this.file(options) + `<div id="dlg${options.name}" class="easyui-${this.uiTypes[options.type]}" title="Image Preview" data-options="closed:true,iconCls:'icon-save',resizable:false,modal:true" style="width:400px;height:200px;padding:10px"><img id="${this.prefix(options)}${options.name}" width="100%" height="100%"/></div>`;
	}

	progress(options) {
		if (!options.height) options.height = 20; // fix big progress
		return `<div id="${this.prefix(options)}${options.name}" class="easyui-${this.uiTypes[options.type]}" data-options="value:${this.value(options)}" style="width:${this.cWidth(options)}px;height:${this.cHeight(options)}px"></div>`;
	}

	flowchart(options) {
		return `<div id="flw${options.name}" width="${this.cWidth(options)}" height="${this.cHeight(options)}"></div>`;
	}

	chart(options) {
		return `<div id="cht${options.name}" width="${this.cWidth(options)}" height="${this.cHeight(options)}"></div>`;
	}

	formatter(name, c, json) {
		json = json ? '"' : '';
		return `${json}(value, row, index) => {try{var c = (DForm.byName(\`${name}\`).columns || []).find(c => c.field==\`${c.field}\`); return c&&c.format?c.format(value,row,index):value;}catch(ex){return value;} }${json}`;
	}

	mapColumns(options, json) {
		let cTitle = c => c.title || this.english(c.field);

		var cols = $.grep(options.columns || [], c => !c.ignore);
		let ret = "";
		if (options.multiple) ret += `{"field":'ck',"checkbox":true},`;
		ret = `"frozenColumns": [[`;
		if (!options.frozen) {
			ret += `{"field":"${options.idField.field}","title": "${options.idField.title}","sortable": "true", "formatter": ${this.formatter(options.name, options.idField, json)}},`;
			if (options.textField.field != options.idField.field) ret += `{"field":"${options.textField.field || options.textField.title}","title":"${options.textField.title || options.textField.field}","width":"${options.textField.width||120}", "sortable": "true", "formatter": ${this.formatter(options.name, options.textField, json)}}`;
		} else {
			$.map($.grep(cols, c => c.frozen), c => `{"field":"${c.field || cTitle(c)}","title":"${cTitle(c) || c.field}","width":"${c.width||120}","align":'left',"sortable":"true", "formatter": ${this.formatter(options.name, c, json)}}`).join(",");
		}
		ret += `]], "columns": [[`;
		ret += $.map($.grep(cols, c => !c.frozen), c => `{"field":"${c.field || cTitle(c)}","title":"${cTitle(c) || c.field}","align":"left","sortable":"true", "formatter": ${this.formatter(options.name, c, json)}}`).join(",");
		ret += ']]';
		return ret;
	}

	select(options, tag = options.tag, type) {
		return this.combo(options, tag, type);
	}

	tree(options) {
		return this.select(options, "select");
	}

	navigation(options) {
		return this.combo(options, 'ul', 'tree');
	}

	combo(options, tag, type) {
		var cols = $.grep(options.columns || [], c => !c.ignore);
		tag = tag || "select";
		options.idField = $.uniqueSort([{
			field: options.idField,
			title: options.idField
		}].concat($.grep(cols, c => c.primary), [{
			field: 'Id',
			title: 'ID'
		}])).find(x => typeof(x.field) !== "undefined");
		options.textField = $.uniqueSort([{
			field: options.textField,
			title: options.textField
		}].concat($.grep(cols, c => c.display), [{
			field: company.library ? '_ToString' : '_name',
			title: options.name,
		}])).find(x => typeof(x.field) !== "undefined");
		var fun = type || this.eFun(options);
		var dropdown = ['combotreegrid', 'combotree', 'combogrid', 'select'].indexOf(fun) > -1;
		if (dropdown) this.selects.push({
			id: "cmb" + options.name,
			options: this.byName(options.name)
		});
		this.selects = $.uniqueSort(this.selects);
		var ret = `<${tag} id="cmb${options.name}" class="easyui-${fun}" style="max-width:${dropdown?'400px':this.cWidth(options)}; width:${this.cWidth(options)}px" required="${(options.required ? 'true' : 'false')}" data-options='disabled:${options.disabled?'true':'false'},${this.eventHandlers(options)}, value:"${this.value(options)}", rownumbers:${typeof(options.rowNumbers)!=='undefined'?options.rowNumbers:(fun.indexOf('tree')<-1?'false':'true')}, pagination:${typeof(options.pagination)!=='undefined'?options.pagination:(fun.indexOf('tree')<-1?'false':'true')}, panelWidth:${2*this.cWidth(options)}, fitColumns: true, singleSelect: true, multiple:${(options.multiple || 'false')}, idField: "${options.idField.field}", enableFilter: ${options.filter?'true':'false'}, nowrap: false, textField: "${options.textField.field}", treeField: "${options.textField.field}",`;
		if (fun.indexOf('tree') == -1) {
			ret += 'fitColumns: false,' + this.mapColumns(options);
		}
		if (options.data) {
			ret += `,data: ${JSON.stringify(options.data)}`;
		}
		ret += `'>`;
		if (options.options) {
			ret += $.map(options.options, o => `<option value='${_FrEMD._toJS(o)}'>${o.name || o}</option>`).join('\n');
		}
		ret += `</${tag}>`;
		// console.log(ret);
		return ret;
	}

	grid(options, tag, type) {
		return this.combo(options, "table", "datagrid");
	}

	treegrid(options) {
		return this.combo(options, 'table', 'tree');
	}

	async doLink(e, event) {
		this.busy(true);
		try {
			await e.links.find(l => l.label == event.target.innerText).onClick(this.get());
		} catch (ex) {
			console.log("doLink", ex);
		}
		this.busy(false);
	}

	EditedValue(e) {
		return (typeof(ace) !== "undefined") ? ace.edit('pnl' + e.name).session.getValue() : '';
	}

	async PanOnClose(e) {
		if (e.editor) {
			e.value = this.EditedValue(e);
		}
		if (e.close) {
			await e.close(this.get());
		}
	}

	async PendAfterOpen(e) {
		if (e.editor && typeof(ace) !== "undefined") {
			await _FrEMD.OpenEditor('pnl' + e.name /*+ '-center'*/ , e.language, e.loader || (o => e.value), e.saver, this.get(), e);
		}
		if (e.open) {
			await e.open(this.get());
		}
	}

	link(options) {
		return (options.links || []).filter(l => !l.ignore).map(l => `<a href="#" class="easyui-${this.uiTypes[options.type]}" data-options='${this.eventHandlers(options)}, iconCls:"icon-${l.icon || 'ok'}"'>${l.label}</a>`).join('\n');
	}

	async SetTreeData(e, n, data) {
		$.each($("#cmb" + e.name)[this.eFun(e)]('tree').tree("getChildren", n.target), (_, c) => $("#cmb" + e.name)[this.eFun(e)]('tree').tree("remove", c.target));
		$("#cmb" + e.name)[this.eFun(e)]('tree').tree("append", {
			parent: n.target,
			data: data
		});
		return true;
	}

	async Expand(e, n) {
		this.SetTreeData(e, n, [{
			id: null,
			text: "loading..."
		}]);
		var obj = {};
		var pField = e.parentField || $.map($.grep(e.columns || [], c => c.parent), c => c.field).concat([null])[0];
		var idField = $.grep(e.columns || [], c => c.primary).concat(e.idField)[0].field;
		if (pField) {
			obj[pField] = {
				_source: n._source
			};
			if (idField) {
				obj[pField][idField] = n.id;
			} else {
				obj[pField] = n.id;
			}
		}
		let data = await this._loadData({
			id: "cmb" + e.name,
			options: e
		}, obj);
		this.SetTreeData(e, n, data);
	}

	async _loadData(s, o, start, end) {
		var name = (s && s.options ? (s.options.Class ? s.options.Class.Name.replace(' ', '_') : (s.options.table || s.options.name)) : s.name);

		let oScope = company.Scope ? window[company.Scope] : window;
		o = o || (oScope[name] ? new oScope[name]() : {
			Active: true,
		});
		o = (typeof filters !== "undefined" && filters && filters[name]) ? filters[name](o) : o;
		o = (s && s.options && s.options.source ? s.options.source(o, this.get()) : o);
		let names = $.uniqueSort([s.options.searchField].concat($.map($.grep(s.options.columns || [], c => c.search), c => c.field), ["Name"]));
		var fun = this.eFun(s.options);
		if (!o[names[0]]) o[names[0]] = $("#" + s.id)[fun]('getText');
		var data = null;
		if (s.options.loader) {
			data = await s.options.loader(this.get(), s.options, o);
		} else if (company.library) {
			let lib = '';
			if (name.indexOf('.') > 0) {
				lib = name.split('.')[0] + '.';
				name = name.split('.')[1];
			}

			data = await this.sr()._(lib + company.Code.toLowerCase() + name + "Findall", null, o, null, start, end);
		} else {
			// ems
			data = await o.findAll();
			//data = await window._FrEMD._o(null, o);
		}
		if (s.options.postload) {
			await s.options.postload(data);
		}
		$.each(data, (i, d) => {
			d.__OWNER = s;
			$.each(s.options.columns, (_, c) => {
				if (c.value) {
					d[c.field] = c.value(d, data, i);
				}
			});
		});
		if (!s.options.columns && fun.indexOf('tree') > -1) {
			data = $.map(data, d => {
				let ret = {
					id: d[s.options.idField.field],
					text: d[s.options.textField.field],
					state: d.state || (s.options.loader ? "file" : "closed"),
					_source: d,
				};
				ret.children = (ret.state == "closed") ? [{
					text: 'loading...'
				}] : null;
				return ret;
			});
		}
		return data || [];
	}

	async fillData(g, o, start, end) {
		var s = null;
		for (var i = 0; i < this.selects.length; i++) {
			if (this.selects[i].id == g[0].id) s = this.selects[i];
		}
		if (!s) return;
		this.busy(true);
		try {
			var fun = g[0].classList["0"].replace('easyui-', '');
			try {
				$("#" + s.id)[fun]('grid').datagrid('getPager').pagination('loading');
			} catch (ex) {}
			if (s.options.noload) {
				let _data = null;
				try {
					_data = $("#" + s.id)[fun]('grid').datagrid("getData");
				} catch (ex) {
					_data = $("#" + s.id)[fun]('tree').tree('getRoot');
				}
				if (_data) {
					return this.busy(false);
				}
			}
			var data = await this._loadData(s, o, start, end);
			try {
				if ($("#" + s.id)[fun]('grid')) $("#" + s.id)[fun]('grid').datagrid('getPager').pagination('loaded');
			} catch (ex) {}
			try {
				$("#" + s.id)[fun]('grid').datagrid('loadData', {
					total: data.Count || data.length,
					rows: data,
				});
			} catch (ex) {
				$("#" + s.id)[fun]('tree').tree('loadData', data);
			}
		} catch (ex) {
			console.log(ex);
		}
		this.busy(false);
	}

	eventHandlers(options) {
		if (!this.byName(options.name)) return; // if not an element, do not run the handlers

		return this.events.filter(e => e.type == options.type || typeof(e.type) === 'undefined').map(e => `${e.name}: (${e.params || ''}) => {try{DForm.${e.handler}(DForm.byName("${options.name}") || ${_FrEMD._toJS(options)} || {name: "${options.name}",type: "${options.type}"}, ${e.params})}catch(ex){console.log("Event Error: ${options.name}/${options.type}/${e.name}", ex);}}`).join(',');
	}

	async PanelOpen(e) {
		if (e.editor) return true;
		let content = e.value;
		if (e.loader) {
			content = await e.loader(this.get());
		}
		if (content) {
			try {
				$("#pnl" + e.name).panel('body').html(content);
				console.log("pnl" + e.name + ": Content Valid");
			} catch (ex) {
				//console.log(ex);
			}
		}
		return content;
	}

	async SelectChange(options, tab) {
		this.busy(true);
		$.grep(this.elements, e => e.type == "grid" && e.group == tab).forEach(e => $("#cmb" + e.name).datagrid());
		this.busy(false);
	}

	async FieldChange(options, value) {
		this.busy(true);
		if (options && options.change) {
			await options.change(this.get(), value);
		}
		this.busy(false);
	}

	async URLChange(s, options) {
		this.busy(true);
		options.data = await $.get(s.value);
		return await this.FieldChange(s, options);
	}

	UploadFile(f, options) {
		window.DForm.busy(true);
		var formData = new FormData();
		var fileid = Math.random();
		var method = options.method || "ContentManager.cmsUploadFile";
		formData.append('fileid', fileid);
		var file = $("#" + f.fileboxId)[0].files[0];
		formData.append('__UFILE', file);
		if (options.local) {
			// handling the file locally
			var reader = new FileReader();
			reader.onload = (e) => {
				var data = e.target.result;
				ret = data;
				window.DForm.byName(options.name).data = ret;
				if (options && options.upload) options.upload(window.DForm.get(), ret);
			};
			if (options.binary) {
				reader.readAsBinaryString(file);
			} else if (options.dataurl) {
				reader.readAsDataURL(file);
			} else {
				reader.readAsText(file);
			}
			window.DForm.busy(false);
		} else if (method) {
			$.ajax({
				url: this.sr().srURL + "&method=" + method + "&sInput=" + fileid + "&preTag=&postTag=",
				data: formData,
				// THIS MUST BE DONE FOR FILE UPLOADING
				cache: false,
				contentType: false,
				type: 'POST',
				processData: false,
				success: data => {
					this.sr().runScript(data);
					window.DForm.byName(options.name).data = ret;
					if (options && options.upload) options.upload(window.DForm.get(), ret);
					window.DForm.busy(false);
				}
			});
		}
	}

	eFun(e) {
		try {
			if (e.type == "tree") {
				if (e.columns) {
					return "combotreegrid";
				} else if (typeof(e.combo) !== 'undefined' && !e.combo) {
					return 'tree';
				} else {
					return "combotree";
				}
			} else if (e.type == 'navigation') {
				return 'tree';
			} else if (e.type == "combotree") {
				return "combotreegrid";
			} else if (e.type == "select" && e.options) {
				return "combobox";
			}
			return "combogrid";
		} catch (ex) {
			return "combogrid";
		}
	}

	_fillWindow(winName, v, map) {
		v = v || {};
		map = map || {};
		if (Array.isArray(map)) {
			map = Object.fromEntries(new Map(map));
		}

		map = $.extend({}, map, Object.fromEntries(Object.keys(v).map(k => [winName + k, k])));

		let s = {};
		for (var m in map) {
			if (typeof(v[map[m]]) === "undefined") {
				//console.log('is_undefined', m, map[m], v[map[m]]);
				s[m] = map[m];
			} else {
				//console.log('is_not_undefined', m, map[m], v[map[m]]);
				s[m] = v[map[m]];
			}
		}
		this.clear(winName);
		//console.log("s", s);
		this.set(s);
		$("#pnl_" + winName).window("open");
	}

	windowToEntity(o, bEmpty, grid, prefix, filter) {
		o = o || this.get();
		filter = filter || (v => v);
		let ret = grid ? (grid.selected || grid) : null;
		if (bEmpty) {
			ret = {};
			o = {};
		} else {
			ret = (ret && ret.Id) ? {
				Id: ret.Id
			} : {};
		}

		this.elements.filter(e => (prefix ? e.group == prefix : true) && e.type != 'link' && ['_'].indexOf(e.name.replace(prefix, "")) < 0).forEach(e => {
			ret[e.name.replace(prefix, "")] = o[e.name];
			return true;
		});

		filter(ret);

		return ret;
	}

	bind(obj) {
		var objBind = (o, e) => {
			o[this.eFun(e)]({
				onShowPanel: () => {
					this.fillData($("#" + e.id), null, 0, 10);
				},
				onClickRow: (index, row) => {
					var s = row ? row.__OWNER : null;
					if (s && s.options.select) {
						s.options.select(row);
					}
				}
			});
			try {
				var dg = o[this.eFun(e)]('grid');
				// dg.datagrid('enableFilter')
				var state = dg.data('datagrid');
				var opts = state.options;
				var onBeforeLoad = opts.onBeforeLoad;
				opts.onBeforeLoad = (param) => {
					state.allRows = null;
					return onBeforeLoad.call(this, param);
				};
				var pager = dg.datagrid('getPager');
				dg.datagrid('getPanel').panel({
					ID: i
				});
				pager.pagination({
					onSelectPage: function(pageNum, pageSize) {
						window.DForm.fillData($("#" + window.DForm.selects[$(this.parentNode).panel('options').ID].id), null, pageSize * (pageNum - 1), pageSize * pageNum);
					}
				});
				dg.datagrid('loadData', state.data);
			} catch (ex) {}
		}
		if (obj) {
			objBind(obj);
		} else {
			for (var i = 0; i < this.selects.length; i++) {
				if (this.selects[i].options.options) {
					//$("#" + this.selects[i].id).combo();
				} else {
					objBind($("#" + this.selects[i].id), this.selects[i]);
				}
			}

			this.elements.filter(e => e.window).forEach(e => {
				let t = $("#tbcWindow").tabs("getTab", e.group);
				if (t) {
					t.panel('options').tab.hide();
				}
			});
		}
	}

	english(s) {
		if (!s) return "";
		var result = s.replace(/([A-Z])/g, " $1");
		result = result.replace(/_/g, '');
		return result.charAt(0).toUpperCase() + result.slice(1);
	}

	onToggle(e, bValue) {
		let sTag = `#fElement_${e.for.name} > .easyui-${this.uiTypes[e.for.type]}`;
		let oTag = $(sTag);
		e.for.enabled = typeof(bValue) === "undefined" ? !e.for.enabled : bValue;

		oTag.prop("disabled", !e.for.enabled);
		//oTag[this.uiTypes[e.for.type]](e.for.enabled ? "enable" : "disable");
		console.log(sTag, oTag, this.uiTypes[e.for.type], e.for.enabled);
	}

	render(name, title, elements, buttons, bFixed) {
		this.elements = (elements || []).filter(e => !e.ignore);

		this.buttons = buttons || [];
		this.selects = [];
		this.grids = [];

		this.elements.filter(e => e.type == "window").forEach(w => this.elements.splice(this.elements.findIndex(e => e.name == w.name), 0, {
			name: "_" + w.name,
			type: "link",
			title: w.title || w.name,
			group: w.group,
			window: w.window,
			section: w.section,
			links: [{
				label: 'Open',
				icon: 'edit',
				onClick: o => $("#pnl" + w.name).window('open')
			}],
		}));

		this.sr().groupBy(this.elements.filter(e => e.window), "group").forEach(kv => {
			if (!kv.key) return;

			let e = {
				name: "_" + kv.key,
				title: kv.key,
				type: "window",
				group: kv.key,
				width: this.width * 0.9,
				height: this.height * 0.9,
				loader: o => {
					kv.values.filter(v => v.type !== 'link' || (v.type == 'link' && v.name.startsWith('_'))).forEach(v => $("#pnl_" + v.group + '-center').append($("#fElement_" + v.name)));
					return null;
				},
				buttons: [].concat.apply([], kv.values.filter(v => v.type == 'link' && !v.name.startsWith('_')).map(v => [...v.links.map(l => ({
					name: l.name || l.label,
					title: l.title || l.label,
					onClick: l.onClick,
					icon: l.icon,
					window: true,
					group: kv.key,
				}))])),
			};
			this.buttons.push(...e.buttons);

			this.elements.push(e);
		});

		var ret = "";
		// check the option of using window() as a renderer of the main window...
		if (true) {
			this.elements.filter(e => !e.zone).forEach(e => e.zone = 'center');
			let wOptions = {
				name: name || this.name,
				title: title || this.title,
				type: 'window',
				visible: true,
				width: this.width,
				height: this.height,
				fixed: bFixed,
				links: [{
					icon: "help",
					action: o => $("#pnl__Console").window('open')
				}],
				buttons: this.buttons.filter(b => !b.window),
			};
			this.sr().groupBy(this.elements, 'zone').filter(zg => zg.key).forEach(zg => {
				wOptions[zg.key] = this.renderElements(zg.values);
			});

			ret = this.window(wOptions);
		} else {
			ret = this.header(name, title, bFixed, [{
				icon: "help",
				action: o => $("#pnl__Console").window('open')
			}]);

			ret += this.renderElements();

			ret += this.footer(bFixed);

		}
		// console.log(ret);

		return ret;
	}

	cWidth(options) {
		let ret = Math.floor(((options ? options.width : null) || (this.width / 3)));
		if (options.zone == 'east' || options.zone == 'west') {
			ret = 0.25 * ret; // 90% of 3/10, the width of the normal element
		} else if (options && options.editor) {
			ret = window.innerWidth;
		} else if (options && options.width && typeof(options.width) === 'string') {
			ret = this.width;
		} else if (options && options.type == 'window' && !options.width) {
			ret = this.width * 0.9;
		}

		// console.log(options.name + ": cWidth = " + ret, options.zone);
		return ret;
	}

	window(options) {
		options.title = options.title || options.name;
		var ret = `
		<div id = "pnl${options.name}" class="easyui-window" title="${options.title}" data-options='${this.eventHandlers(options)}, closed:${!options.visible},minimizable:${!options.fixed},maximizable:${!options.fixed},closable:${!options.fixed},collapsible:${!options.fixed},draggable:${!options.fixed},resizable:${!options.fixed},iconCls:"icon-${options.icon}", tools:"#${options.name}_tools"' style="width:${this.cWidth(options)}px;height:${this.cHeight(options)}px;padding:10px;">
		    <div class="easyui-layout" data-options="fit:true">
		`;

		let bZone = options.south ? 'south' : (this.zones.find(z => z == 'south') || this.zones[0]);
		options[bZone] = options[bZone] || [];
		let zWidth = Math.min(120, this.width * 0.95 / (options.buttons ? options.buttons.length : 1), this.cWidth(options));
		options[bZone].push(`<div id="pnl${options.name}-buttons" data-options="region:'${bZone}',border:false" style="text-align:right;padding:5px 0 0;">` + $.map($.grep(options.buttons || [], b => !b.ignore), b => `<a id='${b.name}' href="javascript:void(0)" class="easyui-linkbutton c6" iconCls="icon-${b.icon || 'save'}" style="width:${zWidth}px" onclick='window.DForm.doClick(${_FrEMD._toJS(b)})'>${b.title || b.name}</a>&nbsp;&nbsp;`).join('') + `</div>`);

		this.zones.filter(z => options[z]).forEach(z => {
			ret += `
		        <div data-options="region:'${z}'" title="${(z=='west' || z=='east')?'&nbsp;':''}" style='height:${(z=='north'||z=='south')?10:100}%;width:${((z=='east'||z=='west')?0.1:1)*this.cWidth(options)}px'>
        		    ${(Array.isArray(options[z])?options[z]:[options[z]]).join('')}
                </div>
            `;
		});

		ret += `</div></div>`;

		// links (tools)
		let links = $.grep([].concat(options.links || []), l => !l.ignore);
		ret += `<div id="${options.name}_tools">` + $.map(links.reverse(), l => `<a href="javascript:void(0)" style="color:black" class="fas fa-${l.icon || 'add'}" onclick='(async () => {var a = ${_FrEMD._toJS(l)}; $("#pnl${options.name}").window("setTitle", "${options.title}: " + a.name); await a.action(DForm.get(), a, ${_FrEMD._toJS(options)}); $("#pnl${options.name}").window("setTitle", "${options.title}");})()'></a>`).join('\n') + `</div>`;

		return ret;
	}

	async _end() {
		let o = this.get();

		// do not use the first button, because many forms have a Cancel button only
		let button = this.buttons.find(b => b.autoSubmit) /* || this.buttons[0]*/ ;
		if (button && o && Object.values(o).length && (typeof(button.autoSubmit) === "undefined" || button.autoSubmit)) {
			let v = Object.values(o).reduce((t, v) => {
				return ((typeof(v) !== "object") ? 1 : 0) * (v ? 1 : 0);
			});
			//console.log(o, Object.values(o), v);
			if (v) {
				// all fields have values
				await this.doClick(button);

			}
		}
	}

	footer(bFixed) {
		return `</form>` + `<div id="dlg-buttons">` + this.buttons.filter(b => !b.window).map(b => `<a id='${b.name}' href="javascript:void(0)" class="easyui-linkbutton c6" iconCls="icon-${b.icon || 'save'}" style="width:${Math.min(120, this.width * 0.95 / this.buttons.length, this.cWidth())}px" onclick='window.DForm.doClick(${_FrEMD._toJS(b)})'>${b.title || b.name}</a>&nbsp;&nbsp;`).join('') + "</div>" + (bFixed ? "" : '</div>');
	}

	header(name, title, bFixed, links) {
		this.title = title || this.title;
		name = name || this.name;
		var ret = '';

		ret += this.window({
			name: "__Console",
			type: "window",
			editor: true,
			loader: o => window.logs.slice().reverse().map(l => l.date.toISOString() + ": " + l.args.map(s => typeof(s) === 'object' ? ((obj, indent = 2) => {
				let cache = [];
				const retVal = JSON.stringify(
					obj,
					(key, value) =>
					typeof value === "object" && value !== null ?
					cache.includes(value) ?
					undefined // Duplicate reference found, discard key
					:
					cache.push(value) && value // Store value in our collection
					:
					value,
					indent
				);
				cache = null;
				return retVal;
			})(s) : s).join(', ')).join('\n'),
		});

		if (!bFixed) {
			links = (links || []).filter(l => !l.ignore);
			let tData = "";
			if (links.length) {
				ret += `<div id="${this.name}_tools">` + links.map(l => `<a href="javascript:void(0)" class="icon-${l.icon}" onclick='(async () => {var a = ${_FrEMD._toJS(l)}; $("#win${this.name}").window("setTitle", "${this.title}: " + a.name); await a.action(DForm.get()); $("#win${this.name}").window("setTitle", "${this.title}");})()'></a>`).join('\n') + "</div>";
				tData = `,tools:"#${this.name}_tools"`;
			}
			ret += `<div id='win${this.name}' class='easyui-window' title='${this.title}' data-options='iconCls:"icon-save" ${tData}' style='width:${this.width}px;height:${this.height}px;padding:10px;'>`;
		}
		return ret + `<form id="frm${this.name}" method="post" novalidate>`;
	}

	renderElements(elements) {
		elements = elements || this.elements;

		var tWidth = Math.floor(this.width * 0.95);
		var tHeight = Math.floor(this.height * 0.85);

		let ret = '';
		var gElements = this.sr().groupBy(elements, "group");
		if (gElements.length > 1) ret += `<div id="tbcWindow" class="easyui-tabs" data-options='${this.eventHandlers({type: 'tabs'})}' style="width:${tWidth}px;height:${tHeight}px;">`;
		for (var g = 0; g < gElements.length; g++) {
			if (gElements.length > 1) ret += '<div title="' + (gElements[g].key || "Main") + '" style="padding:20px;display:none;">';
			var sElements = this.sr().groupBy(gElements[g].values, "section");
			if (sElements.length > 1) ret += '<div class="easyui-accordion" style="width:' + tWidth + 'px;height:' + /*tHeight*/ "100%" + 'px;">';
			for (var s = 0; s < sElements.length; s++) {
				ret += `<div title="${sElements[s].key || ""}" data-options="iconCls:'icon-more'" style="padding:10px;">`;
				for (var i = 0; i < sElements[s].values.length; i++) {
					var e = sElements[s].values[i];
					if (e.ignore) continue;
					e.value = e.value || this.sr().$_REQUEST(e.name);
					ret += `<div id="fElement_${e.name}" class="fitem" style="display: ${(e.type=='window' || e.hidden)?'none':''}">`;
					if (e.toggle) {
						ret += `<a href="#" class="easyui-linkbutton" data-options='${this.eventHandlers({type: 'toggle', for: e})},plain:true,iconCls:"icon-${e.icon || 'search'}"' style="width:100px;height:30px">${e.title || this.english(e.name)}</a>`;
					} else {
						ret += `<label>${e.title || this.english(e.name)}:</label>`;
					}
					if (e.type && this[e.type]) {
						ret += this[e.type](e);
					} else if (e.render) {
						ret += e.render();
					}
					ret += '</div>';
				}
				ret += '</div>';
			}
			if (sElements.length > 1) ret += '</div>';
			if (gElements.length > 1) ret += "</div>";
		}
		if (gElements.length > 1) ret += "</div>";
		return ret;
	}

	info(msg) {
		if ($.messager) {
			$.messager.alert(this.title, msg, 'info');
		} else {
			this.sr().ShowMessage(msg, this.title);
		}
	}

	error(msg) {
		if ($.messager) {
			$.messager.alert(this.title, msg, 'error');
		} else {
			this.sr().ShowMessage(msg, this.title);
		}
	}

	byName(name) {
		return this.elements.find(e => e.name === name);
	}
};
window.DForm = new DynaForm();

window.DynaForm = class {
	constructor() {
		this.title = "Form Title";
		this.name = "frmForm";
		this.elements = [];
		this.selects = [];
		this.grids = [];
		this.buttons = [];
		this.sTable = null;
		this.bDebug = false;

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
			params: 'n=event',
			type: 'link',
		}, {
			name: 'onClickRow',
			handler: 'FieldChange',
			params: 'n, o',
			type: 'grid',
		}];

		this.width = window.innerWidth * 0.8;
		this.height = window.innerHeight * 0.7;
	}

	parse() {
		$.parser.parse();
	}

	init() {
		var select = {
			init: function (container, options) {
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
			destroy: function (target) {
				$(target).remove();
			},
			getValue: function (target) {
				return $(target).val();
			},
			setValue: function (target, value) {
				$(target).val(value);
			},
			resize: function (target, width) {
				$(target)._outerWidth(width);
			}
		};
		$.extend($.fn.datagrid.defaults.editors, {
			datetime: {
				init: function (container, options) {
					options.width = window.DForm.cWidth(options);
					var input = $(window.DForm.datetime(options)).appendTo(container);
					input.datetimebox();
					return input;
				},
				destroy: function (target) {
					$(target).remove();
				},
				getValue: function (target) {
					return $(target).val();
				},
				setValue: function (target, value) {
					$(target).val(value);
				},
				resize: function (target, width) {
					$(target)._outerWidth(width);
				}
			},
			checkbox: {
				init: function (container, options) {
					var input = $(window.DForm.bool(options)).appendTo(container);
					input.switchbutton();
					return input;
				},
				destroy: function (target) {
					$(target).remove();
				},
				getValue: function (target) {
					return $(target).val();
				},
				setValue: function (target, value) {
					$(target).val(value);
				},
				resize: function (target, width) {
					$(target)._outerWidth(width);
				}
			},
			combotreegrid: select,
			select: select,
		});
	}

	ask(question, fAnswer, options) {
		$.messager.confirm(this.title, question, function (r) {
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
		$.each(window.sr.groupBy(ar, gField), function (key, values) {
			values.values.sort(function (a, b) {
				if (parseFloat(a[vField]) < parseFloat(b[vField])) {
					return 1;
				} else if (parseFloat(a[vField]) > parseFloat(b[vField])) {
					return -1;
				} else {
					return 0;
				}
			});
			$.each(values.values, function (i, v) {
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
			var ret = await sr._("ContentManager.cmsGenerateLayerClass", null, company.library + "." + sTable);
			fields.push({
				group: "Main",
				attribute: {
					RelationClass: {
						Name: sTable
					}
				},
				name: window.DForm.sTable,
				type: 'select',
				select: function (o) {
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
					source: function (o, fData) {
						return o;
					},
					columns: rCols
				});
			}
		} else {
			// ems
			var ec = null;
			$.each(window.EntityClasses, (_, c) => {
				if (c.Name.replace(' ', '_') == sTable) {
					ec = c;
				}
			});

			fields.push({
				group: "Main",
				name: sTable,
				title: ec.Name,
				Class: ec,
				type: 'select',
				select: function (o) {
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
						Class: ea.EntityType,
						source: function (o, fData) {
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
				onclick: function (o) {
					window.DForm.busy(false);
					window.DForm.clear();
				},
				icon: "cancel"
			}, {
				name: 'Save',
				onclick: function (o) {
					if (o[window.DForm.sTable] && o[window.DForm.sTable].Id) o.Id = o[window.DForm.sTable].Id;
					delete o[window.DForm.sTable];

					if (company.library) {
						sr._(company.Code.toLowerCase() + "" + window.DForm.sTable + (o.Id ? "Update" : "Insert"), function (ret) {
							if (ret) {
								window.DForm.info(window.DForm.sTable + " Saved");
							} else {
								window.DForm.error("Unable to save " + window.DForm.sTable);
							}
							window.DForm.busy(false);
						}, o);
					} else {
						sr._("emsEntityObject" + (o.Id ? "Update" : "Insert"), function (ret) {
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

	async _wait(ms) {
		return new Promise(resolve => {
			setTimeout(resolve, ms);
		});
	}

	header(name, title, bFixed, links) {
		this.title = title || this.title;
		name = name || this.name;

		var ret = '';
		if (!bFixed) {
			ret += `<div id='win${this.name}' class='easyui-window' tools:'#${this.name}_tools' title='${this.title}' data-options='iconCls:"icon-save"' style='width:${this.width}px;height:${this.height}px;padding:10px;'><div id="${this.name}_tools">`;

			ret += $.map($.grep(links || [], l => !l.ignore), l => `<a href="javascript:void(0)" class = "icon-${l.icon}" onclick='(async () => {var a = ${_FrEMD._toJS(l)}; $("#win${this.name}").window("setTitle", "${this.title}: " + a.name); await a.action(DForm.get()); $("#win${this.name}").window("setTitle", "${this.title}");})()'></a>`).join('\n');

			ret += "</div>";
		}
		return ret + `<form id="frm${this.name}" method="post" novalidate>`;
	}

	footer(bFixed) {
		return `</form><div id="dlg-buttons">` + $.map(this.buttons, b => `<a id='${b.name}' href="javascript:void(0)" class="easyui-linkbutton c6" iconCls="icon-${b.icon || 'save'}" style="width:${Math.min(120, this.width * 0.95 / this.buttons.length, this.cWidth())}px" onclick='window.DForm.doClick(${_FrEMD._toJS(b)})'>${b.title || b.name}</a>&nbsp;&nbsp;`).join('') + (bFixed ? "" : '</div>');
	}

	async doClick(button) {
		button = this.buttons.find(b => b.name == button.name);

		this.busy(true);
		var o = this.get();
		var sMissing = $.map($.grep(this.elements, e => e.required && !o[e.name]), e => "<li>" + (e.label || e.name) + "</li>").join("");
		if (sMissing) {
			window._FrEMD._error("Missing mandatory fields:<br/><ul>" + sMissing + "</ul>", 5000);
			this.busy(false);
			return;
		}

		await button.onclick(o);
		this.busy(false);
	}

	busy(bBusy) {
		if (!bBusy) {
			var total = 0;
			if (typeof moment !== 'undefined') {
				total = moment().diff(moment(this.busyStamp), 'seconds');
			} else {
				// no moment, use standard Date
				total = (new Date().getTime() - this.busyStamp.getTime()) / 1000 / 3600;
			}
			if (this.bDebug) {
				window._FrEMD._alert("Execution Time: " + total + " seconds.");
			}
			delete this.busyStamp;
		} else {
			this.busyStamp = new Date();
		}

		for (var i = 0; i < this.buttons.length; i++) {
			$('#' + this.buttons[i].name).linkbutton(bBusy ? 'disable' : 'enable');
		}
	}

	clear() {
		var o = {};
		$.each(this.elements, (_, e) => {
			var name = (e.emsSource ? "_" : "") + e.name;

			switch (e.type) {
			case 'text':
			case 'string':
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
						$("#lbl" + oElement.name).html(o[att]);
					} else {
						$("#lbl" + oElement.name).html((o && o.EntityAttribute) ? "" : o);
					}
					break;
				case 'text':
				case 'string':
				case 'password':
					if (att) {
						$("#txt" + oElement.name).textbox("setValue", o[att]);
					} else {
						$("#txt" + oElement.name).textbox("setValue", (o && o.EntityAttribute) ? "" : o);
					}
					break;
				case "DateTime":
				case "datetime":
					if (att) {
						$("#dtp" + oElement.name).datetimebox('setValue', (o[att] ? sr.toDateTime(o[att]) : ""));
					} else {
						$("#dtp" + oElement.name).datetimebox('setValue', (o && o.EntityAttribute) ? "" : (o ? sr.toDateTime(o) : ""));
					}
					break;
				case "int":
				case "integer":
				case "number":
				case "long":
				case "Long":
					if (att) {
						$("#nud" + oElement.name).numberspinner('setValue', o[att]);
					} else {
						$("#nud" + oElement.name).numberspinner('setValue', (o && o.EntityAttribute) ? "" : o);
					}
					break;
				case "bool":
					if (att) {
						$("#chk" + oElement.name).switchbutton((o[att] ? '' : 'un') + 'check');
					} else {
						$("#chk" + oElement.name).switchbutton((((o && o.EntityAttribute) ? "" : o) ? '' : 'un') + 'check');
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
					$("#prg" + oElement.name).progressbar('setValue', Math.round(v * 10) / 10);
					break;
				case "grid":
					let cols = JSON.parse("{" + this.mapColumns(oElement, true) + "}");
					$.each(cols.columns[0], (_, c) => c.formatter = sr.runScript(this.formatter(oElement.name, c)));
					$("#cmb" + oElement.name).datagrid(cols);

					if (att) {
						$("#cmb" + oElement.name).datagrid({
							data: o[att]
						});
					} else {
						$("#cmb" + oElement.name).datagrid({
							data: (o && o.EntityAttribute) ? "" : o
						});
					}
					$("#cmb" + oElement.name).datagrid("unselectAll");
					$("#cmb" + oElement.name).datagrid();
					break;
				case "tree":
					var v = att ? o[att] : ((o && o.EntityAttribute) ? "" : o);
					if (Array.isArray(v)) {
						$("#cmb" + oElement.name).combotree("tree").tree("loadData", v);
					} else {
						$("#cmb" + oElement.name).combotree('setValue', v);
					}
					break;
				case "select":
					if (att) {
						$("#cmb" + oElement.name).combogrid('setValue' + (oElement.multiple ? 's' : ''), (o[att] ? o[att] : ""));
					} else {
						v = null;
						if (o === null) {} else if (o.constructor === Array) {} else if (!o.EntityAttribute) {
							v = o || {
								Id: o.Id,
								_ToString: o._ToString,
								toString: function () {
									return this._ToString;
								}
							};
						}
						$("#cmb" + oElement.name).combogrid('setValue' + (oElement.multiple ? 's' : ''), v);
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
			switch (this.elements[i].type) {
			case 'label':
				v = $("#lbl" + this.elements[i].name).html();
				cn = $("#lbl" + this.elements[i].name);
				break;
			case 'text':
			case 'string':
			case 'password':
				v = $("#txt" + this.elements[i].name).val();
				cn = $("#txt" + this.elements[i].name);
				break;
			case "file":
				cn = $("#fil" + this.elements[i].name);
				v = this.elements[i].data;
				break;
			case "DateTime":
			case "datetime":
				v = new Date($("#dtp" + this.elements[i].name).datetimebox('getValue'));
				cn = $("#dtp" + this.elements[i].name);
				break;
			case "progress":
				v = $("#prg" + this.elements[i].name).progressbar('getValue');
				cn = $("#dtp" + this.elements[i].name);
				break;
			case "int":
			case "integer":
			case "number":
			case "long":
			case "Long":
				v = parseFloat($("#nud" + this.elements[i].name).val());
				if (isNaN(v)) v = 0;
				cn = $("#nud" + this.elements[i].name);
				break;
			case "grid":
				v = $("#cmb" + this.elements[i].name).datagrid('getData');
				break;
			case "tree":
				v = $("#cmb" + this.elements[i].name).combotree("tree").tree("getSelected");
				cn = $("#cmb" + this.elements[i].name);
				break;
			case "window":
				v = this.elements[i].value;
				break;
			case "select":
				if (this.elements[i].options) {
					v = $("#cmb" + this.elements[i].name).combogrid('getValue' + (this.elements[i].multiple ? 's' : ''));
				} else {
					v = $("#cmb" + this.elements[i].name).combogrid('grid').datagrid('getSelections');
					if (!v || !v.length) {
						v = $("#cmb" + this.elements[i].name).combogrid('getValue' + (this.elements[i].multiple ? 's' : ''));
					} else {
						if (!this.elements[i].multiple) v = v[0];
					}
				}
				cn = $("#cmb" + this.elements[i].name);
				break;
			case "bool":
				v = $("#chk" + this.elements[i].name).switchbutton('options').checked;
				cn = $("#chk" + this.elements[i].name);
				break;
			default:
				break;
			}
			try {
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

	cWidth(options) {
		if (options && options.editor) return window.innerWidth;
		return Math.floor(((options ? options.width : null) || (this.width / 3)));
	}

	cHeight(options) {
		if (options && options.editor) return window.innerHeight;
		return Math.floor(((options ? options.height : null) || (this.height / 3)));
	}

	string(options) {
		options.height = 20;
		options.simple = true;
		return this.text(options);
	}

	datetime(options) {
		return '<input id="dtp' + options.name + '" class="easyui-datetimebox" required="' + (options.required ? 'true' : 'false') + '" value="' + (options.value || "") + '" style="width:' + this.cWidth(options) + 'px">';
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

	int(options) {
		return '<input id="nud' + options.name + '" class="easyui-numberspinner" required="' + (options.required ? 'true' : 'false') + '" value="' + (options.value || '0') + '" data-options="increment:' + (options.increment || 1) + '" style="width:' + this.cWidth(options) + 'px;"></input>';
	}

	menu(options) {
		var ret = "";
		ret += '<div class="easyui-panel" id="mnu' + options.name + '" style="padding:5px;">\n';
		$.each(options.menu, (_, m) => ret += '<a href="#" class="easyui-splitbutton" data-options="menu:\'#mm' + m.label.replace(/ /g, '') + '\',iconCls:\'icon-' + (m.icon || 'none') + '\'">' + m.label + '</a>\n');
		ret += "</div>\n";

		let dv = m => {
			let ret = '<div' + (m.subMenus ? '' : ` data-options="iconCls:'icon-${m.icon || 'none'}'"`) + '>\n';
			ret += m.subMenus ? '<span>' + m.label + '</span>\n<div>' : (`<span width='100%' onclick='(async () => {let m = ${_FrEMD._toJS(m)}; if(m.action){return await m.action(DForm.get(), m);} if (m.subMenus) return; await _FrEMD.RenderPage({_code: m.code || m.label.replace(/ /g, "").toLowerCase()}, m.data);})()'>${m.label}</span>`);
			$.each(m.subMenus, (_, s) => ret += dv(s));
			ret += (m.subMenus ? "</div>\n" : "") + `</div>\n`;
			return ret;
		};

		if (false) $.each(options.menu, (_, m) => ret += '<div id="mm' + m.label.replace(/ /g, '') + '" style="width:150px;">' + $.map(m.subMenus, sm => dv(sm)).join('\n') + '</div>\n');

		if (true)
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
		return `<input id="chk${options.name}" required="${options.required?'true':'false'}" data-options='disabled:${options.disabled?'true':'false'},${this.eventHandlers(options)}' class="easyui-switchbutton" ${options.checked?'checked':''} />`;
	}

	label(options) {
		return `<span id="lbl${options.name}" style="width:${this.cWidth(options)}px" data-options="disabled:${options.disabled?'true':'false'}">${options.value || ''}</span>`;
	}

	url(options) {
		return this.string(options).replace("FieldChange", "URLChange");
	}

	text(options) {
		return `<input id="txt${options.name}" class="easyui-${options.editor || "textbox"}" data-options='disabled:${options.disabled?'true':'false'},${this.eventHandlers(options)}' multiline="${options.simple ? 'false' : 'true'}" style="white-space:pre-wrap;width:${this.cWidth(options)}px;height:${this.cHeight(options)}px" required="${options.required ? 'true' : 'false'}" value="${options.value || ""}" />`;
	}

	toScript(o, type) {
		var editor = null;
		if (typeof (o) === "string") {
			// only a name
			editor = ace.edit(o);
		} else {
			editor = ace.edit("txt" + o.name);
		}
		editor.session.setUseWrapMode(true);
		if (typeof (beautifier) !== "undefined") {
			var value = editor.getValue();
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
			type = type || o.type || "javascript";
			editor.session.setMode('ace/mode/' + type);
			if (['csharp', 'javascript'].indexOf(type) > -1) {
				value = beautifier.js(value, options);
			} else if (['html'].indexOf(type) > -1) {
				value = beautifier.html(value, options);
			}
			if (value != editor.session.getValue()) editor.session.setValue(value);
		}
		return editor;
	}

	password(options) {
		var ret = this.string(options);
		ret = ret.replace('<input ', '<input type="password" ');
		return ret;
	}

	file(options) {
		return '<input id="fil' + options.name + '" class="easyui-filebox" data-options="onChange:function(n,o){var s = $(\'#\' + this.id).filebox(\'options\'); window.DForm.UploadFile(s, window.DForm.byName(\'' + options.name + '\'));}" style="width: ' + this.cWidth(options) + 'px">';
	}

	progress(options) {
		if (!options.height) options.height = 20; // fix big progress
		return '<div id="prg' + options.name + '" class="easyui-progressbar" data-options="value:' + (options.value || "0") + '" style="width: ' + this.cWidth(options) + 'px;height: ' + this.cHeight(options) + 'px"></div>';
	}

	flowchart(options) {
		return '<div id="flw' + options.name + '" width="' + this.cWidth(options) + '" height="' + this.cHeight(options) + '"></div>';
	}

	chart(options) {
		return '<div id="cht' + options.name + '" width="' + this.cWidth(options) + '" height="' + this.cHeight(options) + '"></div>';
	}

	tree(options) {
		return this.select(options, "select");
	}

	formatter(name, c, json) {
		json = json ? '"' : '';
		return `${json}(value,row,index)=>{var c = (DForm.byName(\`${name}\`).columns || []).find(c => c.field==\`${c.field}\`); try{return c&&c.format?c.format(value,row,index):value;}catch(ex){return value;} }${json}`;
	}

	mapColumns(options, json) {
		var cols = $.grep(options.columns || [], c => !c.ignore);

		let ret = "";
		if (options.multiple) ret += `{"field":'ck',"checkbox":true},`;

		ret = `"frozenColumns": [[`;

		if (!options.frozen) {
			ret += `{"field":"${options.idField.field}","title": "${options.idField.title}","sortable": "true", "formatter": ${this.formatter(options.name, options.idField, json)}},`;
			if (options.textField.field != options.idField.field) ret += `{"field":"${options.textField.field}","title":"${options.textField.title}","width":"${options.textField.width||120}", "sortable": "true", "formatter": ${this.formatter(options.name, options.textField, json)}}`;
		} else {
			$.map($.grep(cols, c => c.frozen), c => `{"field":"${c.field}","title":"${c.title || c.field}","width":"${c.width||120}","align":'right',"sortable":"true", "formatter": ${this.formatter(options.name, c, json)}}`).join(",");
		}

		ret += `]], "columns": [[`;
		ret += $.map($.grep(cols, c => !c.frozen), c => `{"field":"${c.field}","title":"${c.title || this.english(c.field)}","align":"right","sortable":"true", "formatter": ${this.formatter(options.name, c, json)}}`).join(",");
		ret += ']]';

		return ret;
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
		}])).find(x => typeof (x.field) !== "undefined");

		options.textField = $.uniqueSort([{
			field: options.textField,
			title: options.textField
		}].concat($.grep(cols, c => c.display), [{
			field: company.library ? '_ToString' : '_name',
			title: options.name,
		}])).find(x => typeof (x.field) !== "undefined");

		var fun = type || this.eFun(options);

		var dropdown = ['combotreegrid', 'combotree', 'combogrid', 'select'].indexOf(fun) > -1;
		if (dropdown) this.selects.push({
			id: "cmb" + options.name,
			options: this.byName(options.name)
		});
		this.selects = $.uniqueSort(this.selects);


		var ret = `<${tag} id="cmb${options.name}" class="easyui-${fun}" style="max-width:${dropdown?'400px':this.cWidth(options)}; width:${this.cWidth(options)}px" required="${(options.required ? 'true' : 'false')}" data-options='disabled:${options.disabled?'true':'false'},${this.eventHandlers(options)}, value:"${options.value}", rownumbers:${fun.indexOf('tree')>-1?'false':'true'}, pagination:${fun.indexOf('tree')>-1?'false':'true'}, panelWidth:${2*this.cWidth(options)}, fitColumns: true, singleSelect: true, multiple:${(options.multiple || 'false')}, idField: "${options.idField.field}", enableFilter: ${options.filter?'true':'false'}, textField: "${options.textField.field}", treeField: "${options.textField.field}",`;
		if (fun.indexOf('tree') == -1) {
			ret += 'fitColumns: false,' + this.mapColumns(options);
		}
		ret += `'>`;
		ret += $.map(options.options, o => `<option value="${o}">${o}</option>`).join('\n');
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

	eventHandlers(options) {
		return $.map($.grep(this.events, e => e.type == options.type || typeof (e.type) === 'undefined'), e => `${e.name}: (${e.params || ''}) => {try{DForm.${e.handler}(DForm.byName("${options.name}") || ${_FrEMD._toJS(options)} || {name: "${options.name}",type: "${options.type}"}, ${e.params})}catch(ex){console.log("Link Click", ex);}}`).join(',');
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

	window(options) {
		options.title = options.title || options.name;
		var ret = `<div id = "pnl${options.name}" class = "easyui-window" title = "${options.title}" data-options = '${this.eventHandlers(options)}, closed:true,iconCls:"icon-${options.icon}", tools:"#${options.name}_tools"' style = "width:${this.cWidth(options)}px;height:${this.cHeight(options)}px;padding:10px;">${options.value}</div><div id="${options.name}_tools">`;

		ret += $.map($.grep(options.links || [], l => !l.ignore), l => `<a href="javascript:void(0)" class = "icon-${l.icon}" onclick = '(async () => {var a = ${_FrEMD._toJS(l)}; $("#pnl${options.name}").window("setTitle", "${options.title}: " + a.name); await a.action(DForm.get()); $("#pnl${options.name}").window("setTitle", "${options.title}");})()'></a>`).join('\n');

		ret += `</div>`;
		return ret;
	}

	async PanOnClose(e) {
		if (e.editor && typeof (ace) !== "undefined") {
			e.value = ace.edit('pnl' + e.name).session.getValue();
		}
		if (e.close) {
			await e.close(this.get());
		}
	}

	async PendAfterOpen(e) {
		if (e.editor && typeof (ace) !== "undefined") {
			let loader = e.loader;
			if (!loader) loader = o => e.value;
			let saver = e.saver;
			if (!saver) saver = (v, o) => {};
			let language = e.language;
			if (!language) language = o => "html";
			await _FrEMD.OpenEditor('pnl' + e.name, language, loader, saver, this.get(), e);
		}
		if (e.open) {
			await e.open(this.get());
		}
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
			} catch (ex) {
				//console.log(ex);
			}
		}
		return content;
	}

	link(options) {
		return $.grep(options.links, l => !l.ignore).map(l => `<a href="#" class="easyui-linkbutton" data-options='${this.eventHandlers(options)}, iconCls:"icon-${l.icon || 'ok'}"'>${l.label}</a>`).join('\n');
	}

	select(options, tag, type) {
		return this.combo(options, tag, type);
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
		o = o || (window[name] ? new window[name]() : {
			Active: true,
		});
		o = (typeof filters !== "undefined" && filters && filters[name]) ? filters[name](o) : o;
		o = (s && s.options && s.options.source ? s.options.source(o, this.get()) : o);

		let names = $.uniqueSort([s.options.searchField].concat($.map($.grep(s.options.columns || [], c => c.search), c => c.field), ["Name"]));

		var fun = this.eFun(s.options);
		//if ($("#" + s.id).fun('getText')) o[names[0]] = $("#" + s.id).combobox('getText');
		if (!o[names[0]]) o[names[0]] = $("#" + s.id)[fun]('getText');

		var data = null;
		if (s.options.loader) {
			data = await s.options.loader(this.get(), s.options, o);
		} else if (company.library) {
			data = await sr._(company.Code.toLowerCase() + name + "Findall", null, o, null, start, end);
		} else {
			// ems
			data = await window._FrEMD._o(null, o);
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

	async SelectChange(options, tab) {
		this.busy(true);
		$.grep(this.elements, e => e.type == "grid" && e.group == tab).forEach(e => $("#cmb" + e.name).datagrid());
		this.busy(false);
	}

	async FieldChange(options, value) {
		this.busy(true);
		if (options && options.change) {
			await options.change(window.DForm.get(), value);
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
			} else {
				reader.readAsText(file);
			}
			window.DForm.busy(false);
		} else if (method) {
			$.ajax({
				url: window.sr.srURL + "&method=" + method + "&sInput=" + fileid + "&preTag=&postTag=",
				data: formData,
				// THIS MUST BE DONE FOR FILE UPLOADING
				cache: false,
				contentType: false,
				type: 'POST',
				processData: false,
				success: data => {
					window.sr.runScript(data);
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
				} else {
					return "combotree";
				}
			} else if (e.type == "combotree") {
				return "combotreegrid";
			}
			return "combogrid";
		} catch (ex) {
			return "combogrid";
		}
	}

	bind(obj) {
		var objBind = (o, e) => {
			//console.log(this.eFun(e), o, e);
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
					onSelectPage: function (pageNum, pageSize) {
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
				if (this.selects[i].options.options) continue;
				objBind($("#" + this.selects[i].id), this.selects[i]);
			}
		}
	}

	initChart(name, options, data) {
		if (!options) {
			if (!data) {
				return;
			}

			var records = [];
			if (typeof zingchart !== 'undefined') {
				options = {
					"graphset": []
				};

				for (var g = 0; g < data.labels.length; g++) {
					var gset = {
						type: data.type || "bar",
						options: {},
					};

					if (data.type == "grid") {
						gset.options.style = {
							".th": {
								"y": "0px",
								"background-color": "#7ca82b",
								"font-color": "#fff",
								"font-size": "12",
								"font-weight": "none",
								"height": "20px"
							}
						};
						gset.options["col-labels"] = [];
					}
					gset["stacked"] = data.labels.length > 0;
					gset["plot"] = {
						"value-box": {
							value: "%v",
							placement: "top-in",
							"font-color": "white",
						},
						tooltip: {
							value: "%v"
						}
					};
					if (data.type != "grid") {
						gset["plotarea"] = {
							"margin-right": "25%"
						};
						gset["legend"] = {
							"toggle-action": "hide",
							"item": {
								"cursor": "pointer"
							},
							"draggable": true,
							"drag-handler": "icon"
						};
					}
					gset["title"] = {
						"text": data.title,
						"font-family": "arial",
						"x": "40px",
						"y": "5px",
						"align": "left",
						"bold": false,
						"font-size": "16px",
						"font-color": "#000000",
						"background-color": "none"
					};
					gset["subtitle"] = {
						"text": "<i>" + "Between " + moment(data.startDate).format("DD/MM/YYYY") + " and " + moment(data.endDate).format("DD/MM/YYYY") + "</i>",
						"font-family": "arial",
						"x": "40px",
						"y": "25px",
						"align": "left",
						"bold": false,
						"font-size": "16px",
						"font-color": "#7E7E7E",
						"background-color": "none"
					};

					gset.labels = [];
					for (var t = 0; t < gset.labels.length; t++) {
						gset.labels[t] = {
							"text": gset.labels[t],
							"hook": "node:plot=2;index=" + t
						};
					}
					gset["scaleX"] = {
						"values": [],
					};
					var labels = window.sr.groupBy(data.data, data.dimensions[0]);
					for (var i = 0; i < labels.length; i++) {
						gset["scaleX"].values.push(moment(labels[i].key).format(data.interval.Format).toString());
					}

					gset.series = [];
					var gData = window.sr.groupBy(data.data, data.labels[g]);
					for (var i = 0; i < gData.length; i++) {
						if (data.type == "grid") {
							gset.options["col-labels"].push(gData[i].key);
						}
						var values = Array(labels.length);
						for (var j = 0; j < gData[i].values.length; j++) {
							var v = gData[i].values[j];
							for (var l = 0; l < labels.length; l++) {
								if (labels[l].key == v[data.dimensions[0]]) {
									values[l] = parseInt(v[data.values[0]]);
								}
							}
						}
						gset.series.push({
							values: values,
							text: gData[i].key,
						});
					}

					// for grid type, transpose the values
					if (data.type == "grid") {
						var s = gset.series;
						// the series values need to be transposed
						var series = [];
						for (var _s = 0; _s < gset["scaleX"].values.length; _s++) {
							series[_s] = {
								values: [gset["scaleX"].values[_s]]
							};
							for (var c = 0; c < s.length; c++) {
								series[_s].values.push(s[c].values[_s]);
							}
						}
						gset.series = series;
						gset.options["col-labels"].unshift("");

						var maxColWidth = 20;
						for (var _o = 0; _o < gset.options["col-labels"].length; _o++) {
							var v = gset.options["col-labels"][_o];
							if (v.length > maxColWidth - 1) {
								gset.options["col-labels"][_o] = v.toString().substring(0, maxColWidth);
							}
						}
					}

					options.graphset.push(gset);
				}
				//console.log(options);
			} else {

			}
		}

		if (typeof zingchart !== 'undefined') {
			// using ZingChart
			zingchart.render({
				id: "cht" + name,
				data: options,
			});
		} else {
			new CanvasJS.Chart(document.getElementById("cht" + name), options).render();
		}
	}

	initFlowchart(name, shapes) {
		var options = this.byName(name);
		flowSVG.draw(SVG('flw' + name).size(
			500 || this.cWidth(options),
			500 || this.cHeight(options)
		));
		flowSVG.config({
			interactive: true,
			showButtons: true,
			scrollto: true,
			// Shape width
			w: 100,
			// Shape height
			h: 79,
			// The following are self-explanatory
			connectorLength: 50,
			connectorStrokeWidth: 3,
			arrowColour: 'lightgrey',
			decisionFill: 'firebrick',
			processFill: 'navajowhite',
			finishFill: 'seagreen',
			defaultFontSize: '10'
			// Any other configurations
		});
		flowSVG.shapes(shapes);
	}

	english(s) {
		if (!s) return "";

		var result = s.replace(/([A-Z])/g, " $1");
		return result.charAt(0).toUpperCase() + result.slice(1);
	}

	eInfo(name) {
		return {
			elm: $(`[id$='${name}']`),
			fun: $(`[id$='${name}']`)[0].className.split(' ').find(c => c.indexOf('easyui-') > -1).replace('easyui-', '')
		};
	}

	onToggle(e, bValue) {
		var info = this.eInfo(e.for.name);

		if (typeof (bValue) === "undefined") {
			bValue = !info.elm.prop("disabled");
		}
		info.elm[info.fun](bValue ? "enable" : "disable");
	}

	render(name, title, elements, buttons, bFixed) {
		this.elements = $.grep(elements, e => !e.ignore);
		this.buttons = buttons;
		this.selects = [];
		this.grids = [];
		var ret = this.header(name, title, bFixed, false && [{
			icon: "add",
			onClick: o => _FrEMD.RenderPage({
				_code: page._code
			}, page.data)
		}]);

		var tWidth = Math.floor(this.width * 0.95);
		var tHeight = Math.floor(this.height * 0.85);

		$.map($.grep(this.elements, e => e.type == "window"), w => this.elements.push({
			name: "_" + w.name,
			type: "link",
			title: w.title || w.name,
			group: w.group,
			links: [{
				label: 'Open',
				icon: 'edit',
				onClick: o => {
					$("#pnl" + w.name).window('open');
				}
			}]
		}));

		var gElements = window.sr.groupBy(this.elements, "group");
		if (gElements.length > 1) ret += `<div id="tt" class="easyui-tabs" data-options='${this.eventHandlers({type: 'tabs'})}' style="width:${tWidth}px;height:${tHeight}px;">`;

		for (var g = 0; g < gElements.length; g++) {
			if (gElements.length > 1) ret += '<div title="' + (gElements[g].key || "Main") + '" style="padding:20px;display:none;">';

			var sElements = window.sr.groupBy(gElements[g].values, "section");
			if (sElements.length > 1) ret += '<div class="easyui-accordion" style="width:' + tWidth + 'px;height:' + tHeight + 'px;">';

			for (var s = 0; s < sElements.length; s++) {
				ret += `<div title="${sElements[s].key || ""}" data-options="iconCls:'icon-help'" style="padding:10px;">`;
				for (var i = 0; i < sElements[s].values.length; i++) {
					var e = sElements[s].values[i];
					if (e.ignore) continue;
					e.value = e.value || sr.$_REQUEST(e.name);
					ret += `<div class="fitem" style="display: ${e.type=='window'?'none':''}">`;

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

		ret += this.footer(bFixed);

		return ret;
	}

	info(msg) {
		if ($.messager) {
			$.messager.alert(this.title, msg, 'info');
		} else {
			sr.ShowMessage(msg, this.title);
		}

	}

	error(msg) {
		if ($.messager) {
			$.messager.alert(this.title, msg, 'error');
		} else {
			sr.ShowMessage(msg, this.title);
		}
	}

	byName(name) {
		return this.elements.find(e => e.name === name);
	}
};

window.DForm = new DynaForm();
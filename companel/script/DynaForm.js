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

        this.width = window.innerWidth * 0.8;
        this.height = window.innerHeight * 0.7;
    }

    init() {
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
            select: {
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
            }
        });
    }

    ask(question, fAnswer, options) {
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
        $.each(window.sr.groupBy(ar, gField), function(key, values) {
            values.values.sort(function(a, b) {
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

    CRUD(sTable, bFixed) {
        var fields = [];
        window.DForm.sTable = sTable;

        var doLayout = () => {
            return $.when(window._FrEMD.end(null, {
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
                            sr._(company.Code.toLowerCase() + "" + window.DForm.sTable + (o.Id ? "Update" : "Insert"), function(ret) {
                                if (ret) {
                                    window.DForm.info(window.DForm.sTable + " Saved");
                                } else {
                                    window.DForm.error("Unable to save " + window.DForm.sTable);
                                }
                                window.DForm.busy(false);
                            }, o);
                        } else {
                            sr._("emsEntityObject" + (o.Id ? "Update" : "Insert"), function(ret) {
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
            })).then((o) => {
                window.DForm.bind();
            });
        };

        if (company.library) {
            sr._("ContentManager.cmsGenerateLayerClass", function(ret) {
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
                        //console.log(o);
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

                return doLayout();
            }, company.library + "." + sTable);
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
                        Class: ea.EntityType,
                        source: function(o, fData) {
                            return o;
                        },
                        type: "select"
                    });
                }
            });
            return doLayout();
        }
    }

    header(name, title, bFixed) {
        this.title = title || this.title;
        name = name || this.name;

        var ret = '';
        if (!bFixed) {
            ret += '<div id="win' + this.name + '" class="easyui-window" title="' + this.title + '" data-options="iconCls:\'icon-save\'" style="width:' + this.width + 'px;height:' + this.height + 'px;padding:10px;">';
        }
        return ret + '<form id="frm' + this.name + '" method="post" novalidate>';
    }

    footer(bFixed) {
        var ret = '</form><div id="dlg-buttons">';
        var bWidth = Math.min(this.width * 0.95 / this.buttons.length, this.cWidth());
        for (var i = 0; i < this.buttons.length; i++) {
            ret += '<a id="' + this.buttons[i].name + '" href="javascript:void(0)" class="easyui-linkbutton c6" iconCls="icon-' + (this.buttons[i].icon || 'save') + '" style="width:' + bWidth + 'px" onclick=\'window.DForm.doClick(' + i + ');\'>' + (this.buttons[i].title || this.buttons[i].name) + '</a>&nbsp;&nbsp;';
        }
        if (!bFixed) {
            ret += '</div>';
        }
        return ret;
    }

    doLink(eName, index) {
        var oElement = this.byName(eName);

        oElement.links[index].onClick(this.get());
    }

    doClick(bIndex) {
        var button = this.buttons[bIndex];

        if (!button.onclick) return;

        this.busy(true);
        var o = this.get();
        var sMissing = "";
        for (var i = 0; i < this.elements.length; i++) {
            if (this.elements[i].required && !o[this.elements[i].name]) {
                sMissing += "<li>" + (this.elements[i].label || this.elements[i].name) + "</li>";
            }
        }
        if (sMissing) {
            window._FrEMD._error("Missing mandatory fields:<br/><ul>" + sMissing + "</ul>", 5000);
            this.busy(false);
            return;
        }

        button.onclick(o);
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
                    o[name] = "";
                    break;
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
                case "select":
                    o[name] = "";
                    break;
                case "bool":
                    o[name] = false;
                    break;
                default:
                    break;
            }
        });
        this.set(o);
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
            }
            oElement.emsSource = o;

            switch (oElement.type) {
                case 'text':
                case 'string':
                case 'password':
                    if (att) {
                        $("#txt" + oElement.name).textbox("setValue", o[att]);
                    } else {
                        $("#txt" + oElement.name).textbox("setValue", (o && o["EntityAttribute"]) ? "" : o);
                    }
                    break;
                case "DateTime":
                case "datetime":
                    if (att) {
                        $("#dtp" + oElement.name).datetimebox('setValue', (o[att] ? sr.toDateTime(o[att]) : ""));
                    } else {
                        $("#dtp" + oElement.name).datetimebox('setValue', (o && o["EntityAttribute"]) ? "" : (o ? sr.toDateTime(o) : ""));
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
                        $("#nud" + oElement.name).numberspinner('setValue', (o && o["EntityAttribute"]) ? "" : o);
                    }
                    break;
                case "bool":
                    if (att) {
                        $("#chk" + oElement.name).switchbutton((o[att] ? '' : 'un') + 'check');
                    } else {
                        $("#chk" + oElement.name).switchbutton((((o && o["EntityAttribute"]) ? "" : o) ? '' : 'un') + 'check');
                    }
                    break;
                case "progress":
                    var v = 0;
                    if (att) {
                        v = o[att];
                    } else {
                        v = (o && o["EntityAttribute"]) ? "" : o;
                    }
                    $("#prg" + oElement.name).progressbar('setValue', Math.round(v * 10) / 10);
                    break;
                case "select":
                    if (att) {
                        $("#cmb" + oElement.name).combogrid('setValue' + (oElement.multiple ? 's' : ''), (o[att] ? o[att] : ""));
                    } else {
                        var v = null;
                        if (o === null) {} else if (o.constructor === Array) {} else if (!o.EntityAttribute) {
                            v = o || {
                                Id: o.Id,
                                _ToString: o._ToString,
                                toString: function() {
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
        } else {
            for (var i = 0; i < this.elements.length; i++) {
                var att = (company.library ? "" : "_") + this.elements[i].name;

                if (typeof(o[att]) === "undefined") continue;

                var v = o[att];

                if (this.elements[i].name == this.sTable) {
                    v = o;
                    v.Date = new Date();
                }
                if (o.EntityValues) {
                    // an emsFormValues source
                    // find the EntityValue for this element and set it
                    for (var j = 0; j < o.EntityValues.length; j++) {
                        if (o.EntityValues[j].EntityAttribute.Name == this.elements[i].name) {
                            // found the EntityValue for this element
                            v = o.EntityValues[j];
                            for (var p in v) {
                                if (p.endsWith("Value")) {
                                    v[p] = o[att];
                                }
                            }
                            break;
                        }
                    }
                }
                if (this.elements[i].name) this.set(v, this.elements[i].name);
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
        return Math.floor(((options ? options.width : null) || (this.width / 3)));
    }

    cHeight(options) {
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
        return '<input id="chk' + options.name + '" required="' + (options.required ? 'true' : 'false') + '" data-options="onChange:function(){var s = $(\'#\' + this.id).switchbutton(\'options\'); window.DForm.BoolChange(s, window.DForm.byName(\'' + options.name + '\'));}" class="easyui-switchbutton" ' + (options.checked ? 'checked' : '') + '>';
    }

    label(options) {
        return (options.value || "");
    }

    link(options) {
        var ret = '<div class="easyui-panel" style="padding:5px;width:' + this.cWidth(options) + 'px;">';
        for (var i = 0; i < options.links.length; i++) {
            ret += '<a href="#" class="easyui-linkbutton" data-options="iconCls:\'icon-' + (options.links[i].icon || 'ok') + '\',' + (options.name ? 'group:\'' + options.name + '\'' : '') + '" onclick="window.DForm.doLink(\'' + options.name + '\', ' + i + ')">' + (options.links[i].label || i) + '</a>';
        }
        ret += "</div>";
        return ret;
    }

    text(options) {
        return '<input id="txt' + options.name + '" class="easyui-textbox" multiline="' + (options.simple ? 'false' : 'true') + '" style="white-space: pre-wrap; width: ' + this.cWidth(options) + 'px;height: ' + this.cHeight(options) + 'px" required="' + (options.required ? 'true' : 'false') + '" value="' + (options.value || "") + '">';
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
        var ret = '<table id="tr' + options.name + '" width="' + this.cWidth(options) + '" height="' + this.cHeight(options) + '" class="easyui-treegrid" data-options="iconCls: \'icon-ok\', rownumbers: true, animate: true, collapsible: true, fitColumns: true"><thead><tr>';
        $.each(options.columns, (_, c) => {
            ret += '<th data-options="field:\'' + c.name + '\',width:180' + (c.formatter ? ",formatter: (" + JSON.stringify(c.formatter) : ")") + ':">' + (c.label || c.name) + '</th>';
        });

        ret += '</tr></thead></table>';
    }

    combotree(options) {
        var ret = this.select(options, "input", "treegrid");
        return ret;
    }

    combo(options, tag, type) {
        var textField = company.library ? '_ToString' : '_name';

        var pWidth = this.cWidth(options) * 2;

        var tag = tag || "select";

        var ret = '<' + tag + ' id="cmb' + options.name + '" class="easyui-combo' + (type || (options.options ? 'box' : 'grid')) + '" style="width:' + this.cWidth(options) + 'px" required="' + (options.required ? 'true' : 'false') + '" data-options="onChange:function(n,o){var s = $(\'#\' + this.id).combo' + (options.options ? 'box' : 'grid') + '(\'options\'); window.DForm.Selected(s, window.DForm.byName(\'' + options.name + '\'));}, rownumbers:true, pagination: ' + (tag == "select" ? "true" : "false") + ', panelWidth:' + pWidth + ', fitColumns: true, multiple: ' + (options.multiple || 'false') + ', idField: \'Id\', textField: \'' + textField + '\',frozenColumns: [[';
        if (options.multiple) ret += "{field:'ck',checkbox:true},";
        ret += "{field:'Id',title:'ID',sortable: true},";
        ret += "{field:'" + textField + "',title:'" + options.name + "',width:120, sortable: true},";
        ret += "]], columns: [[";
        if (options.columns) {
            for (var i = 0; i < options.columns.length; i++) {
                ret += "{field:'" + options.columns[i].field + "',title:'" + options.columns[i].title + "',align:'right', sortable: true},";
            }
        }
        ret += ']], fitColumns: false">';
        for (var i = 0; options.options && i < options.options.length; i++) {
            ret += '<option value="' + options.options[i] + '">' + options.options[i] + '</option>';
        }
        ret += '</' + tag + '>';

        return ret;
    }

    select(options, tag, type) {
        var s = $.grep(this.selects, x => x.id == "cmb" + options.name);
        s = s.length ? s[0] : null;
        if (!s && !options.avoid) {
            s = {
                id: "cmb" + options.name
            };
            this.selects.push(s);
        }
        s.options = options;

        return this.combo(options, tag, type);
    }

    BoolChange(s, options) {
        if (options && options.change) {
            options.change(window.DForm.get());
        }
    }

    Selected(s, options) {
        if (options && options.change) {
            options.change(window.DForm.get());
        }
    }

    UploadFile(f, options) {
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
        } else if (method) {
            $.ajax({
                url: window.sr.srURL + "&method=" + method + "&sInput=" + fileid + "&preTag=&postTag=",
                data: formData,
                // THIS MUST BE DONE FOR FILE UPLOADING
                cache: false,
                contentType: false,
                type: 'POST',
                processData: false,
                success: function(data) {
                    window.sr.runScript(data);
                    window.DForm.byName(options.name).data = ret;
                    if (options && options.upload) options.upload(window.DForm.get(), ret);
                }
            });
        }
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

    fillData(g, start, end) {
        var s = null;
        for (var i = 0; i < window.DForm.selects.length; i++) {
            if (window.DForm.selects[i].id == g[0].id) s = window.DForm.selects[i];
        }
        if (!s) return;
        g.combogrid('grid').datagrid('getPager').pagination('loading');

        var name = s.options.Class ? s.options.Class.Name.replace(' ', '_') : (s.options.table || s.options.name);
        var o = window[name] ? new window[name]() : {
            Active: true,
        };
        o = (typeof filters !== "undefined" && filters && filters[name]) ? filters[name](o) : o;
        o = (s.options.source ? s.options.source(o, this.get()) : o);
        o.Name = $("#" + s.id).combobox('getText');
        if (company.library) {
            if (o === null) return;
            sr._(company.Code.toLowerCase() + name + "Findall", function(ret) {
                $("#" + s.id).combogrid('grid').datagrid('getPager').pagination('loaded');
                for (var i = 0; i < ret.length; i++) ret[i].__OWNER = s;
                $("#" + s.id).combogrid('grid').datagrid('loadData', {
                    total: ret.Count,
                    rows: ret
                });
                if (s.options.multiple) {
                    $.each(ret, (_, r) => {});
                }
                //window.sr.PostCache(1000);
            }, o, null, start, end);
        } else {
            // ems
            window._FrEMD._o(function(ret) {
                $("#" + s.id).combogrid('grid').datagrid('getPager').pagination('loaded');
                for (var i = 0; i < ret.length; i++) ret[i].__OWNER = s;
                $("#" + s.id).combogrid('grid').datagrid('loadData', {
                    total: ret.length,
                    rows: ret
                });
            }, o);
        }
    }

    bind(obj) {
        var objBind = (o, e) => {
            if (e && e.type == "combotree") {
                o.combotreegrid({

                })
            } else {
                o.combogrid({
                    onShowPanel: function() {
                        window.DForm.fillData($("#" + this.id), 0, 10);
                    },
                    onClickRow: function(index, row) {
                        var s = row.__OWNER;
                        if (s && s.options.select) {
                            s.options.select(row);
                        }
                    }
                });

                var dg = o.combogrid('grid');
                // dg.datagrid('enableFilter')
                var state = dg.data('datagrid');
                var opts = state.options;

                var onBeforeLoad = opts.onBeforeLoad;
                opts.onBeforeLoad = (param) => {
                    state.allRows = null;
                    return onBeforeLoad.call(this, param);
                }
                var pager = dg.datagrid('getPager');
                dg.datagrid('getPanel').panel({
                    ID: i
                });
                pager.pagination({
                    onSelectPage: function(pageNum, pageSize) {
                        window.DForm.fillData($("#" + window.DForm.selects[$(this.parentNode).panel('options').ID].id), pageSize * (pageNum - 1), pageSize * pageNum);
                    }
                });
                dg.datagrid('loadData', state.data);
            }
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
            connectorLength: 60,
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
        return s.charAt(0).toUpperCase() + s.slice(1).split(/(?=[A-Z])/).toString().replace(',', ' ');
    }

    render(name, title, elements, buttons, bFixed) {
        this.elements = elements;
        this.buttons = buttons;
        this.selects = [];
        this.grids = [];
        var ret = this.header(name, title, bFixed);

        var tWidth = Math.floor(this.width * 0.95);
        var tHeight = Math.floor(this.height * 0.85);

        var gElements = window.sr.groupBy(this.elements, "group");
        if (gElements.length > 1) ret += '<div id="tt" class="easyui-tabs" style="width:' + tWidth + 'px;height:' + tHeight + 'px;">';

        for (var g = 0; g < gElements.length; g++) {
            if (gElements.length > 1) ret += '<div title="' + (gElements[g].key || "Main") + '" style="padding:20px;display:none;">';

            var sElements = window.sr.groupBy(gElements[g].values, "section");
            if (sElements.length > 1) ret += '<div class="easyui-accordion" style="width:' + tWidth + 'px;height:' + tHeight + 'px;">';

            for (var s = 0; s < sElements.length; s++) {
                ret += '<div title="' + (sElements[s].key || "") + '" data-options="iconCls:\'icon-help\'" style="padding:10px;">';
                for (var i = 0; i < sElements[s].values.length; i++) {
                    var e = sElements[s].values[i];
                    e.value = e.value || sr.$_REQUEST(e.name);
                    ret += '<div class="fitem"><label>' + this.english(e.title || e.name) + ':</label>';
                    if (e.type && this[e.type]) ret += this[e.type](e);
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
        for (var i = 0; i < this.elements.length; i++)
            if (this.elements[i].name == name) return this.elements[i];
        return null;
    }
};

window.DForm = new DynaForm();
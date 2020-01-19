window.FrEMD = class {
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

        this._defineLinks();
    }

    async downloadSRCache(code, filename) {
        code = code || company.Code
        if (typeof(JSZip) === "undefined") {
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
        }).then(function(content) {
            //location.href = 'data:application/zip;base64,' + content;
            saveAs(content, filename || 'srCache.zip');
        });
    }

    _loadContent() {
        return $.get("blocks" + this.m() + "/header.htm" + this.randURL(), (html) => {
            console.log("header loaded");
            this.headerHTML = html;
        }).then(() => {
            this.step();
            return $.get("blocks" + this.m() + "/footer.htm" + this.randURL(), (html) => {
                console.log("footer loaded");
                this.footerHTML = html;
            }).then(() => {
                this.step();
                return $.get("blocks" + this.m() + "/content.htm" + this.randURL(), (html) => {
                    console.log("content loaded");
                    this.contentHTML = html;
                }).then(() => {
                    this.step();
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
                        // pageview is done dynamically at the end of the page serving
                    }

                    return this.RenderPage({
                        _code: (this.hash.page || 'index')
                    });
                    //setURL("page=" + (this.hash['page'] || 'index'));
                });
            });
        });
    }

    async initDOM() {
        window.document.body.style.visibility = 'hidden';
        await this.preInit();
        await ((company && company.OnPageLoad) ? company.OnPageLoad : async () => {})();
        if (frames[0].reRender) {
            frames[0].reRender();
        }
        if (typeof(ko) !== "undefined") {
            setTimeout(() => {
                ko.applyBindings(window, window.frames[0].document.body);
                window.title = window.frames[0].document.title; //??
                window.document.body.style.visibility = 'visible';
            }, 500);
        }

        if (false) return $.when(this.preInit()).then(() => {
            $.when(((company && company.OnPageLoad) ? company.OnPageLoad : () => {})()).then(() => {
                if (frames[0].reRender) {
                    frames[0].reRender();
                }
                if (typeof(ko) !== "undefined") {
                    setTimeout(() => {
                        ko.applyBindings(window, window.frames[0].document.body);
                        window.title = window.frames[0].document.title; //??
                        window.document.body.style.visibility = 'visible';
                    }, 500);
                }
            });
        });
    }

    async preInit() {
        window._FrEMD = this;
        this.fromHash();
        await this.require("Company");
        await this.require("ServiceRouter");
        await this._initServiceRouter();
        $.each(company.Required, async (_, l) => {
            await this.require(l);
        });
        await this._loadEntityClasses();
        console.log("Done Loading");
        return;

        if (false) return $.Deferred(def => {
            $.when(this.require("Company")).then(() => {
                $.when(this.require("ServiceRouter")).then(() => {
                    this._initServiceRouter();
                    $.when(...$.map(company.Required, l => this.require(l))).then(() => {
                        $.when(this._loadEntityClasses()).then(() => {
                            console.log("Done Loading");
                            def.resolve(null);
                        });
                    });
                });
            });
        }).promise();
    }

    async init() {
        await this.preInit();
        return await this._loadContent();

        if (false) $.when(this.preInit()).then(() => {
            return this._loadContent();
        });
    }

    async _loadEntityClasses() {
        var EntityClassJS = "script/EntityClass.js";
        if (typeof window.company !== 'undefined' && window.company && !window.company.Store) {
            EntityClassJS = "/nammour.com/ems/" + EntityClassJS;
        }
        let eas = await window.sr._("EnterpriseManager.emsEntityAttributeFindall", null, {
            EntityClass: {
                Company: {
                    Code: company.Code
                }
            }
        });
        let html = await $.get(EntityClassJS + "?rand=" + Math.random());
        this.step();

        var classes = window.sr.groupBy(eas, "EntityClass");
        var tClasses = window.sr.groupBy(eas, "EntityType");
        $.each(classes, (_, c) => {
            c.key.EntityAttributes = c.values;
            var tas = tClasses.find(tc => tc.key && c.key && tc.key.Id === c.key.Id);
            c.key.TypedAttributes = tas ? tas.values : [];
        });
        window.EntityClasses = classes.map(a => a.key);

        this.step();
        for (var i = 0; i < window.EntityClasses.length; i++) {
            var code = this._inject(html, {
                c: window.EntityClasses[i]
            });
            //console.log(code);
            code += "window." + window.EntityClasses[i].Name.replace(/ /g, '_') + " = " + window.EntityClasses[i].Name.replace(/ /g, '_') + ";";

            window.sr.runScript(code);
        }
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

    async require(libName) {
        var _hrefs = $.grep(this.hrefs, l => l.lib === libName && this._include(l));

        var calls = [];
        $.each(_hrefs, async (_, n) => {
            var _css = Array.isArray(n.css) ? n.css : [n.css];
            $.each(_css, (_, c) => {
                //this._css(c);
                calls.push(this._css(c));
            });
            var _srcs = Array.isArray(n.src) ? n.src : [n.src];
            $.each(_srcs, async (_, s) => {
                //await $.getScript(s);

                calls.push($.getScript(s));
            });
        });
        //console.log("require[" + libName + "]");
        //return true;
        return $.when(...calls).then(() => {
            console.log("require[" + libName + "]");
            return true;
        });
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

    _defineLinks() {
        // later on we will do this through ems by storing libs in as an entity and loading linked entities
        this.hrefs = [];
        this.hrefs.push({
            lib: "Company",
            src: "script/company.js"
        });

        var bLocal = location.href.indexOf('/nammour.com') > -1;
        this.hrefs.push({
            lib: "ServiceRouter",
            src: (bLocal ? "/nammour.com/cms/" : "") + "script/ServiceRouter.js",
        });
        this.hrefs.push({
            lib: "FormHelper",
            src: (bLocal ? "/nammour.com/ems/" : "") + "script/FormHelper.js",
        });
        this.hrefs.push({
            lib: "DynaForm",
            src: (bLocal ? "/nammour.com/ems/" : "") + "script/DynaForm.js",
            css: "http://voky.com.ua/showcase/sky-forms/examples/css/sky-forms.css",
        });
        this.hrefs.push({
            lib: "EasyUI",
            src: ["https://www.jeasyui.com/easyui/jquery.easyui.min.js" /*, "https://www.jeasyui.com/easyui/jquery.easyui.mobile.js"*/ ],
            css: ["https://www.jeasyui.com/easyui/themes/icon.css",
                "https://www.jeasyui.com/easyui/themes/default/easyui.css"
            ],
        });
        this.hrefs.push({
            lib: "knockout",
            src: "https://cdnjs.cloudflare.com/ajax/libs/knockout/3.5.0/knockout-min.js",
        });
        this.hrefs.push({
            lib: "js2PDF",
            src: "https://cdnjs.cloudflare.com/ajax/libs/jspdf/1.5.3/jspdf.min.js",
        });
        this.hrefs.push({
            lib: "html2canvas",
            src: "https://html2canvas.hertzen.com/dist/html2canvas.min.js",
        });
        this.hrefs.push({
            lib: "SweetAlert",
            src: "https://cdnjs.cloudflare.com/ajax/libs/sweetalert/1.1.3/sweetalert.min.js",
            css: "https://cdnjs.cloudflare.com/ajax/libs/sweetalert/1.1.3/sweetalert.min.css"
        });
        this.hrefs.push({
            lib: "PouchDB",
            src: "https://cdnjs.cloudflare.com/ajax/libs/pouchdb/7.1.1/pouchdb.min.js",
        });
        this.hrefs.push({
            lib: "JSZip",
            src: ["https://cdnjs.cloudflare.com/ajax/libs/jszip/3.2.2/jszip.min.js", "https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/1.3.8/FileSaver.min.js"],
        });
        this.hrefs.push({
            lib: "BabelJS",
            src: "https://unpkg.com/@babel/standalone/babel.min.js",
        });
        this.hrefs.push({
            lib: "DataTables",
            src: "https://cdnjs.cloudflare.com/ajax/libs/datatables/1.10.19/js/jquery.dataTables.min.js",
            css: "https://cdnjs.cloudflare.com/ajax/libs/datatables/1.10.19/css/jquery.dataTables.min.css",
        });
        this.hrefs.push({
            lib: "BT Tables",
            src: "//cdnjs.cloudflare.com/ajax/libs/bootstrap-table/1.9.1/bootstrap-table.min.js",
            css: "//cdnjs.cloudflare.com/ajax/libs/bootstrap-table/1.9.1/bootstrap-table.min.css"
        });
        this.hrefs.push({
            lib: "Ionic",
            src: "https://cdnjs.cloudflare.com/ajax/libs/ionic/1.3.2/js/ionic.min.js",
            css: "https://cdnjs.cloudflare.com/ajax/libs/ionic/1.3.2/css/ionic.min.css"
        });
        this.hrefs.push({
            lib: "uuid",
            src: "https://cdnjs.cloudflare.com/ajax/libs/node-uuid/1.4.8/uuid.min.js",
        });
        this.hrefs.push({
            lib: "WebIX",
            src: "http://cdn.webix.com/edge/webix.js",
            css: "http://cdn.webix.com/edge/webix.css"
        });
        this.hrefs.push({
            lib: "ThreeJS",
            src: "https://cdnjs.cloudflare.com/ajax/libs/three.js/r74/three.js",
        });
        this.hrefs.push({
            lib: "Kendo UI",
            src: "https://kendo.cdn.telerik.com/2016.1.112/js/kendo.all.min.js",
            css: ["https://kendo.cdn.telerik.com/2016.1.112/styles/kendo.common.min.css",
                "http://kendo.cdn.telerik.com/2016.1.112/styles/kendo.material.min.css"
            ]
        });
        this.hrefs.push({
            lib: "Semantic UI",
            src: "https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/2.4.1/semantic.min.js",
            css: "https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/2.4.1/semantic.min.css"
        });
        this.hrefs.push({
            lib: "LZ-String",
            src: "https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.4.4/lz-string.min.js",
        });
        this.hrefs.push({
            lib: "JQuery Form",
            src: "https://cdnjs.cloudflare.com/ajax/libs/jquery.form/3.51/jquery.form.min.js",
        });
        this.hrefs.push({
            lib: "XLSX",
            src: [
                "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.12.3/xlsx.full.min.js",
            ],
        });
        this.hrefs.push({
            lib: "ZingChart",
            src: "https://cdnjs.cloudflare.com/ajax/libs/zingchart/2.8.5/zingchart.min.js",
        });
        this.hrefs.push({
            lib: "DynaTable",
            src: "https://cdnjs.cloudflare.com/ajax/libs/Dynatable/0.3.1/jquery.dynatable.min.js",
            css: "https://cdnjs.cloudflare.com/ajax/libs/Dynatable/0.3.1/jquery.dynatable.min.css",
        });
        this.hrefs.push({
            lib: "JQuery Validate",
            src: "https://cdnjs.cloudflare.com/ajax/libs/jquery-validate/1.14.0/jquery.validate.min.js",
        });
        this.hrefs.push({
            lib: "AngularJS",
            src: "https://cdnjs.cloudflare.com/ajax/libs/angular.js/1.6.1/angular.min.js",
        });
        this.hrefs.push({
            lib: "Underscore",
            src: "https://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.9.1/underscore-min.js",
        });
        this.hrefs.push({
            lib: "AccordionMenu",
            src: "http://www.jqueryscript.net/demo/Multilevel-Accordion-Menu-Plugin-For-jQuery/js/script.js",
            css: "http://www.jqueryscript.net/demo/Multilevel-Accordion-Menu-Plugin-For-jQuery/css/style.css"
        });
        this.hrefs.push({
            lib: "JSGrid",
            src: "http://js-grid.com/js/jsgrid.min.js",
            css: "http://js-grid.com/css/jsgrid.min.css"
        });
        this.hrefs.push({
            lib: "FancyForm",
            src: "http://fancyjs.com/fancy/build/fancyform-min.js",
            css: "http://fancyjs.com/fancy/build/fancyform-min.css"
        });
        this.hrefs.push({
            lib: 'nonoScroller',
            src: 'https://cdnjs.cloudflare.com/ajax/libs/jquery.nanoscroller/0.8.7/javascripts/jquery.nanoscroller.min.js',
            css: 'https://cdnjs.cloudflare.com/ajax/libs/jquery.nanoscroller/0.8.7/css/nanoscroller.min.css',
        });
        this.hrefs.push({
            lib: "VueJS",
            src: "https://cdn.jsdelivr.net/npm/vue",
        });
        this.hrefs.push({
            lib: "Moment",
            src: "https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.24.0/moment-with-locales.min.js"
        });
        this.hrefs.push({
            lib: "HTML2Canvas",
            src: "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/0.4.1/html2canvas.min.js"
        });
        this.hrefs.push({
            lib: "JQuery Mobile",
            type: "mobile",
            src: "https://code.jquery.com/mobile/1.4.5/jquery.mobile-1.4.5.min.js",
            css: "https://code.jquery.com/mobile/1.4.5/jquery.mobile-1.4.5.min.css"
        });
        this.hrefs.push({
            lib: "Juxtapose",
            src: "https://cdn.knightlab.com/libs/juxtapose/latest/js/juxtapose.min.js",
            css: "https://cdn.knightlab.com/libs/juxtapose/latest/css/juxtapose.css"
        });
        this.hrefs.push({
            lib: "TwentyTwenty",
            src: ["https://cdnjs.cloudflare.com/ajax/libs/mhayes-twentytwenty/1.0.0/js/jquery.event.move.min.js", "https://cdnjs.cloudflare.com/ajax/libs/mhayes-twentytwenty/1.0.0/js/jquery.twentytwenty.min.js"],
            css: ["https://cdnjs.cloudflare.com/ajax/libs/mhayes-twentytwenty/1.0.0/css/twentytwenty.min.css", "https://cdnjs.cloudflare.com/ajax/libs/mhayes-twentytwenty/1.0.0/css/foundation.min.css"],
        });
        this.hrefs.push({
            lib: "MD5",
            primary: true,
            src: "https://cdnjs.cloudflare.com/ajax/libs/crypto-js/3.1.2/components/core.js",
        });
        this.hrefs.push({
            lib: "Pako",
            src: "https://cdnjs.cloudflare.com/ajax/libs/pako/1.0.3/pako.min.js"
        });
        this.hrefs.push({
            lib: "PapaCSV",
            src: "https://cdnjs.cloudflare.com/ajax/libs/PapaParse/4.3.7/papaparse.min.js"
        });
        this.hrefs.push({
            lib: "JQ Transform",
            src: "https://cdn.jsdelivr.net/jquery.jqtransform/1.1/jquery.jqtransform.js",
            css: "https://cdn.jsdelivr.net/jquery.jqtransform/1.1/jqtransform.css"
        });
        this.hrefs.push({
            lib: "Boostrap Select",
            src: "//cdnjs.cloudflare.com/ajax/libs/bootstrap-select/1.6.2/js/bootstrap-select.min.js",
            css: "//cdnjs.cloudflare.com/ajax/libs/bootstrap-select/1.6.2/css/bootstrap-select.min.css"
        });
        this.hrefs.push({
            lib: "prettyCheckable",
            src: "//cdn.jsdelivr.net/jquery.prettycheckable/1.2/prettyCheckable.js",
            css: "//cdn.jsdelivr.net/jquery.prettycheckable/1.2/prettyCheckable.css"
        });
        this.hrefs.push({
            lib: "JQuery UI",
            type: "desktop",
            src: "https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js",
            css: "https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.css"
        });
        this.hrefs.push({
            lib: "ACEEditor",
            src: ["https://cdnjs.cloudflare.com/ajax/libs/ace/1.4.3/ace.js",
                "https://cdnjs.cloudflare.com/ajax/libs/ace/1.4.3/ext-beautify.js"
            ]
        })
        this.hrefs.push({
            lib: "ReactJS",
            src: ["https://unpkg.com/react@16/umd/react.development.js",
                "https://unpkg.com/react-dom@16/umd/react-dom.development.js"
            ],
        });
        this.hrefs.push({
            lib: "EasyUI Mobile",
            src: "http://www.jeasyui.com/easyui/jquery.easyui.mobile.js",
            css: "http://www.jeasyui.com/easyui/themes/mobile.css",
        });
        this.hrefs.push({
            lib: "UIkit",
            type: "desktop",
            src: "https://cdnjs.cloudflare.com/ajax/libs/uikit/2.24.2/js/uikit.min.js",
            css: "https://cdnjs.cloudflare.com/ajax/libs/uikit/2.24.2/css/uikit.min.css"
        });
        this.hrefs.push({
            lib: "printThis",
            src: "https://cdnjs.cloudflare.com/ajax/libs/printThis/1.12.3/printThis.min.js",
        });
        this.hrefs.push({
            lib: "Flowchart",
            type: "desktop",
            src: ["https://cdnjs.cloudflare.com/ajax/libs/svg.js/1.0.1/svg.min.js",
                "http://www.jqueryscript.net/demo/Simple-SVG-Flow-Chart-Plugin-with-jQuery-flowSVG/jquery.scrollTo.min.js", "http://www.jqueryscript.net/demo/Simple-SVG-Flow-Chart-Plugin-with-jQuery-flowSVG/dist/flowsvg.min.js"
            ],
        });
        this.hrefs.push({
            lib: "UIkit DatePicker",
            type: "desktop",
            src: "https://cdnjs.cloudflare.com/ajax/libs/uikit/2.22.0/js/components/datepicker.min.js",
            css: "https://cdnjs.cloudflare.com/ajax/libs/uikit/2.22.0/css/components/datepicker.css"
        });
        this.hrefs.push({
            lib: "UIkit Password",
            type: "desktop",
            src: "https://cdnjs.cloudflare.com/ajax/libs/uikit/2.22.0/js/components/form-password.min.js",
            css: "https://cdnjs.cloudflare.com/ajax/libs/uikit/2.22.0/css/components/form-password.min.css"
        });
        this.hrefs.push({
            lib: "Charts",
            type: "desktop",
            src: "https://cdnjs.cloudflare.com/ajax/libs/canvasjs/1.7.0/canvasjs.min.js",
            //src: "http://canvasjs.com/assets/script/canvasjs.min.js",
        });
        this.hrefs.push({
            lib: "Filters",
            src: "script/filters.js"
        });
        this.hrefs.push({
            lib: "ACE",
            src: "https://cdnjs.cloudflare.com/ajax/libs/ace/1.3.3/ace.js"
        });
        this.hrefs.push({
            lib: "doT",
            src: "https://cdnjs.cloudflare.com/ajax/libs/dot/1.0.3/doT.min.js"
        });
        this.hrefs.push({
            lib: "Handlebars",
            src: "https://cdnjs.cloudflare.com/ajax/libs/handlebars.js/2.0.0/handlebars.js"
        });
        this.hrefs.push({
            lib: "EJS",
            src: "https://storage.googleapis.com/google-code-archive-downloads/v2/code.google.com/embeddedjavascript/ejs_production.js",
        });
        this.hrefs.push({
            lib: "XML2JSON",
            src: "https://cdnjs.cloudflare.com/ajax/libs/x2js/1.2.0/xml2json.min.js",
        });
        this.hrefs.push({
            lib: "JQuery NivoSlider",
            src: "https://cdnjs.cloudflare.com/ajax/libs/jquery-nivoslider/3.2/jquery.nivo.slider.min.js"
        });
        this.hrefs.push({
            lib: "NOTY",
            src: "https://cdnjs.cloudflare.com/ajax/libs/jquery-noty/2.3.8/packaged/jquery.noty.packaged.min.js",
            css: "https://cdnjs.cloudflare.com/ajax/libs/animate.css/3.5.2/animate.min.css",
        });
        this.hrefs.push({
            lib: "JQuery Easing",
            src: "https://cdnjs.cloudflare.com/ajax/libs/jquery-easing/1.3/jquery.easing.min.js"
        });
        this.hrefs.push({
            lib: "jsPDF",
            src: "https://cdnjs.cloudflare.com/ajax/libs/jspdf/1.3.2/jspdf.min.js"
        });
        this.hrefs.push({
            lib: "Tabulator",
            src: "https://cdnjs.cloudflare.com/ajax/libs/tabulator/3.5.3/js/tabulator.min.js",
            css: "https://cdnjs.cloudflare.com/ajax/libs/tabulator/3.5.3/css/tabulator.min.css"
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
        if (noty) {
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

    img(dImg) {
        return "data:image/png;base64," + dImg;
    }

    _inject(html, data) {
        if (typeof EJS !== 'undefined') {
            return new EJS({
                text: html
            }).render(data);
        } else if (typeof doT !== 'undefined') {
            var tempFn = doT.template(html);
            return tempFn(data);
        } else if (typeof Handlebars !== 'undefined') {
            var template = Handlebars.compile(html);
            return template(data);
        } else if (typeof _ === 'function' && typeof _.template !== 'undefined') {
            return _.template(html)(data);
        } else {
            return html;
        }
    }

    async end(fCallBack, data) {
        if (this.endCalled) return;
        this.endCalled = true;
        if (!data) data = window.page.data || {};

        data.page = this.allData.page;
        data.pages = this.allData.pages;

        await this.doCalls();
        if (fCallBack) {
            await fCallBack();
        }
        //console.log("all calls done", this.allData.page);
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

        if (company.OnPageLoad) {
            setTimeout(() => {
                //alert("Calling OnPageLoad");
                company.OnPageLoad(data);
            }, 500);
        }
        this.endCalled = false;
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

    preCompile(page) {
        if (typeof Babel === "undefined") return page;

        if (typeof React !== "undefined") return $.when(window.sr.Get("templates" + this.m() + "/" + page._code + ".jsx" + this.randURL())).then(jsx => {
            if (jsx === null || jsx === "") page;
            var res = Babel.transform(jsx, {
                presets: ['es2015', "react"]
            });
            return $.when(window.sr._("ContentManager.cmsSaveFileBody", null,
                window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/')) +
                "/templates" + this.m() + "/" + page._code + ".js", res.code)).then(() => {
                return page;
            });
        });
    }

    async RenderPage(page, data, options) {
        console.log("RenderPage", page, data);
        for (var i = 0; i < this.pages.length; i++) {
            if (this.pages[i]._code == page._code && this.pages[i]._language && (this.pages[i]._language == (window.lang || company.Language || "en"))) {
                console.log((window.lang || company.Language || "en"));
                page = this.pages[i];
                break;
            }
        }

        page.data = data;

        window.page = page;
        if (!window.sr.bLocal && (page.Body || page.toEntityObject)) {
            console.log("Page " + page._code + " already loaded, serving...");
            // found the page and it is an object
            this.allHTML = (this.contentHTML ? this.contentHTML : page.Body);
            this.allHTML = this.headerHTML + this.allHTML + this.footerHTML;
            this.allData = {
                settings: this.settings,
                page: page,
                pages: this.pages
            };
            this.allOptions = options;

            await window.sr.runScript(page.Script);
            if (!page.Script) {
                let e = await this.end();
                return e;
            }
        }

        try {
            let js = await $.ajax({
                type: 'GET',
                url: "blocks" + this.m() + "/main.js" + this.randURL(),
                dataType: "text",
            });
            await this.runScript(js)();
            console.log("Main script found.");
        } catch (ex) {}
        this.step();

        //this.RenderPageCMS(page, data, options, (page, options) => {
        if (!CMS_ROOT) return fFail(page, options);

        let ret = null;
        if (CMS_ROOT) {
            ret = await window.sr._("ContentManager.cmsHTMLPageFind", null, {
                Page: page._code.indexOf('/') >= 0 ? page._code : (CMS_ROOT + page._code)
            });
        }

        if (ret) {
            // store to avoid redundant loading
            ret._code = page._code;

            console.log("Page " + page._code + " found in CMS, serving...");

            this.allHTML = (ret.Body ? ret.Body : this.contentHTML);
            this.allHTML = this.headerHTML + this.allHTML + this.footerHTML;
            this.allData = {
                settings: this.settings,
                page: ret,
                pages: this.pages
            };
            this.allOptions = options;

            this.endCalled = false;
            page.Script = this.runScript(ret.Script);
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

            page = await this.preCompile(page);

            try {
                let data = await $.ajax({
                    url: "templates" + this.m() + "/" + page._code + ".htm" + this.randURL()
                });
                console.log("Page " + page._code + " html template found");
                page.Body = data;
            } catch (ex) {
                console.log("Page " + page._code + " has no html template");
                page.Body = this.contentHTML || page._content || "<!--" + ("Page " + page._code + " does not exist") + "-->";
            }

            try {
                let js = await $.ajax({
                    url: "templates" + this.m() + "/" + page._code + ".js" + this.randURL(),
                    dataType: "text",
                });
                page.Script = this.runScript(js);
                console.log("Page " + page._code + " script is retrieved");
                //window.sr.runScript(js);
            } catch (ex) {}

            //console.log("GOT DATA");
            this.step();

            // only cache pages that come from EMS
            if (page.toEntityObject) this.pages.push(page);

            this.allHTML = this.headerHTML + page.Body + this.footerHTML;
            this.allData = {
                settings: this.settings,
                page: page,
                pages: this.pages
            };
            this.allOptions = options;
        }
        //console.log("THE END");
        if (!this.endCalled && !page.Script) {
            await this.end();
        } else {
            try {
                await new page.Script().main();
            } catch (ex) {
                console.log(ex);
                await page.Script();
            }
        }

        if (typeof(ga) !== "undefined") {
            ga('send', {
                hitType: 'pageview',
                page: '/' + page._code + '.dynamic',
                title: page._title
            });
            console.log("Sent GA hit for page: " + page._code);
        }
    }

    runScript(js) {
        if (js.indexOf("class {") >= 0) {
            // a class definition, do not enclose it in a function
            return sr.runScript(js);
        } else {
            return sr.runScript("(async () => {" + js + "});");
        }
    }
};
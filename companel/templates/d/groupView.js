window.__groupView = class {

    async FillSliders() {
        var imagedata = {};
        for (var i = 2014; i <= moment().year(); i++) {
            try {
                imagedata["Year" + i] = await new Promise(resolve => zingchart.exec('chtResults-' + i, 'getimagedata', {
                    format: 'png',
                    year: i,
                    callback: function(ret) {
                        resolve(ret);
                    }
                }));
            } catch (ex) {}
        }
        for (var i = 2014; i <= moment().year(); i++) {
            //console.log(i + ": " + imagedata["Year" + i].length);
            new juxtapose.JXSlider('#Slider' + i + "To" + (i + 1),
                [{
                        src: imagedata["Year" + i],
                        label: i,
                        credit: ''
                    },
                    {
                        src: imagedata["Year" + (i + 1)],
                        label: i + 1,
                        credit: ""
                    }
                ], {
                    animate: true,
                    showLabels: true,
                    showCredits: true,
                    startingPosition: "50%",
                    makeResponsive: true
                });
        }
    }

    async ShowReport(year, name, func) {
        var m = new Main();
        m.showLoading(true);
        try {
            let ret = await new ReportSection(year, company.Code)[func](name);
            this.ChartData(ret, year, name);
        } catch (ex) {}
        m.showLoading(false);
    }

    ChartData(data, year, section) {
        var s = new ReportSection(year, company.Code);
        typeof(ga) !== "undefined" ? ga('send', {
            hitType: 'event',
            eventCategory: 'CorporateMeasures',
            eventAction: 'ReportSection',
            eventLabel: company.Code + "/" + section + "/" + year
        }): null;

        var chart = zingchart.render({
            id: "chtResults-" + year,
            data: s._asZingOptions(s._data(data, 'bar', section)),
            height: '600',
            width: '100%'
        });

        var tdata = s._pivot(ret, "MMM/YY");
        var columns = [];
        for (var p in tdata[0]) {
            columns.push({
                title: p,
                field: p,
                width: 200
            });
        }
        tdata = $.grep(tdata, (n, i) => {
            return parseFloat(n.Aggregation) > 0;
        });

        var html = "<thead><tr>";
        $.each(tdata, (i, v) => {
            if (i === 0) {
                for (var p in v) {
                    html += "<th>" + p + "</th>";
                }
                html += "</tr></thead><tbody>";
            }
            html += "<tr>";
            for (var p in v) {
                html += "<td>" + v[p] + "</td>";
            }
            html += "</tr>";
        });
        html += "</tbody>";
        $("#tblResults-" + year).html(html);
        try {
            $('#tblResults-' + year).DataTable();
        } catch (ex) {}
    }

    feed(callback) {
        var s = new ReportSection(2014, company.Code);
        window.lastFeed = s._start = moment(window.lastFeed).add({
            month: 1
        });
        s._end = moment(s._start).endOf('month');
        $.when(s._run(window.page.data.record.Name)).then(ret => {
            var s = new ReportSection(2014, company.Code);
            callback(JSON.stringify({
                plot0: s._data(ret, 'bar', window.page.data.record.Name)
            }));
            console.log("Tick");
            zingchart.exec('chtResults-TimeLapse', 'stopfeed');
        });
    }

    TimeLapse(runFunc, section) {
        var s = new ReportSection(2014, company.Code);
        window.lastFeed = s._start = moment({
            year: 2014,
            month: 0,
            day: 1
        });
        s._end = moment(s._start).endOf('month');
        $.when(s._run(section)).then(ret => {
            var config = s._asZingOptions(s._data(ret, 'bar', section));
            config.graphset[0].refresh = {
                "type": "feed",
                "transport": "js",
                "url": "feed()",
                "interval": 400,
                "resetTimeout": 1000
            };
            zingchart.render({
                id: "chtResults-TimeLapse",
                data: config,
                height: '600',
                width: '100%'
            });
        });
    }

    main() {
        window._FrEMD.end();
    }
}
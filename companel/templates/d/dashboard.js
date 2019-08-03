$.when(window.sr._("CorporateMeasures.comDashboardEntryFindall", null, {
    Enabled: true,
    Dashboard: {
        Enabled: true,
        User: window.me
    }
})).then(dbes => {
    var calls = [];
    $.each(dbes, (_, de) => {
        var interval = {
            Year: 1
        };
        if (de.Handler == "_dbNumber" || de.Handler == "_dbTable") {
            interval = {
                Year: 1
            };
        } else if (de.Handler == "_dbLineChart" || de.Handler == "_dbSparkBars" || de.Handler == "_dbSparkLines" || de.Handler == "_dbNumberChart") {
            interval = {
                Month: 1
            };
        }

        var rs = new ReportSection(2014, company.Code, interval);
        rs._start = moment().add(-1, 'y').startOf('year');
        rs._end = moment().add(-1, 'y').endOf('year');
        calls.push(rs._run(de.GroupView.Name));
    });
    $.when(...calls).then((...arRet) => {
        $.each(arRet, (i, data) => dbes[i].Data = data);

        window.dasbhbaordEntries = sr.groupBy(dbes, "Dashboard");

        return window._FrEMD.end();
    }).then(() => {
        var s = new ReportSection(2014, company.Code);
        $.each($.grep(dbes, v => v.Handler == "_dbLineChart"), (_, v) => {
            zingchart.render({
                id: "_chart" + v.Id,
                data: s._asZingOptions(s._data(v.Data, 'column', v.Name)),
                height: '300',
                width: '80%',
            });
        });
    });
});
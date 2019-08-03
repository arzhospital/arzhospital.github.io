$.when(window.sr._("CorporateMeasures.comUserFind", null, (window.me || (window.page.data ? window.page.data.User : {
    Id: 0
})))).then(ret => {
    window.me = ret;

    return $.when(window.sr._("CorporateMeasures.comGroupViewFindall", null, {
        Enabled: true,
        Category: {
            Enabled: true,
            Organization: {
                Active: true,
                OrganizationUsers: [window.me]
            }
        }
    }), window.sr._("CorporateMeasures.comGroupViewLinkFindall", null, {
        Enabled: true,
        BaseGroupView: {
            Category: {
                Enabled: true,
                Organization: {
                    OrganizationUsers: [window.me]
                }
            }
        }
    }));
}).then((ret1, ret2) => {
    window.categories = window.sr.groupBy(ret1, "Category");
    window.categories.sort((a, b) => a.key.Order - b.key.Order);

    window.viewLinks = ret2;

    return window.sr._("CorporateMeasures.comGroupViewFindall", null, {
        DataMap: null,
        Category: null,
        User: {
            Active: true,
            UserOrganizations: [{
                OrganizationUsers: [window.me]
            }]
        },
        OPERATORS: {
            DataMap: "!="
        }
    });
}).then(ret => {
    window.measures = ret;

    return $.when((typeof(window.ReportSection) === "undefined") ? window.sr._("ContentManager.cmsHTMLPageFind", null, {
        Page: 'Hosted/COM/ReportSection'
    }) : null);
}).then(ret => {
    if (ret) window.sr.runScript(ret.Script);

    var rs = new ReportSection(2014, company.Code);
    rs._start = moment().subtract(1, 'months').startOf('month');
    rs._end = moment().subtract(1, 'months').endOf('month');

    var calls = [];
    $.each(measures, (_, m) => {
        calls.push(rs._run(m.Name));
    });
    return $.when(...calls).then((...arRet) => {
        $.each(measures, (_, m) => {
            m.V0 = arRet[_][0].V0;
        });
        //console.log("Measures Aquired", measures);
    });
}).then(() => {
    return window._FrEMD.end();
});
window.__IndexPage = class {
    constructor() {}

    async main() {
        window.me = await window.sr._("CorporateMeasures.comUserFind", null, (window.me || (window.page.data ? window.page.data.User : {
            Id: 0
        })));

        window.categories = window.sr.groupBy(await window.sr._("CorporateMeasures.comGroupViewFindall", null, {
            Enabled: true,
            Category: {
                Enabled: true,
                Organization: {
                    Active: true,
                    OrganizationUsers: [window.me]
                }
            }
        }), "Category");
        window.categories.sort((a, b) => a.key.Order - b.key.Order);

        window.viewLinks = await window.sr._("CorporateMeasures.comGroupViewLinkFindall", null, {
            Enabled: true,
            BaseGroupView: {
                Category: {
                    Enabled: true,
                    Organization: {
                        OrganizationUsers: [window.me]
                    }
                }
            }
        });

        window.measures = await window.sr._("CorporateMeasures.comGroupViewFindall", null, {
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

        if (typeof(window.ReportSection) === "undefined") {
            var page = await window.sr._("ContentManager.cmsHTMLPageFind", null, {
                Page: 'Hosted/COM/ReportSection'
            });
            window.sr.runScript(page.Script);
        }

        var rs = new ReportSection(2014, company.Code);
        rs._start = moment().subtract(1, 'months').startOf('month');
        rs._end = moment().subtract(1, 'months').endOf('month');

        for (var i = 0; i < measures.length; i++) {
            let res = await rs._run(measures[i].Name);
            if (res && res[0]) {
                measures[i].V0 = res[0].V0;
            }
        }

        await window._FrEMD.end();
    }
};
var gviews = [];
window._FrEMD._c({
    Page: "Hosted/COM/ReportSection"
}, ret => {
    sr.runScript(ret[0].Script);
}, "ContentManager.cmsHTMLPageFindall");
window._FrEMD._c({
    Enabled: true,
    User: {
        Active: true,
        UserOrganizations: [{
            Code: company.Code
        }]
    }
}, ret => {
    gviews = ret;
}, "CorporateMeasures.comGroupViewFindall");
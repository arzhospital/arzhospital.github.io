if (typeof ReportSection === "undefined") {
    let ret = await sr._("ContentManager.cmsHTMLPageFindall", null, {
        Page: "Hosted/COM/ReportSection"
    });
    sr.runScript(ret[0].Script);
    console.log("Loaded ReportSection");
}

if (typeof gviews === "undefined") {
    let gviews = await sr._("CorporateMeasures.comGroupViewFindall", null, {
        Enabled: true,
        User: {
            Active: true,
            UserOrganizations: [{
                Code: company.Code
            }]
        }
    });
    window.gviews = gviews;
    console.log("Loaded gviews", gviews.length);
}

window.DoLogin = async (username, password) => {
    let ret = await new Employee().username(username, '=').password(password, '=').findAll();

    if (ret.length) {
        window.me = ret[0];
        window._FrEMD.RenderPage({
            _code: 'index'
        });
    }
};
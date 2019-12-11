window.ShowYear = async (section, year) => {
    let s = new ReportSection(year, company.Code);

    zingchart.render({
        id: "chtResults-" + year,
        data: s._asZingOptions(s._data(await s._run(window.gviews.find(g => g.Name == section), ['taken']), 'bar', section)),
        height: '600',
        width: '100%'
    });

    zingchart.exec("chtResults-" + year, "toggledimension");

    typeof(ga) !== "undefined" ? ga('send', {
        hitType: 'event',
        eventCategory: 'CorporateMeasures',
        eventAction: 'ReportSection',
        eventLabel: company.Code + "/" + section + "/" + year
    }): null;

    if (!window.sr.bLocal || window.sr.$_REQUEST("cacheResult") != "sr") return;
    if (typeof window.___doCache === "undefined") {
        window.___doCache = confirm('Generate Website Cache?');
    }
    if (!window.___doCache) return;

    if (year >= moment().year()) {
        year = 2014;
        for (var i = 0; i < gviews.length - 1; i++) {
            if (gviews[i].Name == section) {
                $("#menu-" + (i + 1)).trigger("click");
                return;
            }
        }
        return window._FrEMD.downloadSRCache();
    }
    $("#section-" + (year + 1)).trigger("click");
}

for (var i = 0; i < gviews.length; i++) {
    if (gviews[i].Name != page.data._section) continue;

    if (!gviews[i].KeyFields || !gviews[i].KeyFields.length) {
        // make it depth=2
        //console.log("Finding gview " + gviews[i].Name + " with depth=2");
        gviews[i] = await window.sr._("CorporateMeasures.comGroupViewFind", null, {
            Id: gviews[i].Id
        }, null, 2);
    }
}

await window._FrEMD.end();

$("#tab-container").easytabs();
await ShowYear(page.data._section, 2014);
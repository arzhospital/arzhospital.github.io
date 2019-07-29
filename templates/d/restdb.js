function fulfillRestDB() {
    var settings = {
        "async": true,
        "crossDomain": true,
        "url": 'https://arzbi-a5ec.restdb.io/rest/postdata?q=' + JSON.stringify({
            pending: true
        }),
        "method": "GET",
        "headers": {
            "content-type": "application/json",
            "x-apikey": "5c3b37a866292476821c9eef",
            "cache-control": "no-cache"
        }
    };

    $.ajax(settings).done(function(response) {
        var calls = [];
        $.each(response, (_, r) => {
            calls.push({
                id: r._id,
                call: $.ajax({
                    async: false,
                    url: r.url,
                    method: "POST",
                    headers: {
                        'cache-control': 'no-cache',
                    },
                    processData: false,
                    data: r.postData
                })
            });
        });

        console.log("Pending: " + response.length);

        $.when(...$.map(calls, c => c.call)).then((...ret) => {
            $.each(ret, (i, r) => {
                var s = {};
                for (var p in settings) {
                    s[p] = settings[p];
                }
                s.method = "PUT";
                s.url = s.url.split('?')[0] + "/" + calls[i].id;
                s.processData = false;
                s.data = JSON.stringify({
                    result: r.responseText || r,
                    pending: false
                });
                $.ajax(s);
            });
        });
    });
}
end(() => {
    setInterval(fulfillRestDB, 10000);
});
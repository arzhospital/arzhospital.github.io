window.Main = class {
    constructor() {}

    mainPostLoad() {
        document.title = company.Name;

        if (window.me) this.mainFillInfo();

        $("body").attr("class", "theme-cyan");

        if (typeof(DataTable) !== "undefined") {
            $('.js-basic-example').DataTable();

            //Exportable table
            $('.js-exportable').DataTable({
                dom: 'Bfrtip',
                buttons: [
                    'copy', 'csv', 'excel', 'pdf', 'print'
                ]
            });
        }
    }

    //Widgets count plugin
    initCounters() {
        $('.count-to').countTo();
    }

    //Charts
    initCharts() {
        //Chart Bar
        $('.chart.chart-bar').sparkline(undefined, {
            type: 'bar',
            barColor: '#fff',
            negBarColor: '#fff',
            barWidth: '4px',
            height: '34px'
        });

        //Chart Pie
        $('.chart.chart-pie').sparkline(undefined, {
            type: 'pie',
            height: '50px',
            sliceColors: ['rgba(255,255,255,0.70)', 'rgba(255,255,255,0.85)', 'rgba(255,255,255,0.95)', 'rgba(255,255,255,1)']
        });

        //Chart Line
        $('.chart.chart-line').sparkline(undefined, {
            type: 'line',
            width: '60px',
            height: '45px',
            lineColor: '#fff',
            lineWidth: 1.3,
            fillColor: 'rgba(0,0,0,0)',
            spotColor: 'rgba(255,255,255,0.40)',
            maxSpotColor: 'rgba(255,255,255,0.40)',
            minSpotColor: 'rgba(255,255,255,0.40)',
            spotRadius: 3,
            highlightSpotColor: '#fff'
        });
    }

    mainFillInfo() {
        try {
            var ctx = $("#cnvDrawing")[0].getContext('2d');
            ctx.font = "20px Verdana";
            ctx.strokeText(window.me.FirstName[0] + ". " + window.me.LastName[0] + ".", 10, 50);
        } catch (_ex) {

        }
    }

    RenderSparkLines() {
        return;
        //$(".sparkline").sparkline();
        $(".sparkline").each(function() {
            var $this = $(this);
            $this.sparkline('html', $this.data());
        });
        $('.sparkline-pie').sparkline('html', {
            type: 'pie',
            offset: 90,
            width: '150px',
            height: '150px',
            sliceColors: ['#E91E63', '#00BCD4', '#FFC107']
        });
        drawDocSparklines();
        drawMouseSpeedDemo();
    }

    showLoading(bLoading) {
        if (bLoading) {
            $('body').append('<div class="page-loader-wrapper"><div class="loader"><div class="preloader"><div class="spinner-layer pl-red"><div class="circle-clipper left"><div class="circle"></div></div><div class="circle-clipper right"><div class="circle"></div></div></div></div><p>Please wait...</p></div></div>');
        } else {
            $(".page-loader-wrapper").fadeOut();
        }
    }

    triggerStuff() {
        $(".control").click(function() {
            $("body").addClass("mode-search"), $(".input-search").focus()
        }), $(".icon-close").click(function() {
            $("body").removeClass("mode-search")
        })

        var a = document.getElementById("morphsearch"),
            b = a.querySelector("input.morphsearch-input"),
            c = a.querySelector("span.morphsearch-close"),
            d = isAnimating = !1,
            e = function(c) {
                if ("focus" === c.type.toLowerCase() && d) return !1;
                morphsearch.getBoundingClientRect();
                d ? (classie.remove(a, "open"), "" !== b.value && setTimeout(function() {
                    classie.add(a, "hideInput"), setTimeout(function() {
                        classie.remove(a, "hideInput"), b.value = ""
                    }, 300)
                }, 500), b.blur()) : classie.add(a, "open"), d = !d
            };
        b.addEventListener("focus", e), c.addEventListener("click", e), document.addEventListener("keydown", function(a) {
            27 === (a.keyCode || a.which) && d && e(a)
        }), a.querySelector('button[type="submit"]').addEventListener("click", function(a) {
            a.preventDefault()
        });
    }

    activateNotificationAndTasksScroll() {
        $(".navbar-right .dropdown-menu .body .menu").slimscroll({
            height: "254px",
            color: "rgba(0,0,0,0.5)",
            size: "4px",
            alwaysVisible: !1,
            borderRadius: "0",
            railBorderRadius: "0"
        });
    }

    initTwentyTwenty() {
        try {
            $(".twentytwenty-container[data-orientation!='vertical']").twentytwenty({
                default_offset_pct: 0.7
            });
            $(".twentytwenty-container[data-orientation='vertical']").twentytwenty({
                default_offset_pct: 0.3,
                orientation: 'vertical'
            });
        } catch (ex) {

        }
    }

    OnPageLoad() {
        //if (typeof $.fn.twentytwenty === "undefined") window._FrEMD.require("TwentyTwenty");
        activateNotificationAndTasksScroll();

        // setTimeout(mainPostLoad, 1000);
        this.mainPostLoad();

        //new Chart(document.getElementById("line_chart").getContext("2d"), getChartJs('line'));
        this.RenderSparkLines();
        this.initCounters();
        this.initCharts();
        this.triggerStuff();
        this.initTwentyTwenty();
        this.showLoading(false);
    }
};

new window.Main().showLoading(true);
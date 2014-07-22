/*jslint browser: true, unparam: true */

(function ($, tangelo, vg) {
    "use strict";

    $.fn.timeline = function (spec) {
        var y = tangelo.accessor({field: spec.y}),
            x = tangelo.accessor({field: spec.x}),
            data = spec.data,
            dt = [],
            opt = {
                data: {table: dt},
                renderer: "svg",
                el: this[0]
            },
            that = this[0];

        data.rows.forEach(function (row) {
            dt.push({
                x: tangelo.isNumber(x(row)) ? x(row) : NaN,
                y: tangelo.isNumber(y(row)) ? y(row) : NaN,
                orig: row
            });
        });

        function resize() {
            vg.parse.spec("scatterplot.json", function(chart) {
                console.log($(that).width() + "," + $(that).height());
                if ($(that).width() > 0 && $(that).height() > 0) {
                    chart(opt).width($(that).width() - 70).height($(that).height() - 70).update();
                }
            });
        }
        $(window).resize(resize);
        resize();

        return that;
    };

}(window.jQuery, window.tangelo, window.vg));

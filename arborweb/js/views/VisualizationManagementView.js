/*jslint browser: true, nomen: true */

(function (flow, _, $, Backbone, d3) {
    "use strict";

    flow.VisualizationManagementView = Backbone.View.extend({
        events: {
            'change #visualization': 'changeVisualization',

            'click #show': function () {
                this.loadInputs(_.values(this.inputsView.itemViews), {}, _.bind(function (options) {
                    var inner = $('<div style="width:100%;height:100%"></div>');
                    $("#vis").empty();
                    $("#vis").append(inner);
                    inner[this.visualization.get('name')](options);
                    flow.setDisplay('vis');

                    // Untoggle the show script button if active
                    if (d3.select("#show-script").classed("active")) {
                        d3.select("#show-script").on("click")();
                        d3.select("#show-script").classed("active", false);
                    }
                }, this));
            }
        },

        initialize: function (settings) {
            this.datasets = settings.datasets;
            this.inputsView = new flow.InputsView({
                collection: new Backbone.Collection(),
                el: this.$('.inputs'),
                datasets: this.datasets
            });

            this.visualizations = settings.visualizations;
            this.visualizaitonsView = new flow.ItemsView({el: this.$('#visualization'), itemView: flow.ItemOptionView, collection: this.visualizations});
            this.visualizaitonsView.render();
            this.changeVisualization();
        },

        render: function () {
            if (this.visualization) {
                this.inputsView.collection.set(this.visualization.get('inputs'));
                this.inputsView.render();
            }
            return this;
        },

        changeVisualization: function () {
            this.visualization = this.visualizations.get($("#visualization").val());
            this.render();
        },

        loadInputs: function (inputViews, options, done) {
            var input, inputView, dataset, value;
            if (inputViews.length === 0) {
                done(options);
                return;
            }

            // Just handle the first input, recurse to handle the rest
            inputView = inputViews[0];
            inputViews = inputViews.slice(1);

            // Sometimes the view is a Backbone view, sometimes it is a plain control
            value = inputView.view.$el ? inputView.view.$el.val() : inputView.view.val();

            input = inputView.model;

            if (input.get('type') === 'table' || input.get('type') === 'tree' || input.get('type') === 'image' || input.get('type') === 'r') {
                dataset = this.datasets.get(value);
                if (dataset.get('bindings')) {
                    d3.select("#prov")
                        .text(JSON.stringify(dataset.get('bindings').inputs, null, "    "));
                }
                flow.retrieveDatasetAsFormat(dataset, input.get('type'), input.get('format'), false, _.bind(function (error, converted) {
                    options[input.get('name')] = converted.get('data');

                    // Handle the rest once we're done taking care of this one
                    this.loadInputs(inputViews, options, done);
                }, this));
                return;
            }
            if (input.get('type') === 'string') {
                options[input.get('name')] = value;
            } else if (input.get('type') === 'number') {
                options[input.get('name')] = parseFloat(value);
            } else if (input.get('type') === 'json') {
                options[input.get('name')] = JSON.parse(value);
            }
            this.loadInputs(inputViews, options, done);
        }

    });

}(window.flow, window._, window.$, window.Backbone, window.d3));
/*jslint browser: true, nomen: true */

(function (flow, $, girder) {
    'use strict';

    $(document).ready(function () {
        girder.apiRoot = '/girder/api/v1';
        
        // Look up the id of the analysis we wish to perform
        // the analysis specified here is a placeholder. it generates an ultrametric tree
        // but the branch lengths are not meaningful
        var treeRequest = new flow.App();
        treeRequest.analysisName = "Get complete subtree for a given taxon";
        girder.restRequest({
            path: 'resource/search',
            data: {
                q: treeRequest.analysisName,
                types: JSON.stringify(["item"])
            }
        }).done(function (results) {
            console.log(JSON.stringify(results["item"][0]));
            treeRequest.analysisId = results["item"][0]._id;
            treeRequest.readyToAnalyze();
        });

        treeRequest.readyToAnalyze = function () {
//            if ("taxonOttIdList" in this) {
                d3.select("#send-tree-request").classed('disabled', false);
//            }
        };

        $("#send-tree-request").click(function() {
//            $("#send-tree-timer-request").attr("disabled", "disabled");
            $("#send-tree-request").text("Re-send request");
            $("#notice").text("Requesting tree...");

            var inputs = {
                ott_id_string: {type: "string", format: "text", data: $("#complete-subtree-ott-id-input").val()}
            };
            
            console.log(inputs.ott_id_string.data)

            var outputs = {
//                res: {type: "table", format: "rows"},
//                treePlot: {type: "image", format: "png.base64"}
                newick_result: {type: "string", format: "text"},
                taxon_names: {type: "string", format: "text"}
            };

            flow.performAnalysis(treeRequest.analysisId, inputs, outputs,
                _.bind(function (error, result) {
                    treeRequest.taskId = result._id;
                    setTimeout(_.bind(treeRequest.checkTreeResult, treeRequest), 1000);
                }, treeRequest));

            treeRequest.checkTreeResult = function () {
                var check_url = '/item/' + this.analysisId + '/romanesco/' + this.taskId + '/status'
                girder.restRequest({path: check_url}).done(_.bind(function (result) {
                    console.log(result.status);
                    if (result.status === 'SUCCESS') {
                        // get result data
                        var result_url = '/item/' + this.analysisId + '/romanesco/' + this.taskId + '/result'
                        girder.restRequest({path: result_url}).done(_.bind(function (data) {
//                            treeRequest.treePlot = data.result.treePlot.data;
                            treeRequest.tree = data.result.newick_result;
                            treeRequest.taxonNames = data.result.taxon_names;

                            aceApp.tree = treeRequest.tree;
                            console.log(aceApp.tree);
                            console.log(treeRequest.taxonNames);
                            d3.select("#tree-name").html('Tree: loaded from OpenTree <span class="glyphicon glyphicon-ok-circle"></span>');
                            // render tree plot
//                            $("#tree-plot").image({ data: treeRequest.treePlot });
//                            $("#analyze").removeAttr("disabled");
//                            $("#notice").text("Ancestral state reconstruction succeeded!");
//                            $('html, body').animate({
//                                scrollTop: $("#tree-plot").offset().top
//                            }, 1000);
                        }, this));

                    } else if (result.status === 'FAILURE') {
                        $("#analyze").removeAttr("disabled");
                        $("#notice").text("Analysis failed. " + result.message);
                    } else {
                        setTimeout(_.bind(this.checkTreeResult, this), 1000);
                    }
                }, this));
            };

        });
        
//        treeRequest.render(); // necessary?
        
        /* --------------- original code below here --------------- */


        // Lookup the ID of the analysis that we wish to perform.
        var aceApp = new flow.App();
        aceApp.analysisName = "aceArbor";
        girder.restRequest({
            path: 'resource/search',
            data: {
                q: aceApp.analysisName,
                types: JSON.stringify(["item"])
            }
        }).done(function (results) {
            aceApp.ASRId = results["item"][0]._id;
            aceApp.readyToAnalyze();
        });

        aceApp.readyToAnalyze = function () {
            if ("column" in this && "table" in this && "tree" in this && "ASRId" in this) {
                d3.select("#analyze").classed('disabled', false);
            }
        };

        function toggleInputTablePreview() {
            if ($("#table-preview-icon").hasClass("glyphicon-folder-close")) {
                $("#table-preview-icon").removeClass("glyphicon-folder-close");
                $("#table-preview-icon").addClass("glyphicon-folder-open");
                $("#table-preview-text").text(" Hide input table preview");
            }
            else {
                $("#table-preview-icon").removeClass("glyphicon-folder-open");
                $("#table-preview-icon").addClass("glyphicon-folder-close");
                $("#table-preview-text").text(" Show input table preview");
            }

            $("#input-table-vis").toggle('slow');
        }

        // override upload function for simple mode
        flow.DatasetManagementView.prototype.upload = function (file) {
            var reader = new FileReader();

            reader.onload = _.bind(function (e) {
                var dataset = {
                        name: file.name,
                        data: e.target.result
                    },
                    extension = file.name.split('.'),
                    typeFormat;

                extension = extension[extension.length - 1];
                typeFormat = flow.getTypeFormatsFromExtension(extension)[0];
                typeFormat = {type: typeFormat.type, format: typeFormat.format};
                _.extend(dataset, typeFormat);
                dataset = new Backbone.Model(dataset);

                // modifications for simple app begin here
                // if its a table, get the column names
                if (typeFormat.type == "table") {
                    aceApp.table = dataset.get('data');
                    aceApp.tableFormat = typeFormat.format;
                    d3.select("#table-name").html('Table: ' + file.name + ' <span class="glyphicon glyphicon-ok-circle"></span>');
                    $("#column-input").text("Parsing column names...");
                    $("#column-names").empty();
                    flow.retrieveDatasetAsFormat(dataset, "table", "column.names.discrete", false, _.bind(function (error, dataset) {
                        var columnNames = dataset.get('data');
                        for (var i = 0; i < columnNames.length; ++i) {
                            // create drag-and-drop elements here
                            $("#column-names").append('<div class="btn btn-info draggable discrete">' + columnNames[i] + '</div>');
                        }
                        $(".draggable").draggable({
                             zIndex: 1, helper: "clone"
                        });
                        d3.select("#column-input").html('Drag column of interest here <span class="glyphicon glyphicon-exclamation-sign"></span>');
                    }, this));
                    flow.retrieveDatasetAsFormat(dataset, "table", "column.names.continuous", false, _.bind(function (error, dataset) {
                        var columnNames = dataset.get('data');
                        for (var i = 0; i < columnNames.length; ++i) {
                            // create drag-and-drop elements here
                            $("#column-names").append('<div class="btn btn-info draggable continuous">' + columnNames[i] + '</div>');
                        }
                        $(".draggable").draggable({
                             zIndex: 1, helper: "clone"
                        });
                    }, this));

                    flow.retrieveDatasetAsFormat(dataset, "table", "rows", false, _.bind(function (error, dataset) {
                      // show the input table to help the user understand if their data
                      // was parsed correctly or not
                      var rowData = dataset.get('data');
                      rowData.rows = rowData.rows.slice(0, 3);
                      d3.select("#input-table-vis-container").classed('hidden', false);
                      $("#input-table-vis").table({ data: rowData });
                    }, this));

                }

                else if (typeFormat.type == "tree") {
                    aceApp.tree = dataset.get('data');
                    console.log(aceApp.tree);
                    d3.select("#tree-name").html('Tree: ' + file.name + ' <span class="glyphicon glyphicon-ok-circle"></span>');
                }
                aceApp.readyToAnalyze();

                this.datasets.off('add', null, 'set-collection').add(dataset);
            }, this);

            reader.readAsText(file);
        };

        $("#column-input").droppable({
            drop: function( event, ui ) {
                var COI = ui.draggable.text();
                aceApp.type = "discrete";
                if (ui.draggable.hasClass("continuous")) {
                    aceApp.type = "continuous";
                }
                aceApp.column = COI;
                d3.select("#column-input")
                    .classed('btn-primary', true)
                    .classed('btn-success', false)
                    .classed('bg-warning', false)
                    .html(COI + ' <span class="glyphicon glyphicon-ok-circle"></span>');
                aceApp.readyToAnalyze();
            },
            over: function (event, ui) {
                d3.select("#column-input")
                    .classed('btn-success', true)
                    .classed('bg-warning', false);
            },
            out: function (event, ui) {
                d3.select("#column-input")
                    .classed('btn-success', false)
                    .classed('bg-warning', true);
            }
            });

        $("#analyze").click(function() {
            $("#analyze").attr("disabled", "disabled");
            $("#analyze").text("Re-run");
            $("#notice").text("Performing ancestral state reconstruction analysis...");

            var inputs = {
                table:  {type: "table",  format: aceApp.tableFormat,    data: aceApp.table},
                tree:   {type: "tree",   format: "newick",           data: aceApp.tree},
                column: {type: "string", format: "text",             data: aceApp.column},
                type:   {type: "string", format: "text",             data: aceApp.type},
                method: {type: "string", format: "text",             data: "marginal"}
            };

            var outputs = {
                res: {type: "table", format: "rows"},
                treePlot: {type: "image", format: "png.base64"}
            };

            flow.performAnalysis(aceApp.ASRId, inputs, outputs,
                _.bind(function (error, result) {
                    aceApp.taskId = result._id;
                    setTimeout(_.bind(aceApp.checkASRResult, aceApp), 1000);
                }, aceApp));

            aceApp.checkASRResult = function () {
                var check_url = '/item/' + this.ASRId + '/romanesco/' + this.taskId + '/status'
                girder.restRequest({path: check_url}).done(_.bind(function (result) {
                    console.log(result.status);
                    if (result.status === 'SUCCESS') {
                        // get result data
                        var result_url = '/item/' + this.ASRId + '/romanesco/' + this.taskId + '/result'
                        girder.restRequest({path: result_url}).done(_.bind(function (data) {
                            aceApp.treePlot = data.result.treePlot.data;

                            // render tree plot
                            $("#tree-plot").image({ data: aceApp.treePlot });
                            $("#analyze").removeAttr("disabled");
                            $("#notice").text("Ancestral state reconstruction succeeded!");
                            $('html, body').animate({
                                scrollTop: $("#tree-plot").offset().top
                            }, 1000);
                        }, this));

                    } else if (result.status === 'FAILURE') {
                        $("#analyze").removeAttr("disabled");
                        $("#notice").text("Analysis failed. " + result.message);
                    } else {
                        setTimeout(_.bind(this.checkASRResult, this), 1000);
                    }
                }, this));
            };

        });

        $("#help").click(function() {
            $("#upload").popover({
                title: 'Step #1',
                content: 'Upload your table (csv or tsv) and tree (newick) here',
                placement: 'bottom',
                trigger: 'manual'
            });
            $("#upload").popover('toggle');
            $("#column-input").popover({
                title: 'Step #2',
                content: 'Drag your column of interest here',
                placement: 'left',
                trigger: 'manual'
            });
            $("#column-input").popover('toggle');
            $("#analyze").popover({
                title: 'Step #3',
                content: 'Click on the "Go!" button',
                placement: 'bottom',
                trigger: 'manual'
            });
            $("#analyze").popover('toggle');
        });

        $("#table-preview").click(function() {
            toggleInputTablePreview();
        });

        aceApp.render();
    }); 
}(window.flow, window.$, window.girder));

/*jslint browser: true, nomen: true */

function getFlowAppByNameLookup(name) {

    var app = new flow.App();
    app.analysisName = name;
    girder.restRequest({
        path: 'resource/search',
        data: {
            q: app.analysisName,
            types: JSON.stringify(["item"])
        }
    }).done(function (results) {
        console.log(JSON.stringify(results["item"][0]));
        app.analysisId = results["item"][0]._id;
        app.readyToAnalyze();
    });
    
    return app;
}

(function (flow, $, girder) {
    'use strict';

    $(document).ready(function () {
        girder.apiRoot = '/girder/api/v1';
        
        // Look up the ids of the analyses we wish to perform

        // this analysis generates an ultrametric tree with arbitrary branch lengths
        var treeRequest = getFlowAppByNameLookup("Get complete subtree from OpenTree for a given ott id");

        // this analysis collects trait data for a set of taxon names
        var traitRequest = getFlowAppByNameLookup("Get trait data from TraitBank");

        // this analysis performs asr using the specified tree and trait data
        var aceApp = getFlowAppByNameLookup("aceArbor");

        // control access to ui elements
        treeRequest.readyToAnalyze = function () {
            d3.select("#send-tree-request").classed('disabled', false);
        };
        traitRequest.readyToAnalyze = function () {
            if ("taxonNames" in this) {
                d3.select("#send-trait-request").classed('disabled', false);
            }
        };        
        aceApp.readyToAnalyze = function () {
            if ("column" in this && "table" in this && "tree" in this && "ASRId" in this) {
                d3.select("#analyze").classed('disabled', false);
            }
        };

        $("#send-tree-request").click(function() {
            $("#send-tree-request").text("Search for a different tree");
            $("#tree-notice").text("Requesting tree...");

            var inputs = {
                ott_id: {type: "string", format: "text", data: $("#complete-subtree-ott-id-input").val()}
            };
            
            console.log(inputs.ott_id.data)

            var outputs = {
//                res: {type: "table", format: "rows"},
//                treePlot: {type: "image", format: "png.base64"}
                newick_result: {type: "string", format: "text"},
                tree: {type: "tree", format: "newick"},
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
//                            treeRequest.tree = data.result.newick_result;

                            // record the taxon names
                            traitRequest.taxonNames = data.result.taxon_names.data;
                            console.log(traitRequest.taxonNames);
                            traitRequest.readyToAnalyze();

                            // record the tree
                            aceApp.tree = data.result.tree.data;
//                            console.log(aceApp.tree);
//                            d3.select("#tree-name").html(
//                                'Tree: loaded from OpenTree <span class="glyphicon glyphicon-ok-circle"></span>');
                            
                            // render tree plot
//                            $("#tree-plot").image({ data: treeRequest.treePlot });
//                            $("#analyze").removeAttr("disabled");

                            d3.select("#tree-notice").html('Tree loaded successfully from OpenTree <span class="glyphicon glyphicon-ok-circle"></span>');
//                            $('html, body').animate({
//                                scrollTop: $("#tree-plot").offset().top
//                            }, 1000);

                        }, this));

                    } else if (result.status === 'FAILURE') {
//                        $("#analyze").addAttr("disabled");
                        $("#tree-notice").text("Could not retrieve tree from OpenTree. " + result.message);
                    } else {
                        setTimeout(_.bind(this.checkTreeResult, this), 1000);
                    }
                }, this));
            };

        });
        
        $("#send-trait-request").click(function() {
            $("#send-trait-request").text("Re-submit trait request");
            $("#trait-notice").text("Gathering available trait data...");

            var inputs = {
                taxon_names: {type: "string", format: "text", data: traitRequest.taxonNames}
            };
            
            console.log("requesting trait data for taxon names: " + inputs.taxon_names.data)

            var outputs = {
                trait_name_table: {type: "table", format: "rows"}
            };

            flow.performAnalysis(traitRequest.analysisId, inputs, outputs,
                _.bind(function (error, result) {
                    traitRequest.taskId = result._id;
                    setTimeout(_.bind(traitRequest.checkTraitResult, traitRequest), 1000);
                }, traitRequest));

            traitRequest.checkTraitResult = function () {
                var check_url = '/item/' + this.analysisId + '/romanesco/' + this.taskId + '/status'
                girder.restRequest({path: check_url}).done(_.bind(function (result) {
                    console.log(result.status);
                    if (result.status === 'SUCCESS') {
                        // get result data
                        var result_url = '/item/' + this.analysisId + '/romanesco/' + this.taskId + '/result'
                        girder.restRequest({path: result_url}).done(_.bind(function (data) {

//                            console.log(data.result.trait_name_table.data);

                            // display the available data to the user
                            var rowData = data.result.trait_name_table.data;
                            d3.select("#trait-table-vis-container").classed('hidden', false);
                            $("#trait-table-vis").table({ data: rowData });
                            
                            $.each($("#trait-table-vis").find("th"), function(i, headerCell) {
                                var traitName = headerCell.textContent;
                                var btn = $("div").addClass("btn btn-primary :hover").click(function() {
//                                    console.log("selected cell: " + traitName);
                                    console.log('test');
                                });
                                $(headerCell).html(btn);
                            });

                            $("#trait-notice").text("Trait data request was successful! Click on a column header to select data for ancestral character estimation:");

/*                            aceApp.traitData = traitRequest.tree;
                            console.log(aceApp.traitData);
                            console.log(traitRequest.tra);
                            d3.select("#tree-name").html('Tree: loaded from OpenTree <span class="glyphicon glyphicon-ok-circle"></span>'); */

                        }, this));

                    } else if (result.status === 'FAILURE') {
//                        $("#analyze").removeAttr("disabled");
                        $("#trait-notice").text("There was a problem attempting to collect trait data. " + result.message);
                    } else {
                        setTimeout(_.bind(this.checkTraitResult, this), 1000);
                    }
                }, this));
            };

        });
        
        
        /* --------------- original code below here --------------- */


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
            $("#ace-notice").text("Performing ancestral state reconstruction analysis...");

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
                            $("#ace-notice").text("Ancestral state reconstruction succeeded!");
                            $('html, body').animate({
                                scrollTop: $("#tree-plot").offset().top
                            }, 1000);
                        }, this));

                    } else if (result.status === 'FAILURE') {
                        $("#analyze").removeAttr("disabled");
                        $("#ace-notice").text("Analysis failed. " + result.message);
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

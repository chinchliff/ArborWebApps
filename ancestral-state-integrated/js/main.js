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

        // this analysis just renders a tree into a PNG graphic
        var treeRenderRequest = getFlowAppByNameLookup("Render tree");

        // this analysis filters a tree using a list of names
        var filterRequest = getFlowAppByNameLookup("Filter tree based on taxon list");

        // this analysis performs asr using the specified tree and trait data
        var asrRequest = getFlowAppByNameLookup("aceArbor");

        // control access to ui elements
        treeRequest.readyToAnalyze = function () {
            if ("analysisId" in this) {
                d3.select("#send-tree-request").classed('disabled', false);
            }
        };
        traitRequest.readyToAnalyze = function () {
            if ("taxonNames" in this && "analysisId" in this) {
                d3.select("#send-trait-request").classed('disabled', false);
            }
        };
        treeRenderRequest.readyToAnalyze = function () {};
        filterRequest.readyToAnalyze = function () {
            if ("namesToKeep" in this && "tree" in this && "analysisId" in this) {
                d3.select("#send-filter-request").classed('disabled', false);
            }
        };
        asrRequest.readyToAnalyze = function () {
            if ("column" in this && "table" in this && "tree" in this && "analysisId" in this && "type" in this) {
                d3.select("#send-asr-request").classed('disabled', false);
            }
        };

        $("#send-tree-request").click(function() {
            $("#send-tree-request").attr("disabled","disabled");
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
//                    console.log(result.status);
                    if (result.status === 'SUCCESS') {
                        // get result data
                        var result_url = '/item/' + this.analysisId + '/romanesco/' + this.taskId + '/result'
                        girder.restRequest({path: result_url}).done(_.bind(function (data) {
//                            treeRequest.treePlot = data.result.treePlot.data;

                            // record the taxon names
//                            console.log(traitRequest.taxonNames);
                            traitRequest.taxonNames = data.result.taxon_names.data;
                            traitRequest.readyToAnalyze();

                            // record the tree
                            filterRequest.tree = data.result.tree.data;
                            
                            // render tree plot
//                            $("#tree-plot").image({ data: treeRequest.treePlot });
//                            $("#analyze").removeAttr("disabled");

                            d3.select("#tree-notice").html('Tree loaded successfully from OpenTree ' + 
                                    ' <span class="glyphicon glyphicon-ok-circle"></span>');

//                            $('html, body').animate({
//                                scrollTop: $("#tree-plot").offset().top
//                            }, 1000);

                            $("#send-tree-request").removeAttr("disabled");
                        }, this));

                    } else if (result.status === 'FAILURE') {
                        $("#tree-notice").text("Could not retrieve tree from OpenTree. " + result.message);
                        $("#send-tree-request").removeAttr("disabled");
                    } else {
                        setTimeout(_.bind(this.checkTreeResult, this), 1000);
                    }
                }, this));
            };

        });
        
        $("#send-trait-request").click(function() {
            $("#send-trait-request").attr("disabled","disabled");
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

                            // display the available data to the user
                            var rowData = data.result.trait_name_table.data;
                            asrRequest.table = rowData;
                            asrRequest.tableFormat = 'rows';
                            d3.select("#trait-table-vis-container").classed('hidden', false);
                            $("#trait-table-vis").table({ data: rowData });
                            
                            // remove null entries from the table to improve readability
                            $.each($("#trait-table-vis").find("td"), function(i, dataCell) {
                                if ($(dataCell).html() == "null") { $(dataCell).text(""); }
                            });
                            
                            // enable buttons to select the trait to be used for ASR
                            $.each($("#trait-table-vis").find("th"), function(i, headerCell) {
                                var traitName = headerCell.textContent;
                                if (traitName != "name") {
                                    $(headerCell).html('<div class="btn btn-primary :hover">' + traitName + '</div>');
                                    $(headerCell).children("div").click(function() {
                                        $("#trait-selection").html('Selected trait: ' +
                                                traitName + ' <span class="glyphicon glyphicon-ok-circle"></span>');
                                        $("#filter-notice").html('Tree needs to be filtered to match trait: ' +
                                                traitName + ' <span class="glyphicon glyphicon-exclamation-sign"></span>');

                                        // set the column to be used for the ASR request
                                        asrRequest.column = traitName;
                                        
                                        // collect the taxon names that have data for this trait 
                                        var names = [];
                                        for (var i = 0; i < rowData["rows"].length; i++) {
//                                            console.log(rowData["rows"][i]);
                                            if (rowData["rows"][i][traitName] != null) {
                                                names.push(rowData["rows"][i]["name"]);
                                            }
                                        }
                                        filterRequest.namesToKeep = names.join();
                                        console.log("will filter tree to contain only: " + filterRequest.namesToKeep);
                                        filterRequest.readyToAnalyze();
                                    });
                                }
                            });

                            $("#trait-notice").text("Trait data request was successful! " + 
                                    "Select the data to be used for ancestral character estimation:");
                            $("#trait-selection").html('No trait has been selected. ' + 
                                    '<span class="glyphicon glyphicon-exclamation-sign"></span>');

                            $("#send-trait-request").removeAttr("disabled");
                        }, this));

                    } else if (result.status === 'FAILURE') {
                        $("#trait-notice").text("There was a problem attempting to collect trait data. " + result.message);
                        $("#send-trait-request").removeAttr("disabled");
                    } else {
                        setTimeout(_.bind(this.checkTraitResult, this), 1000);
                    }
                }, this));
            };

        });
        
        $("#send-filter-request").click(function() {
            $("#send-filter-request").attr("disabled", "disabled");
            $("#send-filter-request").text("Re-filter tree");
            $("#filter-notice").text("Filtering tree based on availability of trait data...");

            var inputs = {
                tips_to_keep: {type: "string", format: "text", data: filterRequest.namesToKeep},
                newick_tree: {type: "string", format: "text", data: filterRequest.tree}
            };
            
            var outputs = {
                filtered_tree: {type: "tree", format: "newick"}
            };

            flow.performAnalysis(filterRequest.analysisId, inputs, outputs,
                _.bind(function (error, result) {
                    filterRequest.taskId = result._id;
                    setTimeout(_.bind(filterRequest.checkFilterResult, filterRequest), 1000);
                }, filterRequest));

            filterRequest.checkFilterResult = function () {
                var check_url = '/item/' + this.analysisId + '/romanesco/' + this.taskId + '/status'
                girder.restRequest({path: check_url}).done(_.bind(function (result) {
                    console.log(result.status);
                    if (result.status === 'SUCCESS') {
                        // get result data
                        var result_url = '/item/' + this.analysisId + '/romanesco/' + this.taskId + '/result'
                        girder.restRequest({path: result_url}).done(_.bind(function (data) {

                            asrRequest.tree = data.result.filtered_tree.data
//                            console.log(asrRequest.tree);

                            $("#filter-notice").html('Tree was successfully filtered for taxa with ' + 
                                    asrRequest.column + ' data. <span class="glyphicon glyphicon-ok-circle"></span>');

                            $("#select-discrete").removeAttr("disabled");
                            $("#select-discrete-label").removeClass("disabled");
                            $("#select-continuous").removeAttr("disabled");
                            $("#select-continuous-label").removeClass("disabled");
                            
                            $("#send-filter-request").removeAttr("disabled");
                        }, this));

                    } else if (result.status === 'FAILURE') {
                        $("#filter-notice").text("There was a problem filtering the tree. " + result.message);
                        $("#send-filter-request").removeAttr("disabled");
                    } else {
                        setTimeout(_.bind(this.checkFilterResult, this), 1000);
                    }
                }, this));
            };
        });
        
        $("#send-asr-request").click(function() {
            $("#send-asr-request").attr("disabled", "disabled");
            $("#send-asr-request").text("Re-run ancestral state reconstruction");
            $("#ace-notice").text("Performing ancestral state reconstruction analysis...");

            var inputs = {
                table:  {type: "table",  format: asrRequest.tableFormat,    data: asrRequest.table},
                tree:   {type: "tree",   format: "newick",           data: asrRequest.tree},
                column: {type: "string", format: "text",             data: asrRequest.column},
                type:   {type: "string", format: "text",             data: asrRequest.type},
                method: {type: "string", format: "text",             data: "marginal"}
            };

            var outputs = {
                res: {type: "table", format: "rows"},
                treePlot: {type: "image", format: "png.base64"}
            };

            console.log(inputs);
            console.log(outputs);

            flow.performAnalysis(asrRequest.analysisId, inputs, outputs,
                _.bind(function (error, result) {
                    asrRequest.taskId = result._id;
                    setTimeout(_.bind(asrRequest.checkASRResult, asrRequest), 1000);
                }, asrRequest));

            asrRequest.checkASRResult = function () {
                var check_url = '/item/' + this.analysisId + '/romanesco/' + this.taskId + '/status'
                girder.restRequest({path: check_url}).done(_.bind(function (result) {
                    console.log(result.status);
                    if (result.status === 'SUCCESS') {
                        // get result data
                        var result_url = '/item/' + this.analysisId + '/romanesco/' + this.taskId + '/result'
                        girder.restRequest({path: result_url}).done(_.bind(function (data) {

                            asrRequest.treePlot = data.result.treePlot.data;

                            // render tree plot
                            $("#tree-plot").image({ data: asrRequest.treePlot });
                            $("#send-asr-request").removeAttr("disabled");
                            $("#asr-notice").html("Ancestral state reconstruction succeeded!" + 
                                    ' <span class="glyphicon glyphicon-ok-circle"></span>');

//                            $('html, body').animate({
//                                scrollTop: $("#tree-plot").offset().top
//                            }, 1000);

                        $("#send-asr-request").removeAttr("disabled");
                        }, this));

                    } else if (result.status === 'FAILURE') {
                        $("#asr-notice").text("Analysis failed. " + result.message);
                        $("#send-asr-request").removeAttr("disabled");
                    } else {
                        setTimeout(_.bind(this.checkASRResult, this), 1000);
                    }
                }, this));
            };

        });
        
        $("#select-continuous-label").click(function() {
            asrRequest.type = 'continuous';
            asrRequest.readyToAnalyze();
            console.log(asrRequest);
//            $("#select-continuous").button('toggle')
        });

        $("#select-discrete-label").click(function() {
            asrRequest.type = 'discrete';
            asrRequest.readyToAnalyze();
            console.log(asrRequest);
//            $("#select-continuous").button('toggle')
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
                    asrRequest.table = dataset.get('data');
                    asrRequest.tableFormat = typeFormat.format;
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
                    asrRequest.tree = dataset.get('data');
                    console.log(asrRequest.tree);
                    d3.select("#tree-name").html('Tree: ' + file.name + ' <span class="glyphicon glyphicon-ok-circle"></span>');
                }
                asrRequest.readyToAnalyze();

                this.datasets.off('add', null, 'set-collection').add(dataset);
            }, this);

            reader.readAsText(file);
        };

        $("#column-input").droppable({
            drop: function( event, ui ) {
                var COI = ui.draggable.text();
                asrRequest.type = "discrete";
                if (ui.draggable.hasClass("continuous")) {
                    asrRequest.type = "continuous";
                }
                asrRequest.column = COI;
                d3.select("#column-input")
                    .classed('btn-primary', true)
                    .classed('btn-success', false)
                    .classed('bg-warning', false)
                    .html(COI + ' <span class="glyphicon glyphicon-ok-circle"></span>');
                asrRequest.readyToAnalyze();
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

        asrRequest.render();
    }); 
}(window.flow, window.$, window.girder));

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
//        console.log(JSON.stringify(results["item"][0]));
        app.analysisId = results["item"][0]._id;
        app.ready();
    });
    return app;
}

function renderTreePlot(target, tree, renderRequest, flow, girder, logElement=null) {
    
    var inputs = { tree: {type: "tree", format: "newick", data: tree} };
    var outputs = { treePlot: {type: "image", format: "png.base64"} };

    console.log(inputs);
    console.log(outputs);
    console.log(renderRequest);
    console.log(flow);
    console.log(girder);

    flow.performAnalysis(renderRequest.analysisId, inputs, outputs,
        _.bind(function (error, result) {
            renderRequest.taskId = result._id;
            setTimeout(_.bind(renderRequest.checkTreeResult, renderRequest), 1000);
        }, renderRequest));

    renderRequest.checkRenderResult = function () {
        var check_url = '/item/' + this.analysisId + '/romanesco/' + this.taskId + '/status'
        console.log(check_url);
        girder.restRequest({path: check_url}).done(_.bind(function (result) {
            console.log(result.status);
            if (result.status === 'SUCCESS') {
                var result_url = '/item/' + this.analysisId + '/romanesco/' + this.taskId + '/result'
                console.log(result_url);
                girder.restRequest({path: result_url}).done(_.bind(function (data) {

                    // render tree plot
                    target.image({ data: renderRequest.treePlot });
                    
                }, this));
            } else if (result.status === 'FAILURE' && logElement != null) {
                var msg = "Could not render tree. " + result.message;
                console.log(msg);
                logElement.text(msg);
            } else {
                setTimeout(_.bind(this.checkRenderResult, this), 1000);
            }
        }, this));
    };


}

(function (flow, $, girder) {
    'use strict';

    $(document).ready(function () {
        girder.apiRoot = '/girder/api/v1';
        
        // initial setup
        $("#collect-tree").collapse(); // uncollapse the first panel
//        $("#collect-trait-data").collapse();
//        $("#filter-tree").collapse();
        
        // Look up the ids of the analyses we wish to perform

        // this analysis generates an ultrametric tree with arbitrary branch lengths
        var treeRequest = getFlowAppByNameLookup("Get complete subtree from OpenTree for a given ott id");

        // this analysis collects trait data for a set of taxon names
        var traitRequest = getFlowAppByNameLookup("Get trait data from TraitBank");

        // this analysis just renders a tree into a PNG graphic
        var treeRenderRequest = getFlowAppByNameLookup("Render tree");
        console.log(treeRenderRequest);

        // this analysis filters a tree using a list of names
        var filterRequest = getFlowAppByNameLookup("Filter tree based on taxon list");

        // this analysis performs asr using the specified tree and trait data
        var asrRequest = getFlowAppByNameLookup("Do ancestral state reconstruction using aRbor");

        // control access to ui elements
        treeRequest.ready = function (callback) {
            if ("ottId" in this && "analysisId" in this) {
                d3.select("#send-tree-request").classed('disabled', false);
                $("#send-tree-request").removeAttr("disabled");
                callback();
            }
        };
        treeRequest.notReady = function () {
            $("#send-tree-request").addAttr("disabled").addClass("disabled");
        };
        traitRequest.ready = function () {
            if ("taxonNames" in this && "analysisId" in this) {
                $("#send-trait-request").removeClass('disabled');
            }
        };
        traitRequest.notReady = function () {
            $("#send-trait-request").addClass("disabled");
        };

        treeRenderRequest.ready = function () {};

        filterRequest.ready = function () {
            if ("namesToKeep" in this && "tree" in this && "analysisId" in this) {
                $("#send-filter-request").removeClass('disabled');
            }
        };
        filterRequest.notReady = function () {
            $("#send-filter-request").addClass("disabled");
        };
        asrRequest.ready = function () {
            console.log(asrRequest);
            if ("column" in this && "table" in this && "tree" in this && "analysisId" in this && "type" in this) {
                $("#send-asr-request").removeClass('disabled').removeAttr("disabled");
            }
        };
        asrRequest.notReady = function () {
            $("#send-asr-request").addClass("disabled").addAttr("disabled");
        };

        // using devbridge jquery.autocomplete.js for taxon name suggestions
        $('#ott-id-select').autocomplete({
            serviceUrl: "https://api.opentreeoflife.org/v3/tnrs/autocomplete_name",
            type: "POST",
            paramName: "name",
            minChars: 2,
            transformResult: function(response) {
                return {
                    suggestions: $.map(JSON.parse(response), function(result) {
                        return { value: result.unique_name, data: result.ott_id };
                    })
                };
            },
            onSelect: function (suggestion) {
                console.log(suggestion.data);
                treeRequest.ottId = suggestion.data.toString();
                treeRequest.taxonName = suggestion.value;
                treeRequest.ready(function() {
                    $("#send-tree-request").html("Request tree for: " + suggestion.value);
                });
            }
//            onSearchComplete: function(query, suggestions) { console.log(query); console.log(suggestions); }
//            lookup: ["Test result 1","Test result 2", "another one"]
        }).focus(function() { $(this).val(""); });

        $("#send-tree-request").click(function() {
            $("#send-tree-request").attr("disabled","disabled");
            $("#send-tree-request").text("Request tree");
            $("#tree-notice").text("Requesting tree...");

            var inputs = {
                ott_id: {type: "string", format: "text", data: treeRequest.ottId}
            };
            
            console.log(inputs);
            
            var outputs = {
                newick_result: {type: "string", format: "text"},
                tree:          {type: "tree", format: "newick"},
                taxon_names:   {type: "string", format: "text"}
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
                        var result_url = '/item/' + this.analysisId + '/romanesco/' + this.taskId + '/result'
                        girder.restRequest({path: result_url}).done(_.bind(function (data) {
//                            treeRequest.treePlot = data.result.treePlot.data;

                            // record the tree
                            filterRequest.tree = data.result.tree.data;
                            console.log("will use tree: " + filterRequest.tree);

//                            renderTreePlot($("#original-tree-vis"), filterRequest.tree, treeRenderRequest, flow, girder);




                            var inputs = { tree: {type: "tree", format: "newick", data: tree} };
                               var outputs = { treePlot: {type: "image", format: "png.base64"} };

                               console.log(inputs);
                               console.log(outputs);

                               flow.performAnalysis(treeRenderRequest.analysisId, inputs, outputs,
                                   _.bind(function (error, result) {
                                       treeRenderRequest.taskId = result._id;
                                       setTimeout(_.bind(treeRenderRequest.checkTreeResult, treeRenderRequest), 1000);
                                   }, treeRenderRequest));

                               treeRenderRequest.checkRenderResult = function () {
                                   var check_url = '/item/' + this.analysisId + '/romanesco/' + this.taskId + '/status'
                                   console.log(check_url);
                                   girder.restRequest({path: check_url}).done(_.bind(function (result) {
                                       console.log(result.status);
                                       if (result.status === 'SUCCESS') {
                                           var result_url = '/item/' + this.analysisId + '/romanesco/' + this.taskId + '/result'
                                           console.log(result_url);
                                           girder.restRequest({path: result_url}).done(_.bind(function (data) {

                                               // render tree plot
                                               $("#original-tree-vis").image({ data: treeRenderRequest.treePlot });
                   
                                           }, this));
                                       } else if (result.status === 'FAILURE' && logElement != null) {
                                           var msg = "Could not render tree. " + result.message;
                                           console.log(msg);
                                           logElement.text(msg);
                                       } else {
                                           setTimeout(_.bind(this.checkRenderResult, this), 1000);
                                       }
                                   }, this));
                               };




/**/



                            d3.select("#tree-notice").html('Tree loaded successfully from OpenTree ' + 
                                    ' <span class="glyphicon glyphicon-ok-circle"></span>');

                            // record the taxon names
//                            console.log(traitRequest.taxonNames);
                            traitRequest.taxonNames = data.result.taxon_names.data;
                            console.log(traitRequest.taxonNames);
                            traitRequest.ready();
                            $("#send-trait-request").html("Request trait data for: " + this.taxonName);

                            $("#collect-tree").collapse("hide");
                            $("#collect-trait-data").collapse("show");

//                            $('html, body').animate({
//                                scrollTop: $("#original-tree-vis").offset().top
//                            }, 1000);
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
        
        $("#trait-table-toggle").click(function() {
            $("#trait-table").toggle();
            $("#trait-list").toggle();
            if ($("#trait-table-toggle").html() == "Show full trait table") {
                $("#trait-table-toggle").text("Switch to trait list view");
            } else {
                $("#trait-table-toggle").text("Show full trait table");
            }
        });
        
        $("#send-trait-request").click(function() {
            $("#send-trait-request").attr("disabled","disabled");
            $("#send-trait-request").text("Re-submit trait request");
            $("#trait-notice").text("Gathering available trait data...");
            $("#trait-selection").html("");
            $("#trait-table").html(""); // clear any previous results
            $("#trait-list").html("");
            $("#trait-table-toggle-group").hide();

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
//                    console.log(result.status);
                    if (result.status === 'SUCCESS') {
                        // get result data
                        var result_url = '/item/' + this.analysisId + '/romanesco/' + this.taskId + '/result'
                        girder.restRequest({path: result_url}).done(_.bind(function (data) {

                            var rowData = data.result.trait_name_table.data;
                            console.log(rowData);

                            // collect the number of taxa represented for each trait
                            var taxCountsForTrait = {}
                            for (var i = 0; i < rowData["rows"].length; i++) {
                                if (rowData["rows"][i]["name"] == "(number of tips with trait)") {
                                    for (var traitName in rowData["rows"][i]) {
                                        if (traitName != "name") {
                                            taxCountsForTrait[traitName] = rowData["rows"][i][traitName];
                                        }
                                    }
                                    break;
                                }
                            }

                            $("#trait-table-container").prepend
                            ("<p>Select the data to be used for ancestral character estimation:</p>");
                            $("#trait-table").hide().table({ data: rowData });

                            d3.select("#trait-table-container").classed('hidden', false);
                            
                            // remove null entries from the table to improve readability
                            $.each($("#trait-table").find("td"), function(i, dataCell) {
                                if ($(dataCell).html() == "null") { $(dataCell).text(""); }
                            });
                                                        
                            // enable buttons to select the trait to be used for ASR
                            $.each($("#trait-table").find("th"), function(i, headerCell) {
                                var traitName = headerCell.textContent;
                                var traitNameNoSpaces = traitName.replace(/ /g,"_");
                                console.log('processing trait: ' + traitName);
                                if (traitName != "name") {

                                    // add a button to the table header
                                    var tableButton = $('<span></span>')
                                    .addClass("btn btn-primary :hover")
                                    .html(traitName)
                                    .click(function() {
                                        $("#trait-selection").html('Selected trait: ' +
                                                traitName + ' <span class="glyphicon glyphicon-ok-circle"></span>');
                                        $("#filter-notice").html('Tree needs to be filtered to match trait: ' +
                                                traitName + ' <span class="glyphicon glyphicon-exclamation-sign"></span>');

                                            // set the column to be used for the ASR request
                                            asrRequest.column = traitNameNoSpaces;

                                            // collect the taxon names that have data for this trait 
                                            // WARNING: cannot seem to use tables with R scripts in arbor
                                            // right now, conversion issues
                                            var names = [];
                                            var filteredData = {
                                                "fields": ["name", traitNameNoSpaces],
                                                "rows": []
                                            };

                                            // temporary hack to circumvent table conversion issue
                                            var measurements = []

                                            for (var i = 0; i < rowData["rows"].length; i++) {
                                        //                                            console.log(rowData["rows"][i]);
                                                var traitValue = rowData["rows"][i][traitName];
                                                var name = rowData["rows"][i]["name"];
                                                var taxCountsForTrait = {};
                                                if (traitValue != null && name != "(number of tips with trait)") {
                                                    names.push(name);
                                                    var r = {"name": name}
                                                    r[traitNameNoSpaces] = traitValue;
                                                    filteredData.rows.push(r);
        
                                                    // temporary hack to circumvent table conversion issue
                                                    measurements.push(traitValue);
                                                }
                                            }
                                            filterRequest.namesToKeep = names.join();
                                            console.log("will filter tree to contain only: " + filterRequest.namesToKeep);
                                            console.log("filtered data: ");
                                            console.log(filteredData)

                                            // currently not being used - table conversion issues
                                            asrRequest.table = filteredData;
                                            asrRequest.tableFormat = 'rows';

                                            // temporary hack to circumvent table conversion issue
                                            asrRequest.measurements_string = measurements.join('\t');
                                            asrRequest.names_string = names.join('\t'); 

                                            filterRequest.ready();
                                            
                                            $("#collect-trait-data").collapse("hide");
                                            $("#filter-tree").collapse("show");

                                    });

                                    $(headerCell).html(tableButton);                                    

                                    if (taxCountsForTrait[traitName] > 2) {
                                        // add a button to the trait list
                                        var listButton = $(tableButton).clone()
                                        
                                        var listButton = $('<button></button>')
                                        .addClass("btn btn-primary :hover")
                                        .html(traitName + " (" + taxCountsForTrait[traitName] + ")")
                                        .click(function() { $(tableButton).click(); });

//                                        console.log(listButton);
                                    
                                        $("#trait-list").append(listButton);
                                    }
                                }
                            });

                            $("#trait-notice").text("Trait data request was successful!");
//                            $("#trait-selection").html('No trait has been selected. ' + 
//                                    '<span class="glyphicon glyphicon-exclamation-sign"></span>');

                            $("#send-trait-request").removeAttr("disabled");
                            $("#trait-table-toggle").removeClass('disabled');
                            $("#trait-table-toggle-group").show();

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
                newick_tree:  {type: "string", format: "text", data: filterRequest.tree}
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
//                    console.log(result.status);
                    if (result.status === 'SUCCESS') {
                        // get result data
                        var result_url = '/item/' + this.analysisId + '/romanesco/' + this.taskId + '/result'
                        girder.restRequest({path: result_url}).done(_.bind(function (data) {

                            asrRequest.tree = data.result.filtered_tree.data
                            console.log(asrRequest.tree);

                            $("#filter-notice").html('Tree was successfully filtered for taxa with ' + 
                                    asrRequest.column + ' data. <span class="glyphicon glyphicon-ok-circle"></span>');
                            
                            $("#send-filter-request").removeAttr("disabled");

                            // reveal the final analysis interface elements
                            $("#select-discrete").removeAttr("disabled").removeClass("disabled");
                            $("#select-continuous").removeAttr("disabled").removeClass("disabled");

                            $("#filter-tree").collapse("hide");
                            $("#final-asr-request").collapse("show");                            
                            
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
            $("#asr-notice").text("Performing ancestral state reconstruction analysis...");

            var inputs = {
//                table:       {type: "table",  format: asrRequest.tableFormat,    data: asrRequest.table},
                tree:        {type: "tree",   format: "newick",                  data: asrRequest.tree},
                column:      {type: "string", format: "text",                    data: asrRequest.column},
                type:        {type: "string", format: "text",                    data: asrRequest.type},
                name_column: {type: "string", format: "text",                    data: "name"},
                method:      {type: "string", format: "text",                    data: "marginal"},
                
                // temporary hack to circumvent table conversion issue
                measurements_string: {type: "string", format: "text", data: asrRequest.measurements_string},
                names_string: {type: "string", format: "text", data: asrRequest.names_string},
            };
 
            var outputs = {
                res: {type: "table", format: "rows"},
                treePlot: {type: "image", format: "png.base64"}
            };

            console.log(inputs);
//            console.log(outputs);

            flow.performAnalysis(asrRequest.analysisId, inputs, outputs,
                _.bind(function (error, result) {
                    asrRequest.taskId = result._id;
                    setTimeout(_.bind(asrRequest.checkASRResult, asrRequest), 1000);
                }, asrRequest));

            asrRequest.checkASRResult = function () {
                var check_url = '/item/' + this.analysisId + '/romanesco/' + this.taskId + '/status'
                girder.restRequest({path: check_url}).done(_.bind(function (result) {
                    console.log(asrRequest);
                    console.log(result);
                    if (result.status === 'SUCCESS') {
                        // get result data
                        var result_url = '/item/' + this.analysisId + '/romanesco/' + this.taskId + '/result'
                        girder.restRequest({path: result_url}).done(_.bind(function (data) {

                            asrRequest.treePlot = data.result.treePlot.data;

                            // render tree plot
                            $("#asr-vis").image({ data: asrRequest.treePlot });
                            $("#send-asr-request").removeAttr("disabled");
                            $("#asr-notice").html("Ancestral state reconstruction succeeded!" + 
                                    ' <span class="glyphicon glyphicon-ok-circle"></span>');

//                            $('html, body').animate({
//                                scrollTop: $("#original-tree-vis").offset().top
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
        
        $("#select-continuous").click(function() {
            asrRequest.type = 'continuous';
            asrRequest.ready();
//            console.log(asrRequest);
//            $("#select-continuous").button('toggle')
        });

        $("#select-discrete").click(function() {
            asrRequest.type = 'discrete';
            asrRequest.ready();
//            console.log(asrRequest);
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
                asrRequest.ready();

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
                asrRequest.ready();
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

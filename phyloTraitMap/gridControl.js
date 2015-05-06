  var grid;
  var grid_columns;
  var grid_options;
  var grid_data;




// start scatterplot

// utility function to test for numeric attributes
function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

var brushCell;

var width = 960,
    size = 250,
    padding = 25;

var x = d3.scale.linear()
    .range([padding / 2, size - padding / 2]);

var y = d3.scale.linear()
    .range([size - padding / 2, padding / 2]);

var xAxis = d3.svg.axis()
    .scale(x)
    .orient("bottom")
    .ticks(5);

var yAxis = d3.svg.axis()
    .scale(y)
    .orient("left")
    .ticks(5);

var color = d3.scale.category10();


function loadScatterplot(data) {

  var domainByTrait = {}, traits = []

  // d3.keys(data[0]).filter(function(d) { return d !== "species"; })

  // clear out content from any previous scatterplot
  $('#morphplot').empty()

  // loop through and find only numeric traits.  We are checking only the first item, so we are assuming a dense character
  // matrix


  for (var attrib in data[0]) {
    if (isNumeric(data[0][attrib])) {
      traits.push(attrib)
    }
  }

/*
  for (var row in data) {
    for (var attrib in data[row]) {
      if (isNumeric(data[row][attrib]) && !(attrib in traits)) {
        traits.push(attrib)
      }
    }
  }
  */

  n = traits.length;

  n = traits.length;

  traits.forEach(function(trait) {
      domainByTrait[trait] = d3.extent(data, function(d) { return d[trait]; });
  });

  xAxis.tickSize(size * n);
  yAxis.tickSize(-size * n);

  var brush = d3.svg.brush()
      .x(x)
      .y(y)
      .on("brushstart", brushstart)
      .on("brush", brushmove)
      .on("brushend", brushend);

  var svg = d3.select("#morphplot").append("svg")
      .attr("width", size * n + padding)
      .attr("height", size * n + padding)
    .append("g")
      .attr("transform", "translate(" + padding + "," + padding / 2 + ")");

  svg.selectAll(".x.axis")
      .data(traits)
    .enter().append("g")
      .attr("class", "x axis")
      .attr("transform", function(d, i) { return "translate(" + (n - i - 1) * size + ",0)"; })
      .each(function(d) { x.domain(domainByTrait[d]); d3.select(this).call(xAxis); });

  svg.selectAll(".y.axis")
      .data(traits)
    .enter().append("g")
      .attr("class", "y axis")
      .attr("transform", function(d, i) { return "translate(0," + i * size + ")"; })
      .each(function(d) { y.domain(domainByTrait[d]); d3.select(this).call(yAxis); });

  var cell = svg.selectAll(".cell")
      .data(cross(traits, traits))
    .enter().append("g")
      .attr("class", "cell")
      .attr("transform", function(d) { return "translate(" + (n - d.i - 1) * size + "," + d.j * size + ")"; })
      .each(plot);

  // Titles for the diagonal.
  cell.filter(function(d) { return d.i === d.j; }).append("text")
      .attr("x", padding)
      .attr("y", padding)
      .attr("dy", ".71em")
      .text(function(d) { return d.x; });

  cell.call(brush);

  function plot(p) {
    var cell = d3.select(this);

    x.domain(domainByTrait[p.x]);
    y.domain(domainByTrait[p.y]);

    cell.append("rect")
        .attr("class", "frame")
        .attr("x", padding / 2)
        .attr("y", padding / 2)
        .attr("width", size - padding)
        .attr("height", size - padding);

    cell.selectAll("circle")
        .data(data)
      .enter().append("circle")
        .attr("cx", function(d) { return x(d[p.x]); })
        .attr("cy", function(d) { return y(d[p.y]); })
        .attr("r", 3)
        .style("fill", function(d) { return color(d.species); });
  }


  // Clear the previously-active brush, if any.
  function brushstart(p) {
    if (brushCell !== this) {
      d3.select(brushCell).call(brush.clear());
      x.domain(domainByTrait[p.x]);
      y.domain(domainByTrait[p.y]);
      brushCell = this;
    }
  }

  // Highlight the selected circles.
  function brushmove(p) {
    var e = brush.extent();
    svg.selectAll("circle").classed("hidden", function(d) {
      return e[0][0] > d[p.x] || d[p.x] > e[1][0]
          || e[0][1] > d[p.y] || d[p.y] > e[1][1];
    });
  }

  // If the brush is empty, select all circles.
  function brushend() {
    if (brush.empty()) svg.selectAll(".hidden").classed("hidden", false);
  }

  function cross(a, b) {
    var c = [], n = a.length, m = b.length, i, j;
    for (i = -1; ++i < n;) for (j = -1; ++j < m;) c.push({x: a[i], i: i, y: b[j], j: j});
    return c;
  }

  d3.select(self.frameElement).style("height", size * n + padding + 20 + "px");
}


// end scatterplot 




function updateTableDisplay(studyList) {

  var attrib;
    grid_columns = [];
    var thisObject;
    var attriblist = [];
    var dataobject;
    for (i=0; i<studyList.length; i++) {
        dataobject = studyList[i]
        for (attrib in dataobject) {
            // if this attribute is not already stored in our array, then add it
            if (attriblist.indexOf(attrib)<0) {
                grid_columns.push( {id: attrib, name: attrib, field: attrib} ) 
                attriblist.push(attrib)
            }
        }
    }

  // introspect to find the attributes for the table columns
  //grid_columns = []
  // for (var attrib in studyList[0]) {
  //grid_columns.push( {id: attrib, name: attrib, field: attrib} )  
 // }

  // global options for SlickGrid
  grid_options = {
    enableCellNavigation: true,
    enableColumnReorder: false,
    forceFitColumns: false,
    fullWidthRows: true
  };

  // draw the scatterplot for the selected data, if it has been enabled
  if (scatterplotEnabled == true) {
    loadScatterplot(studyList)
  }

  // re-instantiate the grid each time, it didn't seem to update correctly using the invalidate()
  // method, so safer to start afresh each time
  grid = new Slick.Grid("#tablecontent", studyList, grid_columns, grid_options);
 
}



// Run Romanesco Step
//
// this function takes the name of the hovered entry, queries a data table through romanesco, and graphs 
// the corresponding detail in the UI using vega.  It is called each time a hover occurs over an entity on the map. This
// is a heavy activity to be performing on hover, but it is instructive to see how to invoke romanesco processing. Since 
// the romanesco step could take awhile, a checkQueryResult() routine is called after a 1/2 second

function updateDrillDownDataDisplay() {
  var entry = phylomap.selectedOccurrences[phylomap.pickedId]
  console.log('entry to process: ',entry)
  var inputs = {
                inputTable:  {type: "table",  format: "rows",   data: phylomap.awsData},
                operation:   {type: "string", format: "text",   data: "EqualTo"},
                columnname: {type: "string", format: "text",    data: "stationName"},
                testvalue:   {type: "string", format: "text",   data: entry.name}
            };
    var outputs = {
                outTable:  {type: "table",  format: "rows"}
            };
  console.log('analysis inputs=',inputs)
    window.flow.performAnalysis(phylomap.filterAnalysis, inputs, outputs,
        _.bind(function (error, result) {
            phylomap.taskId = result.id;
            setTimeout(_.bind(checkQueryResult, window.app), 500);
            
        }, window.app));
}


// this checks the status of a running Romanesco job.  The status value returned is examined and action is taken
// to render the result, print out a failure console message, or wait another period and re-request status. 

checkQueryResult = function () {
    var check_url = '/item/' + phylomap.filterAnalysis + '/romanesco/' + phylomap.taskId + '/status'
    girder.restRequest({path: check_url}).done(_.bind(function (result) {
        console.log(result.status);
        if (result.status === 'SUCCESS') {
            // get result data
            var result_url = '/item/' + phylomap.filterAnalysis  + '/romanesco/' + phylomap.taskId  + '/result'
            girder.restRequest({path: result_url}).done(_.bind(function (data) {
              //console.log("filtered result:",data.result.outTable.data.rows)
                // render AWS station plot in Vega
          parseVegaSpec("vegaBarChartSpec.json",{rows: data.result.outTable.data.rows},"#vega-content");
                $("#notice").text("AWS station lookup succeeded!");
                //$('html, body').animate({
                //    scrollTop: $("#tablecontent").offset().top
                //}, 1000);
            }, this));

        } else if (result.status === 'FAILURE') {
            $("#notice").text("AWS station lookup failed. " + result.message);
        } else {
          // no answer yet, so wait an interval and check again.  250 = 250ms = 1/4 second
            setTimeout(_.bind(checkQueryResult, this), 500);
        }
    }, this));
};




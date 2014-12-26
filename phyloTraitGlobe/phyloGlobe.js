function addLoadEvent(func) {
	var oldonload = window.onload;
	if (typeof window.onload != 'function') {
		window.onload = func;
	} else {
		window.onload = function() {
			if (oldonload) {
				oldonload();
			}
			func();
		}
	}
}

function log(msg) {
    setTimeout(function() {
        throw new Error(msg);
    }, 0);
}

function clearLocations() {
	infoWindow.close();
	for (i in markers) {
		markers[i].setMap(null);
		// CRL
		delete markerColorIndex[i];
	}
	markers.length = 0;
	markerIndex = {};
	for (i in overlays) {
		overlays[i].setMap(null);
	}
	// set index to last item so it will reset on next element
	iconIndex = 0;

	// clear occurrence compilation list
	phylomap.selectedOccurrences = []
	updateTableDisplay(phylomap.selectedOccurrences)
}

// Can create serious problems as it doesn't delete markerIndex references!
function clearOneLocation(index) {
	var marker = markers[index];
	if (marker) {
		marker.setMap(null);
	}
	delete markers[index];
}

function clearOneId(id) {
	// if a marker has ID = id
	if (typeof markerIndex[id] != "undefined") {
		markerIndex[id].forEach(function(d) {
			clearOneLocation(d);
		});
		delete markerIndex[id];
	}
}

// returns true if there is at least 1 marker on the map with ID = _id
function markerExists(id) {
	if (typeof markerIndex[id] != "undefined" && markerIndex[id].length > 0)
		return true;
	else
		return false;
}


// ---- build node lists to aid traversal, finding locations or matching nodes

function addTaxaToTaxaList(treenode) {
  if ('children' in treenode) {
  	// case for intermediate nodes, continue traversal
  	for (var i=0;i<treenode.children.length;i++) {
  		addTaxaToTaxaList(treenode.children[i])
  	}
  } else {
  	// case for a taxon
  	phylomap.taxalist.push(treenode)
  }
}

// this is a pre-processing function that is called once each time a tree is loaded.  It runs throgh
// the tree and builds a list of all nodes, so searching doesn't have to involve recursive searching 
// each time.  The routine assumes phylomap.currentTree is valid.

function addAllNodesToAllNodeList(treenode) {
  phylomap.allnodelist.push(treenode)
  if ('children' in treenode) {
  	// case for intermediate nodes, continue traversal
  	for (var i=0;i<treenode.children.length;i++) {
  		addAllNodesToAllNodeList(treenode.children[i])
  	}
  }
}

// this is a pre-processing function that is called once each time a tree is loaded.  It runs throgh
// the tree and builds a list of the taxa, so searching doesn't have to involve recursive searching 
// each time.  The routine assumes phylomap.currentTree is valid.

function processTreeForMapLocations() {
	// clear out the previous list if there is one
	while (phylomap.taxalist.length > 0) {
		phylomap.taxalist.pop()
	}
	while (phylomap.allnodelist.length > 0) {
		phylomap.allnodelist.pop()
	}
	// start a recursive traversals to build lists of just taxa and of all the nodes for use later
	addTaxaToTaxaList(phylomap.currentTree)
	addAllNodesToAllNodeList(phylomap.currentTree)
	//console.log(phylomap.taxalist)
}


//------ end of build node lists

function searchLocationsNear(searchUrl) {
	d3.json(searchUrl, function(json) {
		var icon = getIcon();
		var bounds = new google.maps.LatLngBounds();
		json.result.data.forEach(function(d){
			var name = d.name;
			var id = d.ID.$oid;
			var latlng = new google.maps.LatLng(
				parseFloat(d.lat),
				parseFloat(d.lng));
			var text = "location: " + latlng + "<br>id: " + id;
			createMarker(latlng, name, text, id, icon);
			bounds.extend(latlng);
		});
	});
}

// The next few routines below are involved in handling circles drawn on the map by the user. 
//  These routines check for observation points that lie within the radius of the drawn circle. 

// determine if a point (lat,lng) is inside the circle with center clat,clng, and given radius
function pointInCircle(lat,lng,clat,clng,radius) {
	var KPiDouble = 3.141592654
	var KDegreesToRadiansDouble = 0.01745329  // KPiDouble / 180.0
	var earthRadius = 6378137 // in meters
	clng = clng * KDegreesToRadiansDouble
	clat = clat * KDegreesToRadiansDouble
	var cradius = radius / earthRadius
	var lng = lng * KDegreesToRadiansDouble
	var lat = lat * KDegreesToRadiansDouble
	var angle = Math.acos(Math.sin(clat) * Math.sin(lat) + Math.cos(clat) * Math.cos(lat) * Math.cos(lng - clng))
	var decision = (angle < cradius)
	//if (decision) {
	//	console.log(lat,lng,clat,clng,angle,cradius,(angle < cradius))
    //}
	return decision
}

// This call adds markers to the map for all occurrence points within the boundaries of a circle. 
function searchLocationsNearCircle(lat,lon,radius) {
	var icon = getIcon();
	var bounds = new google.maps.LatLngBounds();
	// look through all taxa in precompiled list
	for (var i=0;i<phylomap.taxalist.length;i++) {
		var name = phylomap.taxalist[i].node_data['node name'];
		var id = phylomap.taxalist[i].node_data['nodeid'];
		if ('loc' in phylomap.taxalist[i].node_data) {
			for (var j = phylomap.taxalist[i].node_data['loc'].length - 1; j >= 0; j--) {
				var point =  phylomap.taxalist[i].node_data['loc'][j]
				// if this point is inside the target circle, then add a marker
				if (pointInCircle(point[1],point[0],lat,lon,radius)) {
					var latlng = new google.maps.LatLng(
						parseFloat(point[1]),
						parseFloat(point[0]));
					// the id field is used internally to phylomap for highlighting, it doesn't
					// need to be displayed to the user generally
					//var text = "species: " + name + " <br>id: " + id;
					var text = "species: " + name ;	
					// add other attributes to display tag if they are present in the taxon nodes
					var attribs = []
					if ('attributes' in phylomap.taxalist[i].node_data) {
						if (phylomap.taxalist[i].node_data['attributes'].length >= j) {
							attribs = phylomap.taxalist[i].node_data['attributes'][j]
							// add descriptions to the text markers
							for (var attrib in attribs) {
								text = text + ' [' + attrib+']:'+attribs[attrib]
							};
						}
					}
					createMarker(latlng, name, text, id, icon);
					addLocationToSelectedList(phylomap.taxalist[i],attribs,point[1],point[0])
					bounds.extend(latlng);
					var colorToUse = getIconColor()
	        		highlightPath(phylomap.taxalist[i],phylomap.currentTree,colorToUse)
				}
			}
		}
	}
	updateTableDisplay(phylomap.selectedOccurrences)
}


function addLocationToSelectedList(node,attribs,lat,lon) {
    console.log('adding node to selection list.  Length now:',phylomap.selectedOccurrences.length)
    var record = {}
    // if there are extra attributes on this node, copy them over to the trait matrix selection entry
    for (attrib in attribs) {
    	record[attrib] = attribs[attrib]
    }
    record['lat'] = lat
    record['lon'] = lon
    record['species'] = node.node_data['node name']
    phylomap.selectedOccurrences.push(record)
}


function findNodeInTreeByNodeId(currentTreeNode, nodeID) {
	for (var i = phylomap.allnodelist.length - 1; i >= 0; i--) {
		if (phylomap.allnodelist[i].node_data['nodeid'] == nodeID) {
			return phylomap.allnodelist[i]
		}
	}
}


function mapSingleNode(treeNode, rootNode,icon,selectionID) {
	var bounds = new google.maps.LatLngBounds();
	var name = treeNode.node_data['node name'];
	//console.log('map single node of id=',id, treeNode)

	// if this node has locations, then add them to the map
	if ('loc' in treeNode.node_data) {
		for (var i = 0; i< treeNode.node_data['loc'].length; i++) {
			var thisloc = treeNode.node_data['loc'][i]
			var latlng = new google.maps.LatLng(
				parseFloat(thisloc[1]),
				parseFloat(thisloc[0]));
			var text = "species: " + name + "<br>id: " + selectionID;
			// add other attributes to display tag if they are present in the taxon node
			var attribs = []
			if ('attributes' in treeNode.node_data) {
				if (treeNode.node_data['attributes'].length >= i) {
					attribs = treeNode.node_data['attributes'][i]
					// add descriptions to the text markers
					for (var attrib in attribs) {
						text = text + ' [' + attrib+']:'+attribs[attrib]
					};
				}
			}
			createMarker(latlng, name, text, selectionID, icon);
			//bounds.extend(latlng);
			addLocationToSelectedList(treeNode,attribs,thisloc[1],thisloc[0])		
		};
	}
}


// recursive traversal of the current tree to uncover all nodes below the passed node and
// map them.  The clade root is passed so highlighting can be performed by lighting nodes between 
// the clade root and the current node

// *** had to use _children instead of children because of how the accessor algorithm 
// in phylotree re-names the attributes.  This search might fail sometimes, so testing
// for valid children references under either name

function mapAllNodesInClade(treeNode, cladeRootNode,icon,selectionID) {
	//console.log('mapping everything below node:',treeNode.node_data['nodeid'])
		// highlight the path on the tree between the rootId and this node if a valid id was passed
	if (treeNode != null) {
			var id = cladeRootNode.node_data['nodeid'];
	        var colorToUse = getIconColor(id)
	        highlightLimitedPath(treeNode,cladeRootNode,colorToUse)
	}

	if (('_children' in treeNode) && (treeNode._children.length>0)) {
		for (var i = treeNode._children.length - 1; i >= 0; i--) {
			mapAllNodesInClade(treeNode._children[i], cladeRootNode,icon,selectionID)
		}
	} else if (('children' in treeNode) && (treeNode.children.length>0)) {
			//console.log('mapAllNodesInClade: traversing -children- attribute to follow clade')
			for (var i = treeNode.children.length - 1; i >= 0; i--) {
				mapAllNodesInClade(treeNode.children[i], cladeRootNode,icon,selectionID)
			}
	} else {
		// we have reached the bottom of the hierarchy, write out the locations to the map
		// 
		mapSingleNode(treeNode, cladeRootNode,icon,selectionID)
	}
}

// This search is used only during highlight of entire clade.  
// Processing moved from a service to inline javascript when integrated with Arbor/TangeloHub. 
// the data element returned in the clicked node is a <g> element, so we need to look inside its
// '__data__' attribute to find the actual tree node record.  This 

function searchLocationsNearClade(selectedNode, callback) {
	var selectedNodeID = selectedNode.node_data['nodeid']
	//console.log("highlight clade below node id",selectedNodeID);
	// find the node with the id that matches the one the user clicked on
	rootOfClade = findNodeInTreeByNodeId(phylomap.currentTree, selectedNodeID)
	// traverse tree recursively, adding all locations in all taxa below this.  We create the
	// icon here so each selection maps to just one type of icon
	var icon = getIcon(selectedNodeID);
	mapAllNodesInClade(rootOfClade, rootOfClade, icon, selectedNodeID)
	updateTableDisplay(phylomap.selectedOccurrences)
	// run the callback if one was passed.  Use for setting and clearing processing badge
	if (callback != null) callback();
}

function getIcon(nodeid) {
	if (typeof iconIndex === "undefined" || iconIndex == null || iconIndex == iconList.length) {
		iconIndex = 0;
	} 

	return iconList[iconIndex++];
}

// CRL : since iconIndex is incremented immediately after each use, we handle the wraparound case and
// generate a lagging index value.  Don't know why we have to adjust this, thought we caught the index
// before it it was incremeneted

function adjustColorIndex(index) {
    if (index>0) {
        return (index-1)
        }
    else {
        return (iconList.length-1)
        }
}

// CRL: lookup the color of the tree highlight by retrieving the color of the corresponding
// map icon and adjusting it (why adjustment needed?)

function getIconColor(id) {
    var colorToUse;

    // if this has been called before any markers are created for this node, set the indexes appropriately
    if (typeof markerColorIndex[id] == "undefined") {
    	markerColorIndex[id] = iconIndex;
    }
    colorToUse = treeHighlightColorList[adjustColorIndex(markerColorIndex[id])];
    //console.log("getIconColor: id=",id," markerColorIndex=",markerColorIndex[id]," treeColor=",colorToUse)
    return colorToUse
}


 function addCesiumPointBillboard(scene, ellipsoid) {
        // A white circle is drawn into a 2D canvas.  The canvas is used as
        // a texture for billboards, each of which applies a different color
        // and scale to change the point's appearance. The 2D canvas can draw much more than circles. 
        //  See: https://developer.mozilla.org/en/Canvas_tutorial
        var canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        var context2D = canvas.getContext('2d');
        context2D.beginPath();
        context2D.arc(8, 8, 8, 0, Cesium.Math.TWO_PI, true);
        context2D.closePath();
        context2D.fillStyle = 'rgb(255, 255, 255)';
        context2D.fill();

        phylomap.cesium.billboards = new Cesium.BillboardCollection();
        var textureAtlas = scene.createTextureAtlas({
            image : canvas
        });
        phylomap.cesium.billboards.textureAtlas = textureAtlas;
        phylomap.cesium.scene.primitives.add(phylomap.cesium.billboards);
}


 function addPointToCesiumBillboard(scene, ellipsoid,lng,lat) {
   	var canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
      	var context2D = canvas.getContext('2d');
        context2D.beginPath();
        context2D.arc(8, 8, 8, 0, Cesium.Math.TWO_PI, true);
        context2D.closePath();
        context2D.fillStyle = 'rgb(255, 255, 255)';
        context2D.fill();

        phylomap.cesium.billboards = new Cesium.BillboardCollection();

        phylomap.cesium.billboards.add({
            position : ellipsoid.cartographicToCartesian(Cesium.Cartographic.fromDegrees(lng,lat)),
            color : Cesium.Color.RED,
            scale : 0.5,
            image : canvas,
            imageIndex : 0
        });
        phylomap.cesium.scene.primitives.add(phylomap.cesium.billboards);
}


function createMarker(latlng, name, text, id, icon) {
	var html = "<b>" + name + "</b><br>" + text;
	// save the color of this icon in a color index array
	markerColorIndex[id] = iconIndex;
	//console.log('saving marketColorIndex[',id,'] = ',iconIndex)
	icon = ((icon != null) ? icon : getIcon());

	// add point to the cesium globe view
	addPointToCesiumBillboard(
			phylomap.cesium.scene,
			phylomap.cesium.ellipsoid,
			latlng.lng(),
			latlng.lat()
		);

	// still create a GMap marker for compatibility
	var marker = new google.maps.Marker({
		map: map,
		position: latlng,
		icon: icon
	});

	// store in index the id/markerIndex key/value pair, easier to delete later.
	if (typeof markerIndex[id] === "object") {
		markerIndex[id].push(markers.length);
	} else {
		markerIndex[id] = [markers.length];
	}
	markers.push(marker);

}

function createMarker_orig(latlng, name, text, id, icon) {
	var html = "<b>" + name + "</b><br>" + text;
	// save the color of this icon in a color index array
	markerColorIndex[id] = iconIndex;
	//console.log('saving marketColorIndex[',id,'] = ',iconIndex)
	icon = ((icon != null) ? icon : getIcon());

	// add point to the cesium globe view
	addPointToCesiumBillboard(
			phylomap.cesium.scene,
			phylomap.cesium.ellipsoid,
			latlng.lng(),
			latlng.lat()
		);

	// still create a GMap marker for compatibility
	var marker = new google.maps.Marker({
		map: map,
		position: latlng,
		icon: icon
	});

	// store in index the id/markerIndex key/value pair, easier to delete later.
	if (typeof markerIndex[id] === "object") {
		markerIndex[id].push(markers.length);
	} else {
		markerIndex[id] = [markers.length];
	}
	markers.push(marker);

}


function highlightParents (node, color, size) {
	// ensure our helper functions were included
	if (typeof highlightPath != 'undefined' && typeof nodeFromId != 'undefined') {
		if (node[0].length > 0) {
			highlightPath(node.datum(), color, size);
		}
	}
}

var map;
var clickedOn;
var mapOptions;
var overlays = [];
var markers = [];
var markerColorIndex = [];
var markerIndex = {};
var infoWindow;
var locationSelect;
var phylotree = {};
var iconIndex = 0;
var iconList = [
	'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
	'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
	'http://maps.google.com/mapfiles/ms/icons/green-dot.png',
	'http://maps.google.com/mapfiles/ms/icons/orange-dot.png',
	'http://maps.google.com/mapfiles/ms/icons/pink-dot.png',
	'http://maps.google.com/mapfiles/ms/icons/ltblue-dot.png',
	'http://maps.google.com/mapfiles/ms/icons/purple-dot.png',
	'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png',
	'http://maps.google.com/mapfiles/ms/icons/red-pushpin.png',
	'http://maps.google.com/mapfiles/ms/icons/blue-pushpin.png',
	'http://maps.google.com/mapfiles/ms/icons/grn-pushpin.png',
	'http://maps.google.com/mapfiles/ms/icons/pink-pushpin.png',
	'http://maps.google.com/mapfiles/ms/icons/ltblu-pushpin.png',
	'http://maps.google.com/mapfiles/ms/icons/purple-pushpin.png',
	'http://maps.google.com/mapfiles/ms/icons/ylw-pushpin.png',
]

// adding matching hightlight colors to match the icons, so the tree hightlight color matches the icon color
var treeHighlightColorList = [ "red","blue","green","orange","pink","lightblue","purple","yellow","red","blue","green","pink","lightblue","purple","yellow"]
/*
phylomap.getMongoDBInfo = function () {
    "use strict";

    // Read in the config options regarding which MongoDB
    // server/database/collection to use.
    return {
        server: localStorage.getItem('phylomap:mongodb-server') || 'localhost',
        db: localStorage.getItem('phylomap:mongodb-db') || 'xdata',
        coll: localStorage.getItem('phylomap:mongodb-coll') || 'anolis'
    };
};

phylomap.updateConfig = function() {
	"use strict";

	var server,
		db,
		coll;

	// Grab the elements
	server = document.getElementById("mongodb-server");
	db = document.getElementById("mongodb-db");
	coll = document.getElementById("mongodb-coll");

	// Write the options into DOM storage.
	localStorage.setItem('phylomap:mongodb-server', server.value);
	localStorage.setItem('phylomap:mongodb-db', db.value);
	localStorage.setItem('phylomap:mongodb-coll', coll.value);
};

phylomap.setConfigDefaults = function () {
    "use strict";

    var cfg;

    // Clear out the locally stored options.
    localStorage.removeItem('phylomap:mongodb-server');
    localStorage.removeItem('phylomap:mongodb-db');
    localStorage.removeItem('phylomap:mongodb-coll');

    // Retrieve the new config values, and set them into the fields.
    cfg = phylomap.getMongoDBInfo();
    d3.select("#mongodb-server").property("value", cfg.server);
    d3.select("#mongodb-db").property("value", cfg.db);
    d3.select("#mongodb-coll").property("value", cfg.coll);
};
*/

//function load() {

addLoadEvent(function () {
	    phylomap.cesium.viewer = new Cesium.Viewer('cesiumContainer');
	    phylomap.cesium.scene = phylomap.cesium.viewer.scene;
    	phylomap.cesium.ellipsoid = phylomap.cesium.scene.globe.ellipsoid;
    	//addCesiumPointBillboard(phylomap.cesium.scene,phylomap.cesium.ellipsoid)
});

var map, featureList, tree, tree_nodes = [], boroughSearch = [], okmapsSearch = [], museumSearch = [], timeline_added = false, featuresTemp = [];
var CONTAINS_BOOST = 100, CONTAINS_CENTROID_BOOST = 10, INTERSECTS_BOOST = 1;
var MAP_PIXEL_AREA;
var CARTO_USER = "krdyke";
var TABLE_NAME = "bbox_test_set3";
var PER_PAGE = 100;
var QUERY_URL = "https://{username}.carto.com/api/v2/sql?q=".replace("{username}", CARTO_USER);
//var carto_fields = ["the_geom", "title", "title_article_split",
//    "subject_headings", "url", "year_start", "year_end", "city","county"];
var TABLE_FIELDS = ["the_geom", "title", "cartodb_id", "original_date","contentdm_number"];
var BASE_URL = "SELECT {fields} FROM {table_name}";
var IMAGE_URL = "http://dc.library.okstate.edu/utils/ajaxhelper/?CISOROOT=OKMaps&CISOPTR={{contentdm_number}}&action=2&DMSCALE=100&DMWIDTH={{width}}&DMHEIGHT={{height}}&DMX=0&DMY=0&DMTEXT=&DMROTATE=0";


var carto_url = BASE_URL
    .replace("{table_name}", TABLE_NAME)
    .replace("{fields}", TABLE_FIELDS.join(", "));

var sql = function(query, callback, format){
        var format_str = '';
        if (format){
            format_str = "&format=" + format;
        }
        else {
            format_str = "&format=geojson";
        }
        return $.ajax({
            url: QUERY_URL + encodeURIComponent(query) + format_str,
            type: "GET",
            dataType: "json",
            success: callback,
            error: function(err){
                console.log(err);
            }
        });
    };

$(window).resize(function() {
  sizeLayerControl();
});

$(document).on("click", ".feature-row", function(e) {
  $(document).off("mouseout", ".feature-row", clearHighlight);
  sidebarClick(parseInt($(this).attr("data-id"), 10));
});

if ( !("ontouchstart" in window) ) {
  $(document).on("mouseover", ".feature-row", function(e) {
    var bbox_str = $(this).attr("data-bbox");
    var a = bbox_str.split(","); 
    var b = L.latLngBounds([a[1],a[0]], [a[3],a[2]]);
    var rect = L.rectangle(b, highlightStyle);
    highlight.clearLayers().addLayer(rect);
    // var pt1 = map.latLngToLayerPoint([a[1],a[0]]);
    // var pt2 = map.latLngToLayerPoint([a[3],a[2]]);
    // var w = Math.abs(pt2.x - pt1.x);
    // var h = Math.abs(pt1.y - pt2.y);
    // var imageUrl = IMAGE_URL.replace("{{contentdm_number}}",$(this).attr("data-cdm"))
    //   .replace("{{height}}", h)
    //   .replace("{{width}}", w);
    // L.imageOverlay(imageUrl, b).addTo(map);
  });
}

$(document).on("mouseout", ".feature-row", clearHighlight);

$("#about-btn").click(function() {
  $("#aboutModal").modal("show");
  $(".navbar-collapse.in").collapse("hide");
  return false;
});

$("#full-extent-btn").click(function() {
  map.fitBounds(okmaps.getBounds());
  $(".navbar-collapse.in").collapse("hide");
  return false;
});

$("#timeline-btn").click(function() {
    if (!timeline_added){
        //markerClusters.removeLayer(okmaps);

        timeline = L.timeline(okmaps_geojson, {

            onEachFeature: function (feature, layer) {
                    if (feature.properties) {
                      var content = "<table class='table table-striped table-bordered table-condensed'>" +
                        "<tr><th>Name</th><td>" + feature.properties.title + "</td></tr>" +
                        "<tr><th>Year</th><td>" + new Date(feature.properties.original_date).getUTCFullYear() +
                        "</td></tr></table>";

                      layer.on({
                        click: function (e) {
                          $("#feature-title").html(feature.properties.title);
                          $("#feature-info").html(content);
                          $("#featureModal").modal("show");
                          addToHighlight(feature);
                        }
                      });
                      $("#feature-list tbody").append('<tr class="feature-row" id="' + L.stamp(layer) +
                        '" lat="' + layer.getLatLng().lat + '" lng="' + layer.getLatLng().lng +
                        '"><td style="vertical-align: middle;"></td><td class="feature-name">' +
                         layer.feature.properties.title + '</td><td style="display:none;" class="feature-sort-name">'+layer.feature.properties.title_article_split+'</td><td style="vertical-align: middle;"><i class="fa fa-chevron-right pull-right"></i></td></tr>');

                      okmapsSearch.push({
                        name: layer.feature.properties.title,
                        source: "Newspapers",
                        id: L.stamp(layer),
                        lat: layer.feature.geometry.coordinates[1],
                        lng: layer.feature.geometry.coordinates[0]
                      });
                    }
                  },
            drawOnSetTime: false,
            markerClusterGroup: markerClusters,
            getInterval: function(feature){
                return {
                    "start": new Date(feature.properties.year_start),
                    "end": new Date(feature.properties.year_end)
                };
            }
        });

        timeline.updateDisplayedLayers =  function updateDisplayedLayers() {
          var _this3 = this;
          var features = this.ranges.lookup(this.time);
          this.clearLayers();
          features.forEach(function (feature) {
            _this3.addData(feature);
          });
          //if (this.markerClusterGroup){
          //  markerClusters.clearLayers();
          //  _this3.markerClusterGroup.addLayers(_this3.getLayers());
          // this.markerClusterGroup.refreshClusters();
          //}
        };

        timeline_control = L.timelineSliderControl({
            formatOutput: function(date){
              var d = new Date(date).getUTCFullYear();
              return d;
            },
            enablePlayback: false,
            waitToUpdateMap: true
        });

        // timeline.on("click", function(e){
        //     var feature = e.layer.feature;
        //         var content = "<table class='table table-striped table-bordered table-condensed'>" +
        //           "<tr><th>Name</th><td>" + feature.properties.title + "</td></tr>" +
        //           "<tr><th>Years</th><td>" + moment(new Date(feature.properties.year_start)).format("YYYY") + " - "+
        //           moment(new Date(feature.properties.year_end)).format("YYYY")+ "</td></tr>" +
        //           "<tr><th>URL</th><td style='word-break:break-word;'><a href="+feature.properties.url +">"+ feature.properties.url +
        //           "</a></td></tr>{kw}<table>";
        //       //only show headings row if there are some to show!
        //       if (feature.properties.subject_headings !== ""){
        //           content = content.replace("{kw}", "<tr><th>Keywords</th><td>" +
        //           feature.properties.subject_headings + "</td></tr>");
        //       }
        //       else {
        //           content = content.replace("{kw}","");
        //       }
        //     $("#feature-title").html(feature.properties.title);
        //     $("#feature-info").html(content);
        //     $("#featureModal").loginModal("show");
        // });

        timeline.on("change", function(e){
          this.updateDisplayedLayers();
          syncSidebar();
        });
        map.addLayer(timelineLayer);
        //markerClusters.addLayer(timeline);
        timeline_control.addTo(map);
        timeline_control.addTimelines(timeline);
        timeline_added = true;
        syncSidebar();
        return false;
    }
    else {
        //markerClusters.removeLayer(timeline);
        map.removeLayer(timelineLayer);
        //markerClusters.addLayer(okmaps);
        timeline_control.removeFrom(map);
        timeline_added = false;
        syncSidebar();
    }

});

$("#legend-btn").click(function() {
  $("#legendModal").modal("show");
  $(".navbar-collapse.in").collapse("hide");
  return false;
});

$("#login-btn").click(function() {
  $("#loginModal").modal("show");
  $(".navbar-collapse.in").collapse("hide");
  return false;
});

$("#list-btn").click(function() {
  animateSidebar();
  return false;
});

$("#nav-btn").click(function() {
  $(".navbar-collapse").collapse("toggle");
  return false;
});

$("#sidebar-toggle-btn").click(function() {
  animateSidebar();
  return false;
});

$("#sidebar-hide-btn").click(function() {
  animateSidebar();
  return false;
});

function addToHighlight(feature){
  highlight.clearLayers().addData(feature).setStyle(highlightStyle);
}

function animateSidebar() {
  $("#sidebar").animate({
    width: "toggle"
  }, 350, function() {
    map.invalidateSize();
  });
}

function sizeLayerControl() {
  $(".leaflet-control-layers").css("max-height", $("#map").height() - 50);
}

function clearHighlight() {
  highlight.clearLayers();
}

function sidebarClick(id) {
  var layer = okmaps.getLayer(id);
  //map.fitBounds(layer.getBounds());
  layer.fire("click");
  /* Hide sidebar and go to the map on small screens */
  if (document.body.clientWidth <= 767) {
    $("#sidebar").hide();
    map.invalidateSize();
  }
}

function filterRankFeatures(){
  var f,fbbox,fcent,dist;
  var bbox = map.getBounds();
  var bbox_area = getBoundsArea(bbox);
  var cent = bbox.getCenter();
  
  intersecteds = tree.search(boundsToRbush(bbox));
  var i = intersecteds.length - 1;
  for (i; i >= 0; i--){
    f = okmaps.getLayer(intersecteds[i].leaflet_id);
    fbbox = f.getBounds();
    fbbox_area = getBoundsArea(fbbox);
    fcent = fbbox.getCenter();
    dist = cent.distanceTo(fcent);

    if (bbox.contains(fbbox)){
     f.feature.properties.spatialScore = Math.abs(1 - (fbbox_area/bbox_area));   
     addtoFeatureList(f);
    }

    else if (bbox.contains(fcent)){
      f.feature.properties.spatialScore = Math.abs(1 - (fbbox_area/bbox_area)) + dist;
      addtoFeatureList(f);
    }
    
  }
  $("#loading").hide();
}

function filterRankFeatures2(){
  console.log("filterRankFeatures2");
  var f,fbbox,fcent,dist;
  var bbox = map.getBounds();
  var bbox_area = getBoundsArea(bbox);
  var cent = bbox.getCenter();
  var lyrs = okmaps.getLayers();
  //intersecteds = tree.search(boundsToRbush(bbox));
  var i = lyrs.length - 1;
  for (i; i >= 0; i--){
    f = lyrs[i];
    fbbox = f.getBounds();
    fbbox_area = getBoundsArea(fbbox);
    fcent = fbbox.getCenter();
    dist = cent.distanceTo(fcent);

    if (bbox.contains(fbbox)){
     f.feature.properties.spatialScore = Math.abs(1 - (fbbox_area/bbox_area));   
     addtoFeatureList(f);
    }

    else if (bbox.contains(fcent)){
      f.feature.properties.spatialScore = Math.abs(1 - (fbbox_area/bbox_area)) + dist;
      addtoFeatureList(f);
    }
    
  }
  $("#loading").hide();
}

function bboxStringToWKT(bbox_str){
  var bb = bbox_str.split(",");
  return "POLYGON((" + bb[0] + " " + bb[1] + "," + bb[0] + " " + bb[3]+
   "," + bb[2] + " " + bb[3]+ "," + bb[2] + " " + bb[1] +
   "," + bb[0] + " " + bb[1] + "))";
}

function buildFilterRankQuery(input_bounds, offset){
  var bbox_wkt = bboxStringToWKT(input_bounds.toBBoxString());
  var url = BASE_URL.replace("{username}", CARTO_USER)
    .replace("{table_name}", TABLE_NAME)
    .replace("{fields}", "cartodb_id");

  // var q = url + " WHERE ST_GeomFromText('" + bbox_wkt +"', 4326)"+
  //   " ~ the_geom  ORDER BY the_geom <#> ST_GeomFromText('" + bbox_wkt +
  //   "', 4326),st_area(the_geom) DESC LIMIT 100";

  var q = "select cartodb_id, sort_order from ((SELECT 1 as sort_order, cartodb_id FROM {{table_name}} as b1 WHERE ST_GeomFromText('" + 
    bbox_wkt + "', 4326) ~ the_geom ORDER BY st_area(the_geom) DESC) UNION ALL (SELECT 2 as sort_order, cartodb_id FROM {{table_name}} WHERE ST_Centroid(the_geom) @ ST_GeomFromText('" + 
    bbox_wkt + "', 4326) ORDER BY ST_Centroid(the_geom) <#> ST_GeomFromText('" + 
    bbox_wkt + "', 4326))) as foobar LIMIT " + PER_PAGE + " OFFSET " + offset;
  
  q = q.replace(/{{table_name}}/g, TABLE_NAME);

    return q;
}

function filterRankFeatures3(page_number){
  var offset = (page_number - 1) * PER_PAGE || 0;
  console.log("filterRankFeatures3");
  featuresTemp = [];
  var f,fbbox,fcent,dist;
  var bbox = map.getBounds();
    
  var q = buildFilterRankQuery(bbox, offset);
  
  return sql(q, function(d){
    var lyrs = okmaps.getLayers();
    var len = lyrs.length;
    var rows = d.rows;
    var ld = rows.length;
    console.log(ld + " rows");
    var cdb_id;

    var start, end;
    start = performance.now();
    for (var i = 0; i < ld; i++){

      cdb_id = rows[i].cartodb_id;
      for (var j = 0; j < len; j++){
        l = lyrs[j];
        if (cdb_id == l.feature.properties.cartodb_id){
          //addtoFeatureList(l);
          featuresTemp.push({
            "cdm": l.feature.properties.contentdm_number,
            "id": L.stamp(l),
            "bbox": l.getBounds().toBBoxString(),
            "feature-name": l.feature.properties.title,
            "feature-sort-name":l.feature.properties.original_date
          });
          break;
        }
      }
    }
    end = performance.now();
    console.log("matching by id:  "+ (end - start) + " milliseconds.");
    
  },"json");
  // var bbox_area = getBoundsArea(bbox);
  // var cent = bbox.getCenter();
  // var lyrs = okmaps.getLayers();
  //intersecteds = tree.search(boundsToRbush(bbox));
  // var i = lyrs.length - 1;
  // for (i; i >= 0; i--){
  //   f = lyrs[i];
  //   fbbox = f.getBounds();
  //   fbbox_area = getBoundsArea(fbbox);
  //   fcent = fbbox.getCenter();
  //   dist = cent.distanceTo(fcent);

  //   if (bbox.contains(fbbox)){
  //    f.feature.properties.spatialScore = Math.abs(1 - (fbbox_area/bbox_area));   
  //    addtoFeatureList(f);
  //   }

  //   else if (bbox.contains(fcent)){
  //     f.feature.properties.spatialScore = Math.abs(1 - (fbbox_area/bbox_area)) + dist;
  //     addtoFeatureList(f);
  //   }
    
  // }

}


function getBoundsArea(bounds){
  var sw = bounds.getSouthWest();
  var ne = bounds.getNorthEast();
  var se = L.latLng(sw.lat, ne.lng);
  var nw = L.latLng(ne.lat, sw.lng);
  return ne.distanceTo(nw) * ne.distanceTo(se);
}

function boundsToRbush(bounds){
  var sw = bounds.getSouthWest();
  var ne = bounds.getNorthEast();
  return {  
      minX:sw.lng,
      minY:sw.lat,
      maxX:ne.lng,
      maxY:ne.lat
  };
}

function addtoFeatureList(layer){
  $("#feature-list tbody").append('<tr class="feature-row" data-cdm="'+
   layer.feature.properties.contentdm_number + '" data-id="' + L.stamp(layer) +
     '" data-bbox="' + layer.getBounds().toBBoxString() + '"><td class="feature-name">' +
     layer.feature.properties.title + '</td><td class="feature-sort-name">' + 
     layer.feature.properties.original_date + '</td></tr>');
}

function syncSidebar() {
  console.log("syncSidebar");
  var start,start2,end,end2;
  /* Empty sidebar features */

  /* Loop through theaters layer and add only features which are in the map bounds */

  if (!timeline_added){
    
      // start2 = performance.now();
      // filterRankFeatures2(okmaps);
      // end2 = performance.now();
      // console.log("2:  "+ (end2 - start2) + " milliseconds.");

      start = performance.now();
      $("#loading").show();

      filterRankFeatures3(okmaps).then(function(){

        // featureList = new List("features", {
        //   valueNames: ["feature-name", "feature-sort-name","spatialScore"],
        //   page:50
        // });
        featureList.clear();
        featureList.add(featuresTemp);
        $(".sidebar-table").scrollTop(0);
        

        end = performance.now();
        console.log("3:  "+ (end - start) + " milliseconds.");
        $("#loading").hide();
      },function(err){
        console.log(err);
        $("#loading").hide();        
      });
     

      // okmaps.eachLayer(function (layer) {
      //   if (map.hasLayer(okmapsLayer)) {
      //     if (map.getBounds().contains(layer.getBounds())) {
      //       $("#feature-list tbody").append('<tr class="feature-row" id="' + L.stamp(layer) +
      //           '" bbox="' + layer.getBounds().toBBoxString() +
      //           '"><td style="vertical-align: middle;"><span class="fa fa-map"/></td><td class="feature-name">' +
      //           layer.feature.properties.title + '</td></tr>');
      //     }
      //   }
      // });
  }
    else {
      filterRankFeatures(timeline);
      // timeline.eachLayer(function (layer) {
      //   if (map.hasLayer(timelineLayer)) {
      //     if (map.getBounds().contains(layer.getLatLng())) {
      //       $("#feature-list tbody").append('<tr class="feature-row" id="' + L.stamp(layer) +
      //           '" bbox="' + layer.getBounds().toBBoxString() +
      //           '"><td style="vertical-align: middle;"><span class="fa fa-map"/></td><td class="feature-name">' +
      //           layer.feature.properties.title + '</td></tr>');
           
      //     }
      //   }
      // });

    }

  // /* Loop through museums layer and add only features which are in the map bounds */
  // museums.eachLayer(function (layer) {
  //   if (map.hasLayer(museumLayer)) {
  //     if (map.getBounds().contains(layer.getLatLng())) {
  //       $("#feature-list tbody").append('<tr class="feature-row" id="' + L.stamp(layer) + '" lat="' + layer.getLatLng().lat + '" lng="' + layer.getLatLng().lng + '"><td style="vertical-align: middle;"><img width="16" height="18" src="assets/img/museum.png"></td><td class="feature-name">' + layer.feature.properties.NAME + '</td><td style="vertical-align: middle;"><i class="fa fa-chevron-right pull-right"></i></td></tr>');
  //     }
  //   }
  // });

  /* Update list.js featureList */


}

/* Basemap Layers */
var cartoLight = L.tileLayer("https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://cartodb.com/attributions">CartoDB</a>'
});
var usgsImagery = L.layerGroup([L.tileLayer("http://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}", {
  maxZoom: 15,
}), L.tileLayer.wms("http://raster.nationalmap.gov/arcgis/services/Orthoimagery/USGS_EROS_Ortho_SCALE/ImageServer/WMSServer?", {
  minZoom: 16,
  maxZoom: 19,
  layers: "0",
  format: 'image/jpeg',
  transparent: true,
  attribution: "Aerial Imagery courtesy USGS"
})]);

/* Overlay Layers */
var highlight = L.geoJson(null);
var highlightStyle = {
  color: "#ff6600",
  weight: 1
};



// var boroughs = L.geoJson(null, {
//   style: function (feature) {
//     return {
//       color: "black",
//       fill: false,
//       opacity: 1,
//       clickable: false
//     };
//   },
//   onEachFeature: function (feature, layer) {
//     boroughSearch.push({
//       name: layer.feature.properties.BoroName,
//       source: "Boroughs",
//       id: L.stamp(layer),
//       bounds: layer.getBounds()
//     });
//   }
// });
// $.getJSON("data/boroughs.geojson", function (data) {
//   boroughs.addData(data);
// });

//Create a color dictionary based off of subway route_id
// var subwayColors = {"1":"#ff3135", "2":"#ff3135", "3":"ff3135", "4":"#009b2e",
//     "5":"#009b2e", "6":"#009b2e", "7":"#ce06cb", "A":"#fd9a00", "C":"#fd9a00",
//     "E":"#fd9a00", "SI":"#fd9a00","H":"#fd9a00", "Air":"#ffff00", "B":"#ffff00",
//     "D":"#ffff00", "F":"#ffff00", "M":"#ffff00", "G":"#9ace00", "FS":"#6e6e6e",
//     "GS":"#6e6e6e", "J":"#976900", "Z":"#976900", "L":"#969696", "N":"#ffff00",
//     "Q":"#ffff00", "R":"#ffff00" };
//
// var subwayLines = L.geoJson(null, {
//   style: function (feature) {
//       return {
//         color: subwayColors[feature.properties.route_id],
//         weight: 3,
//         opacity: 1
//       };
//   },
//   onEachFeature: function (feature, layer) {
//     if (feature.properties) {
//       var content = "<table class='table table-striped table-bordered table-condensed'>" + "<tr><th>Division</th><td>" + feature.properties.Division + "</td></tr>" + "<tr><th>Line</th><td>" + feature.properties.Line + "</td></tr>" + "<table>";
//       layer.on({
//         click: function (e) {
//           $("#feature-title").html(feature.properties.Line);
//           $("#feature-info").html(content);
//           $("#featureModal").modal("show");
//
//         }
//       });
//     }
//     layer.on({
//       mouseover: function (e) {
//         var layer = e.target;
//         layer.setStyle({
//           weight: 3,
//           color: "#00FFFF",
//           opacity: 1
//         });
//         if (!L.Browser.ie && !L.Browser.opera) {
//           layer.bringToFront();
//         }
//       },
//       mouseout: function (e) {
//         subwayLines.resetStyle(e.target);
//       }
//     });
//   }
// });
// $.getJSON("data/subways.geojson", function (data) {
//   subwayLines.addData(data);
// });

/* Single marker cluster layer to hold all clusters */
/*
var markerClusters = new L.MarkerClusterGroup({
  spiderfyOnMaxZoom: true,
  showCoverageOnHover: false,
  zoomToBoundsOnClick: true
 // disableClusteringAtZoom: 16
});
*/


/* Empty layer placeholder to add to layer control for listening when to add/remove okmaps to markerClusters layer */
var okmapsLayer = L.geoJson(null);
var timelineLayer = L.geoJson(null);
var okmaps = L.geoJson(null, {
  style: function(feature){
    return {
      color: "#ff6600",
      opacity: 0.1,
      weight:1,
      fill: true,
      fillColor:"#ff6600",
      fillOpacity:0.01
    };
  },
  onEachFeature: function (feature, layer) {

    if (feature.properties) {
      var thumb_url = "http://dc.library.okstate.edu/utils/getthumbnail/collection/OKMaps/id/" + feature.properties.contentdm_number;
      var ref_url = "http://dc.library.okstate.edu/cdm/ref/collection/OKMaps/id/"+ feature.properties.contentdm_number;
      var content = "<table class='table table-striped table-bordered table-condensed'>" +
        "<tr><td>Title</td><td>" + feature.properties.title.replace("'","&#39;") + "</td></tr><tr><td>Thumbnail</td><td>"+
        "<a target='_none' href='"+ref_url+"'><img alt= '"+feature.properties.title.replace("'","&#39;")+ "'src='"+
        thumb_url+"'/></a></td></tr><tr><td>Link</td><td><a href='"+ ref_url+ "'>Click for Details</a></td></tr></table>";

      layer.on({
        click: function (e) {
          $("#feature-title").html(feature.properties.title);
          $("#feature-info").html(content);
          $("#featureModal").modal("show");
          addToHighlight(feature);
        }
      });

     addtoFeatureList(layer);
      
      okmapsSearch.push({
        name: layer.feature.properties.title,
        source: "Maps",
        id: L.stamp(layer),
        bbox: layer.getBounds(),
      });
    }
  }
});
sql(carto_url, function (data) {
  okmaps_geojson = data;
  okmaps.addData(data);
  // okmaps.eachLayer(function(lyr){
  //   tree_nodes.push(L.extend({"leaflet_id": lyr._leaflet_id}, boundsToRbush(lyr.getBounds())));
  // });
  // tree = rbush();
  // tree.load(tree_nodes);
  featureList = new List("features", {
    valueNames: [{data:["cdm"]},
                 {data:["id"]}, 
                 {data:["bbox"]}, 
                 "feature-name", 
                 "feature-sort-name"]
   // page:50
   });

  map.addLayer(okmapsLayer);
});
//
// /* Empty layer placeholder to add to layer control for listening when to add/remove museums to markerClusters layer */
// var museumLayer = L.geoJson(null);
// var museums = L.geoJson(null, {
//   pointToLayer: function (feature, latlng) {
//     return L.marker(latlng, {
//       icon: L.icon({
//         iconUrl: "assets/img/museum.png",
//         iconSize: [24, 28],
//         iconAnchor: [12, 28],
//         popupAnchor: [0, -25]
//       }),
//       title: feature.properties.NAME,
//       riseOnHover: true
//     });
//   },
//   onEachFeature: function (feature, layer) {
//     if (feature.properties) {
//       var content = "<table class='table table-striped table-bordered table-condensed'>" + "<tr><th>Name</th><td>" + feature.properties.NAME + "</td></tr>" + "<tr><th>Phone</th><td>" + feature.properties.TEL + "</td></tr>" + "<tr><th>Address</th><td>" + feature.properties.ADRESS1 + "</td></tr>" + "<tr><th>Website</th><td><a class='url-break' href='" + feature.properties.URL + "' target='_blank'>" + feature.properties.URL + "</a></td></tr>" + "<table>";
//       layer.on({
//         click: function (e) {
//           $("#feature-title").html(feature.properties.NAME);
//           $("#feature-info").html(content);
//           $("#featureModal").modal("show");
//           highlight.clearLayers().addLayer(L.circleMarker([feature.geometry.coordinates[1], feature.geometry.coordinates[0]], highlightStyle));
//         }
//       });
//       $("#feature-list tbody").append('<tr class="feature-row" id="' + L.stamp(layer) + '" lat="' + layer.getLatLng().lat + '" lng="' + layer.getLatLng().lng + '"><td style="vertical-align: middle;"><img width="16" height="18" src="assets/img/museum.png"></td><td class="feature-name">' + layer.feature.properties.NAME + '</td><td style="vertical-align: middle;"><i class="fa fa-chevron-right pull-right"></i></td></tr>');
//       museumSearch.push({
//         name: layer.feature.properties.NAME,
//         address: layer.feature.properties.ADRESS1,
//         source: "Museums",
//         id: L.stamp(layer),
//         lat: layer.feature.geometry.coordinates[1],
//         lng: layer.feature.geometry.coordinates[0]
//       });
//     }
//   }
// });
// $.getJSON("data/DOITT_MUSEUM_01_13SEPT2010.geojson", function (data) {
//   museums.addData(data);
// });

function myHandler(geojson) {
    console.debug(geojson);
}

function onSelectedHandler(geojson){
  var bounds = [[geojson.properties.extent[1], 
                 geojson.properties.extent[0]],
                [geojson.properties.extent[3], 
                 geojson.properties.extent[2]]
              ];
  L.rectangle(bounds, highlightStyle).addTo(highlight);
  map.fitBounds(bounds);
}

map = L.map("map", {
  zoom: 7,
  center: [35.702222, -97.979378],
  //layers: [cartoLight, markerClusters, highlight],
  layers: [cartoLight, okmapsLayer, highlight],
  zoomControl: false,
  attributionControl: false
});

//override onAdd to include form-control and empty classes
L.Control.Photon = L.Control.Photon.extend({

    includes: L.Mixin.Events,

    onAdd: function (map, options) {
        this.map = map;
        this.container = L.DomUtil.create('div', 'leaflet-photon');

        this.options = L.Util.extend(this.options, options);

        this.input = L.DomUtil.create('input', 'photon-input form-control empty', this.container);
        this.search = new L.PhotonSearch(map, this.input, this.options);
        this.search.on('blur', this.forwardEvent, this);
        this.search.on('focus', this.forwardEvent, this);
        this.search.on('hide', this.forwardEvent, this);
        this.search.on('selected', this.forwardEvent, this);
        this.search.on('ajax:send', this.forwardEvent, this);
        this.search.on('ajax:return', this.forwardEvent, this);
        return this.container;
    }
});

var searchControl = L.control.photon({
      onSelected: onSelectedHandler,
      resultsHandler: myHandler,
      placeholder: '',
      position: 'topleft'
  });

searchControl.addTo(map);

/* Layer control listeners that allow for a single markerClusters layer */
map.on("overlayadd", function(e) {
  if (e.layer === okmapsLayer) {
    //markerClusters.addLayer(okmaps);
    syncSidebar();
  }
  // if (e.layer === museumLayer) {
  //   markerClusters.addLayer(museums);
  //   syncSidebar();
  // }
});

map.on("overlayremove", function(e) {
  if (e.layer === okmapsLayer) {
    //markerClusters.removeLayer(okmaps);
    syncSidebar();
  }
  // if (e.layer === museumLayer) {
  //   markerClusters.removeLayer(museums);
  //   syncSidebar();
  // }
});

/* Filter sidebar feature list to only show features in current map bounds */
map.on("moveend", function (e) {
  //var start = performance.now();
  syncSidebar();
  //var end = performance.now();
  //console.log("syncSidebar took " + (end - start) + " milliseconds.");
});

/* Clear feature highlight when map is clicked */
map.on("click", function(e) {
  highlight.clearLayers();
});



/* Attribution control */
function updateAttribution(e) {
  $.each(map._layers, function(index, layer) {
    if (layer.getAttribution) {
      $("#attribution").html((layer.getAttribution()));
    }
  });
}
map.on("layeradd", updateAttribution);
map.on("layerremove", updateAttribution);

var attributionControl = L.control({
  position: "bottomright"
});
attributionControl.onAdd = function (map) {
  var div = L.DomUtil.create("div", "leaflet-control-attribution");
  div.innerHTML = "<span class='hidden-xs'></a>";
  return div;
};
//map.addControl(attributionControl);

var zoomControl = L.control.zoom({
  position: "bottomright"
}).addTo(map);

/* GPS enabled geolocation control set to follow the user's location */
var locateControl = L.control.locate({
  position: "bottomright",
  drawCircle: true,
  follow: true,
  setView: true,
  keepCurrentZoomLevel: true,
  markerStyle: {
    weight: 1,
    opacity: 0.8,
    fillOpacity: 0.8
  },
  circleStyle: {
    weight: 1,
    clickable: false
  },
  icon: "fa fa-location-arrow",
  metric: false,
  strings: {
    title: "My location",
    popup: "You are within {distance} {unit} from this point",
    outsideMapBoundsMsg: "You seem located outside the boundaries of the map"
  },
  locateOptions: {
    maxZoom: 18,
    watch: true,
    enableHighAccuracy: true,
    maximumAge: 10000,
    timeout: 10000
  }
}).addTo(map);

/* Larger screens get expanded layer control and visible sidebar */
if (document.body.clientWidth <= 767) {
  var isCollapsed = true;
} else {
  var isCollapsed = false;
}

var baseLayers = {
  "Street Map": cartoLight,
  "Aerial Imagery": usgsImagery
};

var groupedOverlays = {
  "Maps": {
    "": okmapsLayer
    //"<img src='assets/img/museum.png' width='24' height='28'>&nbsp;Museums": museumLayer
  }
};

var layerControl = L.control.groupedLayers(baseLayers, groupedOverlays, {
  collapsed: isCollapsed
}).addTo(map);

/* Highlight search box text on click */
$("#searchbox").click(function () {
  $(this).select();
});

/* Prevent hitting enter from refreshing the page */
$("#searchbox").keypress(function (e) {
  if (e.which == 13) {
    e.preventDefault();
  }
});

$("#featureModal").on("hidden.bs.modal", function (e) {
  $(document).on("mouseout", ".feature-row", clearHighlight);
});

/* Typeahead search functionality */
$(document).on("ajaxStop", function () {
  $("#loading").hide();
  sizeLayerControl();
  /* Fit map to boroughs bounds */
  //map.fitBounds(boroughs.getBounds());
  //filterRankFeatures2(okmaps);
  // featureList = new List("features", {
  //   valueNames: ["feature-name", "feature-sort-name","spatialScore"],
  //   page:50
  //  });
  // featureList.sort("spatialScore", {
  //   order: "asc"
  // });

  // var boroughsBH = new Bloodhound({
  //   name: "Boroughs",
  //   datumTokenizer: function (d) {
  //     return Bloodhound.tokenizers.whitespace(d.name);
  //   },
  //   queryTokenizer: Bloodhound.tokenizers.whitespace,
  //   local: boroughSearch,
  //   limit: 10
  // });

  okmapsBH = new Bloodhound({
    name: "Maps",
    datumTokenizer: function (d) {
      return Bloodhound.tokenizers.whitespace(d.name);
    },
    queryTokenizer: Bloodhound.tokenizers.whitespace,
    local: okmapsSearch,
    limit: 10
  });

  // var museumsBH = new Bloodhound({
  //   name: "Museums",
  //   datumTokenizer: function (d) {
  //     return Bloodhound.tokenizers.whitespace(d.name);
  //   },
  //   queryTokenizer: Bloodhound.tokenizers.whitespace,
  //   local: museumSearch,
  //   limit: 10
  // });
  //

  //boroughsBH.initialize();
  okmapsBH.initialize();
  // museumsBH.initialize();
  //geonamesBH.initialize();

  /* instantiate the typeahead UI */
    $("#searchbox").typeahead({
        minLength: 3,
        highlight: true,
        hint: true,
        autocomplete: true
      }, {
        name: "Maps",
        display: "name",
        source: okmapsBH.ttAdapter(),
        templates: {
          suggestion: Handlebars.compile('<div>{{name}}</div>')
        }
    }).on("typeahead:selected", function (obj, datum) {
    if (datum.source === "Newspapers") {
      if (!map.hasLayer(okmapsLayer)) {
        map.addLayer(okmapsLayer);
      }
      map.fitBounds(datum.getBounds(), 17);
      if (map._layers[datum.id]) {
        map._layers[datum.id].fire("click");
      }
    }
    if ($(".navbar-collapse").height() > 50) {
      $(".navbar-collapse").collapse("hide");
    }
}).on("typeahead:opened", function () {
    $(".navbar-collapse.in").css("max-height", $(document).height() - $(".navbar-header").height());
    $(".navbar-collapse.in").css("height", $(document).height() - $(".navbar-header").height());
  }).on("typeahead:closed", function () {
    $(".navbar-collapse.in").css("max-height", "");
    $(".navbar-collapse.in").css("height", "");
  });
  $(".twitter-typeahead").css("position", "static");
  $(".twitter-typeahead").css("display", "block");
});

// Leaflet patch to make layer control scrollable on touch browsers
var container = $(".leaflet-control-layers")[0];
if (!L.Browser.touch) {
  L.DomEvent
  .disableClickPropagation(container)
  .disableScrollPropagation(container);
} else {
  L.DomEvent.disableClickPropagation(container);
}

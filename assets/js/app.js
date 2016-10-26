//Object.keys polyfill
// From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys
if (!Object.keys) {
  Object.keys = (function() {
    'use strict';
    var hasOwnProperty = Object.prototype.hasOwnProperty,
        hasDontEnumBug = !({ toString: null }).propertyIsEnumerable('toString'),
        dontEnums = [
          'toString',
          'toLocaleString',
          'valueOf',
          'hasOwnProperty',
          'isPrototypeOf',
          'propertyIsEnumerable',
          'constructor'
        ],
        dontEnumsLength = dontEnums.length;

    return function(obj) {
      if (typeof obj !== 'object' && (typeof obj !== 'function' || obj === null)) {
        throw new TypeError('Object.keys called on non-object');
      }

      var result = [], prop, i;

      for (prop in obj) {
        if (hasOwnProperty.call(obj, prop)) {
          result.push(prop);
        }
      }

      if (hasDontEnumBug) {
        for (i = 0; i < dontEnumsLength; i++) {
          if (hasOwnProperty.call(obj, dontEnums[i])) {
            result.push(dontEnums[i]);
          }
        }
      }
      return result;
    };
  }());
}

// End polyfills and what nots
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////

//hide the address bar for mobile. hahahaha i don't care that it's a hack!
window.scrollTo(0,1);

var map, featureList, tree, tree_nodes = [],
 boroughSearch = [], okmapsSearch = [], museumSearch = [], 
 timeline_added = false, featuresTemp = [];
var okm = {};
okm.G = {};
okm.util = {};
okm.map = {};
okm.sidebar = {};
okm.filter = {};
//criteria obj keys must correspond to table fields
okm.filter.criteria = {};
okm.map.layers = {};
okm.map.styles = {};
okm.map.styles.highlight = {
        color: "#ff7300",
        weight: 1
      };
okm.G.CARTO_USER = "krdyke";
okm.G.MB_TOKEN = "pk.eyJ1Ijoia3JkeWtlIiwiYSI6Ik15RGcwZGMifQ.IR_NpAqXL1ro8mFeTIdifg";
okm.G.TABLE_NAME = "okmaps";
okm.G.PER_PAGE = 10;
okm.G.PAGE_NUMBER = 1;
okm.G.QUERY_URL = "https://{username}.carto.com/api/v2/sql".replace("{username}", okm.G.CARTO_USER);
okm.G.BASE_URL = "SELECT {fields} FROM {table_name}";
okm.G.CDM_ROOT = "http://dc.library.okstate.edu";
okm.G.REF_URL = okm.G.CDM_ROOT + "/cdm/ref/collection/OKMaps/id/";
okm.G.IMG_URL = okm.G.CDM_ROOT + "/utils/ajaxhelper/?CISOROOT=OKMaps&CISOPTR={{contentdm_number}}&action=2&DMSCALE={{scale}}&DMWIDTH={{width}}&DMHEIGHT={{height}}&DMX=0&DMY=0&DMTEXT=&DMROTATE=0";
okm.G.THUMBNAIL_URL = okm.G.CDM_ROOT + "/utils/getthumbnail/collection/OKMaps/id/";
okm.G.TABLE_FIELDS = ["the_geom", 
  "title", 
  "cartodb_id", 
  "original_date",
  "contentdm_number",
  "collection",
  "img_width",
  "img_height",
  "size"];
okm.G.CARTO_URL = okm.G.BASE_URL
    .replace("{table_name}", okm.G.TABLE_NAME)
    .replace("{fields}", okm.G.TABLE_FIELDS.join(", "));


//from http://stackoverflow.com/questions/1669190/javascript-min-max-array-values
okm.util.array_min = function(arr) {
  var len = arr.length, min = Infinity;
  while (len--) {
    if (arr[len] < min) {
      min = arr[len];
    }
  }
  return min;
};

//from http://stackoverflow.com/questions/1669190/javascript-min-max-array-values
okm.util.array_max = function(arr) {
  var len = arr.length, max = -Infinity;
  while (len--) {
    if (arr[len] > max) {
      max = arr[len];
    }
  }
  return max;
};


okm.util.sql = function(query, callback, format){
  var format_str = '';
  if (format){
      format_str = format;
  }
  else {
      format_str = "geojson";
  }
  return $.ajax({
      url: okm.G.QUERY_URL,
      data: {
        format: format_str,
        q: query
      },
      type: "POST",
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
  sidebarClick(parseInt($(this).data("id"), 10));
});

if ( !("ontouchstart" in window) ) {
  $(document).on("mouseover", ".feature-row", function(e) {
    var bbox_str = $(this).data("bbox");
    var a = bbox_str.split(","); 
    var b = L.latLngBounds([a[1],a[0]], [a[3],a[2]]);
    var rect = L.rectangle(b, okm.map.styles.highlight);
    okm.map.layers.highlight.clearLayers().addLayer(rect);
  });
}

$(document).on("mouseout", ".feature-row", clearHighlight);

$("#about-btn").click(function() {
  $("#aboutModal").modal("show");
  $(".navbar-collapse.in").collapse("hide");
  return false;
});


$("#filter-options").click(function(){
  $("#filterModal").modal("show");
  okm.filter.filter_changed = false;
  $(".navbar-collapse.in").collapse("hide");
  return false;
});

$("#full-extent-btn").click(function() {
  map.fitBounds(okm.map.layers.okmaps.getBounds());
  $(".navbar-collapse.in").collapse("hide");
  return false;
});

$("#sidebar-size-increase").click(function(){
  var current_width = +$("#sidebar").css("width").replace("px", "");
  var body_width = +$("body").css("width").replace("px", "");
  if (current_width < (body_width + 250)){
    $("#sidebar,.panel-heading, .feature-row , .panel-body").css("width", (current_width + 250) + "px");
  }
});

$("#sidebar-size-decrease").click(function(){
  var current_width = +$("#sidebar").css("width").replace("px", "");
  if (current_width > 350){
    $("#sidebar,.panel-heading, .feature-row , .panel-body").css("width", (current_width - 250) + "px");
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

$("#filterModal").on("hide.bs.modal", function(){
  if (okm.filter.filter_changed){
    okm.sidebar.sync();
  }
});


function addToHighlight(feature){
  okm.map.layers.highlight.clearLayers()
    .addData(feature)
    .setStyle(okm.map.styles.highlight);
}

okm.filter.year = function(features){
  var years = features.filter(function(v){
    if (v.properties.original_date){
      return true;
    }
  }).map(function(v){
      return v.properties.original_date;
  });

  var minYear = okm.util.array_min(years);
  var maxYear = okm.util.array_max(years);
  $("#yearSlider").slider({
    min: minYear,
    max: maxYear,
    range: true,
    tooltip: "always",
    tooltip_split: true
  });

  //workaround for misaligned tooltips in Chrome
  //see https://github.com/seiyria/bootstrap-slider/issues/483
  $('#facet2 .tooltip-min').css({'margin-left': '-22px'});
  $('#facet2 .tooltip-max').css({'margin-left': '-22px'});

  $("#yearSlider").on("slideStop", function(e){
    okm.filter.filter_changed = true;
    okm.filter.criteria.original_date = e.value;
  });
};

okm.filter.collection = function(features){
  var nest, ul, li, clone, label, input;
  nest = d3.nest()
    .key(function(d){
      return d.properties.collection;
    }).rollup(function(leaves){
      return leaves.length;
  }).entries(features);

  nest.sort(function(a, b){
    if (a.value > b.value){
      return -1;
    }
    else if (a.value < b.value){
      return 1;
    }
    else {
      return 0;
    }
  });

  ul = $("#facet1 ul");
  li = $("#facet1 li");
  label = $("#facet1 label");
  input = $("#facet1 input");
  for (var i = 0; i < nest.length; i++){
    clone = li.clone();
    clone.find("label").html(label.html() + nest[i].key);
    clone.find("label input").val(nest[i].key);
    ul.append(clone);
  }
  li.remove();
  
  $("#facet1 input").change(function(e){
    okm.filter.filter_changed = true;
    okm.filter.criteria.collection = okm.filter.get_input_values($("#facet1 input"));
  });

};


okm.filter.get_input_values = function(elems){
  values = elems.filter(function(){
    return this.checked;
  }).map(function(){
    return this.value;
  });

  return values.get();
};



okm.filter.init = function(features){
  okm.filter.collection(features);
  okm.filter.year(features);
};


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
  okm.map.layers.highlight.clearLayers();
}

function sidebarClick(id) {
  var layer = okm.map.layers.okmaps.getLayer(id);
  //map.fitBounds(layer.getBounds());
  layer.fire("click");
  /* Hide sidebar and go to the map on small screens */
  if (document.body.clientWidth <= 767) {
    $("#sidebar").hide();
    map.invalidateSize();
  }
}


okm.util.bboxStringToWKT = function(bbox_str){
  var bb = bbox_str.split(",");
  return "POLYGON((" + bb[0] + " " + bb[1] + "," + bb[0] + " " + bb[3]+
   "," + bb[2] + " " + bb[3]+ "," + bb[2] + " " + bb[1] +
   "," + bb[0] + " " + bb[1] + "))";
};


function buildFilterRankQuery(input_bounds, offset){
  var nonspatial_filters = okm.filter.build_where();
  var bbox_wkt = okm.util.bboxStringToWKT(input_bounds.toBBoxString());
  var url = okm.G.BASE_URL.replace("{username}", okm.G.CARTO_USER)
    .replace("{table_name}", okm.G.TABLE_NAME)
    .replace("{fields}", "cartodb_id");
  var q = "SELECT cartodb_id, sort_order from ((" + 
    //first set of results is those whose bbox is entirely contained
    //within the viewport, sorted by area from largest to smallest
    "SELECT 1 as sort_order, cartodb_id FROM {{table_name}} as b1 WHERE" +
      " ST_GeomFromText('" + 
      bbox_wkt + "', 4326) ~ the_geom " + nonspatial_filters + 
      "ORDER BY st_area(the_geom) DESC)" +
    " UNION ALL (" + 

    //second set is those bboxes with centroids falling within the viewport
    //sorted by distance between
    "SELECT 2 as sort_order, cartodb_id FROM {{table_name}} WHERE" +
      " ST_Centroid(the_geom) @ ST_GeomFromText('" + 
      bbox_wkt + "', 4326) " + nonspatial_filters +
      " ORDER BY ST_Centroid(the_geom) <#> ST_GeomFromText('" + 
      bbox_wkt + "', 4326))" +

    // Uncomment the following lines to include a third tier of results,
    // those whose bounding box intersects the viewport in *any* way
    // " UNION ALL (" + 
    // "SELECT 3 as sort_order, cartodb_id FROM {{table_name}} WHERE" +
    //   " ST_GeomFromText('" + 
    //   bbox_wkt + "', 4326) && the_geom " + nonspatial_filters +
    //   " ORDER BY the_geom <<->> ST_GeomFromText('" + 
    //   bbox_wkt + "', 4326))" + 

      ") as foobar LIMIT " + okm.G.PER_PAGE + " OFFSET " + offset;
  q = q.replace(/{{table_name}}/g, okm.G.TABLE_NAME);
  return q;
}


okm.filter.build_where = function(properties){
  var years;
  var props = properties;
  var filters = Object.keys(okm.filter.criteria);
  var i = filters.length -1;
  var q = "";

  for (i; i >= 0; i--){

    switch (filters[i]){

      case "collection":
        q = q + " AND collection in ('" + okm.filter.criteria.collection.join("','") + "') ";
        break;

      case "original_date":
        years = okm.filter.criteria.original_date;
        q = q + " AND original_date BETWEEN " + years[0] + " AND " + years[1] + " ";
        break;
      case "size":
        break;
    }
    
  }
  return q;
};

function filterRankFeatures3(){
  var offset = (okm.G.PAGE_NUMBER - 1) * okm.G.PER_PAGE || 0;
  console.log("filterRankFeatures3");
  featuresTemp = [];
  var f,fbbox,fcent,dist;
  var bbox = map.getBounds();
    
  var q = buildFilterRankQuery(bbox, offset);
  
  return okm.util.sql(q, function(d){
    var lyrs = okm.map.layers.okmaps.getLayers();
    var full_title, short_title;
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

          full_title = l.feature.properties.title;
          short_title = full_title.substr(0,50);
          short_title = full_title.length > 50 ? short_title.substr(0, Math.min(short_title.length, short_title.lastIndexOf(" "))) + "..." : full_title;
          featuresTemp.push({
            "cdm": l.feature.properties.contentdm_number,
            "carto": l.feature.properties.cartodb_id,
            "id": L.stamp(l),
            "bbox": l.getBounds().toBBoxString(),
            "feature-name": short_title,
            "feature-sort-name":l.feature.properties.original_date,
            "feature-thumbnail":okm.G.THUMBNAIL_URL + l.feature.properties.contentdm_number,
            "feature-row": full_title          
          });
          break;
        }
      }
      
    }
    end = performance.now();
    console.log("matching by id:  "+ (end - start) + " milliseconds.");
    
  },"json");
}


function getBoundsArea(bounds){
  var sw = bounds.getSouthWest();
  var ne = bounds.getNorthEast();
  var se = L.latLng(sw.lat, ne.lng);
  var nw = L.latLng(ne.lat, sw.lng);
  return ne.distanceTo(nw) * ne.distanceTo(se);
}

function syncUrlHash(){
  var loc = "loc="+map.getBounds().toBBoxString();

  location.hash = [loc].join("&");
}

function getUrlHashAsObject(){
  var a = {}, i;
  var h = location.hash.split("&");
  for (i; i < h.length; i++){
    var keyvalue = h[i].split("=");
    a[keyvalue[0]] = keyvalue[1];
  }
  return a;
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

$("#search-on-map-move").change(function(e){
  if (this.checked){
    okm.sidebar.sync();
  }
});

function autosearchOn(){
  return $("#search-on-map-move").get()[0].checked;
}

$("#more-results").click(function(e){
  okm.G.PAGE_NUMBER++;
  $("#loading").show();
  filterRankFeatures3(okm.map.layers.okmaps).then(function(){
      featureList.add(featuresTemp);
      $("#loading").hide();
    }, function(err){
      console.log(err);
      $("#loading").hide();        
    });
});


 okm.sidebar.sync = function() {
  console.log("okm.sidebar.sync");
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

      filterRankFeatures3(okm.map.layers.okmaps).then(function(){

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
      //   if (map.hasLayer(okm.map.layers.okmapsLayer)) {
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


};

/* Basemap Layers */
// var cartoLight = L.tileLayer("https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png", {
//   maxZoom: 19,
//   attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://cartodb.com/attributions">CartoDB</a>'
// });

function myHandler(geojson) {
    console.debug(geojson);
}

function animateIcon(){
   var icon = $('.animated-icon').get()[0];
  
   setTimeout(function(){
      icon.style.width = '50px';
      icon.style.height = '50px';
      icon.style.marginLeft = '-25px';
      icon.style.marginTop = '-25px';
    }, 300);

    setTimeout(function(){
      icon.style.width = '30px';
      icon.style.height = '30px';
      icon.style.marginLeft = '-15px';
      icon.style.marginTop = '-15px';
    }, 900);

    setTimeout(function(){
      icon.style.width = '50px';
      icon.style.height = '50px';
      icon.style.marginLeft = '-25px';
      icon.style.marginTop = '-25px';
    }, 1500);

    setTimeout(function(){
      icon.style.width = '30px';
      icon.style.height = '30px';
      icon.style.marginLeft = '-15px';
      icon.style.marginTop = '-15px';
    }, 2100);

    setTimeout(function(){
      icon.style.width = '50px';
      icon.style.height = '50px';
      icon.style.marginLeft = '-25px';
      icon.style.marginTop = '-25px';
    }, 2700);

    setTimeout(function(){
      icon.style.width = '30px';
      icon.style.height = '30px';
      icon.style.marginLeft = '-15px';
      icon.style.marginTop = '-15px';
    }, 3300);


}

function onSelectedHandler(geojson){
  if (geojson.properties.hasOwnProperty("extent")){
    var bounds = [[geojson.properties.extent[1], 
                   geojson.properties.extent[0]],
                  [geojson.properties.extent[3], 
                   geojson.properties.extent[2]]
            ];

    var r = L.rectangle(bounds, {
      fillColor: "#ff7300",
      stroke: false
    });

    r.addTo(map);
    map.fitBounds(bounds);
    setTimeout(function(){
      $(r.getElement()).fadeOut({"complete": function(){r.remove();}});
    }, 3000);
  }
  else if (geojson.geometry.hasOwnProperty("coordinates") &&
           geojson.geometry.coordinates.length === 2){
    var latlng = geojson.geometry.coordinates.reverse();
    map.setView(latlng, 13, {
      maxZoom:14
    });

    var icon = L.divIcon({
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [10, 0],
      shadowSize: [0, 0],
      className: 'animated-icon',
      html: ''
    });

    var m = L.marker(latlng, {
      icon: icon
    });

    m.on('add', function(){
      animateIcon();
    });
      
    m.addTo(map);
    setTimeout(function(){
      $(m.getElement()).fadeOut({"complete": function(){m.remove();}});
    }, 4000);
    
    //window.setTimeout(function(){m.remove();},3000);



  }  
}

/* Attribution control */
function updateAttribution(e) {
  $.each(map._layers, function(index, layer) {
    if (layer.getAttribution) {
      $("#attribution").html((layer.getAttribution()));
    }
  });
}

Modernizr.on("webp", function(support){

  var tile_format;
  //need the toString bit due to Modernizr bug.
  //https://github.com/Modernizr/Modernizr/issues/1765
  //fixed but not yet released
  if (support.toString() === "true"){ 
    tile_format = "webp";
  }
  else {
    tile_format = "jpg";
  }

  okm.map.layers.street = L.tileLayer("https://{s}.tiles.mapbox.com/v4/mapbox.streets/{z}/{x}/{y}.{{tf}}?access_token={{token}}".replace("{{tf}}",tile_format).replace("{{token}}",okm.G.MB_TOKEN), {
    maxZoom: 19,
    detectRetina: true,
   attribution: "&copy; Mapbox"
  });
  okm.map.layers.satellite = L.tileLayer("https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v10/tiles/256/{z}/{x}/{y}?access_token={{token}}".replace("{{token}}",okm.G.MB_TOKEN), {
     maxZoom: 19,
    detectRetina: true,
   attribution: "&copy; Mapbox"
  });

  /* Overlay Layers */
  okm.map.layers.highlight = L.geoJson(null, {
    "style": function(f){
      return okm.map.styles.highlight;
    }
  });
  

  
  /* Empty layer placeholder to add to layer control for listening when to add/remove okmaps to markerClusters layer */
  okm.map.layers.okmapsLayer = L.geoJson(null);
  timelineLayer = L.geoJson(null);
  okm.map.layers.okmaps = L.geoJson(null, {
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
        var img_url = okm.G.IMG_URL.replace("{{contentdm_number}}", feature.properties.contentdm_number)
                        .replace("{{width}}", feature.properties.img_width/10)
                        .replace("{{height}}", feature.properties.img_height/10)
                        .replace("{{scale}}", 10);
        var ref_url = okm.G.REF_URL + feature.properties.contentdm_number;
        var content = "<table class='table table-striped table-bordered table-condensed'>" +
          "<tr><td>Title</td><td>" + feature.properties.title.replace("'","&#39;") + "</td></tr>"+
          "<tr><td>Link</td><td><a href='"+ ref_url+ "'>"+ ref_url +"</a></td></tr>"+
          "<tr><td>Thumbnail</td><td>"+
          "<a target='_none' href='"+ ref_url+"'><div class='feature-modal-image-helper'><img class='img-responsive' alt= '" + 
          feature.properties.title.replace("'","&#39;")+ "'src='"+
          img_url+"'/></div></a></td></tr></table>";

        layer.on({
          click: function (e) {
            $("#feature-title").html(feature.properties.title);
            $("#loading").show();
            $("#feature-info").html(content);
            $("#featureModal img").on("load",function(){
              $("#loading").hide();
              $("#featureModal").modal("show");
              addToHighlight(feature);
            });
            
          }
        });

      }
    }
  });

  map = L.map("map", {
    zoom: 7,
    center: [35.702222, -97.979378],
    //layers: [cartoLight, markerClusters, highlight],
    layers: [okm.map.layers.street, okm.map.layers.okmapsLayer, okm.map.layers.highlight],
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
        position: 'topright',
        url: "https://photon.komoot.de/api/?"
    });

  /* Layer control listeners that allow for a single markerClusters layer */
  map.on("overlayadd", function(e) {
    if (e.layer === okm.map.layers.okmapsLayer) {
      //markerClusters.addLayer(okmaps);
      okm.sidebar.sync();
    }
  });

  map.on("overlayremove", function(e) {
    if (e.layer === okm.map.layers.okmapsLayer) {
      //markerClusters.removeLayer(okmaps);
      okm.sidebar.sync();
    }
  });

  /* Filter sidebar feature list to only show features in current map bounds */
  map.on("moveend", function (e) {
    okm.G.PAGE_NUMBER = 1;
    if (autosearchOn()){
      okm.sidebar.sync();
    }
    syncUrlHash();
  });

  /* Clear feature highlight when map is clicked */
  map.on("click", function(e) {
    okm.map.layers.highlight.clearLayers();
  });


  okm.util.sql(okm.G.CARTO_URL, function (data) {
    okmaps_geojson = data;
    okm.filter.init(data.features);

    okm.map.layers.okmaps.addData(data);
    featureList = new List("features", {
      valueNames: [{data:["cdm"]},
                   {data:["carto"]},
                   {data:["id"]}, 
                   {data:["bbox"]}, 
                   "feature-name", 
                   "feature-sort-name",
                   {name:"feature-thumbnail", attr:"src"},
                   {name:"feature-row", attr:"title"}],
      item: "<tr class='feature-row'><td class='feature-name'>"+
        "</td><td class='feature-sort-name'>" + 
        "</td><td><div class='thumbnail-background'><i class='thumbnail-loading fa fa-spin fa-circle-o-notch fa-2x'></i><span class='thumbnail-background-helper'></span>" +
        "<img class='feature-thumbnail'/>"+
        "</div></td</tr>"
     });

    // Remove loading spinner when thumbnail loads
    featureList.on("updated", function(){
      $(".feature-thumbnail").load(function(e){
        var sibs = $(this).siblings(); 
        if (sibs.length > 0){
          sibs[0].remove();
        }
      });
    });

    map.addLayer(okm.map.layers.okmapsLayer);
    map.fire("moveend");
  });



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
  
  var isCollapsed;
  /* Larger screens get expanded layer control and visible sidebar */
  if (document.body.clientWidth <= 767) {
    isCollapsed = true;
  } else {
    isCollapsed = false;
  }

  var baseLayers = {
    "Street Map": okm.map.layers.street,
    "Satellite": okm.map.layers.satellite
  };

  var groupedOverlays = {
    "Maps": {
      "": okm.map.layers.okmapsLayer
      //"<img src='assets/img/museum.png' width='24' height='28'>&nbsp;Museums": museumLayer
    }
  };

  /*var layerControl = L.control.groupedLayers(baseLayers, groupedOverlays, {
    collapsed: isCollapsed
  }).addTo(map);*/
  var layerControl = L.control.groupedLayers(baseLayers, {
    collapsed: isCollapsed
  }).addTo(map);

  searchControl.addTo(map);

  // Leaflet patch to make layer control scrollable on touch browsers
  var container = $(".leaflet-control-layers")[0];
  if (!L.Browser.touch) {
    L.DomEvent
    .disableClickPropagation(container)
    .disableScrollPropagation(container);
  } else {
    L.DomEvent.disableClickPropagation(container);
  }

});

$("input.photon-input").on("focusout", function(e){
  $(this).val("");
});

$("#featureModal").on("hidden.bs.modal", function (e) {
  $(document).on("mouseout", ".feature-row", clearHighlight);
});

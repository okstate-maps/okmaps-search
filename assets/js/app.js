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

window.scrollTo(0,1);

var map, 
 featureList,
 okmapsSearch = [], 
 timeline_added = false, 
 geo = [];

var okm = {};
okm.G = {};
okm.state = {};
okm.util = {};

okm.sidebar = {};
okm.filter = {};
//criteria obj keys must correspond to table fields
okm.filter.criteria = {};

//how to rank search results gets handled in this thing
okm.filter.filter_rank_query = "SELECT cartodb_id, sort_order from " + //parent wrapper

"(" + //parent
    
   "(" + //1st clause

        //experiment 2: return maps very close in area (but can be larger than viewport)
          "SELECT 1 as sort_order, cartodb_id FROM {{table_name}} as c1 WHERE" +
          " ST_GeomFromText('{{bbox_wkt}}', 4326) && ST_Centroid(the_geom)" +
          " AND " +
          "(" + 
            "abs( 1 - (area / " + 
            " ST_Area(ST_Transform(ST_GeomFromText('{{bbox_wkt}}', 4326), 3857)))) < 0.4" + 
          ")" + 
          " {{nonspatial_filters}}" + 
          " ORDER BY ST_Centroid(ST_Transform(ST_GeomFromText('{{bbox_wkt}}', 4326), 3857)) <-> ST_Centroid(the_geom_webmercator) ASC" +
    
   " )" + //end 1st

  " UNION ALL "+
    
  " ( " + //2nd clause

        //first set of results is those whose bbox is entirely contained
        // within the viewport, sorted by area from largest to smallest
          " SELECT 2 as sort_order, cartodb_id FROM {{table_name}} as c2 WHERE" +
          " ST_GeomFromText('{{bbox_wkt}}', 4326) ~ the_geom {{nonspatial_filters}}" + 
          " ORDER BY " + 
          " area DESC " +
          " , " +
          " ST_Centroid(ST_Transform(ST_GeomFromText('{{bbox_wkt}}', 4326), 3857)) <-> ST_Centroid(the_geom_webmercator) ASC " +

  " )" + //end 2nd

  " UNION ALL "+
    
  " ( " + //3rd clause
  
    // The Catch-All: returns maps whose bounding box intersects the viewport in *any* way
    // and order by distance from center
    "SELECT 3 as sort_order, cartodb_id FROM {{table_name}} as c3 WHERE" +
      " ST_GeomFromText('" + 
      "{{bbox_wkt}}" + "', 4326) && the_geom " + 
      "{{nonspatial_filters}}" +
      " ORDER BY " +
      " ST_Centroid(ST_Transform(ST_GeomFromText('{{bbox_wkt}}', 4326), 3857)) <-> ST_Centroid(the_geom_webmercator) ASC " +

  " )" + //end 3rd

")" + //end parent

" as foobar LIMIT {{per_page}} OFFSET {{offset}}";

    // " UNION ALL (" + 

//previous iterations
    //bboxes with centroids falling within the viewport sorted by distance between
    // "SELECT 2 as sort_order, cartodb_id FROM {{table_name}} WHERE" +
    //   " ST_Centroid(the_geom) @ ST_GeomFromText('{{bbox_wkt}}'" + 
    //   ", 4326) {{nonspatial_filters}}" +
    //   " ORDER BY ST_Centroid(the_geom) <#> ST_GeomFromText('" + 
    //   "{{bbox_wkt}}" + "', 4326))" +



      //experiment: cut out very small maps from results of those contained by viewport
      // "SELECT 1 as sort_order, cartodb_id FROM {{table_name}} as b1 WHERE" +
      // " ST_GeomFromText('{{bbox_wkt}}', 4326) ~ the_geom" + 
      // " AND" +
      // " ( area / " + 
      // " ST_Area(ST_Transform(ST_GeomFromText('{{bbox_wkt}}', 4326), 3857)) > 0.1 )" + 
      // " {{nonspatial_filters}} " + 
      // "ORDER BY area DESC)" +

okm.text_search = {};
okm.text_search.text_searching = false;
okm.text_search.base_query = "select cartodb_id  from ("+
  "select title, cartodb_id,"+
  "(setweight(to_tsvector('english', title),'A')"+
  ") as document "+
  "from {{table_name}}  ) as doc "+
  "where doc.document @@ plainto_tsquery('english','{{search_text}}') "+
  "order by "+
  "ts_rank(doc.document, plainto_tsquery('english','{{search_text}}'), 1) DESC " +
  "LIMIT {{per_page}} OFFSET {{offset}}";

okm.map = {};
okm.map.controls = {};
okm.map.layers = {};
okm.map.styles = {};
okm.map.styles.highlight = {
        color: "#ff7300",
        weight: 1
      };
okm.G.CARTO_USER = "krdyke";
okm.G.MB_TOKEN = "pk.eyJ1Ijoia3JkeWtlIiwiYSI6Ik15RGcwZGMifQ.IR_NpAqXL1ro8mFeTIdifg";
okm.G.MAPZEN_KEY = "mapzen-6dXEegt";
okm.G.TABLE_NAME = "okmaps";
okm.G.PER_PAGE = 10;
okm.G.PAGE_NUMBER = 1;
okm.G.QUERY_URL = "https://{username}.carto.com/api/v2/sql".replace("{username}", okm.G.CARTO_USER);
okm.G.BASE_URL = "SELECT {fields} FROM {table_name}";
//okm.G.CDM_ROOT = "http://dc.library.okstate.edu";
okm.G.CDM_ROOT = "https://cdm17279.contentdm.oclc.org/";
okm.G.REF_URL = okm.G.CDM_ROOT + "/cdm/ref/collection/OKMaps/id/";
okm.G.IMG_URL = okm.G.CDM_ROOT + "/utils/ajaxhelper/?CISOROOT=OKMaps&CISOPTR={{contentdm_number}}&action=2&DMSCALE={{scale}}&DMWIDTH={{width}}&DMHEIGHT={{height}}&DMX=0&DMY=0&DMTEXT=&DMROTATE=0";
okm.G.IIIF_URL = okm.G.CDM_ROOT + "digital/iiif/OKMaps/{{contentdm_number}}/info.json";
okm.G.THUMBNAIL_URL = okm.G.CDM_ROOT + "/utils/getthumbnail/collection/OKMaps/id/";
okm.G.MODAL_HEIGHT = Math.round($("#featureModal").height() * 0.6);
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

okm.util.state_hash = {
    'Alabama': 'AL',
    'Alaska': 'AK',
    'American Samoa': 'AS',
    'Arizona': 'AZ',
    'Arkansas': 'AR',
    'California': 'CA',
    'Colorado': 'CO',
    'Connecticut': 'CT',
    'Delaware': 'DE',
    'District Of Columbia': 'DC',
    'Federated States Of Micronesia': 'FM',
    'Florida': 'FL',
    'Georgia': 'GA',
    'Guam': 'GU',
    'Hawaii': 'HI',
    'Idaho': 'ID',
    'Illinois': 'IL',
    'Indiana': 'IN',
    'Iowa': 'IA',
    'Kansas': 'KS',
    'Kentucky': 'KY',
    'Louisiana': 'LA',
    'Maine': 'ME',
    'Marshall Islands': 'MH',
    'Maryland': 'MD',
    'Massachusetts': 'MA',
    'Michigan': 'MI',
    'Minnesota': 'MN',
    'Mississippi': 'MS',
    'Missouri': 'MO',
    'Montana': 'MT',
    'Nebraska': 'NE',
    'Nevada': 'NV',
    'New Hampshire': 'NH',
    'New Jersey': 'NJ',
    'New Mexico': 'NM',
    'New York': 'NY',
    'North Carolina': 'NC',
    'North Dakota': 'ND',
    'Northern Mariana Islands': 'MP',
    'Ohio': 'OH',
    'Oklahoma': 'OK',
    'Oregon': 'OR',
    'Palau': 'PW',
    'Pennsylvania': 'PA',
    'Puerto Rico': 'PR',
    'Rhode Island': 'RI',
    'South Carolina': 'SC',
    'South Dakota': 'SD',
    'Tennessee': 'TN',
    'Texas': 'TX',
    'Utah': 'UT',
    'Vermont': 'VT',
    'Virgin Islands': 'VI',
    'Virginia': 'VA',
    'Washington': 'WA',
    'West Virginia': 'WV',
    'Wisconsin': 'WI',
    'Wyoming': 'WY'
  };

okm.util.check_if_need_load = function(elem){
  if (elem.scrollHeight - elem.scrollTop === elem.clientHeight){
    okm.sidebar.more_results();
  }  
};

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

okm.util.get_offset = function(){
  return (okm.G.PAGE_NUMBER - 1) * okm.G.PER_PAGE || 0;
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

/**
  Converts a Leaflet bounding box string (obtained via L.latLngBounds.toBBoxString()) into a Leaflet latLngBounds object.
  @param {String} a string with bounding box coordinates in a 'southwest_lng,southwest_lat,northeast_lng,northeast_lat' format (http://leafletjs.com/reference-1.0.2.html#latlngbounds-tobboxstring). 
  @returns {Object} Instance of L.latLngBounds 
*/
okm.util.bboxStringToLatLngBounds = function(bbox_str){
  var a = bbox_str.split(",");
  return L.latLngBounds([a[1],a[0]], [a[3],a[2]]);
};  

/**
  Converts a Leaflet bounding box string (obtained via L.latLngBounds.toBBoxString())
  into Well Known Text (WKT)
  @param {String} a string with bounding box coordinates in a 'southwest_lng,southwest_lat,northeast_lng,northeast_lat' format (http://leafletjs.com/reference-1.0.2.html#latlngbounds-tobboxstring). 
  @returns {String}
*/
okm.util.bboxStringToWKT = function(bbox_str){
  var bb = bbox_str.split(",");
  return "POLYGON((" + bb[0] + " " + bb[1] + "," + bb[0] + " " + bb[3]+
   "," + bb[2] + " " + bb[3]+ "," + bb[2] + " " + bb[1] +
   "," + bb[0] + " " + bb[1] + "))";
};

okm.util.autosearch_off = function(){
  $("#search-on-map-move").get()[0].checked = false;
};

okm.util.autosearch_on = function(){
  $("#search-on-map-move").get()[0].checked = true;
};

okm.util.autosearch_status = function(){
  return $("#search-on-map-move").get()[0].checked;
};

okm.util.get_url_hash_object = function (){
  var a = {}, i;
  var h = location.hash.slice(1).split("&");
  for (i = 0; i < h.length; i++){
    var keyvalue = h[i].split("=");
    a[keyvalue[0]] = keyvalue[1];
  }
  return a;
};


$(window).resize(function() {
  sizeLayerControl();
});

$(document).on("click", ".feature-row", function(e) {
  okm.sidebar.click(parseInt($(this).data("id"), 10));
});


// if (!("ontouchstart" in window || 
//   window.navigator.pointerEnabled || 
//   window.navigator.msPointerEnabled)) {
if (!("ontouchstart" in window)) {

  $(document).on("mouseover", ".feature-row", function(e) {
    var bbox_str = $(this).data("bbox");
    var b = okm.util.bboxStringToLatLngBounds(bbox_str);
    var rect = L.rectangle(b, okm.map.styles.highlight);
    okm.map.layers.highlight.clearLayers().addLayer(rect);
  });
}

okm.map.clearHighlight = function() {
  okm.map.layers.highlight.clearLayers();
};

$(document).on("mouseout", ".feature-row", okm.map.clearHighlight);

$("#about-btn").click(function() {
  $("#aboutModal").modal("show");
  $(".navbar-collapse.in").collapse("hide");
  return false;
});

$("#help-btn").click(function() {
  introJs().setOption("showStepNumbers", false).start();
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
    $("#sidebar,.panel-heading, .feature-row , .panel-body")
      .css("width", (current_width + 250) + "px");
  }
});

$("#sidebar-size-decrease").click(function(){
  var current_width = +$("#sidebar").css("width").replace("px", "");
  if (current_width > 350){
    $("#sidebar,.panel-heading, .feature-row , .panel-body")
      .css("width", (current_width - 250) + "px");
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

$("#featureModal").on("hide.bs.modal", function(){
  okm.map.clearHighlight();
  okm.iiif_map.remove();
});

$("#filterModal").on("hide.bs.modal", function(){
  if (okm.filter.filter_changed){
    okm.sidebar.sync();
  }
});

$("#input_text_search").on("keypress",function(e){
  if (e.which === 13 && this.value !== ""){
    okm.text_search.click();
  }
  else {
    okm.G.PAGE_NUMBER = 1;
  }
});

//"Infinite" scrolling of search results
//see html and css for more results button if you prefer
$(".sidebar-table").scroll(_.throttle(function(){
  okm.util.check_if_need_load(this);
}, 300));


okm.text_search.click = function(){
  var raw_search_text = okm.text_search.get_search_text();
  var search_text = okm.text_search.format_search_text(raw_search_text);
  okm.text_search.execute(search_text);
};



okm.text_search.execute = function(text){
  var query = okm.text_search.format_query(text);
  return okm.search_carto(query).then(function(){
    featureList.clear();
    okm.sidebar.add_results();
    okm.text_search.text_searching = true;
     $("#loading").hide();
  },function(err){
      console.log(err);
      $("#loading").hide();   
  });
};

okm.text_search.get_search_text = function(){
  return $("#input_text_search").val();
};

okm.text_search.format_search_text = function(input_text){
    return input_text.replace("'","''");
};

okm.text_search.format_query = function(formatted_text){
  var query = okm.text_search.base_query.replace(/{{search_text}}/g, formatted_text);
  query = query.replace("{{per_page}}", okm.G.PER_PAGE);
  query = query.replace("{{offset}}", okm.util.get_offset());
  query = query.replace(/{{table_name}}/g, okm.G.TABLE_NAME);
  return query;
};

okm.text_search.more_results = function(){
  var raw_search_text = okm.text_search.get_search_text();
  var search_text = okm.text_search.format_search_text(raw_search_text);
  var query = okm.text_search.format_query(search_text);
  return okm.search_carto(query).then(function(){
    okm.sidebar.add_results();
    okm.text_search.text_searching = true;
    $("#loading").hide();
  },function(err){
      console.log(err);
      $("#loading").hide();   
  });

};

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
    map.invalidateSize({pan:false});
  });
}

function sizeLayerControl() {
  $(".leaflet-control-layers").css("max-height", $("#map").height() - 50);
}


okm.sidebar.click = function(id) {
  var layer = okm.map.layers.okmaps.getLayer(id);
  layer.fire("click");
  /* Hide sidebar and go to the map on small screens */
  if (document.body.clientWidth <= 767) {
    $("#sidebar").hide();
    map.invalidateSize({pan:false});
  }
};

function buildFilterRankQuery(input_bounds, offset){
  var nonspatial_filters = okm.filter.build_where();
  var bbox_wkt = okm.util.bboxStringToWKT(input_bounds.toBBoxString());
  var url = okm.G.BASE_URL.replace("{username}", okm.G.CARTO_USER)
    .replace("{table_name}", okm.G.TABLE_NAME)
    .replace("{fields}", "cartodb_id");
  var q = okm.filter.filter_rank_query
    .replace(/{{bbox_wkt}}/g, bbox_wkt)
    .replace(/{{nonspatial_filters}}/g, nonspatial_filters)
    .replace(/{{table_name}}/g, okm.G.TABLE_NAME)
    .replace(/{{offset}}/g, offset)
    .replace(/{{per_page}}/g, okm.G.PER_PAGE);
  return q;
}


okm.filter.build_where = function(properties){
  var years;
  var props = properties;
  var filters = Object.keys(okm.filter.criteria);
  var i = filters.length -1;
  var q = "";

  //TODO add check for text search input and include

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

okm.search_carto = function(query){
  return okm.util.sql(query, function(d){
    featuresTemp = [];
    var lyrs = okm.map.layers.okmaps.getLayers();
    var full_title, short_title;
    var len = lyrs.length;
    var rows = d.rows;
    var ld = rows.length;
    console.log(ld + " rows");
    var cdb_ids = [];
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
          
          if (cdb_ids.indexOf(l.feature.properties.cartodb_id) === -1){
             cdb_ids.push(l.feature.properties.cartodb_id);
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
          }
          break;
        }
      }
      
    }
    end = performance.now();
    console.log("matching by id:  "+ (end - start) + " milliseconds.");
    
  },"json");
};

function filterRankFeatures(){
  console.log("filterRankFeatures");
  var bbox = map.getBounds();
  var q = buildFilterRankQuery(bbox, okm.util.get_offset());
  return okm.search_carto(q);
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


$("#more-results").click(function(e){
  okm.sidebar.more_results();
});

okm.sidebar.add_results = function(){
  if (featuresTemp.length > 0){
    $("#no-results-found").hide();
    featureList.add(featuresTemp);
  }
  else if ($("tr.feature-row").length === 0){
    $("#no-results-found").show();
  }
};

okm.sidebar.more_results = function(){
  okm.G.PAGE_NUMBER++;
  $("#loading").show();
  if (!okm.text_search.text_searching){
    okm.map.more_results();
  }
  else {
    okm.text_search.more_results();
  }
};

okm.map.more_results = function(){
  filterRankFeatures(okm.map.layers.okmaps).then(function(){
    featureList.add(featuresTemp);
    $("#loading").hide();
  }, function(err){
    console.log(err);
    $("#loading").hide();        
  });  
};

okm.sidebar.sync = function() {
  console.log("okm.sidebar.sync");
  var start,start2,end,end2;

  /* Loop through theaters layer and add only features which are in the map bounds */
  if (!timeline_added){
    
      start = performance.now();
      $("#loading").show();

      filterRankFeatures(okm.map.layers.okmaps).then(function(){

        featureList.clear();
        okm.sidebar.add_results();
        $(".sidebar-table").scrollTop(0);

        end = performance.now();
        console.log("3:  "+ (end - start) + " milliseconds.");
        $("#loading").hide();
      },function(err){
        console.log(err);
        $("#loading").hide();        
      });  
  }
    else {
      filterRankFeatures(timeline);
    }
};


/* Attribution control */
function updateAttribution(e) {
  $.each(map._layers, function(index, layer) {
    if (layer.getAttribution) {
      $("#attribution").html((layer.getAttribution()));
    }
  });
}

  okm.map.layers.street = L.tileLayer("https://api.mapbox.com/styles/v1/mapbox/streets-v9/tiles/{z}/{x}/{y}{{retina}}?access_token={{token}}".replace("{{retina}}", L.Browser.retina ? "@2x" : "").replace("{{token}}",okm.G.MB_TOKEN), {
    maxZoom: 19,
    tileSize: 512,
    zoomOffset: -1,
    attribution: "&copy; Mapbox"
  });
  okm.map.layers.satellite = L.tileLayer("https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v10/tiles/{z}/{x}/{y}{{retina}}?access_token={{token}}".replace("{{retina}}", L.Browser.retina ? "@2x" : "").replace("{{token}}",okm.G.MB_TOKEN), {
    maxZoom: 19,
    tileSize: 512,
    zoomOffset: -1,
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
        var iiif_url = okm.G.IIIF_URL.replace("{{contentdm_number}}", feature.properties.contentdm_number);
        var iiif_div_id = "iiif-" + feature.properties.contentdm_number;
        var ref_url = okm.G.REF_URL + feature.properties.contentdm_number;
        var content = "<table class='table table-striped table-bordered table-condensed'>" +
          "<tr><td>" + feature.properties.title.replace("'","&#39;") + "</td></tr>"+
          "<tr><td><a href='"+ ref_url+ "'>"+ ref_url +"</a></td></tr>"+
          "<tr><td>"+
          //"<div class='feature-modal-image-helper'><a target='_none' href='"+ ref_url+"'><img class='feature-img img-responsive' alt= '" + 
          //feature.properties.title.replace("'","&#39;")+ "'src='"+
          //img_url+"'/></a></div>"+
          "<div class='iiif-map' id='" + iiif_div_id + "' style='width:auto;" + 
           "height:"+ okm.G.MODAL_HEIGHT +"px';></div>"+
          "</td></tr></table>";

        layer.on({
          click: function (e) {
            $("#feature-title").html(feature.properties.title);
            $("#loading").show();
            $("#feature-info").html(content);
            //$("#featureModal img").on("load",function(){
              $("#loading").hide();
              $("#featureModal").modal("show");
              okm.iiif_map = L.map(iiif_div_id,{
                center: [0,0],
                crs: L.CRS.Simple,
                zoom:0,
                fullscreenControl: true
              });

              $("#featureModal .leaflet-control-fullscreen a").wrapInner("<i class='fas fa-expand fa-2x'></i>");
              L.tileLayer.iiif(iiif_url).addTo(okm.iiif_map);
              addToHighlight(feature);
            //});
            
          }
        });

      }
    }
  });

  var init_bounds_str = okm.util.get_url_hash_object().loc || "-103.62304687500001,31.690781806136822,-93.40576171875001,39.57182223734374";
  var init_bounds = okm.util.bboxStringToLatLngBounds(init_bounds_str);
  map = L.map("map", {
    layers: [okm.map.layers.street, okm.map.layers.okmapsLayer, okm.map.layers.highlight],
    zoomControl: false,
    attributionControl: false
  });
  map.fitBounds(init_bounds);
 

var searchControl = L.control.geocoder(okm.G.MAPZEN_KEY, {
  position: "topright",
  fullWidth: 400,
  placeholder: null,
  autocomplete: false,
  title: "Search for a place."
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
    if (okm.util.autosearch_status()){
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
          $(sibs[0]).remove();
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
    }
  };

  var layerControl = L.control.groupedLayers(baseLayers, {
    collapsed: isCollapsed
  }).addTo(map);

  searchControl.addTo(map);
  var searchIcon = $(searchControl.getContainer())
    .find("a")
    .attr("title", "Search for a place.")
    .wrapInner("<span class='fa-stack fa-lg' style='right:3px;bottom:3px;'><i class='fal fa-search fa-stack-2x' style='left:3px;top:2px;'></i><i class='fas fa-map-marker-alt fa-stack-1x'></i></span>");
   
   $("#input_text_search").addClear({
      symbolClass: "far fa-times-circle",
      onClear: function(){
        okm.G.text_searching = false;
        okm.sidebar.sync();
      }
   })
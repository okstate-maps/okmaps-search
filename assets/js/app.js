/*
  Copyright (c) 2014, Alexandre Melard
  All rights reserved.   
  Copyright (c) 2008-2014 Institut National de l'Information Geographique et Forestiere (IGN) France.
  Released under the BSD license.
  ---------------------------------------------------------
  Leaflet class to support WMTS (based on L.TileLayer.WMS)
  from https://github.com/mylen/leaflet.TileLayer.WMTS
 */
L.TileLayer.WMTS = L.TileLayer.extend({
    defaultWmtsParams: {
        service: 'WMTS',
        request: 'GetTile',
        version: '1.0.0',
        layers: '',
        styles: '',
        tilematrixSet: '',
        format: 'image/jpeg'
    },

    initialize: function (url, options) { // (String, Object)
        this._url = url;
        var wmtsParams = L.extend({}, this.defaultWmtsParams);
        var tileSize = options.tileSize || this.options.tileSize;
        if (options.detectRetina && L.Browser.retina) {
            wmtsParams.width = wmtsParams.height = tileSize * 2;
        } else {
            wmtsParams.width = wmtsParams.height = tileSize;
        }
        for (var i in options) {
            // all keys that are not TileLayer options go to WMTS params
            if (!this.options.hasOwnProperty(i) && i!="matrixIds") {
                wmtsParams[i] = options[i];
            }
        }
        this.wmtsParams = wmtsParams;
        this.matrixIds = options.matrixIds||this.getDefaultMatrix();
        L.setOptions(this, options);
    },

    onAdd: function (map) {
        this._crs = this.options.crs || map.options.crs;
        L.TileLayer.prototype.onAdd.call(this, map);
    },

    getTileUrl: function (coords) { // (Point, Number) -> String
        var tileSize = this.options.tileSize;
        var nwPoint = coords.multiplyBy(tileSize);
        nwPoint.x+=1;
        nwPoint.y-=1;
        var sePoint = nwPoint.add(new L.Point(tileSize, tileSize));
        var zoom = this._tileZoom;
        var nw = this._crs.project(this._map.unproject(nwPoint, zoom));
        var se = this._crs.project(this._map.unproject(sePoint, zoom));
        tilewidth = se.x-nw.x;
        var ident = this.matrixIds[zoom].identifier;
        var X0 = this.matrixIds[zoom].topLeftCorner.lng;
        var Y0 = this.matrixIds[zoom].topLeftCorner.lat;
        var tilecol=Math.floor((nw.x-X0)/tilewidth);
        var tilerow=-Math.floor((nw.y-Y0)/tilewidth);
        var url = L.Util.template(this._url, {s: this._getSubdomain(coords)});
        return url + L.Util.getParamString(this.wmtsParams, url) + "&tilematrix=" + ident + "&tilerow=" + tilerow +"&tilecol=" + tilecol ;
    },

    setParams: function (params, noRedraw) {
        L.extend(this.wmtsParams, params);
        if (!noRedraw) {
            this.redraw();
        }
        return this;
    },
    
    getDefaultMatrix : function () {
        /**
         * the matrix3857 represents the projection 
         * for in the IGN WMTS for the google coordinates.
         */
        var matrixIds3857 = new Array(22);
        for (var i= 0; i<22; i++) {
            matrixIds3857[i]= {
                identifier    : "" + i,
                topLeftCorner : new L.LatLng(20037508.3428,-20037508.3428)
            };
        }
        return matrixIds3857;
    }
});

L.tileLayer.wmts = function (url, options) {
    return new L.TileLayer.WMTS(url, options);
};







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
 geo = [];

var okm = {};
okm.G = {};
okm.state = {};
okm.util = {};

okm.sidebar = {};
okm.filter = {};
//criteria obj keys must correspond to table fields
okm.filter.criteria = {};


okm.filter.filter_rank_query = 

"SELECT"+
    " cartodb_id"+

" FROM {{table_name}} WHERE "+

//from filter button and will eventually include text search
" {{nonspatial_filters}}" + 

//" ST_GeomFromText('{{bbox_wkt}}', 4326) && the_geom AND"+
" ST_GeomFromText('{{bbox_wkt}}', 4326) && the_geom"+

" ORDER BY "+
//area of overlap
"("+
  //"  ST_Area("+
  "    CASE"+
  "      WHEN ST_Contains(  St_Transform(St_geomfromtext('{{bbox_wkt}}', 4326),3857), the_geom_webmercator)"+
  //"        THEN the_geom_webmercator"+
  "        THEN area"+
  "      WHEN ST_Within(  St_Transform(St_geomfromtext('{{bbox_wkt}}', 4326),3857), the_geom_webmercator)"+
  "        THEN ST_Area(St_Transform(St_geomfromtext('{{bbox_wkt}}', 4326),3857))"+
  "      ELSE"+
  "         ST_Area(ST_Intersection("+
  "             St_Transform(St_geomfromtext('{{bbox_wkt}}', 4326),3857),"+
  "             the_geom_webmercator"+
  "         ) "+ //st_intersection
  "         ) "+ // last st_area
        " END "+  //CASE
  //")"+//st_area

  " / area ) "+

  "+ "+
  
  //" (ST_Area("+
  " ("+
  "   CASE"+
  "      WHEN ST_Contains(  St_Transform(St_geomfromtext('{{bbox_wkt}}', 4326),3857), the_geom_webmercator)"+
  //"        THEN the_geom_webmercator"+
  "        THEN area"+
  "      WHEN ST_Within(  St_Transform(St_geomfromtext('{{bbox_wkt}}', 4326),3857), the_geom_webmercator)"+
  "        THEN   ST_Area(St_Transform(St_geomfromtext('{{bbox_wkt}}', 4326),3857))"+
  "      ELSE"+
  "         ST_Area(ST_Intersection("+
  "             St_Transform(St_geomfromtext('{{bbox_wkt}}', 4326),3857),"+
  "         the_geom_webmercator"+
  "      ) "+ //st_intersection
  "      ) "+ //st_area
      " END "+  //CASE
  //"  )"+  //st_area" 
  "   / "+
  "   ST_Area("+
  "     St_Transform("+
  "       St_geomfromtext('{{bbox_wkt}}', 4326),"+
  "      3857))"+

  "  ) DESC"+

// TODO add user sorting

" LIMIT {{per_page}} OFFSET {{offset}}";


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
okm.map.styles.geocode = {
        color: "#37b6e5",
        weight: 1
      };
okm.map.styles.bounds_rectangle = {
        color: "#8e8e8e",
        weight: 1
      };

okm.iiif = {};
okm.G.CARTO_USER = "krdyke";
okm.G.MB_TOKEN = "pk.eyJ1Ijoia3JkeWtlIiwiYSI6Ik15RGcwZGMifQ.IR_NpAqXL1ro8mFeTIdifg";
okm.G.MAPZEN_KEY = "mapzen-6dXEegt";
okm.G.TABLE_NAME = "okmaps2";
okm.G.PER_PAGE = 10;
okm.G.PAGE_NUMBER = 1;
okm.G.DEFAULT_BBOX_STRING = "-103.62304687500001,31.690781806136822,-93.40576171875001,39.57182223734374";
okm.G.QUERY_URL = "https://{{username}}.carto.com/api/v2/sql".replace("{{username}}", okm.G.CARTO_USER);
okm.G.BASE_URL = "SELECT {{fields}} FROM {{table_name}}";
//okm.G.CDM_ROOT = "http://dc.library.okstate.edu";
okm.G.CDM_ROOT = "https://cdm17279.contentdm.oclc.org";
okm.G.REF_URL = okm.G.CDM_ROOT + "/cdm/ref/collection/OKMaps/id/";
okm.G.IMG_URL = okm.G.CDM_ROOT + "/utils/ajaxhelper/?CISOROOT=OKMaps&CISOPTR={{contentdm_number}}&action=2&DMSCALE={{scale}}&DMWIDTH={{width}}&DMHEIGHT={{height}}&DMX=0&DMY=0&DMTEXT=&DMROTATE=0";
okm.G.IIIF_BASE_URL = okm.G.CDM_ROOT + "/digital/iiif/OKMaps/{{contentdm_number}}/";
okm.G.IIIF_INFO_URL = okm.G.IIIF_BASE_URL + "info.json";
okm.G.IIIF_MAX_URL = okm.G.IIIF_BASE_URL + "full/max/0/default.jpg";

//max size url example
//https://cdm17279.contentdm.oclc.org/digital/iiif/OKMaps/94/full/max/0/default.jpg
okm.G.THUMBNAIL_URL = okm.G.CDM_ROOT + "/utils/getthumbnail/collection/OKMaps/id/";
okm.G.MODAL_HEIGHT = Math.round($("#featureModal").height() * 0.65);
okm.G.TABLE_FIELDS = [
  "the_geom", 
  "title", 
  "cartodb_id", 
  "original_date",
  "contentdm_number",
  "collection",
  //"img_width",
  //"img_height",
];
okm.G.CARTO_URL = okm.G.BASE_URL
    .replace("{{table_name}}", okm.G.TABLE_NAME)
    .replace("{{fields}}", okm.G.TABLE_FIELDS.join(", "));
<<<<<<< HEAD

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
=======
>>>>>>> gh-pages

okm.util.check_if_need_load = function(elem){
  if (elem.scrollHeight - elem.scrollTop === elem.clientHeight ||
      Math.abs((elem.scrollHeight - elem.scrollTop) - elem.clientHeight) < 2){

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


/**
  Unchecks the checkbox that determines if the map results are refreshed on pan/zoom.
*/
okm.util.autosearch_off = function(){
  $("#search-on-map-move").get()[0].checked = false;
};


/**
  Checks the checkbox that determines if the map results are refreshed on pan/zoom.
*/
okm.util.autosearch_on = function(){
  $("#search-on-map-move").get()[0].checked = true;
};

/**
  Returns the current state of the checkbox that determines if the map results are refreshed on pan/zoom.
*/
okm.util.autosearch_status = function(){
  return $("#search-on-map-move").get()[0].checked;
};

/**
  Returns the contents of the URL hash, split into key/value pairs
*/
okm.util.get_url_hash_object = function (){
  var a = {}, i;
  var h = location.hash.slice(1).split("&");
  for (i = 0; i < h.length; i++){
    var keyvalue = h[i].split("=");
    a[keyvalue[0]] = keyvalue[1];
  }
  return a;
};

/**
  Assymmetric bounds pad function derived from bounds.pad. By default, makes a
  bounds that is wider than it is high.
*/
okm.util.assymmetric_pad = function (bounds, heightBufferRatio, widthBufferRatio) {
  var sw = bounds._southWest,
    ne = bounds._northEast,
    hbr = heightBufferRatio || -0.2,
    wbr = widthBufferRatio || -0.1,
    heightBuffer,
    widthBuffer;
  
  heightBuffer = Math.abs(sw.lat - ne.lat) * hbr;
  widthBuffer = Math.abs(sw.lng - ne.lng) * wbr;
  //debugger;
  return new L.LatLngBounds(
    new L.LatLng(sw.lat - heightBuffer, sw.lng - widthBuffer),
    new L.LatLng(ne.lat + heightBuffer, ne.lng + widthBuffer));
}


$(window).resize(function() {
  sizeLayerControl();
});

/**
  Click handler to route clicks on the map results table to trigger a click on the correct row.
*/
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

//unused atm
$("#legend-btn").click(function() {
  $("#legendModal").modal("show");
  $(".navbar-collapse.in").collapse("hide");
  return false;
});

//unused atm
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
  okm.iiif.map.remove();
  $("#featureInfo").empty();
});

// waits until feature modal fully drawn to add IIIF layer,
// so as to get the map size right
$("#featureModal").on("shown.bs.modal", function(){
  L.tileLayer.iiif(okm.iiif.url).addTo(okm.iiif.map);
})

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

//function buildFilterRankQuery(input_bounds, offset, min_d){
function buildFilterRankQuery(input_bounds, offset){
  var nonspatial_filters = okm.filter.build_where();
  var bbox_wkt = okm.util.bboxStringToWKT(input_bounds.toBBoxString());
  var url = okm.G.BASE_URL.replace("{{username}}", okm.G.CARTO_USER)
    .replace("{{table_name}}", okm.G.TABLE_NAME)
    .replace("{{fields}}", "cartodb_id");
<<<<<<< HEAD
  var q = okm.filter.filter_rank_query
    .replace(/{{bbox_wkt}}/g, bbox_wkt)
    .replace(/{{nonspatial_filters}}/g, nonspatial_filters)
    .replace(/{{table_name}}/g, okm.G.TABLE_NAME)
    .replace(/{{offset}}/g, offset)
    .replace(/{{per_page}}/g, okm.G.PER_PAGE);
=======
  var q = okm.filter.filter_rank_query;

  q = q.replace(/{{bbox_wkt}}/g, bbox_wkt)
      .replace(/{{distance_ratio_multiplier}}/g, "1")
      .replace(/{{area_ratio_multiplier}}/g, "1")
      .replace(/{{nonspatial_filters}}/g, nonspatial_filters)
      .replace(/{{table_name}}/g, okm.G.TABLE_NAME)
      .replace(/{{offset}}/g, offset)
      .replace(/{{per_page}}/g, okm.G.PER_PAGE);
>>>>>>> gh-pages
  return q;
}

// okm.filter.build_min_centroid_dist_query = function(bbox){
//   var bbox_wkt = okm.util.bboxStringToWKT(bbox.toBBoxString());
//   var query = okm.filter.min_centroid_dist_query
//     .replace("{{table_name}}", okm.G.TABLE_NAME)
//     .replace("{{bbox_wkt}}", bbox_wkt);
//   return query;
// }

// okm.filter.get_min_centroid_dist = function(query){
//   return okm.util.sql(query, function(d){return d.rows[0].min_d}, "json");
// }

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
        q = q + "collection in ('" + okm.filter.criteria.collection.join("','") + "') AND ";
        break;

      case "original_date":
        years = okm.filter.criteria.original_date;
        q = q + "original_date BETWEEN " + years[0] + " AND " + years[1] + " AND ";
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
    //console.log(ld + " rows");
    var cdb_ids = [];
    var cdb_id;

    //var start, end;
    //start = performance.now();
    for (var i = 0; i < ld; i++){
      cdb_id = rows[i].cartodb_id;
      //console.log("id: " + rows[i].cartodb_id);
      //console.log("dist ratio: " + rows[i].distance_ratio);
      // console.log("area ratio: " + rows[i].area_ratio);
      // console.log("combined/weighted: " + rows[i].centroid_area_comb);
      //console.log("---------");
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
              "feature-name-hover": full_title,
              "feature-sort-name":l.feature.properties.original_date,
              "feature-thumbnail":okm.G.THUMBNAIL_URL + l.feature.properties.contentdm_number,
              "feature-row": full_title          
            });
          }
          break;
        }
      }
      
    }
    //end = performance.now();
    //console.log("matching by id:  "+ (end - start) + " milliseconds.");
    
  },"json");
};

// function filterRankFeatures(){
//   //console.log("filterRankFeatures");
//   var bbox = map.getBounds();
//   var min_d_q = okm.filter.build_min_centroid_dist_query(bbox);
//   return okm.filter.get_min_centroid_dist(min_d_q).then(function(d){
//     var min_d = d.rows[0].min_d;
//     console.log("Min distance: " + min_d);
//     var q = buildFilterRankQuery(bbox, okm.util.get_offset(), min_d);
//     return okm.search_carto(q);
    
//   });
// }

function filterRankFeatures(){
  // console.log("filterRankFeatures");
  //var bbox = okm.map.map_object.getBounds();
  var bbox = okm.util.assymmetric_pad(okm.map.map_object.getBounds());
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
  var loc = "loc="+ okm.map.map_object.getBounds().toBBoxString();
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
   var start, end;
  start = performance.now();
  
  filterRankFeatures(okm.map.layers.okmaps).then(function(){
    end = performance.now();
    console.log("filterRankFeatures:  "+ (end - start) + " milliseconds.");
    featureList.add(featuresTemp);
    $("#loading").hide();
  }, function(err){
    console.log(err);
    $("#loading").hide();        
  });  
};

okm.sidebar.sync = function() {
<<<<<<< HEAD
  console.log("okm.sidebar.sync");
=======
  //console.log("okm.sidebar.sync");
>>>>>>> gh-pages
  var start, end;
  start = performance.now();
  $("#loading").show();

  filterRankFeatures(okm.map.layers.okmaps).then(function(){

<<<<<<< HEAD
    featureList.clear();
    okm.sidebar.add_results();
    $(".sidebar-table").scrollTop(0);

    end = performance.now();
    console.log("3:  "+ (end - start) + " milliseconds.");
=======
    end = performance.now();
    console.log("filterRankFeatures:  "+ (end - start) + " milliseconds.");

    featureList.clear();
    okm.sidebar.add_results();
    $(".sidebar-table").scrollTop(0);
>>>>>>> gh-pages
    $("#loading").hide();
    
  }, function(err){
    console.log(err);
    $("#loading").hide();        
  });  
};


/* Attribution control */
function updateAttribution(e) {
  $.each(okm.map.map_object._layers, function(index, layer) {
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
  okm.map.layers.counties = L.tileLayer("https://api.mapbox.com/styles/v1/krdyke/cj7rus41ceagg2rny2tgglav3/tiles/256/{z}/{x}/{y}{{retina}}?access_token={{token}}".replace("{{retina}}", L.Browser.retina ? "@2x" : "").replace("{{token}}", okm.G.MB_TOKEN), {
    maxZoom: 19,
    tileSize: 256
    //zoomOffset: -1
  });

  okm.map.layers.townshiprange = L.tileLayer.wmts(
    "https://tiles{s}.arcgis.com/tiles/jWQlP64OuwDh6GGX/arcgis/rest/services/OK_TownshipRange/MapServer/WMTS",
    { 
      layer: 'OK_TownshipRange',
      style: 'default',
      tilematrixSet: "default028mm",
      format: 'image/png',
      subdomains: '1234'
    }
  );

  /* Overlay Layers */
  okm.map.layers.highlight = L.geoJson(null, {
    "style": function(f){
      return okm.map.styles.highlight;
    }
  });
  
  
  /* Empty layer placeholder to add to layer control for listening when to add/remove okmaps to markerClusters layer */
  okm.map.layers.okmapsLayer = L.geoJson(null);
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
        //var img_url = okm.G.IMG_URL.replace("{{contentdm_number}}", feature.properties.contentdm_number)
        //                .replace("{{width}}", feature.properties.img_width/10)
        //                .replace("{{height}}", feature.properties.img_height/10)
        //                .replace("{{scale}}", 10);
        var iiif_url = okm.G.IIIF_INFO_URL.replace("{{contentdm_number}}", feature.properties.contentdm_number);
        var iiif_div_id = "iiif-" + feature.properties.contentdm_number;
        var ref_url = okm.G.REF_URL + feature.properties.contentdm_number;
        var content = "<table class='table table-striped table-bordered table-condensed'>" +
          "<tr><td>" + feature.properties.title.replace("'","&#39;") + "</td></tr>"+
          "<tr><td><a href='"+ ref_url+ "'>"+ ref_url +"</a></td></tr>"+
          "<tr><td>"+
          //"<div class='feature-modal-image-helper'><a target='_none' href='"+ ref_url+"'><img class='feature-img img-responsive' alt= '" + 
          //feature.properties.title.replace("'","&#39;")+ "'src='"+
          //img_url+"'/></a></div>"+
          "<div class='iiif-map' id='" + iiif_div_id + "' style='width:auto;'></div>"+
          "</td></tr></table>";

        layer.on({
          click: function (e) {
            $("#feature-title").html(feature.properties.title);
            $("#loading").show();
            $("#feature-info").html(content);
            //$("#featureModal img").on("load",function(){
            $("#loading").hide();
            $(".iiif-map").css("height", Math.round($("#container").height() * 0.50) + "px");
            $("#featureModal").modal("show");
          
            okm.iiif.map = L.map(iiif_div_id,{
              center: [0,0],
              crs: L.CRS.Simple,
              zoom:0,
              fullscreenControl: true
            });
            
            okm.iiif.url = iiif_url;

            $("#featureModal .leaflet-control-fullscreen a").wrapInner("<i class='fas fa-expand fa-2x'></i>");
  
            addToHighlight(feature);
            
          }
        });
      }
    }
  });

  var init_bounds_str = okm.util.get_url_hash_object().loc || okm.G.DEFAULT_BBOX_STRING;
  var init_bounds = okm.util.bboxStringToLatLngBounds(init_bounds_str);
  okm.map.map_object = L.map("map", {
    layers: [okm.map.layers.street, okm.map.layers.okmapsLayer, okm.map.layers.highlight],
    zoomControl: false,
    attributionControl: false,
    renderer: L.svg({ padding: 100 }) // so search rectangle doesn't get clipped during dragging
  });
  okm.map.map_object.fitBounds(init_bounds);
 
//geocoding
  var searchControl = new L.Control.Geocoder({
    geocoder: L.Control.Geocoder.mapbox(okm.G.MB_TOKEN),
    defaultMarkGeocode: false
  }).on('markgeocode', function(e) {
        var bbox = e.geocode.bbox;
        var poly = L.polygon([
             bbox.getSouthEast(),
             bbox.getNorthEast(),
             bbox.getNorthWest(),
             bbox.getSouthWest()
        ],
          okm.map.styles.geocode
        );
        poly.on("click", function(){
          poly.removeFrom(okm.map.map_object);
        });
        poly.addTo(okm.map.map_object);
        okm.map.map_object.fitBounds(poly.getBounds());
  });

searchControl.onAdd = function (map) {
      var className = 'leaflet-control-geocoder',
          container = L.DomUtil.create('div', className + ' leaflet-bar'),
          icon = L.DomUtil.create('button', className + '-icon', container),
          form = this._form = L.DomUtil.create('div', className + '-form', container),
          input;

      this._map = map;
      this._container = container;

      icon.innerHTML = '<i class="fa fa-map-signs fa-2x"></i>';
      icon.type = 'button';

      input = this._input = L.DomUtil.create('input', '', form);
      input.type = 'text';
      input.placeholder = this.options.placeholder;

      this._errorElement = L.DomUtil.create('div', className + '-form-no-error', container);
      this._errorElement.innerHTML = this.options.errorMessage;

      this._alts = L.DomUtil.create('ul',
        className + '-alternatives leaflet-control-geocoder-alternatives-minimized',
        container);
      L.DomEvent.disableClickPropagation(this._alts);

      L.DomEvent.addListener(input, 'keydown', this._keydown, this);
      if (this.options.geocoder.suggest) {
        L.DomEvent.addListener(input, 'input', this._change, this);
      }
      L.DomEvent.addListener(input, 'blur', function() {
        if (this.options.collapsed && !this._preventBlurCollapse) {
          this._collapse();
        }
        this._preventBlurCollapse = false;
      }, this);


      if (this.options.collapsed) {
        if (this.options.expand === 'click') {
          L.DomEvent.addListener(container, 'click', function(e) {
            if (e.button === 0 && e.detail !== 2) {
              this._toggle();
            }
          }, this);
        }
        //else if (L.Browser.touch && this.options.expand === 'touch') {
        else {
          L.DomEvent.addListener(container, 'touchstart mousedown', function(e) {
            this._toggle();
            e.preventDefault(); // mobile: clicking focuses the icon, so UI expands and immediately collapses
            e.stopPropagation();
          }, this);
        }
        // else {
        //   L.DomEvent.addListener(container, 'mouseover', this._expand, this);
        //   L.DomEvent.addListener(container, 'mouseout', this._collapse, this);
        //   this._map.on('movestart', this._collapse, this);
        // }
      } else {
        this._expand();
        if (L.Browser.touch) {
          L.DomEvent.addListener(container, 'touchstart', function(e) {
            this._geocode(e);
          }, this);
        }
        else {
          L.DomEvent.addListener(container, 'click', function(e) {
            this._geocode(e);
          }, this);
        }
      }

      if (this.options.defaultMarkGeocode) {
        this.on('markgeocode', this.markGeocode, this);
      }

      this.on('startgeocode', function() {
        L.DomUtil.addClass(this._container, 'leaflet-control-geocoder-throbber');
      }, this);
      this.on('finishgeocode', function() {
        L.DomUtil.removeClass(this._container, 'leaflet-control-geocoder-throbber');
      }, this);

      L.DomEvent.disableClickPropagation(container);

      return container;
    }

searchControl.addTo(okm.map.map_object);
//debugger;


      
// var searchControl = L.control.geocoder(okm.G.MAPZEN_KEY, {
//   position: "topright",
//   fullWidth: 400,
//   placeholder: null,
//   autocomplete: false,
//   title: "Search for a place."
// });

 
  /* Layer control listeners that allow for a single markerClusters layer */
  okm.map.map_object.on("overlayadd", function(e) {
    if (e.layer === okm.map.layers.okmapsLayer) {
      //markerClusters.addLayer(okmaps);
      okm.sidebar.sync();
    }
  });

  okm.map.map_object.on("overlayremove", function(e) {
    if (e.layer === okm.map.layers.okmapsLayer) {
      //markerClusters.removeLayer(okmaps);
      okm.sidebar.sync();
    }
  });

  okm.map.map_object.on("dragstart", function (e) {
    var b = okm.util.assymmetric_pad(this.getBounds());
    okm.map.bounds_rectangle = L.rectangle(b, okm.map.styles.bounds_rectangle);
    okm.map.bounds_rectangle.addTo(okm.map.map_object);

    okm.map.map_object.on("drag", function (e) {
      var b = okm.util.assymmetric_pad(this.getBounds());
      okm.map.bounds_rectangle.setBounds(b);
    });

});


  okm.map.map_object.on("dragend", function (e) {
    if (okm.map.bounds_rectangle){
      okm.map.map_object.off("drag", function (e) {
        var b = okm.util.assymmetric_pad(this.getBounds());
        okm.map.bounds_rectangle.setBounds(b);
      }); 
      okm.map.bounds_rectangle.removeFrom(okm.map.map_object);
    }
  });

  /* Filter sidebar feature list to only show features in current map bounds */
  okm.map.map_object.on("moveend", function (e) {
    okm.G.PAGE_NUMBER = 1;
    if (okm.util.autosearch_status()){
      okm.sidebar.sync();
    }
    syncUrlHash();
  });

  /* Clear feature highlight when map is clicked */
  okm.map.map_object.on("click", function(e) {
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

    okm.map.map_object.addLayer(okm.map.layers.okmapsLayer);
    okm.map.map_object.fire("moveend");
  });

  okm.map.map_object.on("layeradd", updateAttribution);
  okm.map.map_object.on("layerremove", updateAttribution);

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
  }).addTo(okm.map.map_object);

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
  }).addTo(okm.map.map_object);
  
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
    "Overlays": {
      "OK Counties": okm.map.layers.counties,
      "OK Township Range": okm.map.layers.townshiprange
    }
  };

  var layerControl = L.control.groupedLayers(baseLayers, groupedOverlays, {
    collapsed: isCollapsed
  }).addTo(okm.map.map_object);

  // geocoding
   searchControl.addTo(okm.map.map_object);
  // var searchIcon = $(searchControl.getContainer())
  //   .find("a")
  //   .attr("title", "Search for a place.")
  //   .wrapInner("<span class='fa-stack fa-lg' style='right:3px;bottom:3px;'><i class='fal fa-search fa-stack-2x' style='left:3px;top:2px;'></i><i class='fas fa-map-marker-alt fa-stack-1x'></i></span>");
   
   $("#input_text_search").addClear({
      symbolClass: "far fa-times-circle",
      onClear: function(){
        okm.G.text_searching = false;
        okm.sidebar.sync();
      }
   })


L.Control.UpdateSearchCheckbox = L.Control.extend({
  
  onAdd: function(map){
    var div = L.DomUtil.create("div");
    var content = '<div  class="autosearch" data-step="4" data-intro="Uncheck this to prevent results from changing when you move the map.">'+
                    '<input id="search-on-map-move" checked="" type="checkbox">'+
                    '<label class="disable-text-selection" for="search-on-map-move"> Redo search when I move the map</label>'+
                  '</div>';
    div.innerHTML = content;
    L.DomEvent.disableClickPropagation(div);
    return div;
  },

  onRemove: function(map){

  }

});

L.control.updatesearchcheckbox = function(opts){
  return new L.Control.UpdateSearchCheckbox(opts);

}

L.control.updatesearchcheckbox({position: "topleft"}).addTo(okm.map.map_object);
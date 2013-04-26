/*
 * jquery.graphview.js
 *
 * displays graph data results by querying a specified index
 * 
 * created by Mark MacGillivray - mark@cottagelabs.com
 *
 * copyheart 2013
 *
 * VERSION 0.0.3
 *
 * EXPERIMENTAL / IN EARLY DEVELOPMENT / THINGS MAY NOT WORK / WOMM
 *
 */

// Deal with indexOf issue in <IE9
// provided by commentary in repo issue - https://github.com/okfn/facetview/issues/18
if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function(searchElement /*, fromIndex */ ) {
        "use strict";
        if (this == null) {
            throw new TypeError();
        }
        var t = Object(this);
        var len = t.length >>> 0;
        if (len === 0) {
            return -1;
        }
        var n = 0;
        if (arguments.length > 1) {
            n = Number(arguments[1]);
            if (n != n) { // shortcut for verifying if it's NaN
                n = 0;
            } else if (n != 0 && n != Infinity && n != -Infinity) {
                n = (n > 0 || -1) * Math.floor(Math.abs(n));
            }
        }
        if (n >= len) {
            return -1;
        }
        var k = n >= 0 ? n : Math.max(len - Math.abs(n), 0);
        for (; k < len; k++) {
            if (k in t && t[k] === searchElement) {
                return k;
            }
        }
        return -1;
    }
}


(function($){
    $.fn.graphview = function(options) {



// ===============================================
// ===============================================
// set defaults and options
// ===============================================
// ===============================================

        var defaults = {
            "target": 'http://localhost:5005/everything',
            "ajaxtype": "GET",
            "datatype": "JSONP",
            "graphable": {
                "enabled": false,
                "ignore":[], 
                "only":[], 
                "promote":{'record':['keywords','tags']}, 
                "links":{'wikipedia':['topic'],'reference':['_parents'],'record':['children']},
                "ignoreisolated":false,
                "dropfacets":true,
                "drophits":true,
                "remote_source": "http://129.67.24.26:9200/test/record/_search"
            },
            "suggestsize": 100,
            "nodesize": 100,
            
            "defaultquery": {
                "query": {
                    "bool": {
                        "must":[]
                    }
                },
                "fields": "*",
                "partial_fields": [],
                "from":0,
                "size":100,
                "facets":{
                    "journals": {"term":{"field":"journal.name.exact","suggest": true, "node": true}},
                    "authors": {"term":{"field":"author.name.exact","suggest": true, "node": true}},
                    "titles": {"term":{"field":"title.exact","suggest": true, "node": true}},
                    "keywords": {"term":{"field":"keyword.exact","suggest": true, "node": false}},
                    "range": {"date_histogram": {"interval": "month", "field": "date"}}
                }
            },

            "nested": [],
            "sort":[],
            "default_operator": "AND",
            "query_string_fuzzify": false,
            
            "source": "will contain the query as a string whenever it is updated",
            "query": "will contain the query object whenever it is updated",
            "response": "will contain the elasticsearch result object when it is obtained",
            "q":"will contain a simple text string search parameter when provided as a query parameter (maybe)",
            
            "callback": false,
            
            "showlabels": false,
            "sharesave": true,
            "sharesave_include_facets": false,
            "searchonload": true,
            "pushstate": true,
            "linkify": true
            
        };

        $.fn.graphview.options = $.extend(defaults, options);
        var options = $.fn.graphview.options;




// ===============================================
// ===============================================
// force directed network graph functions
// ===============================================
// ===============================================

        // a custom fill
        var fill = function(pkg) {
            var cols = ['#111','#333','#222','#444','#666','#888','#000','#bbb','#ddd','#c9d2d4','#ed1c24'];
            if ( isNaN(pkg) ) {
                var ln = pkg.charCodeAt(0)%cols.length;
            } else {
                var ln = pkg%cols.length;
            }
            return cols[ln];
        };
        var fill = d3.scale.category20c();
        var fill = d3.scale.category10();

        var newterm = function(event) {
            event ? event.preventDefault() : false;
            var facet = $(this).attr('data-facet');
            var val = $(this).attr('data-value');
            if ( facet != "none" ) {
                var add = facet + '__________' + val;
            } else {
                var add = val;
            }
            // TODO: add  to the search terms box - or make this the search term, depending on search button pressed
            $(this).parent().parent().remove();
            query();
        };

        var showtitle = function(data) {
            var info = '<div class="well" style="margin-right:-10px;"><p>';
            info += '<a class="label graphview_newsearch" style="margin-right:3px;" data-facet="' + data.facet;
            info += '" data-value="' + data.className;
            info += '" alt="search only for this term" title="search only for this term" href="#">search</a> ';
            info += data.className;
            data.value && data.value > 1 ? info += ' (' + data.value + ')' : false;
            data.id.length != 1 || data.id.length == 1 && data.id[0] != data.className ? info += '<br>' + data.id : false;
            info += '</p></div>';
            $('.graphview_visinfo', obj).html("");
            $('.graphview_visinfo', obj).append(info);
            $('.graphview_newterm', obj).bind('click',newterm);
        };

        var force = function() {
            var w = obj.width();
            var h = obj.height();
            var vis = d3.select(".graphview_panel")
              .append("svg:svg")
                .attr("width", w)
                .attr("height", h)
                .attr("pointer-events", "all")
              .append('svg:g')
                .call(d3.behavior.zoom().on("zoom", redraw))
              .append('svg:g');

            vis.append('svg:rect')
                .attr('width', w)
                .attr('height', h)
                .attr('fill', 'white');

            function redraw() {
              vis.attr("transform",
                  "translate(" + d3.event.translate + ")"
                  + " scale(" + d3.event.scale + ")");
            }

              var force = d3.layout.force()
                  .charge(-180)
                  .linkDistance(60)
                  .nodes(options.nodes)
                  .links(options.links)
                  .size([w, h])
                  .start();

              var link = vis.selectAll("line.link")
                  .data(options.links)
                .enter().append("svg:line")
                  .attr("class", "link")
                  .attr("stroke", "#ddd")
                  .attr("stroke-opacity", 0.8)
                  .style("stroke-width", function(d) { return Math.sqrt(d.value); })
                  .attr("x1", function(d) { return d.source.x; })
                  .attr("y1", function(d) { return d.source.y; })
                  .attr("x2", function(d) { return d.target.x; })
                  .attr("y2", function(d) { return d.target.y; });

              var dom = d3.extent(options.nodes, function(d) {
                  return d.value;
              });
              var cr = d3.scale.sqrt().range([5, 25]).domain(dom);
              
              var node = vis.selectAll("circle.node")
                  .data(options.nodes)
                .enter().append("svg:circle")
                  .attr("class", "node")
                  .attr("cx", function(d) { return d.x; })
                  .attr("cy", function(d) { return d.y; })
                  .attr("r", function(d) { return cr(d.value); })
                  .style("fill", function(d) { return fill(d.group); })
                  .call(force.drag);

            var label = function(d) {
                var l = '';
                if ( d.value ) {
                    d.value > 1 ? l += '(' + d.value + ') ' : false;
                }
                if ( d.className ) {
                    if ( isNaN(d.className) ) {
                        l += d.className;//.substr(0,35);
                        if ( d.className.length == 0 || d.className == "\n" ) {
                            l += 'NO SUITABLE VALUE';
                        }
                        d.className.length > 35 ? l += '...' : false;
                    } else if ( Date.parse(d.className) ) {
                        var date = new Date(d.className);
                        l += date.getDate() + '/' + (date.getMonth() + 1) + '/' + date.getFullYear();
                    } else if (date = new Date(d.className) ) {
                        if ( date.getDate() && date.getMonth() && date.getFullYear() ) {
                            l += date.getDate() + '/' + (date.getMonth() + 1) + '/' + date.getFullYear();
                        } else {
                            l += d.className;
                        }
                    } else {
                        l += d.className;
                    }
                }
                return l;
            }
            var texts = vis.selectAll("text.label")
                .data(options.nodes)
                .enter().append("text")
                .attr("class", "svglabel")
                .attr("fill", "#bbb")
                .text(function(d) {  return label(d); });
                
              node.append("svg:title")
                  .text(function(d) { return 'CLICK FOR OPTIONS - ' + d.className; });

                node.on('click',function(d) {
                    showtitle(d)
                })


              vis.style("opacity", 1e-6)
                .transition()
                  .duration(1000)
                  .style("opacity", 1);

              force.on("tick", function() {
                link.attr("x1", function(d) { return d.source.x; })
                    .attr("y1", function(d) { return d.source.y; })
                    .attr("x2", function(d) { return d.target.x; })
                    .attr("y2", function(d) { return d.target.y; });

                node.attr("cx", function(d) { return d.x; })
                    .attr("cy", function(d) { return d.y; });

               texts.attr("transform", function(d) {
                    return "translate(" + (d.x - cr(d.value)) + "," + (d.y + cr(d.value) + 5) + ")";
                });

              });

            !options.showlabels ? $('.svglabel').hide() : $('.svglabel').show();
        
        };
        



// ===============================================
// ===============================================
// control functions
// ===============================================
// ===============================================

        var trackoptions = function(event) {
            var option = $(this).attr('data-option');
            var val = $(this).val();
            // deal with value lists as appropriate, 
            // or batches of options for the same thing, like radio choices
            // set the relevant option whenever this changes
            // should changes trigger a new query?
        }

        // set whether or not to ignore isolated when graphing backend is available
        var isolated = function() {
            if ( options.graphable.ignoreisolated ) {
                options.graphable.ignoreisolated = false;
            } else {
                options.graphable.ignoreisolated = true;
            };
            query();
        };

        // set what sort of suggestions the searchbox should be showing
        var setsuggestfield = function(event) {
            event ? event.preventDefault() : false;
            $(this).css({'color':fill($('option:selected',this).attr('data-value'))});
            options.suggest = $('option:selected',this).attr('data-value');
        };




// ===============================================
// ===============================================
// visualisation data prep functions
// ===============================================
// ===============================================

        // loop  over an object with a dot notation route to its value if found
        var findthis = function(routeparts,o,matcher) {
            //alert(routeparts + " " + JSON.stringify(o) + " " + matcher);
            // first check if there is a field named with the concatenation of parts, which can be the case with specified fields
            if ( o[routeparts[0]] ) {
                if ( typeof(o[routeparts[0]]) == 'object' ) {
                    if ( $.isArray(o[routeparts[0]]) ) {
                        if ( typeof(o[routeparts[0]][0]) == 'object' ) {
                            var matched = false;
                            for ( var i in o[routeparts[0]] ) {
                                !matched ? matched = findthis(routeparts.slice(1),o[routeparts[0]][i],matcher) : false;
                            }
                            return matched;
                        } else {
                            if ( o[routeparts[0]].indexOf(matcher) != -1 ) {
                                return true;
                            } else {
                                return false;
                            }
                        }
                    } else {
                        return findthis(routeparts.slice(1),o[routeparts[0]],matcher);
                    }
                } else {
                    if ( $.isArray(o[routeparts[0]]) ) {
                        if ( typeof(o[routeparts[0]][0]) == 'object' ) {
                            var matched = false;
                            for ( var i in o[routeparts[0]] ) {
                                !matched ? matched = findthis(routeparts.slice(1),o[routeparts[0]][i],matcher) : false;
                            }
                            return matched;
                        } else {
                            if ( o[routeparts[0]].indexOf(matcher) != -1 ) {
                                return true;
                            } else {
                                return false;
                            }
                        }
                    } else if ( matcher == o[routeparts[0]] ) {
                        return true;
                    } else {
                        return false;
                    }
                }
            } else if ( o[routeparts.join('.')] ) {
                return findthis([routeparts.join('.')],o,matcher);
            } else {
                return false;
            }
        }

        // calculate nodes and links from a result set
        var setnodesandlinks = function() {
            options.nodes = [];
            for ( var i in options.response.hits.hits ) {
                var rec = options.response.hits.hits[i]._source;
                rec == undefined ? rec = options.response.hits.hits[i].fields : false;
                var arr = {
                    "record":rec,
                    "className": rec.title,
                    "group": "records",
                    "value": 0,
                    "facet": "none"
                }
                //arr.className == undefined ? arr.className = indata.projectComposition.project.title : false; // ADDED FOR GTR
                options.nodes.push(arr);
            };
            var links = [];
            $('.graphview_facetsizer').remove();
            $('.graphview_nodetype:checked', obj).each(function() {
                var key = $(this).attr('data-field');
                var obj = options.response.facets[key];
                var facetcount = ' <input id="' + key.replace(/\./g,'_') + '_graphview_facetsize" class="graphview_facetsizer" style="width:30px;padding:0;margin:0;font-size:10px;" type="text" value="' + obj.terms.length + '" />';
                $(this).parent().append(facetcount);
                for ( var item in obj.terms ) {
                    var trec = obj.terms;
                    var arr = {
                        "className": trec[item].term,
                        "group": key,
                        "value": trec[item].count,
                        "facet": key
                    }
                    options.nodes.push(arr);
                    
                    for ( var x = 0; x < options.response.hits.hits.length; x++ ) {
                        var record = options.nodes[x].record;
                        var route = key; //.replace('.exact','');
                        var source = options.nodes.length-1;
                        var target = x;
                        var value = 1;
                        if ( findthis(route.split('.'), record, trec[item].term) ) {
                            links.push({"source":source,"target":target,"value":value});
                        }
                    };
                };            
            });
            $('.graphview_facetsizer').bind('change',query);
            options.links = links;
        }

        // UPDATE THE ON SCREEN CHART
        var build = function(data) {
            data ? options.response = data : false;
            // do some cleaning
            $('.graphview_panel', obj).html('');
            $('.graphview_panel', obj).css({"overflow":"visible"});
            $('.graphview_facetinfo', obj).html("");
            $('.graphview_visinfo', obj).html("");
            $('.graphview_total', obj).html(options.response.hits.total);
            if ( options.graphable.enabled ) {
                options.nodes = options.response.nodes;
                options.links = options.response.links;
            } else { 
                setnodesandlinks();
            }
            force();
            $('.graphview_loading').hide();
            typeof options.callback == 'function' ? options.callback.call(this) : false;
        };
        


// ===============================================
// ===============================================
// query functions - build up a query from current 
// page state, and submit for new results
// ===============================================
// ===============================================

        // read current settings from page changes
        var currentstate = function() {
            // find things in the obj with attr data-something
            // this should tell if it is a query_string, a facet value, a setting of some sort
            // set them all into the options.currentstate
            // they will be used to build the elasticsearch query
            options.defaultquery.size = $('.graphview_size').val();
        }

        var currentquery = function() {
            var qry = $.extend(true, {}, options.defaultquery);
            qry["facets"] = {};
            var vals = $('.query_string', obj).select2("val");
            if ( vals.length != 0 ) {
                for ( var i in vals ) {
                    var kv = vals[i].split('__________');
                    if ( kv.length == 1 ) {
                        qry.query.bool.must.push({"query_string":{"query":kv[0], "default_operator": options.default_operator}});
                    } else {
                        var qobj = {"term":{}};
                        qobj.term[kv[0]] = kv[1];
                        qry.query.bool.must.push(qobj);
                    }
                }
            } else {
                qry.query.bool.must.push({"match_all":{}});
            }
            // check for any ranged values to add to the bool
            if ( $('.lowvalue', obj).val() || $('.highvalue', obj).val() ) {
                var ranged = {
                    'range': {
                        'year': {
                        }
                    }
                };
                $('.lowvalue',obj).val().length ? ranged.range.year.from = endater( $('.lowvalue', obj).val() ) : false;
                $('.highvalue',obj).val().length ? ranged.range.year.to = endater( $('.highvalue', obj).val() ) : false;
                qry.query.bool.must.push(ranged);
            };
            
            $('.graphview_nodetype:checked', obj).each(function() {
                var bb = $(this).attr('data-field');
                if ( bb.length != 0 ) {
                    var size = options.nodesize;
                    if ( $('#' + bb.replace(/\./g,'_') + '_graphview_facetsize', obj).val() ) {
                        size = $('#' + bb.replace(/\./g,'_') + '_graphview_facetsize', obj).val();
                    };
                    var f = {
                        "terms": {
                            "field": bb,
                            "order": "count",
                            "size": size
                        }
                    }
                    qry.facets[bb] = f;
                };
            });
            // add graphing parameters if the backend supports graphing
            options.graphable.enabled ? qry.graph = options.graphable : false;
            options.query = qry;
            options.source = JSON.stringify(qry);
            return qry;
        };
        var query = function() {
            $('.graphview_loading').show();
            currentstate();
            currentquery();
            options.pushstate ? window.history.pushState("", "search", '?source=' + options.source): false;
            var url = options.target;
            options.ajaxtype != 'POST' ? url += '?source=' + options.source : false;
            // TODO: if it is post need to pass the data object
            $.ajax({
                type: options.ajaxtype,
                url: url,
                contentType: "application/json; charset=utf-8",
                dataType: options.datatype,
                success: build
            });
        };
        // a simple prequery for the search box that colours the selection boxes
        var prequery = function() {
            var nonumber = $('.select2-search-choice', obj).last().children('div').text().replace(/ \([0-9]*\)/,'');
            $('.select2-search-choice', obj).last().children('div').text(nonumber);
            $('.select2-search-choice', obj).last().css({"color":fill(options.suggest)});
            query();
        }




// ===============================================
// ===============================================
// ranged date functions
// ===============================================
// ===============================================

        var endater = function(d) {
            var reg = /(\d{2})-(\d{2})-(\d{4})/;
            var dateArray = reg.exec(d); 
            var dateObject = new Date(
                (+dateArray[3]),
                (+dateArray[2])-1,
                (+dateArray[1]),
                (+00),
                (+00),
                (+00)
            );
            return dateObject;
        };

        var ranged = function() {

            var dater = function(d) {
                var day = d.getDate();
                var month = d.getMonth() + 1;
                var year = d.getFullYear();
                var date = day + "-" + month + "-" + year;
                date = date.toString();
                var parts = date.split('-');
                parts[0].length == 1 ? parts[0] = '0' + parts[0] : "";
                parts[1].length == 1 ? parts[1] = '0' + parts[1] : "";
                date = parts[0] + '-' + parts[1] + '-' + parts[2];
                return date;
            };

            if ( $('.dateranged', obj).length == 0 ) { 
                $('.graphview').append('<div class="dateranged" style="position:absolute;bottom:-5px;left:5%;z-index:1000;width:90%;"> \
                    <div style="width:10%;float:left;"> \
                        <input type="text" class="lowvalue" style="width:100%;" placeholder="from date" /> \
                    </div> \
                    <div style="width:70%;float:left;margin:0 20px 0 35px;"><div class="ranged" style="margin-top:8px;"></div></div> \
                    <div style="width:10%;float:left;"><input type="text" class="highvalue" style="width:100%;" placeholder="to date" /></div> \
                    </div>');

                var ranged_values = [];
                var entries = options.response.facets.ranged.entries;
                for ( var i=0, len=entries.length; i < len; i++ ) {
                    ranged_values.push(new Date(entries[i].time));
                };

                var opts = {
                    inline: true,
                    dateFormat: 'dd-mm-yy',
                    defaultDate: dater(ranged_values[0]),
                    minDate: dater(ranged_values[0]),
                    maxDate: dater(new Date()),
                    changeYear: true
                };

                $('.lowvalue', obj).datepicker(opts);
                $('.highvalue', obj).datepicker(opts);
                $('.lowvalue', obj).bind('change',query);
                $('.highvalue', obj).bind('change',query);
                $('.resolution', obj).val("year");
                $('.ranged', obj).slider({
                    range: true,
                    min: 0,
                    max: ranged_values.length-1,
                    values: [0, ranged_values.length-1],
                    slide: function( event, ui ) {
                        $('.lowvalue', obj).val( dater(ranged_values[ ui.values[0] ]) );
                        $('.highvalue', obj).val( dater(ranged_values[ ui.values[1] ]) ).trigger('change');
                    }
                });

            }
        }



// ===============================================
// ===============================================
// the graphview page templates
// ===============================================
// ===============================================

/*
 * For putting option changers on pages, give them an attribute called
 * data-option, with a value of the name of the option e.g. options.defaultquery.size
 * it will then automatically update when a query is performed
 */


        var tg = '<div class="graphview" style="width:100%;height:100%;position:relative;">';

        tg += '<div class="graphview_options" style="margin:5px; z-index:1000;position:absolute;top:0;left:0;">';

        tg += '<div class="graphview_searcharea" style="-webkit-border-radius:4px;-moz-border-radius:4px;border-radius:4px;">';

        tg += '<select class="graphview_suggest" style="display:inline;width:180px;margin-right:-3px;background:#eee;">';
        tg += '<option style="color:' + fill("records") + ';" data-value="records">search everything</option>';
        for ( var key in options.defaultquery.facets ) {
            var obj = options.defaultquery.facets[key];
            if ( key != "range" && obj.term.suggest ) { // TODO: change this in case it is not a term facet?
                tg += '<option data-value="' + obj.term.field + '" style="color:' + fill(obj.term.field) + ';">suggest ' + key + '</option>';
                tg += ', ';
            }
        }
        tg += '</select>';

        tg += '<input type="text" style="width:100%;display:inline;" class="query_string" data-option="query.bool.must.query_string.query" placeholder="mix and match some search terms" /> <img class="graphview_loading" style="width:24px;" src="loading.gif" />';
        tg += '<div class="graphview_resultopts" style="margin:2px 0 5px 0;">';
        tg += '<input class="graphview_size" type="text" value="';
        tg += options.defaultquery.size;
        tg += '" style="width:40px;margin:-3px 0 0 0;padding:1px 1px 0 0;font-size:16px;color:#666;text-align:center;" /> \
            <span style="color:#999;"> of </span> \
            <span class="graphview_total" style="font-size:16px;font-weight:bold;color:#999;"></span>';
        tg += '</div>';
        tg += '</div>';
        for ( var key in options.defaultquery.facets ) {
            if ( key != "range" && options.defaultquery.facets[key].term.node ) { // TODO: change this in case the facet is not a term type?
                var node = options.defaultquery.facets[key].term;
                tg += '<div style="margin-right:2px;color:' + fill(node.field) + ';"><input type="checkbox" class="graphview_nodetype" data-field="' + node.field + '" /> ' + key + '</div>';
            }
        };
        tg += '<div class="graphview_facetinfo" style="color:#999;margin-top:10px;"></div>';
        tg += '<div class="graphview_visinfo" style="margin-top:5px;color:#999;"></div>';
        tg += '</div>';
        tg += '</div>';

        tg += '<div class="graphview_panel" style="position:absolute;top:0;left:0;">';
        tg += '</div>';
        
        tg += '</div>';


        var obj = undefined;

        // ===============================================
        // now create the plugin on the page
        return this.each(function() {
            obj = $(this);

            obj.append(tg);
            
            var searchprompt = function() {
                if ( options.defaultquery.facets.length > 0 ) {
                    return "search for any text, choose above to view suggestions, add a mixture of different sorts";
                } else {
                    return "search for any text";
                }
            }
            
            $('.query_string', obj).select2({
                "formatNoMatches": searchprompt,
                "tags": function(q) {
                    var field = options.suggest;
                    var qry = {
                        "query": {
                            "match_all": {}
                        },
                        "size": 0,
                        "facets": {
                            "tags":{
                                "terms": {
                                    "field": field,
                                    "order": "count",
                                    "size": options.suggestsize
                                }
                            }
                        }
                    };
                    if ( options.graphable.enabled ) {
                        qry.graph = options.graphable;
                        qry.graph.dropfacets = false;
                    };
                    qry.facets.tags.facet_filter = {"query": currentquery().query };
                    var dropdownfilter = true;
                    if ( q.term.length ) {
                        if ( q.term.length == 1 ) {
                            var ts = {
                                "bool":{
                                    "should":[
                                        {"prefix":{}},
                                        {"prefix":{}}
                                    ]
                                }
                            };
                            ts.bool.should[0].prefix[field] = q.term.toLowerCase();
                            ts.bool.should[1].prefix[field] = q.term.toUpperCase();
                            qry.facets.tags.facet_filter.query.bool.must.push(ts);
                            qry.facets.tags.terms.order = "term";
                        } else {
                            if ( q.term.indexOf('*') != -1 || q.term.indexOf('~') != -1 || q.term.indexOf(':') != -1 ) {
                                var qs = q.term;
                                dropdownfilter = false;
                            } else if ( q.term.indexOf(' ') == -1 ) {
                                var qs = '*' + q.term + '*';
                            } else {
                                var qs = q.term.replace(/ /g,' AND ') + '*';
                            }
                            var ts = {
                                "query_string":{
                                    "query": qs,
                                    "default_field": field.replace('.exact','')//,
                                    //"analyzer":"simple"
                                }
                            };
                            qry.facets.tags.facet_filter.query.bool.must.push(ts);
                        }
                    };
                    if ( qry.facets.tags.facet_filter.query.bool.must.length == 0 ) {
                        delete qry.facets.tags.facet_filter;
                    };
                                            
                    $.ajax({
                        type: "POST",
                        url: options.target + '?source=' + JSON.stringify(qry),
                        contentType: "application/json; charset=utf-8",
                        dataType: options.datatype,
                        q: q,
                        field: field,
                        dropdownfilter: dropdownfilter,
                        success: function(data) {
                            var qa = this.q;
                            var t = qa.term, filtered = {results: []};
                            var tags = [];
                            var terms = data.facets.tags.terms;
                            for ( var item in terms ) {
                                tags.push({'id':this.field + '__________' + terms[item].term,'text':terms[item].term + ' (' + terms[item].count + ')'});
                            };
                            $(tags).each(function () {
                                var isObject = this.text !== undefined,
                                    text = isObject ? this.text : this;
                                if ( this.dropdownfilter ) {
                                    if (t === "" || qa.matcher(t, text)) {
                                        filtered.results.push(isObject ? this : {id: this, text: this});
                                    }
                                } else {
                                    filtered.results.push(isObject ? this : {id: this, text: this});
                                };
                            });
                            qa.callback(filtered);
                        }
                    });
                },
                "tokenSeparators":[","],
                "width":"element",
            });

            $('.select2-choices', obj).css({
                "-webkit-border-radius":"3px",
                "-moz-border-radius":"3px",
                "border-radius":"3px",
                "border":"1px solid #ccc"
            });            

            $('.graphview_nodetype', obj).bind('change',query);
            $('.query_string', obj).bind('change',prequery);
            $('.graphview_size', obj).bind('change',query);
            $('.graphview_isolated', obj).bind('click',isolated);
            $('.graphview_suggest', obj).bind('change', setsuggestfield);
            
            query();

        }); // end of the function  


    };


    // graphview options are declared as a function so that they can be retrieved
    // externally (which allows for saving them remotely etc)
    $.fn.graphview.options = {};
    
})(jQuery);

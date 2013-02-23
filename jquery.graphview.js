/*
 * jquery.graphview.js
 *
 * displays graph data results by querying a specified index
 * 
 * created by Mark MacGillivray - mark@cottagelabs.com
 *
 * copyheart 2013
 *
 * VERSION 0.0.2
 *
 * EXPERIMENTAL / IN EARLY DEVELOPMENT / THINGS MAY NOT WORK / WOMM
 *
 */

// TODO: when viewing one bubble type, add an option to add a search term that is the OR set of the currently displayed bubbles of that type

// TODO: make a particular selection of facet values the search terms of a search on a different facet
// for example given a list if citation IDs, make a term query for identifier IDs that are the same values

// TODO: add a differentiator between queries that require a new hits set to be calculated and those that do not
// so that if a large set of hits is pulled, subsequent changes to the bubble view options can be done with a result set size of 0
// then just combine the earlier result set with the new facet answers

(function($){
    $.fn.graphview = function(options) {

        // specify the defaults
        var defaults = {
            "source": 'http://localhost:9200/test/record/_search',
            "datatype": "JSONP",
            "searchbox_suggestions": [
                {"field":"journal.name.exact","display":"journals"},
                {"field":"author.name.exact","display":"authors"},
                {"field":"title.exact","display":"titles"}
            ],
            "suggestions_size": 100,
            "paging":{
                "from":0,
                "size":10
            },
            "optionsbox_width": "300px",
            "list_overflow_control": true,
            "showlabels": false,
            "slide_on": "date",
            "displaytype": "list",
            "nodetypes": [
                {'field':'author.name.exact','display':'author names'},
                {'field':'journal.name.exact','display':'journal names'},
                {'field':'year.exact','display':'years'},
                {'field':'date','display':'dates'},
                {'field':'citation.identifier.id.exact','display':'citations'}
            ]

        };

        $.fn.graphview.options = $.extend(defaults, options);
        var options = $.fn.graphview.options;


        // ===============================================
        // useful things snaffled from elsewhere
        // ===============================================

        // this one is copied from select2
        function debounce(quietMillis, fn, ctx) {
            ctx = ctx || undefined;
            var timeout;
            return function () {
                var args = arguments;
                window.clearTimeout(timeout);
                timeout = window.setTimeout(function() {
                    fn.apply(ctx, args);
                }, quietMillis);
            };
        }


        // ===============================================
        // tabular output functions (simplified facetview)
        // ===============================================

        var tabular = function(data) {
            var optswidthpf = options.optionsbox_width.replace(/[0-9]/g,'');
            if ( optswidthpf == 'px' ) {
                var taboffset = (parseInt(options.optionsbox_width.replace('px','')) + 30) + 'px';
                var tabwidth = (obj.width() - parseInt(options.optionsbox_width.replace('px','')) - 60) + 'px';
            } else {
                var taboffset = (parseInt(options.optionsbox_width.replace('%','')) + 3) + '%';
                var tabwidth = (100 - parseInt(options.optionsbox_width.replace('%','')) - 3) + '%';
            };
            var table = '<table class="table table-striped table-bordered table-condensed" style="position:absolute;top:5px;left:' + taboffset + ';width:' + tabwidth + ';">';
            for ( var i in data.hits.hits ) {
                var record = data.hits.hits[i]._source;
                table += '<tr><td>';
                table += '<p>';
                for ( var a in record.author ) {
                    a != 0 ? table += ', ' : false;
                    table += record.author[a]['name'];
                };
                table += '<br>';
                table += '<strong>' + record.title + '</strong>';
                table += '<br>';
                record.date ? table += record.date + ', ' : false;
                table += record.journal['name'];
                table += '</p>';
                table += '</td></tr>';
            };
            table += '</table>';
            // TODO: restrict table height if in a confined space, and set to overflow scroll. otherwise fills page
            $('.graphview_panel', obj).css({"width":(obj.width() - 30),"height":obj.height()});
            options.list_overflow_control ? $('.graphview_panel', obj).css({"width":obj.width(),"overflow":"auto"}) : false;
            $('.graphview_panel', obj).append(table);
        
        };


        // ===============================================
        // bubble graph functions
        // ===============================================

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

        var bubble = function(data) {
            var w = obj.width();
            var h = obj.height();
            var r = w;
            w > h && h != 0 ? r = h : "";
            var format = d3.format(",d");

            var bubble = d3.layout.pack()
                .sort(null)
                .size([r, r]);
            var vis = d3.select(".graphview_panel").append("svg:svg") // TODO: how to restrict this to the first panel object
                .attr("width", r)
                .attr("height", r)
                .attr("class", "bubble")
            var node = vis.selectAll("g.node")
                .data(bubble(data)
                .filter(function(d) { return !d.nodes }))
                .enter().append("svg:g")
                .attr("class", "node")
                .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
            node.append("svg:circle")
                .attr("r", 0)
                .attr("fill", function(d) { return fill(d.data.group); })
                .attr("stroke-width", 2)
                .attr("stroke", function(d) { d3.rgb(fill(d.data.group)).darker()})
                .transition().duration(1000).attr("r", function(d) { return d.r; })
            node.on('click',function(d) {
                showtitle(d)
            })

        };

        var showtitle = function(data) {
            var info = '<div class="well" style="margin-right:-10px;"><p>';
            info += '<a class="label graphview_newsearch" style="margin-right:3px;" data-facet="' + data.facet;
            info += '" data-value="' + data.className;
            info += '" alt="search only for this term" title="search only for this term" href="#">search</a> ';
            info += '<a class="label graphview_newterm" style="margin-right:3px;" data-facet="' + data.facet;
            info += '" data-value="' + data.className;
            info += '" alt="include in search terms" title="include in search terms" href="#">+ search</a> ';
            info += data.className;
            data.value ? info += ' (' + data.value + ')' : false;
            info += '</p></div>';
            $('.graphview_visinfo', obj).html("");
            $('.graphview_visinfo', obj).append(info);
            $('.graphview_newterm', obj).bind('click',newterm);
        };



        // ===============================================
        // force graph functions
        // ===============================================
        var force = function(json) {
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
              console.log("here", d3.event.translate, d3.event.scale);
              vis.attr("transform",
                  "translate(" + d3.event.translate + ")"
                  + " scale(" + d3.event.scale + ")");
            }

              var force = d3.layout.force()
                  .charge(-180)
                  .linkDistance(60)
                  .nodes(json.nodes)
                  .links(json.links)
                  .size([w, h])
                  .start();

              var link = vis.selectAll("line.link")
                  .data(json.links)
                .enter().append("svg:line")
                  .attr("class", "link")
                  .attr("stroke", "#ddd")
                  .attr("stroke-opacity", 0.8)
                  .style("stroke-width", function(d) { return Math.sqrt(d.value); })
                  .attr("x1", function(d) { return d.source.x; })
                  .attr("y1", function(d) { return d.source.y; })
                  .attr("x2", function(d) { return d.target.x; })
                  .attr("y2", function(d) { return d.target.y; });

              var dom = d3.extent(json.nodes, function(d) {
                  return d.value;
              });
              var cr = d3.scale.sqrt().range([5, 25]).domain(dom);
              
              var node = vis.selectAll("circle.node")
                  .data(json.nodes)
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
                        l += d.className.substr(0,35);
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
                .data(json.nodes)
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
        // control functions
        // ===============================================

        var newterm = function(event) {
            event ? event.preventDefault() : false;
            var facet = $(this).attr('data-facet');
            var val = $(this).attr('data-value');
            if ( facet != "none" ) {
                var add = facet + '__________' + val;
            } else {
                var add = val;
            }
            // TODO: add  to the search terms box
            $(this).parent().parent().remove();
            query();
        };

        // adjust how many results are shown
        var howmany = function(event) {
            event.preventDefault();
            var newhowmany = prompt('Currently displaying ' + options.paging.size + 
                ' results per page. How many would you like instead?');
            if (newhowmany) {
                options.paging.size = parseInt(newhowmany);
                options.paging.from = 0;
                $('.graphview_howmany', obj).html(options.paging.size);
                query();
            }
        };

        // set whether or not to show labels on vis
        var labelling = function() {
            if ( options.showlabels ) {
                options.showlabels = false;
                $('.svglabel').hide();
            } else {
                options.showlabels = true;
                $('.svglabel').show();
            };
        };

        // set the displaytype
        var displaytype = function(event) {
            event ? event.preventDefault() : false;
            if ($(this).attr('data-value') == 'list') {
                options.displaytype = 'force';
                $(this).html('list');
                $(this).attr('data-value','force');
            } else {
                options.displaytype = 'list';
                $(this).html('visualise');
                $(this).attr('data-value','list');
            }
            $('.graphview_visopts').toggle()
            build();
        };


        // loop  over an object with a dot notation route to its value if found
        var findthis = function(routeparts,o,matcher) {
            if ( o[routeparts[0]] ) {
                if ( typeof(o[routeparts[0]]) == 'object' ) {
                    //alert(JSON.stringify(o[routeparts[0]]))
                    if ( $.isArray(o[routeparts[0]]) ) {
                        if ( typeof(o[routeparts[0]][0]) == 'object' ) {
                            var matched = false;
                            for ( var i in o[routeparts[0]] ) {
                                !matched ? matched = findthis(routeparts.slice(1),o[routeparts[0]][i],matcher) : false;
                            }
                            return matched;
                        } else {
                            if ( matcher in o[routeparts[0]] ) {
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
                            if ( matcher in o[routeparts[0]] ) {
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
            } else {
                return false;
            }
        }


        // UPDATE THE ON SCREEN CHART
        var build = function(data) {
            data ? options.data = data : false;
            // do some cleaning
            $('.graphview_panel', obj).html('');
            $('.graphview_panel', obj).css({"overflow":"visible"});
            $('.graphview_facetinfo', obj).html("");
            $('.graphview_visinfo', obj).html("");
            $('.graphview_resultcount', obj).html(options.data.hits.total);
            options.data.hits.total < options.paging.size ? $('.graphview_howmany').val(options.data.hits.total) : false;
            // TODO: enable / disable the result set prev / next buttons depending on result size

            if ( options.displaytype == 'list' ) {
                $('.dateslider').remove();
                tabular(options.data);
            } else { 

                var links = [];
                var sdata = [];
                //if ( !$('#bubbletype', obj).val().length ) {
                for ( var i in options.data.hits.hits ) {
                    var indata = options.data.hits.hits[i]._source;
                    var pn = indata.title;
                    if ( !pn ) {
                        pn = i;
                    } else {
                        pn = pn.substring(0,1).toLowerCase();
                    }
                    $('.graphview_bubbletype:checked', obj).length ? pn = 'records' : false;
                    var arr = {
                        "record":indata,
                        "className": indata.title,
                        "group": pn,
                        "value": 0,
                        "facet": "none"
                    }
                    sdata.push(arr);
                };
                //} else {
                if ( $('.graphview_bubbletype:checked', obj).length ) {
                    for ( var i in options.data.facets ) {
                        if ( i != "slider" ) {
                            var facetblurb = '<p>Showing ';
                            if ( options.data.facets[i].other != 0 ) {
                                facetblurb += 'top <input id="' + i.replace(/\./g,'_') + '_graphview_facetsize" class="graphview_facetsizer" style="width:25px;padding:0;margin:0;font-size:10px;" type="text" value="' + options.data.facets[i].terms.length + '" />';
                            } else {
                                facetblurb += 'all ' + options.data.facets[i].terms.length;
                            }
                            var itidy = i;
                            for ( var c in options.nodetypes ) {
                                if ( options.nodetypes[c].field == i ) {
                                    itidy = options.nodetypes[c].display;
                                };
                            }
                            facetblurb += ' ' + itidy + ' in current resultset</p>';
                            $('.graphview_facetinfo', obj).append(facetblurb);
                            for ( var item in options.data.facets[i].terms ) {
                                var indata = options.data.facets[i].terms;
                                if ( $('.graphview_bubbletype:checked', obj).length == 1 ) {
                                    if ( isNaN(indata[item].term) ) {
                                        var pn = indata[item].term.substring(0,1).toLowerCase();
                                    } else {
                                        var pn = indata[item].term;
                                    }
                                } else {
                                    var pn = i;
                                };
                                var pn = i;
                                var arr = {
                                    "className": indata[item].term,
                                    "group": pn,
                                    "value": indata[item].count,
                                    "facet": i
                                }
                                sdata.push(arr);
                                
                                // TODO: finish this to build the links list
                                for ( var x = 0; x < options.data.hits.hits.length; x++ ) {
                                    var record = sdata[x].record;
                                    var route = i.replace('.exact','');
                                    var source = sdata.length-1;
                                    var target = x;
                                    var value = 1;
                                    if ( findthis(route.split('.'), record, indata[item].term) ) {
                                        links.push({"source":source,"target":target,"value":value});
                                    }
                                };
                            };
                        };
                    };
                };

                $('.graphview_facetsizer').unbind('change',query).bind('change',query);


                if ( options.displaytype == 'force' ) {
                    force({"nodes":sdata,"links":links});
                } else if ( options.displaytype == 'bubble' ) {
                    bubble({"nodes":sdata});
                }

                options.slide_on ? slider(options.data) : false;
                
            }
        };
        
        // SUBMIT A QUERY FOR MORE DATA AND TRIGGER A CHART BUILD
        // TODO: change how query set is constructed and subsequently built from, depending on if we can hit 
        // a backend that supports graphing and returning nodes and links
        var currentquery = function() {
            // check if result size has been augmented
            options.paging.size = $('.graphview_howmany').val();
            var qry = {                
                "query": {
                    "bool": {"must":[]}
                }
            };
            qry["size"] = options.paging.size;
            qry["facets"] = {};
            vals = $('.graphview_freetext', obj).select2("val");
            if ( vals.length != 0 ) {
                for ( var i in vals ) {
                    var kv = vals[i].split('__________');
                    if ( kv.length == 1 ) {
                        qry.query.bool.must.push({"query_string":{"query":kv[0]}});
                    } else {
                        var qobj = {"term":{}};
                        qobj.term[kv[0]] = kv[1];
                        qry.query.bool.must.push(qobj);
                    }
                }
            } else {
                    qry.query.bool.must.push({"match_all":{}});
            };
            // check for any slider values to add to the bool
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
            
            var bubbletypes = [];
            $('.graphview_bubbletype:checked', obj).each(function() {
                bubbletypes.push($(this).attr('data-value'));
            });
            for ( var b in bubbletypes ) {
                var bb = bubbletypes[b];
                if ( bb.length != 0 ) {
                    var size = options.paging.size;
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
            };
            // add a histogram for the slider
            if ( options.slide_on ) {
                qry.facets.slider = {
                    "date_histogram": {
                        "interval": "month",
                        "field": options.slide_on
                    }
                };
            };
            options.query = qry;
            return options.query;
        };
        var query = function(event) {
            var qry = currentquery();
            $.ajax({
                type: "GET",
                url: options.source + '?source=' + JSON.stringify(qry),
                contentType: "application/json; charset=utf-8",
                dataType: options.datatype,
                success: build
            });
        };


        // ===============================================
        // slider functions
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

        var slider = function(data) {

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

            if ( $('.dateslider', obj).length == 0 ) { 
                $('.graphview').append('<div class="dateslider" style="position:absolute;bottom:-5px;left:5%;z-index:1000;width:90%;"> \
                    <div style="width:10%;float:left;"> \
                        <input type="text" class="lowvalue" style="width:100%;" placeholder="from date" /> \
                    </div> \
                    <div style="width:70%;float:left;margin:0 20px 0 35px;"><div class="slider" style="margin-top:8px;"></div></div> \
                    <div style="width:10%;float:left;"><input type="text" class="highvalue" style="width:100%;" placeholder="to date" /></div> \
                    </div>');

                var slider_values = [];
                var entries = data.facets.slider.entries;
                for ( var i=0, len=entries.length; i < len; i++ ) {
                    slider_values.push(new Date(entries[i].time));
                };

                var opts = {
                    inline: true,
                    dateFormat: 'dd-mm-yy',
                    defaultDate: dater(slider_values[0]),
                    minDate: dater(slider_values[0]),
                    maxDate: dater(new Date()),
                    changeYear: true
                };

                $('.lowvalue', obj).datepicker(opts);
                $('.highvalue', obj).datepicker(opts);
                $('.lowvalue', obj).bind('change',query);
                $('.highvalue', obj).bind('change',query);
                $('.resolution', obj).val("year");
                $('.slider', obj).slider({
                    range: true,
                    min: 0,
                    max: slider_values.length-1,
                    values: [0, slider_values.length-1],
                    slide: function( event, ui ) {
                        $('.lowvalue', obj).val( dater(slider_values[ ui.values[0] ]) );
                        $('.highvalue', obj).val( dater(slider_values[ ui.values[1] ]) ).trigger('change');
                    }
                });

            }
        }


        // ===============================================
        // the graphview template to be added to the page
        // ===============================================

        var tg = '<div class="graphview" style="width:100%;height:100%;position:relative;">';

        tg += '<div class="graphview_options" style="width:' + options.optionsbox_width + '; margin:5px; z-index:1000;position:absolute;top:0;left:0;">';

        tg += '<div class="graphview_searcharea" style="border:1px solid #ccc;width:310px;-webkit-border-radius:4px;-moz-border-radius:4px;border-radius:4px;">';
        tg += '<input type="text" class="graphview_searchfield_choice" value="" style="display:none;" />';
        tg += '&nbsp;suggest for me: ';
        if ( options.searchbox_suggestions.length > 0 ) {
            for ( var each in options.searchbox_suggestions ) {
                each != 0 ? tg += ', ' : false;
                var obj = options.searchbox_suggestions[each];
                tg += '<a class="graphview_searchfield" data-value="' + obj['field'] + '" href="#">' + obj['display'] + '</a>';
            }
        };
        tg += '<input type="text" class="graphview_freetext" style="width:' + options.optionsbox_width + ';" placeholder="mix and match some search terms" />';
        tg += '<div class="graphview_resultopts" style="margin:2px 0 5px 2px;">';
        tg += ' <a class="label graphview_reset" title="click to reset all selections" href="#">clear</a>';
        tg += ' <a class="label graphview_learnmore" title="click to view search help information" href="#">help</a>';
        tg += ' <a data-value="list" class="label label-info graphview_visualise" title="click to visualise the links between these results" href="#">visualise</a>';
        tg += ' <a class="label graphview_prev" title="click to view previous results" href="#">prev</a> \
            <input class="graphview_howmany" type="text" value="';
        tg += options.paging.size;
        tg += '" style="width:30px;margin:1px 0 0 0;padding:0;" /> \
            <a class="label graphview_next" title="click to view next results" href="#">next</a> \
            <span style="color:#999;"> of </span> \
            <span class="graphview_resultcount" style="font-size:16px;font-weight:bold;color:#999;"></span>';
        tg += '</div>';
        tg += '</div>';

        tg += '<div class="graphview_visopts" style="margin-top:5px;display:none;">';
        tg += ' <div class="label label-info" style="display:inline;margin-right:2px;">';
        options.showlabels ? tg += "hide labels" : tg += 'show labels';
        tg += '<input type="checkbox" class="graphview_labelling" /></div>';      
        for ( var item in options.nodetypes ) {
            var node = options.nodetypes[item];
            tg += '<div class="label" style="display:inline;margin-right:2px;">' + node.display + '<input type="checkbox" class="graphview_bubbletype" data-value="' + node.field + '" /></div>';
        };
        tg += '<div class="graphview_facetinfo" style="color:#999;margin-top:10px;"></div>';
        tg += '<div class="graphview_visinfo" style="margin-top:5px;color:#999;"></div>';
        tg += '</div>';
        tg += '</div>';

        tg += '<div class="graphview_panel" style="position:absolute;top:0;left:0;">';
        tg += '</div>';
        
        tg += '</div>';


        var obj = undefined;

        var setsearchfield = function(event) {
            event ? event.preventDefault() : false;
            $('.graphview_searchfield').css({'color':'blue','text-decoration':'none'});
            $(this).css({'color':'green','text-decoration':'underline'});
            $('.graphview_searchfield_choice').val( $(this).attr('data-value') );
        };

        // ===============================================
        // now create the plugin on the page
        return this.each(function() {
            obj = $(this);

            obj.append(tg);
            
            $('.graphview_freetext', obj).select2({
                "formatNoMatches": "",
                "tags": function(q) {
                    var field = $('.graphview_searchfield_choice', obj).val();
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
                                    "size": options.suggestions_size
                                }
                            }
                        }
                    };
                    
                    qry.facets.tags.facet_filter = {"query": currentquery().query };
                    if ( qry.facets.tags.facet_filter.query.bool.must[0].match_all !== undefined ) {
                        qry.facets.tags.facet_filter.query.bool.must = [];
                    };
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
                            if ( q.term.indexOf('*') != -1 && q.term.indexOf('~') != -1 && q.term.indexOf(':') != -1 ) {
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
                                            
                    //alert(JSON.stringify(qry,"","    "));
                    $.ajax({
                        type: "GET",
                        url: options.source + '?source=' + JSON.stringify(qry),
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
                                if ( dropdownfilter ) {
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

            $('.graphview_bubbletype', obj).bind('change',query);
            $('.graphview_freetext', obj).bind('change',query);
            $('.graphview_howmany', obj).bind('change',query);
            $('.graphview_labelling', obj).bind('click',labelling);
            $('.graphview_visualise', obj).bind('click',displaytype);
            $('.graphview_searchfield', obj).bind('click', setsearchfield);
            
            query();

        }); // end of the function  


    };


    // graphview options are declared as a function so that they can be retrieved
    // externally (which allows for saving them remotely etc)
    $.fn.graphview.options = {};
    
})(jQuery);

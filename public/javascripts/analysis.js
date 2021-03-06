/**
 * Created by michaelhall on 5/3/17.
 */
// TODO: add a timer for how long the analysis has been running
// TODO: add links to drugs and gene in resistance profiling tree
//============================================================
// Code for opening the websocket and sending/receiving information through it
// Mostly button listeners and text boxes used to gather this information
//============================================================

var getStartedButton    = $('#getStarted'),
    fadeTime            = 400,
    readPathsForm       = $('#readPathsForm'),
    startAnalysisButton = $('#startAnalysis'),
    chartContainer      = $('#chartContainer'),
    resistanceDBfield   = $('#resDBPath'),
    stopAnalysisButton  = $('#stopAnalysis');

var socket;

// open the websocket connection.
// fade out the get started button when clicked and fade in the read path entry box
getStartedButton.click(function(){
	// open the websocket connection and store the socket in a variable to be used elsewhere
	socket = io.connect(location.href);

	socket.on('error', function(error) {
		console.log("Client-side socket error: ");
		console.log(error);
	});

	console.log("Socket connected on client side");

	$(this).fadeOut(fadeTime, function(){
		readPathsForm.fadeIn(fadeTime);
	});

	socket.on('disconnect', function() {
		console.log("Socket closed...");
	});
});

// When the user submits the path, get that path and send to the analysis route,
// fade out the form and reveal the start button
readPathsForm.submit(function(e){
	// prevents default action of form
	e.preventDefault();

	//TODO - error handling for when the text fields are empty.

	// send the path to the server
	socket.emit('paths', {
		pathToInput: $('#readsPath').val(), // path to the user's reads
		pathToDB: $('#dbPath').val(), // path to database
		pathForOutput: $('#outputPath').val(), // folder to run analysis from
		outputFile: $('#outputFile').val(), // file name for output
		pathToResDB: $('#resDBPath input').val(),
		resistanceProfiling: document.getElementById('resProfileCheck').checked
	});

	$(this).fadeOut(fadeTime, function(){
		startAnalysisButton.fadeIn(fadeTime);
	});
});

// When the user clicks start, hide the start button and reveal the stop button and
// div that the chart will be added to. Then, start the child process and plotting.
startAnalysisButton.click(function(){
	// send message to server to start the species typing script
	socket.emit('startAnalysis');

	$(this).fadeOut(fadeTime, function(){
		stopAnalysisButton.fadeIn(fadeTime);
		chartContainer.fadeIn(fadeTime);
		$('#resistanceTree').fadeIn(fadeTime);
	});

	// initiate plotting
    var donut = donutChart()
        .width(960)
        .height(500)
        .transTime(400)
        .cornerRadius(3)
        .padAngle(0.015)
        .variable('prob')
        .category('species');

    d3.select('#chartContainer')
        .call(donut);

    socket.on('stdout', function(data) {
    	var probTotal = Number();
    	// add in an "other" species if the probabilities dont add to 1.0
    	data.forEach(function(d) { probTotal += +d.prob; });
    	if (probTotal < 0.99) {
    		data.push({
			    species: "other",
			    prob: 1.0 - probTotal,
			    err: "N/A"
		    });
	    }
	    // update the donut chart with the new data
        donut.data(data);
    });

	// ======================================================
	// set up tree and select div
	var resTree = tree()
		.width(960)
		.height(500);

	var treeCalled = false;

	var table = [{
		name: 'detected',
		parent: null
	}];
	var genes = [];
	var drugs = [];

    // receiving output from resistance profiling
    socket.on('resistance', function(data) {

	    data.forEach(function(d) {
	    	if (d) {
			    d3.tsvParseRows(d, function (row, i) {
				    // if (d[0].startsWith('#')) return;

				    if (!genes.find(function (element) {
						    return element === row[5];
					    })) {
					    table.push({
						    name: row[5],
						    parent: row[6]
					    });
					    genes.push(row[5]);
				    }

				    if (!drugs.find(function (element) {
						    return element === row[6];
					    })) {
					    table.push({
						    name: row[6],
						    parent: "detected"
					    });
					    drugs.push(row[6]);
				    }
			    });
		    }
	    });
	    var root = d3.stratify()
		    .id(function (d) {
			    return d.name;
		    })
		    .parentId(function (d) {
			    return d.parent;
		    })
		    (table);

	    resTree.data(root);

	    if (!treeCalled) {
		    d3.select('#resistanceTree').call(resTree);
		    treeCalled = true;

		    // ======================================================
	    }
    });
});

// When the stop button is clicked, kill the child process running the species typing and
// close the websocket.
stopAnalysisButton.click(function(){
	stopAnalysisButton.fadeOut(fadeTime);
	socket.emit('kill');
});

// function that will make field to enter resistance profile database path appear when
// checkbox is selected
function showResDB(checkbox){
	if (checkbox.checked) {
		resistanceDBfield.fadeIn();
		// jquery default is block which messes up the semantic ui form
		resistanceDBfield.css('display', 'inherit');
		resistanceDBfield.find('input').attr('required', true); // make field required
	} else {
		resistanceDBfield.fadeOut();
		// remove values from fields and make them not required anymore
		resistanceDBfield.find('input')
			.val('')
			.removeAttr('required');
	}
}

//============================================================
// D3 code for making the donut chart
//============================================================
function donutChart() {
    var data = [],
        width,
        height,
        radius,
        margin = {top: 10, right: 10, bottom: 10, left: 10},
        colour = d3.scaleOrdinal(d3.schemeCategory20), // colour scheme
        variable, // value in data that will dictate proportions on chart
        category, // compare data by
        padAngle, // effectively dictates the gap between slices
        transTime, // transition time
        updateData,
        floatFormat = d3.format('.4r'),
        cornerRadius, // sets how rounded the corners are on each slice
        percentFormat = d3.format(',.2%');

    function chart(selection){
        selection.each(function() {
            // generate chart
            // ===========================================================================================
            // Set up constructors for making donut. See https://github.com/d3/d3-shape/blob/master/README.md
            radius = Math.min(width, height) / 2;

            // creates a new pie generator
            var pie = d3.pie()
                .value(function(d) { return floatFormat(d[variable]); })
                .sort(null);

            // contructs and arc generator. This will be used for the donut. The difference between outer and inner
            // radius will dictate the thickness of the donut
            var arc = d3.arc()
                .outerRadius(radius * 0.8)
                .innerRadius(radius * 0.6)
                .cornerRadius(cornerRadius)
                .padAngle(padAngle);

            // this arc is used for aligning the text labels
            var outerArc = d3.arc()
                .outerRadius(radius * 0.9)
                .innerRadius(radius * 0.9);
            // ===========================================================================================

            // ===========================================================================================
            // append the svg object to the selection
            // var svg = selection.append('svg')
            var svg = selection.append('svg')
                .attr('width', width + margin.left + margin.right)
                .attr('height', height + margin.top + margin.bottom)
                .append('g')
                .attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')');
            // ===========================================================================================

            // ===========================================================================================
            // g elements to keep elements within svg modular
            svg.append('g').attr('class', 'slices');
            svg.append('g').attr('class', 'labelName');
            svg.append('g').attr('class', 'lines');
            // ===========================================================================================

            // ===========================================================================================
            // add and colour the donut slices
            var path = svg.select('.slices')
                .selectAll('path')
                .data(pie(data))
                .enter().append('path')
                .attr('fill', function(d) { return colour(d.data[category]); })
                .attr('d', arc);
            // ===========================================================================================

            // ===========================================================================================
            // add text labels
            var label = svg.select('.labelName').selectAll('text')
                .data(pie(data))
              .enter().append('text')
                .attr('dy', '.35em')
                .html(updateLabelText)
                .attr('transform', labelTransform)
                .style('text-anchor', function(d) { return (midAngle(d)) < Math.PI ? 'start' : 'end'; });
            // ===========================================================================================

            // ===========================================================================================
            // add lines connecting labels to slice. A polyline creates straight lines connecting several points
            var polyline = svg.select('.lines')
                .selectAll('polyline')
                .data(pie(data))
                .enter().append('polyline')
                .attr('points', calculatePoints);
            // ===========================================================================================

            // ===========================================================================================
            // add tooltip to mouse events on slices and labels
            d3.selectAll('.labelName text, .slices path').call(toolTip);
            // ===========================================================================================

            // ===========================================================================================
            // FUNCTION TO UPDATE CHART
            updateData = function() {

                var updatePath = d3.select('.slices').selectAll('path');
                var updateLines = d3.select('.lines').selectAll('polyline');
                var updateLabels = d3.select('.labelName').selectAll('text');

                var data0 = path.data(), // store the current data before updating to the new
                    data1 = pie(data);

                // update data attached to the slices, labels, and polylines. the key function assigns the data to
                // the correct element, rather than in order of how the data appears. This means that if a category
                // already exists in the chart, it will have its data updated rather than removed and re-added.
                updatePath = updatePath.data(data1, key);
                updateLines = updateLines.data(data1, key);
                updateLabels = updateLabels.data(data1, key);

                // adds new slices/lines/labels
                updatePath.enter().append('path')
                    .each(function(d, i) { this._current = findNeighborArc(i, data0, data1, key) || d; })
                    .attr('fill', function(d) {  return colour(d.data[category]); })
                    .attr('d', arc);

                updateLines.enter().append('polyline')
                    .each(function(d, i) { this._current = findNeighborArc(i, data0, data1, key) || d; })
                    .attr('points', calculatePoints);

                updateLabels.enter().append('text')
                    .each(function(d, i) { this._current = findNeighborArc(i, data0, data1, key) || d; })
                    .html(updateLabelText)
                    .attr('transform', labelTransform)
                    .style('text-anchor', function(d) { return (midAngle(d)) < Math.PI ? 'start' : 'end'; });

                // removes slices/labels/lines that are not in the current dataset
                updatePath.exit()
                    .transition()
                    .duration(transTime)
                    .attrTween("d", arcTween)
                    .remove();

                updateLines.exit()
                    .transition()
                    .duration(transTime)
                    .attrTween("points", pointTween)
                    .remove();

                updateLabels.exit()
                    .remove();

                // animates the transition from old angle to new angle for slices/lines/labels
                updatePath.transition().duration(transTime)
                    .attrTween('d', arcTween);

                updateLines.transition().duration(transTime)
                    .attrTween('points', pointTween);

                updateLabels.transition().duration(transTime)
                    .attrTween('transform', labelTween)
                    .styleTween('text-anchor', labelStyleTween);

                updateLabels.html(updateLabelText); // update the label text

                // add tooltip to mouse events on slices and labels
                d3.selectAll('.labelName text, .slices path').call(toolTip);

            };
            // ===========================================================================================
            // Functions
            // calculates the angle for the middle of a slice
            function midAngle(d) { return d.startAngle + (d.endAngle - d.startAngle) / 2; }

            // function that creates and adds the tool tip to a selected element
            function toolTip(selection) {

                // add tooltip (svg circle element) when mouse enters label or slice
                selection.on('mouseenter', function (data) {

                    svg.append('text')
                        .attr('class', 'toolCircle')
                        .attr('dy', -15) // hard-coded. can adjust this to adjust text vertical alignment in tooltip
                        .html(toolTipHTML(data)) // add text to the circle.
                        .style('font-size', '.8em')
                        .style('text-anchor', 'middle'); // centres text in tooltip

                    svg.append('circle')
                        .attr('class', 'toolCircle')
                        .attr('r', radius * 0.57) // radius of tooltip circle
                        .style('fill', colour(data.data[category])) // colour based on category mouse is over
                        .style('fill-opacity', 0.35);

                });

                // remove the tooltip when mouse leaves the slice/label
                selection.on('mouseout', function () {
                    d3.selectAll('.toolCircle').remove();
                });
            }

            // function to create the HTML string for the tool tip. Loops through each key in data object
            // and returns the html string key: value
            function toolTipHTML(data) {

                var tip = '',
                    i   = 0;

                for (var key in data.data) {

                    if ([category, variable, 'err'].includes(key)) {
	                    // if value is a number, format it as a percentage
	                    var value = (!isNaN(parseFloat(data.data[key]))) ? percentFormat(data.data[key]) : data.data[key];

	                    // leave off 'dy' attr for first tspan so the 'dy' attr on text element works. The 'dy' attr on
	                    // tspan effectively imitates a line break.
	                    if (i === 0) tip += '<tspan x="0">' + key + ': ' + value + '</tspan>';
	                    else tip += '<tspan x="0" dy="1.2em">' + key + ': ' + value + '</tspan>';
                    }
                    i++;
                }

                return tip;
            }

            // calculate the points for the polyline to pass through
            function calculatePoints(d) {
                // see label transform function for explanations of these three lines.
                var pos = outerArc.centroid(d);
                pos[0] = radius * 0.95 * (midAngle(d) < Math.PI ? 1 : -1);
                return [arc.centroid(d), outerArc.centroid(d), pos]
            }

            function labelTransform(d) {
                // effectively computes the centre of the slice.
                // see https://github.com/d3/d3-shape/blob/master/README.md#arc_centroid
                var pos = outerArc.centroid(d);

                // changes the point to be on left or right depending on where label is.
                pos[0] = radius * 0.95 * (midAngle(d) < Math.PI ? 1 : -1);
                return 'translate(' + pos + ')';
            }

            function updateLabelText(d) {
                return d.data[category] + ': <tspan>' + percentFormat(d.data[variable]) + '</tspan>';
            }

            // function that calculates transition path for label and also it's text anchoring
            function labelStyleTween(d) {
                this._current = this._current || d;
                var interpolate = d3.interpolate(this._current, d);
                this._current = interpolate(0);
                return function(t){
                    var d2 = interpolate(t);
                    return midAngle(d2) < Math.PI ? 'start':'end';
                };
            }

            function labelTween(d) {
                this._current = this._current || d;
                var interpolate = d3.interpolate(this._current, d);
                this._current = interpolate(0);
                return function(t){
                    var d2  = interpolate(t),
                        pos = outerArc.centroid(d2); // computes the midpoint [x,y] of the centre line that would be
                    // generated by the given arguments. It is defined as startangle + endangle/2 and innerR + outerR/2
                    pos[0] = radius * (midAngle(d2) < Math.PI ? 1 : -1); // aligns the labels on the sides
                    return 'translate(' + pos + ')';
                };
            }

            function pointTween(d) {
                this._current = this._current || d;
                var interpolate = d3.interpolate(this._current, d);
                this._current = interpolate(0);
                return function(t){
                    var d2  = interpolate(t),
                        pos = outerArc.centroid(d2);
                    pos[0] = radius * 0.95 * (midAngle(d2) < Math.PI ? 1 : -1);
                    return [arc.centroid(d2), outerArc.centroid(d2), pos];
                };
            }

            // function to calculate the tween for an arc's transition.
            // see http://bl.ocks.org/mbostock/5100636 for a thorough explanation.
            function arcTween(d) {
                var i = d3.interpolate(this._current, d);
                this._current = i(0);
                return function(t) { return arc(i(t)); };
            }

            function findNeighborArc(i, data0, data1, key) {
                var d;
                return (d = findPreceding(i, data0, data1, key)) ? {startAngle: d.endAngle, endAngle: d.endAngle}
                    : (d = findFollowing(i, data0, data1, key)) ? {startAngle: d.startAngle, endAngle: d.startAngle}
                        : null;
            }
            // Find the element in data0 that joins the highest preceding element in data1.
            function findPreceding(i, data0, data1, key) {
                var m = data0.length;
                while (--i >= 0) {
                    var k = key(data1[i]);
                    for (var j = 0; j < m; ++j) {
                        if (key(data0[j]) === k) return data0[j];
                    }
                }
            }

            function key(d) {
                return d.data[category];
            }

            // Find the element in data0 that joins the lowest following element in data1.
            function findFollowing(i, data0, data1, key) {
                var n = data1.length, m = data0.length;
                while (++i < n) {
                    var k = key(data1[i]);
                    for (var j = 0; j < m; ++j) {
                        if (key(data0[j]) === k) return data0[j];
                    }
                }
            }

            // ===========================================================================================

        });
    }

    // getter and setter functions. See Mike Bostocks post "Towards Reusable Charts" for a tutorial on how this works.
    chart.width = function(value) {
        if (!arguments.length) return width;
        width = value;
        return chart;
    };

    chart.height = function(value) {
        if (!arguments.length) return height;
        height = value;
        return chart;
    };

    chart.margin = function(value) {
        if (!arguments.length) return margin;
        margin = value;
        return chart;
    };

    chart.radius = function(value) {
        if (!arguments.length) return radius;
        radius = value;
        return chart;
    };

    chart.padAngle = function(value) {
        if (!arguments.length) return padAngle;
        padAngle = value;
        return chart;
    };

    chart.cornerRadius = function(value) {
        if (!arguments.length) return cornerRadius;
        cornerRadius = value;
        return chart;
    };

    chart.colour = function(value) {
        if (!arguments.length) return colour;
        colour = value;
        return chart;
    };

    chart.variable = function(value) {
        if (!arguments.length) return variable;
        variable = value;
        return chart;
    };

    chart.category = function(value) {
        if (!arguments.length) return category;
        category = value;
        return chart;
    };

    chart.transTime = function(value) {
        if (!arguments.length) return transTime;
        transTime = value;
        return chart;
    };

    chart.data = function(value) {
        if (!arguments.length) return data;
        data = value;
        if (typeof updateData === 'function') updateData();
        return chart;
    };

    return chart;
}

//============================================================
// D3 code for making the tree for resistance profiling
//============================================================
function tree() {
	var data,
	    i = 0,
	    duration = 750,
	    margin = {top: 20, right: 10, bottom: 30, left: 30},
	    width = 960 - margin.left - margin.right,
	    height = 500 - margin.top - margin.bottom,
	    update;

	var treemap,
	    root;

	function chart(selection){
		selection.each(function() {

			height = height - margin.top - margin.bottom;
			width = width - margin.left - margin.right;
			// append the svg object to the selection
			var svg = selection.append('svg')
				.attr('width', width + margin.left + margin.right)
				.attr('height', height + margin.top + margin.bottom)
				.append('g')
				.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

			// declares a tree layout and assigns the size of the tree
			treemap = d3.tree().size([height, width]);

			// assign parent, children, height, depth
			root = d3.hierarchy(data, function(d) { return d.children });
			root.x0 = height / 2; // left edge of the rectangle
			root.y0 = 0; // top edge of the rect

			// collapse after the second level
			root.children.forEach(collapse);


			update = function(source) {

				// assigns the x and y position for the nodes
				var treeData = treemap(root);

				// compute the new tree layout
				var nodes = treeData.descendants(),
				    links = treeData.descendants().slice(1);

				// normalise for fixed depth
				nodes.forEach(function(d) { d.y = d.depth * 180; });

				// ****************** Nodes section ***************************

				// update the nodes ...
				var node = svg.selectAll('g.node')
					.data(nodes, function(d) { return d.id || (d.id = ++i); });

				// Enter any new modes at the parent's previous position.
				var nodeEnter = node.enter().append('g')
					.attr('class', 'node')
					.attr('transform', function(d) {
						return 'translate(' + (source.y0 + margin.top) + ',' + (source.x0 + margin.left) + ')';
					})
					.on('click', click);

				// add circle for the nodes
				nodeEnter.append('circle')
					.attr('class', 'node')
					.attr('r', 1e-6)
					.style('fill', function(d) {
						return d._children ? 'lightsteelblue' : '#fff';
					});

				// add labels for the nodes
				nodeEnter.append('text')
					.attr('dy', '.35em')
					.attr('x', function(d) {
						return d.children || d._children ? 0 : 13;
					})
					.attr('y', function(d) {
						return d.children || d._children ? -margin.top : 0;
					})
					.attr('text-anchor', function(d) {
						return d.children || d._children ? 'middle' : 'start';
					})
					.text(function(d) {
						return (d.children || d._children) ? d.data.id.capitalize() : d.data.id;
					});

				// add number of children to node circle
				nodeEnter.append('text')
					.attr('x', -3)
					.attr('y', 3)
					.attr('cursor', 'pointer')
					.style('font-size', '10px')
					.text(function(d) {
						if (d.children) return d.children.length;
						else if (d._children) return d._children.length;
					});

				// UPDATE
				var nodeUpdate = nodeEnter.merge(node);

				// transition to the proper position for the node
				nodeUpdate.transition().duration(duration)
					.attr('transform', function(d) {
						return 'translate(' + (d.y + margin.top) + ',' + (d.x + margin.left) + ')';
					});

				// update the node attributes and style
				nodeUpdate.select('circle.node')
					.attr('r', 9)
					.style('fill', function(d) {
						return d._children ? 'lightsteelblue' : '#fff';
					})
					.attr('cursor', 'pointer');

				// remove any exiting nodes
				var nodeExit = node.exit()
					.transition().duration(duration)
					.attr('transform', function(d) {
						return 'translate(' + (source.y + margin.top) + ',' + (source.x + margin.left) + ')';
					})
					.remove();

				// on exit reduce the node circles size to 0
				nodeExit.select('circle')
					.attr('r', 1e-6);

				// on exit reduce the opacity of text labels
				nodeExit.select('text')
					.style('fill-opacity', 1e-6);

				// ****************** links section ***************************

				// update the links
				var link = svg.selectAll('path.link')
					.data(links, function(d) { return d.id });

				// enter any new links at the parent's previous position
				var linkEnter = link.enter().insert('path', 'g')
					.attr('class', 'link')
					.attr('d', function(d) {
						var o = {x: source.x0 + margin.left, y: source.y0 + margin.top};
						return diagonal(o, o);
					});

				// UPDATE
				var linkUpdate = linkEnter.merge(link);

				// transition back to the parent element position
				linkUpdate.transition().duration(duration)
					.attr('d', function(d) { return diagonal(d, d.parent); });

				// remove any exiting links
				var linkExit = link.exit()
					.transition().duration(duration)
					.attr('d', function(d) {
						var o = {x: source.x, y: source.y};
						return diagonal(o, o);
					})
					.remove();

				// store the old positions for transition
				nodes.forEach(function(d) {
					d.x0 = d.x + margin.left;
					d.y0 = d.y + margin.top;
				});

				// creates a curved (diagonal) path from parent to the child nodes
				function diagonal(s, d) {
					path = 'M ' + (s.y + margin.top) + ' ' + (s.x + margin.left) +
						'C ' + ((s.y + d.y + (margin.top * 2)) / 2) + ' ' + (s.x + margin.left) +
						', ' + ((s.y + d.y + (margin.top * 2)) / 2) + ' ' + (d.x + margin.left) +
						', ' + (d.y + margin.top) + ' ' + (d.x + margin.left);
					return path;
				}

				// toggle children on click
				function click(d) {
					if (d.children) {
						d._children = d.children;
						d.children = null;
					} else {
						d.children = d._children;
						d._children = null;
					}
					update(d);
				}
			};
			update(root);
		});
	}

	chart.width = function(value) {
		if (!arguments.length) return width;
		width = value;
		return chart;
	};

	chart.height = function(value) {
		if (!arguments.length) return height;
		height = value;
		return chart;
	};

	chart.margin = function(value) {
		if (!arguments.length) return margin;
		margin = value;
		return chart;
	};

	chart.data = function(value) {
		if (!arguments.length) return data;
		data = value;
		if (typeof update === 'function') {
			root = d3.hierarchy(data, function(d) { return d.children; });
			root.x0 = height / 2; // left edge of the rectangle
			root.y0 = 0; // top edge of the triangle
			root.children.forEach(collapse);
			update(root);
		}
		return chart;
	};

	// collapse the node and all it's children
	function collapse(d) {
		if (d.children) {
			d._children = d.children;
			d._children.forEach(collapse);
			d.children = null;
		}
	}

	String.prototype.capitalize = function() {
		return this.charAt(0).toUpperCase() + this.slice(1).toLowerCase();
	};

	return chart;
}
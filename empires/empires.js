//##Summary
//
// This [D3](http://d3js.org/) visualization is by [Edward Lee](http://www.visualizing.org/users/edward-lee), with a 
// few minor modifications by [BFL](mailto:bradflyon@gmail.com)
//
//Notes by [BFL](mailto:bradflyon@gmail.com)
//
//The basic structure of this example could probably serve as a nice template for many D3 visualizations, having the
//following basic components:

// * *initialization*
//     * load the data into a `data` variable
//     * call out to `processData`
//     * construct the basic `svg` elements from the data and auxiliary objects (e.g., axes ticklines)
//     * configure any click/touch events for the `svg` elements
//     * kick off the first redraw
// * *redraw*
//     * redraw everything, using transitions for everything
// * *processData*
//     * perform any additional processing on the data for auxiliary quantities
// * *window resize event* ($(window).resize if using jQuery)
//     * determine current visualization bounds based on the window size, etc.
//     * call out to `processData` to update auxiliary quantities
//     * call `redraw`

//***

//##Variables

// The current width and height of the visualization; this will change if the window size changes
var wid, hei;
// How long the transitions should last, in milliseconds
var transitionDuration = 800;

//The data that is loaded from the file
var data = [];
// `scales` holds the various scales used for rendering, and some helper utility functions:
//
// * `scales.years`
//    * [d3 linear scale](https://github.com/mbostock/d3/wiki/Quantitative-Scales#wiki-linear_domain) that maps [minYear,maxYear] to [padding.left, wid - padding.right] (the horizontal pixel bounds of the visualization)
//    * this is used to get the proper x location on the screen given a year, handling a *lot* of grunt work in a nice way
//* `scales.indexes`
//    * [d3 linear scale](https://github.com/mbostock/d3/wiki/Quantitative-Scales#wiki-linear_domain) that maps
//           [0, data.length - 1] to [padding.top, hei - padding.bottom - barHeight]
//    * this is used to determine the y location of a bar when fixed heights are being used
//* `scales.areas`(*area*)
//    * function that takes an area and returns the height in pixels that that area represents, as a fraction of the total overall empire areas
//* `scales.popPercents`(*popPercent*)
//    * function that takes a population percent and returns the height in pixels that that population percent represents, as a fraction of the total overall empire areas
var scales = {};

//`totals` holds some auxiliary quantities calculated during initialization:
//
// * `totals.area` is the sum of area over all empires
// * `totals.population` is the sum of population over all empires
// * `totals.popPercent` is the sum of population percent over all empires
var totals = {};

//`vis` is the main html/svg element that contains all of the graphics
var vis;
//Set some "comfortable" padding around the visualization
var padding = {
	top : 40,
	right : 140,
	bottom : 30,
	left : 30
}
//The initial barHeight for the bars; this will be changed based on the actual data and window height
var barHeight = 10;
//If the percentage of total population is not defined for a given empire, then use this default value
var defaultPopPercent = .08;

//The `controls` variable holds the current view option settings, as set by clicking one of the links in the "controls" portion of the screen

//* `controls.display` - how the bars are placed horizontally
//    * "timeline": each bar is placed horizontally where its start year is
//    * "centered": each bar is placed so that the peak year of the corresponding empire is in the center of the screen
//    * "aligned": bars are all placed on far left of visualization (this is the fallback if controls.display is not one of the other two possible values)
//* `controls.height` - how the height of each bar is determined
//    * "fixed": the height of each bar is the same, and is calculated based on the vertical screen size of the visualization
//    * "area": the height of each bar corresponds to how much of the total area over all of the empires, thus providing a way to visually compare the size of each empire
//    * "population": the height of each bar correspond to how much of the total population percentage over all of the empires, thus providing a way to visually compare the fraction of world population of each empire
var controls = {
	display : "aligned",
	height : "fixed"
}

//***

//##Initialization

//This is the [jQuery callback called when the DOM is fully loaded](http://api.jquery.com/ready/)
$(document).ready(function() {

	//This will create the `<svg>` html element, so that you end up with this:
	//>    `<body><svg class="vis">` <br/>

	//Note that D3 can handle this particular case if you just use "*svg*" instead of "*svg:svg*"
	vis = d3.select("body")
			.append("svg:svg")
				.attr("class", "vis");

	//Set the size of the div based on the current size of the window; this method
	//is called every time the window is resized, too
	setVisSize();

	//###Load the Data
	//Internally, the `d3.csv` function uses an ajax call to load the raw data;
	//if you're working on a local file system, you need to tweak d3
	// to handle ajax calls to local files, a la [this pull request for D3](https://github.com/mbostock/d3/pull/632).
	//For local file stuff to work on Chrome, you need to also enable local file access
	// via something like `--allow-file-access-from-files`, but I haven't tried it yet.
	d3.csv("Empires_Data.csv", function(d) {

		data = d;

		//###Parse the data
		//Each line of the csv file results in an element in the `data` array
		for ( i = 0; i < data.length; i++) {
			d = data[i];
			//Do a little bit of cleanup/converting
			for (prop in d) {
				if (!isNaN(d[prop])) {
					d[prop] = parseFloat(d[prop]);
				} else if (d[prop] == "Yes") {
					d[prop] = true;
				} else if (d[prop] == "No") {
					d[prop] = false;
				}
			}
		}

		//### Do sort and calculate totals
		//This is not in `processData` because we only need to do it once, as the source data do not change after being loaded

		//Sort the data by start year for the empire, using the [d3 `ascending` utility method](https://github.com/mbostock/d3/wiki/Arrays#wiki-d3_ascending)
		data.sort(function(a, b) {
			return d3.ascending(a.Start, b.Start);
		});

		//Calculate the total area of all empires, using the [d3 `sum` utility method](https://github.com/mbostock/d3/wiki/Arrays#wiki-d3_sum)
		totals.area = d3.sum(data, function(d) {
			return d.Land_area_million_km2;
		});

		//Calculate the total population of all empires, using the [d3 `sum` utility method](https://github.com/mbostock/d3/wiki/Arrays#wiki-d3_sum)
		totals.population = d3.sum(data, function(d) {
			return d.Estimated_Population;
		});

		//Calculate the sum of the population percentage over  of all empires, using the
		//[d3 `sum` utility method](https://github.com/mbostock/d3/wiki/Arrays#wiki-d3_sum); some of the records do not have the population percentage defined,
		//so these must be dealt somehow, in this case returning the default
		//population percentage (of 0.08)
		totals.popPercent = d3.sum(data, function(d) {
			if (isNaN(d.Percent_World_Population))
				return defaultPopPercent;
			else
				return d.Percent_World_Population;
		});

		//Process data for scales, etc. (see notes below)
		processData();

		//Some more initialization (these methods only called once; see notes below)
		drawStarting();
		addInteractionEvents();

		//Set the initial options for controls.display and controls.height, after a wait of 500ms (for a bit of a dramatic effect :) )
		setTimeout(function() {
			//Set the initial "controls.display" option to "timeline", and do not redraw
			setControl($("#controls #layoutControls #layout-timeline"), "display", "timeline", false);
			//Set the initial "controls.height" option to "area", and redraw
			setControl($("#controls #heightControls #height-area"), "height", "area", true);
		}, 500);

	});
});
//***

//##Set the Width and Height of the Visualization

//These calculations are based on the current window size
function setVisSize() {

	wid = $(window).width() - 4;
	hei = $(window).height() - 25 - $("#controls").height();
	vis.attr("width", wid).attr("height", hei); //works in firefox; 
	/*
	 The original $(".vis").attr("width", wid);//does not work in firefox
	 */
	$(".vis .background").attr("width", wid).attr("height", hei);

}

//Note: You need to be careful how you set the width/height attributes, because the jQuery selectors might not work correctly on Firefox.

//***

//##Hook into Window Resize Event

//This uses [jQuery's resize](http://api.jquery.com/resize/) to get notified when the window's size is changed
$(window).resize(function() {
	setVisSize();
	processData();
	redraw();
});
//***

//##Recalculate Scales, etc. based on Current Window Size
/************************************************************
 * Process the data once it's imported
 ***********************************************************/
//`processData` is called every time the screen is resized.
//It sets `scales.years`, `scales.indexes`, `scales.areas`,  `scales.popPercents`

function processData() {

	//`barHeight` is used for the fixed size case
	barHeight = (hei - padding.top - padding.bottom) / data.length;

	//Configure the `scales` functions
	scales.years = d3.scale.linear()
					.domain([d3.min(data, function(d) {return d.Start;}), 
							d3.max(data, function(d) {return d.End;})])
					.range([padding.left, wid - padding.right]);

	scales.indexes = d3.scale.linear()
					.domain([0, data.length - 1])
					.range([padding.top, hei - padding.bottom - barHeight]);

	scales.areas = function(a) {
		var percentage = a / totals.area;
		var range = hei - padding.top - padding.bottom;
		return range * percentage;
	}

	scales.popPercents = function(a) {
		if (isNaN(a))
			a = defaultPopPercent;
		var percentage = a / totals.popPercent;
		var range = hei - padding.top - padding.bottom;
		return range * percentage;
	}
	//Determine the y location for each bar for the case where height of each bar is proportional to the area of the corresponding empire
	var y_area = padding.top;
	for ( i = 0; i < data.length; i++) {
		d = data[i];
		d.area_y = y_area;
		y_area += scales.areas(d.Land_area_million_km2);
	}

	//Determine the y location for each bar for the case where height of each bar is proportional to the population percentage
	var y_popPercent = padding.top;
	for ( i = 0; i < data.length; i++) {
		d = data[i];
		d.popPercent_y = y_popPercent;

		if (isNaN(d.Percent_World_Population))
			y_popPercent += scales.popPercents(defaultPopPercent);
		else
			y_popPercent += scales.popPercents(d.Percent_World_Population);
	}

}

//***

//##Initial Render (called only once)
/************************************************************
 * Initial rendering of the vis
 ***********************************************************/
function drawStarting() {

	//###The Main *rect* Containing the Visualization
	
	//1. Create a new [svg `rect` element](http://www.w3.org/TR/SVG/shapes.html#RectElement) under the main visualization element
	//2. Set its CSS class to "background"
	//3. Set its `x` attribute to 0
	//4. Set its `y` attribute to 0
	//5. Set its width to the current window width (as calculated in `setVisSize()`)
	//6. Set its height to the current window height (as calculated in `setVisSize()`)
	vis.append("svg:rect")
		.attr("class", "background")
		.attr("x", 0)
		.attr("y", 0)
		.attr("width", wid)
		.attr("height", hei);

	//### Initialize the Year Ticks
	//1. Select all of the `line` elements (which won't exist yet)
	//2. Attach data returned from the [D3 ticks function](https://github.com/mbostock/d3/wiki/Quantitative-Scales#wiki-linear_ticks); there will be 10 uniformly-spaced values in the dataset
	//3. Begin the process for what to do with new data (the `enter()` call)
	//4. For each new one, append an [svg `line` element](http://www.w3.org/TR/SVG/shapes.html#LineElement)
	//5. Set the CSS `class` for this line to "tickLine"
	//6. Set the `x1` attribute for the line to the left-most position in the visualization
	//7. Set the `x2` attribute for the line to the left-most position in the visualization
	//8. Set the `y1` attribute for the line to the yop-most position in the visualization
	//9. Set the `y2` attribute for the line to the bottom-most position in the visualization
	
	vis.selectAll("line")
		.data(scales.years.ticks(10))
		.enter()
			.append("svg:line")
				.attr("class", "tickLine")
				.attr("x1", padding.left)
				.attr("x2", padding.left)
				.attr("y1", padding.top)
				.attr("y2", hei - padding.bottom);

	//### Empire Containers
	//
	//1. Select all of the `g` elements
	//2. Attach the `data` to these elements
	//3. Begin the process for what to do with new data (the `enter()` call)
	//4. For each new one, append an [svg `g` element](http://www.w3.org/TR/SVG/struct.html#Groups) 
	//5. Set the CSS `class` of the element to "barGroup"
	//6. Set the `index` attribute for use later when the bar is clicked and we need to know which one it was
	//7. Set the `transform` attribute to be a translation to where the left is always
	//        the far-most left, and the y location depends on the data row; the left position will
	//        will be modified each time in the redraw method by transition calls based on which options are chosen
	vis.selectAll("g")
		.data(data)
		.enter()
			.append("svg:g")
				.attr("class", "barGroup")
				.attr("index", function(d, i) {return i;})
				.attr("transform", function(d, i) {
					return "translate(" + padding.left + ", " + scales.indexes(i) + ")";
				 });

	// ### Bars
	//1. Select all of the `g.barGroup` elements (these will have been created in the call above, and have the `data` attached to them)
	//2. For each one, append an [svg `rect`](http://www.w3.org/TR/SVG/shapes.html#RectElement) element
	//3. For this new rect, set its class to `bar`
	//4. Set the x attribute to 0
	//5. Set the y attribute to 0
	//6. Set the width of the rect to a function that returns the (scaled) distance between the end and start years for the data row
	//7. Set the height attribute to the initial default barHeight above (this will be reset in the redraw method)
	vis.selectAll("g.barGroup")
			.append("svg:rect")
				.attr("class", "bar")
				.attr("x", 0)
				.attr("y", 0)
				.attr("width", function(d) {
							return scales.years(d.End) - scales.years(d.Start);
							})
				.attr("height", barHeight);

	// ###Empire Peak Lines
	//1. Select all `g.barGroup` elements
	//2. For each one, append an [svg `line` element](http://www.w3.org/TR/SVG/shapes.html#LineElement)
	//3. Set the CSS class for this new line to "peakLine"
	//4. Set the x1 attribute for the line to be a function that returns where the peak for that data point fits during the time period for the empire
	//5. Set the x2 attribute for the line to be the same function as for x1
	//6. Set the y1 attribute to be 0 (which is the top of the barGroup the line is in)
	//7. Set the y2 attribute for the line to be the current generic barHeight (this will be reset in the redraw method based on the current options)
	vis.selectAll("g.barGroup")
			.append("svg:line")
				.attr("class", "peakLine")
				.attr("x1", function(d) {
						return scales.years(d.Peak) - scales.years(d.Start);
					})
				.attr("x2", function(d) {
						return scales.years(d.Peak) - scales.years(d.Start);
					})
				.attr("y1", 0)
				.attr("y2", barHeight);

	//###Bar Labels
	//1. Select all of the `g.barGroup` elements
	//2. For each one, append an [svg `text` element](http://www.w3.org/TR/SVG/text.html#TextElement)
	//3. Set the CSS class for this new element to be "barLabel"
	//4. Set the x value to be a function that returns the width of the bar
	//5. Set the y atrribute of the `text` element to be 0
	//6. Set the `dx` attribute to 5 pixels to give a little space next to the bar
	//7. Set the `dy` property to be a tad down from 0 at 0.35em
	//8. Set the inline css style `fill` to be the color #0ff IF this empire has contiguous = false
	//9. Set the text itself to be d.name (will be actual contents of the tag itself)
	vis.selectAll("g.barGroup")
			.append("svg:text")
				.attr("class", "barLabel")
				.attr("x", function(d) {
						return scales.years(d.End) - scales.years(d.Start);
					})
				.attr("y", 0)
				.attr("dx", 5)
				.attr("dy", ".35em")
				.style("fill", function(d) {
						if (d.Contiguous === false)
							return "#0ff";
					})
				.text(function(d) {
						return d.Name;
					});

	// ###Tick Labels
	//1. Select all of the `text.rule` elements (which might not exist yet, which is ok as they can be created after the data has been added)
	//2. Attach the data to these elements, being the 10 tick marks
	//3. Indicate what to do for new data
	//4. For each new data, add an [svg `text` element](http://www.w3.org/TR/SVG/text.html#TextElement)
	//5. Set its CSS class to "rule"
	//6. Set the x attribute to padding.left for each one (will be reset in redraw based on other options)
	//7. Set the y attribute to be a constant 20 (this is relative to the containing element)
	//8. Set the dy attribute to 0 (maybe this was twiddled at some point)
	//9. Set the `tedxt-anchor` attribute to "middle" to center the text
	//10. Set the text for the element as the function that returns the formatted year for the data point
	//11. Set the initial opacity to 0; this will be transitioned to the proper value in the redraw function
	vis.selectAll("text.rule")
		.data(scales.years.ticks(10))
		.enter()
			.append("svg:text")
				.attr("class", "rule")
				.attr("x", padding.left)
				.attr("y", 20)
				.attr("dy", 0)
				.attr("text-anchor", "middle")
				.text(function(d) {
						return formatYear(d);
					})
				.style("fill-opacity",0);

}

//***

//##redraw
/************************************************************
 * Redraw the vis with transition
 ***********************************************************/

//Redraw everything, using a transition for each thing rendered every time

//Things are rendered from back to front:

//* year ticklines ("line.tickline")
//* empire containers ("g")
//* bars ("g.barGroup rect.bar")
//* bar labels ("g.barGroup text.barLabel")
//* peak lines ("g.barGroup line.peakLine")
//* tick labels ("text.rule")
function redraw() {

	$("#infobox").hide();

	//Calculate the horizontal center of the rendering area for later use
	var visCenter = (wid - padding.left - padding.right) / 2 + padding.left;

	//###redraw the Year Ticks
	//The ticklines are shown either at the specified tick intervals, bunched up in the middle,
	//       or all the way to the left; the top and bottom are the height of the
	//       container minus the padding
	vis.selectAll("line.tickLine")
		.transition().duration(transitionDuration)
			.attr("x1", function(d, i) {
					if (controls.display == "timeline")
						return scales.years(d);
					else if (controls.display == "centered")
						return visCenter;
					else
						return padding.left;
				})
			.attr("x2", function(d) {
					if (controls.display == "timeline")
						return scales.years(d);
					else if (controls.display == "centered")
						return visCenter;
					else
						return padding.left;
				})
			.attr("y1", padding.top)
			.attr("y2", hei - padding.bottom);

	//###redraw the Empire Containers
	vis.selectAll("g")
		.transition().duration(transitionDuration)
			.style("fill-opacity", function(d) {
					if (controls.height == "population" && isNaN(d.Percent_World_Population))
						return .4;
					else
						return 1;
				})
			.attr("transform", function(d, i) {
				var tx, ty;
				if (controls.display == "timeline")
					tx = scales.years(d.Start);
				else if (controls.display == "centered")
					tx = visCenter - (scales.years(d.Peak) - scales.years(d.Start));
				else
					tx = padding.left;

				if (controls.height == "area")
					ty = d.area_y;
				else if (controls.height == "population")
					ty = d.popPercent_y;
				else
					ty = scales.indexes(i);
				return "translate(" + tx + ", " + ty + ")";
				});

	//###redraw the Bars
	vis.selectAll("g.barGroup rect.bar")
		.transition().duration(transitionDuration)
			.style("fill-opacity", function(d) {
					if (controls.height == "population" && isNaN(d.Percent_World_Population))
						return .25;
					else
						return .75;
				})
			.attr("height", function(d) {
					if (controls.height == "area")
						return scales.areas(d.Land_area_million_km2);
					else if (controls.height == "population")
						return scales.popPercents(d.Percent_World_Population);
					else
						return barHeight;
				});

	//###redraw the Bar Labels
	var labelHeight = 0;
	vis.selectAll("g.barGroup text.barLabel")
		.transition().duration(transitionDuration)
			.attr("y", function(d) {
					if (controls.height == "area")
						return scales.areas(d.Land_area_million_km2) / 2 - labelHeight;
					else if (controls.height == "population")
						return scales.popPercents(d.Percent_World_Population) / 2 - labelHeight;
					else
						return barHeight / 2 - labelHeight;
				});

	//###redraw the Peak Lines
	vis.selectAll("g.barGroup line.peakLine")
		.transition().duration(transitionDuration)
			.attr("y2", function(d) {
					if (controls.height == "area")
						return scales.areas(d.Land_area_million_km2);
					else if (controls.height == "population")
						return scales.popPercents(d.Percent_World_Population);
					else
						return barHeight;
				});

	//###redraw the Tick Labels
	vis.selectAll("text.rule")
		.transition().duration(transitionDuration)
			.attr("x", function(d) {
					if (controls.display == "timeline")
						return scales.years(d);
					else if (controls.display == "centered")
						return visCenter;
					else
						return padding.left;
				})
			.attr("y", 20)
			.attr("dy", 0)
			.style("fill-opacity", function(d) {
					if (controls.display == "timeline") {
						return 1;
					}
					else {
					return 0;
				}		
				});

}

//***

//##Configure Interaction Events (called only once)

/************************************************************
 * Add interaction events after initial drawing
 ***********************************************************/
function addInteractionEvents() {

	//This will set up the click event on every single bar that was drawn, with the result that if the user clicks on one of the
	//bars, the InfoBox specific to that bar will be shown
	$("g.barGroup").click(function(e) {
		showInfoBox(e, $(this).attr("index"));
	});
	//Configure so that a click that is NOT on a bar will (ultimately) hide the InfoBox
	$(".vis .background, .vis .mouseLine").click(function(e) {
		showInfoBox(e, null);
	});

	//Note: if this will be used on mobile devices, it is probably worth checking out hooking up to touch events rather than
	// click events for responsiveness purposes.

}

//***
//##Show InfoBox
/************************************************************
 * Display info box for data index i, at mouse
 ***********************************************************/
//Show the InfoBox for a particular empire, or simply hide the InfoBox
//if `i` is null
function showInfoBox(e, i) {

	if (i == null)
		$("#infobox").hide();
	else {
		var d = data[i];

		//Build up the html for the InfoBox
		var info = "<span class='title'>" + d.Name + "</span>";
		info += "<br />" + formatYear(d.Start) + " - " + formatYear(d.End);
		if (!isNaN(d.Land_area_million_km2))
			info += "<br />" + " Peak (" + formatYear(d.Peak) + "): " + d.Land_area_million_km2 + " million sq km";
		if (!isNaN(d.Estimated_Population))
			info += "<br />" + d.Estimated_Population + " million people in " + formatYear(d.Population_Year);
		else
			info += "<br />" + "no population data available";
		if (!isNaN(d.Percent_World_Population))
			info += "<br />" + "(" + Math.round(d.Percent_World_Population * 100) + "% of world population)";
		if (d.Contiguous === false)
			info += "<br />" + "non-contiguous";

		//Determine where the InfoBox will be going on the screen;
		//if the bar clicked is in the top half, use the [mouse coordinates] where the user clicked,
		//otherwise shift back to the left and up a little big (in case the box is near the bottom of the screen)
		var infoPos;
		if (i <= data.length / 2)
			infoPos = {
				left : e.pageX,
				top : e.pageY
			};
		else
			infoPos = {
				left : e.pageX - 200,
				top : e.pageY - 80
			};

		//1. Shove the `info` html we just built into the `#infobox` div element,
		//2. Set its position in CSS
		//3. Then show it, show it, show it...
		$("#infobox").html(info).css(infoPos).show();
	}

}

//***

//##Set Current View Options

//This sets either controls.display or controls.height; it is called from the initialization routine and from the script in the html itself
function setControl(elem, con, val, re) {
	//Remove the CSS "active" class for any sibling elements, by:
	// 
	//1. Finding the parent elements that have class ".controlGroup" via [jQuery's parents() function](http://api.jquery.com/parents/)
	//2. Finding the "a" descendants of the parents via [jQuery's find() function](http://api.jquery.com/find/)
	//3. Removing the CSS "active" class via [jQuery's removeClass() function](http://api.jquery.com/removeclass/)
	$(elem).parents(".controlGroup").find("a").removeClass("active");
	//Make sure the passed in element has its CSS class set to "active", using the [jQuery addClass() function](http://api.jquery.com/addclass/)
	$(elem).addClass("active");
	//Set controls.display or controls.height (could be any property, but only "display" and "height" are passed in for "con" in this example)
	controls[con] = val;
	//If the caller wants us to redraw now, do so
	if (re == true)
		redraw();
}

//***

//This function doesn't seem to be called anywhere
function parseTransform(s) {
	if (s.substr(0, 10) == "translate(") {
		s = s.substring(10, s.length - 1);
		s = s.split(",");
		var v1 = parseFloat($.trim(s[0]));
		var v2 = parseFloat($.trim(s[1]));
	}
	return {
		val1 : v1,
		val2 : v2
	};
}

//***
//##Date Format Helper

//Helper function to format dates that are BCE
function formatYear(y) {
	if (y <= 0)
		return y * -1 + " BCE";
	else
		return y;
}


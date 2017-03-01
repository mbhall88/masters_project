/**
 * Created by michaelhall on 24/2/17.
 */
var express  = require('express'),
    path     = require('path'),
    fs       = require('fs'),
    chokidar = require('chokidar'),
    router   = express.Router();

const spawn = require('child_process').spawn;
const assert = require('assert');

const SCRIPT_DIR = path.join(__dirname, '../public/data/japsaTesting/');
const VIRUS_DB = path.join(__dirname, '../public/data/virusDB/');
// command to run species typing
const RUN_ST = SCRIPT_DIR + "speciesTypingMac.sh " + SCRIPT_DIR + "testZika/ " + VIRUS_DB;

// require middleware with donut chart function
// var chart = require('../middleware/donut.js');

/* GET home page. */
router.get('/', function(req, res, next) {
    res.render('analysis', {info: null});
});


router.post('/', function(req, res){
	console.log("Post request received...");

	// access the socket passed from the server
	var socket = req.app.get('socketio');

	// arguments (in order) to be passed to the child process
	var scriptArgs = ['speciesTypingMac.sh', 'testZika/', '../virusDB/'];

	var scriptOptions = {
		// this is the directory which the child process will be run on
		cwd: SCRIPT_DIR
	};

	// creating the child process
	const speciesTyping = spawn('sh', scriptArgs, scriptOptions);

	// encode the stdout as a string rather than a Buffer
	speciesTyping.stdout.setEncoding('utf8');

	// handle error in trying to run spawn command
	speciesTyping.on('error', function(err){
		console.log("Spawn has error: " + err);
	});

	// handle STDERR coming from child process
	speciesTyping.stderr.on('data', function(chunk){
		// console.log("STDERR: " + chunk);
	});

	// handle STDOUT coming from child process. This should be the species typing output
	speciesTyping.stdout.on('data', function(chunk){
		console.log("STDOUT: " + chunk);
		var info = parseSpecTypingResults(chunk);
		var prob = +info.prob * 100;
		socket.emit('stdout', info);
		// res.render("analysis", {info: parseSpecTypingResults(chunk)});
	});

	speciesTyping.on('close', function(code){
		if (code !== 0){
			console.log("Process exited with code " + code);
		}
	});
});


// function to parse species typing output
function parseSpecTypingResults(stdout){
	if (stdout.startsWith("time")){
		var lines = stdout.split("\n");

		// removes the header line
		lines.splice(0, 1);
		return st2JSON(lines[0]);
	} else {
		return st2JSON(stdout.trim("\n"));
	}
}

// parses a line into the required object
function st2JSON(line){
	var headings = [
		"time", "step", "reads", "bases", "species", "prob", "err", "tAligned", "sAligned"
	];
	var results = line.split("\t");

	// make sure the results have the same number of fields as the headings
	var assertError = "Number of fields returned from Species-typing does not match the " +
			"required number!";
	assert.strictEqual(results.length, headings.length, assertError);

	var output = {};

	// add headings as keys and associate their values from the parsed line
	for (var i = 0; i < headings.length; i++){
		if (!isNaN(results[i])){
			output[headings[i]] = +results[i];
			if (headings[i] === "prob"){
				// TODO - bug with some numbers not rounding properly i.e 99.770000000000001
				output[headings[i]] = Math.round(output[headings[i]] * 10000) / 10000;
			}
		} else {
			if (headings[i] === "species"){
				results[i] = results[i].split(" ").slice(0, 4).join(" ");
			}
			output[headings[i]] = results[i];
		}
	}
	return output;
}


module.exports = router;


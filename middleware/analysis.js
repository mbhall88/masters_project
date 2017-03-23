/**
 * Created by m.hall on 23/3/17.
 */
const spawn = require('child_process').spawn,
      path  = require('path');


// child process constructor for npReader
function run_npReader(pathData) {
	console.log('npReader called...');

	var npReaderArgs = [
		    '--realtime', // run the program in real-time mode
		    '--fail', // get sequence reads from the fail folder
		    '--folder ' + pathData.pathToInput, // the folder containing base-called reads
		    '--output -' // output to stdout (this is default but included for clarity)
	    ],
	    npReaderOptions = {
		    cwd: pathData.pathForOutput, // where to run the process
		    stdio: ['pipe', 'pipe', 'pipe'] // stdin stdout stderr types (could use 'ignore')
	    };

	return spawn('jsa.np.npreader', npReaderArgs, npReaderOptions);
}

// child process constructor for bwa
function run_bwa(pathData, startFrom) {
	console.log('bwa called...');

	// if user provided fastq, analysis starts from bwa and the input to bwa is set as the fastq
	// file specified by client. otherwise, input is from stdin (-).
	var readFrom = (startFrom) ? pathData.pathToInput : '-';

	var bwaArgs = [
		    '-t 4', // number of threads
		    '-k 11', // min. seed length
		    '-W 20', // discard a chain if seeded bases shorter than INT
		    '-r 10', // look for internal seeds inside a seed longer than {-k} * FLOAT
		    '-A 1', // mismatch score
		    '-B 1', // penalty for mismatch - optimised for np
		    '-O 1', // gap open penalty - optimised for nanopore
		    '-E 1', // gap extension penalty
		    '-L 0', // penalty for 5'- and 3'-end clipping - optimised for np
		    '-Y', // use soft clipping for supplementary alignments
		    '-K 10000', // buffer length in bp (not documented)
		    path.join(pathData.pathToVirus, 'genomeDB.fasta'), // ref sequence/db
		    readFrom // read file from
	    ],
	    bwaOptions = {
		    cwd: pathData.pathForOutput, // where to run the process
		    stdio: ['pipe', 'pipe', 'pipe'] // stdin stdout stderr types (could use 'ignore')
	    };

	return spawn('bwa mem', bwaArgs, bwaOptions);
}

// child process constructor for real-time species typing
function run_speciesTyping(pathData) {
	console.log('species typing called...');

	var specTypingArgs = [
		    '--web', // output is in JSON format for use in the web app viz
		    '--bamFile=-', // read BAM from stdin
		    '--indexFile=' + path.join(pathData.pathToVirus, 'speciesIndex'), // index file
		    '--read=100', // min. number of reads between analysis
		    '--time=3', // min. number of secs between analysis
		    '--output=-' // output to stdout
	    ],
	    specTypingOptions = {
		    cwd: pathData.pathForOutput, // where to run the process
		    stdio: ['pipe', 'pipe', 'pipe'] // stdin stdout stderr types (could use 'ignore')
	    };

	return spawn('jsa.np.rtSpeciesTyping', specTypingArgs, specTypingOptions);
}

module.exports = {
	run_npReader: run_npReader,
	run_bwa: run_bwa,
	run_speciesTyping: run_speciesTyping
};
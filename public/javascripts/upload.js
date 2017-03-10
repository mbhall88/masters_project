/**
 * Created by m.hall on 21/2/17.
 */
var progress    = $('#progress'),
    progressBar = $('#progress__bar');

// this function needs to be defined first as code below depends on it being available
var isAdvancedUpload = function() {
	var div = document.createElement('div');
	// testing if browser supports drag and drop events
	return (('draggable' in div) || ('ondragstart' in div && 'ondrop' in div)) &&
		// check the FormData interface which is forming a programmatic object of the files
		'FormData' in window &&
		// detect if browser supports DataTransfer object for file uploading
		'FileReader' in window;
};

// ============================================================================
// UPLOAD LOCAL FILE FORM LOGIC AND DRAG AND DROP BOX
// ============================================================================

var $form     = $('.box'),
    $input    = $form.find('input[type="file"]'),
    $label    = $form.find('label'),
    $errorMsg = "FILE UPLOAD ERROR";


// allows us to style the form depending on whether the browser supports drag and drop
if (isAdvancedUpload()) {
	$form.addClass('has-advanced-upload');

	//This part deals with adding and removing classes to the form on the different states like when
	// the user is dragging a file over the form. Then, catching those files when they are dropped.
	var droppedFiles = false;

	$form.on('drag dragstart dragend dragover dragenter dragleave drop', function(e) {
		// prevent any unwanted behaviors for the assigned events across browsers.
		e.preventDefault();
		e.stopPropagation();
	})
		.on('dragover dragenter', function() {
			$form.addClass('is-dragover');
		})
		.on('dragleave dragend drop', function() {
			$form.removeClass('is-dragover');
		})
		.on('drop', function(e) {
			// returns the list of files that were dropped
			droppedFiles = e.originalEvent.dataTransfer.files;
		});
}

$form.on('submit', function(e) {
	if ($form.hasClass('is-uploading')) return false;

	$form.addClass('is-uploading')
		.removeClass('is-error');

	// Reset the progress bar to 0% when the user selects to upload another file
	$("#progress__bar").text("0%")
		.width("0%");

	if (isAdvancedUpload()) {
		// ajax for modern browsers
		e.preventDefault();

		// collects data from all the form inputs
		var ajaxData = new FormData();

		if (droppedFiles) { // add all files to the form that will be sent to the server
			$.each(droppedFiles, function(i, file) {
				ajaxData.append($input.attr('name'), file, file.name);
			});
		}

		$.ajax({
			url: '/upload',
			type: 'POST',
			data: ajaxData,
			cache: false,
			processData: false,
			contentType: false,
			complete: function() { $form.removeClass('is-uploading'); },
			success: ajaxSuccess,
			error: ajaxErrorHandler,
			xhr: ajaxXHR
		});
	} else {
		// ajax for legacy browsers
		var iframeName = 'uploadiframe' + new Date().getTime(),
		    $iframe    = $('<iframe name="' + iframeName + '" style="display: none;"></iframe>iframe>');

		$('body').append($iframe);
		$form.attr('target', iframeName);

		$iframe.one('load', function() {
			var data = JSON.parse($iframe.contents().find('body').text());
			$form.removeClass('is-uploading')
				.addClass(data.success == true ? 'is-success' : 'is-error')
				.removeAttr('target');
			if (!data.success) console.log(data.error);
			$form.removeAttr('target');
			$iframe.remove();
		});
	}
});

// remove submit button and submit on drop
$form.on('drop', function(e) {
	droppedFiles = e.originalEvent.dataTransfer.files;
	showFiles(droppedFiles);
	$form.trigger('submit');
});

// starts upload of file as soon as it is dropped.
$input.on('change', function(e) {
	$form.trigger('submit');

	// display the files the client has selected to upload
	showFiles(e.target.files);
});


// ============================================================================
// UPLOAD FROM URL FORM LOGIC
// ============================================================================
var urlForm = $('#upload-url'),
    urlEntry = $('#url-entry'),
	socket;

// when user presses the upload button on the URL input box...
urlForm.submit(function(e) {
	e.preventDefault();

	// Reset the progress bar to 0% when the user selects to upload another file
	$("#progress__bar").text("0%")
		.width("0%");

	var data = { urls: [] };

	// could loop through text and push to data.url for multiple URLS
	data.urls.push(urlEntry.val());

	// open socket to server to send/receive data and add listeners/emitters
	openSocket();

	// send the data to the server using the 'urls' event
	socket.emit('urls', data);
});

function openSocket() {
	socket = io.connect(location.href);

	// when receiving progress from curl from the server, update the progress bar
	socket.on('progress', function(prog) {
		updateProgressBar(prog)
	});

	// listener for completion to clear text
	socket.on('downloadComplete', function() {
		urlEntry.val("");
	});

	// emitter for stop button press

	// disable/enable upload logic

	//check file type is ok
}




// ============================================================================
// FUNCTIONS
// ============================================================================

function updateProgressBar(val) {
	//	update the progress bar with the new percentage
	progressBar.text(val + "%")
		.width(val + "%");

	// updating the progress bar's percent so as to cause colour drawChart
	progress.attr('data-percent', val);

	//	once the upload reaches 100%, set the progress bar text to done
	if (val === 100){
		progressBar.html("Done");
	}
}

var ajaxErrorHandler = function(jqXHR, textStatus, errorThrown) {
	console.log(textStatus);
	console.log(errorThrown);
};

var ajaxSuccess = function(data, textStatus) {
	$form.addClass(data === 'success' ? 'is-success' : 'is-error');
	if (data !== 'success') console.log("Error " + data + textStatus);
};

var ajaxXHR = function(){ // logic to update progress bar
	var xhr = new XMLHttpRequest();

	// listen to the 'progress' event
	xhr.upload.addEventListener('progress', function(e){

		if (e.lengthComputable){
			//	Calculate the percentage of upload complete and update progress bar
			var percentComplete = e.loaded / e.total;
			percentComplete = parseInt(percentComplete * 100);
			updateProgressBar(percentComplete);
		}
	}, false);

	return xhr;
};

showFiles = function(files) {
	var len = files.length;
	if (len > 1) {
		$label.text(($input.attr('data-multiple-caption') || '').replace('{count}', len))
	} else {
		$label.text(files[0].name)
	}
};
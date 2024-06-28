<script>
var nopidrefresh = "0";

$(function() {
	
	interval = window.setInterval(function(){ servicestatus(); }, 3000);
	servicestatus();
	getconfig();
	update_ver();

});

// SERVICE STATE

function servicestatus() {
	$.mobile.loading().hide();
	$.mobile.loading( "hide" );

	if (nopidrefresh === "1") {
		return;
	}

	$.ajax( { 
			url:  'ajax.cgi',
			type: 'POST',
			data: { 
				action: 'servicestatus'
			}
		} )
	.fail(function( data ) {
		console.log( "Servicestatus Fail", data );
		$("#servicestatus").attr("style", "background:#dfdfdf; color:red").html("<TMPL_VAR "COMMON.HINT_FAILED">");
		$("#servicestatusicon").html("<img src='./images/unknown_20.png'>");
	})
	.done(function( data ) {
		console.log( "Servicestatus Success", data );
		if (nopidrefresh === "0") {
			if (data.pid) {
				$("#servicestatus").attr("style", "background:#6dac20; color:black").html("<TMPL_VAR "COMMON.HINT_RUNNING"> <span class='small'>PID: " + data.pid + "</span>");
				$("#servicestatusicon").html("<img src='./images/check_20.png'>");
			} else {
				$("#servicestatus").attr("style", "background:#FF6339; color:black").html("<TMPL_VAR "COMMON.HINT_STOPPED">");
				$("#servicestatusicon").html("<img src='./images/error_20.png'>");
			}
		}
	})
	.always(function( data ) {
		console.log( "Servicestatus Finished", data );
	});
}

// SERVICE START_STOP

function servicerestart() {

	nopidrefresh = "1";
	$("#servicestatus").attr("style", "color:blue").html("<TMPL_VAR "COMMON.HINT_EXECUTING">");
	$("#servicestatusicon").html("<img src='./images/unknown_20.png'>");
	$.ajax( { 
			url:  'ajax.cgi',
			type: 'POST',
			data: { 
				action: 'servicerestart'
			}
		} )
	.fail(function( data ) {
		console.log( "Servicerestart Fail", data );
	})
	.done(function( data ) {
		console.log( "Servicerestart Success", data );
		if (data == "0") {
			servicestatus();
		} else {
			$("#servicestatus").attr("style", "background:#dfdfdf; color:red").html("<TMPL_VAR "COMMON.HINT_FAILED">");
		}
	})
	.always(function( data ) {
		console.log( "Servicerestart Finished", data );
		nopidrefresh = "0";
	});
}

function servicestop() {

	nopidrefresh = "1";
	$("#servicestatus").attr("style", "color:blue").html("<TMPL_VAR "COMMON.HINT_EXECUTING">");
	$("#servicestatusicon").html("<img src='./images/unknown_20.png'>");
	$.ajax( { 
			url:  'ajax.cgi',
			type: 'POST',
			data: { 
				action: 'servicestop'
			}
		} )
	.fail(function( data ) {
		console.log( "Servicestop Fail", data );
	})
	.done(function( data ) {
		console.log( "Servicestop Success", data );
		if (data == "0") {
			servicestatus();
		} else {
			$("#servicestatus").attr("style", "background:#dfdfdf; color:red").html("<TMPL_VAR "COMMON.HINT_FAILED">");
		}
	})
	.always(function( data ) {
		console.log( "Servicestop Finished", data );
		nopidrefresh = "0";
	});
}

// ADD DEVICE: Popup

function popup_add_device() {

	var type = $('#type').val();
	// Clean Popup
	$("#savinghint_" + type).html('&nbsp;');
	$("#edit_" + type).val('');
	$("#form_" + type)[0].reset();
	// Open Popup
	$("#popup_device_" + type).popup( "open" );

}

// EDIT DEIVCE: Popup

function popup_edit_device(devicename) {

	// Ajax request
	$.ajax({ 
		url:  'ajax.cgi',
		type: 'POST',
		data: {
			action: 'getconfig'
		}
	})
	.fail(function( data ) {
		console.log( "edit_device Fail", data );
		return;
	})
	.done(function( data ) {
		console.log( "edit_device Success", data );

		devices = data.devices;
		if ( data.error || jQuery.isEmptyObject(devices)) {
			devices = undefined;
			return;
		}
		$.each( devices, function( intDevId, item){
			if (item.name == devicename) {
				$("#name_" + item.type).val(item.name);
				$("#type_" + item.type).val(item.type);
				$("#username_" + item.type).val(item.username);
				$("#password_" + item.type).val(item.password);
				$("#address_" + item.type).val(item.address);
				$("#edit_" + item.module).val(item.name);
				$("#popup_device_" + item.type ).popup( "open" );
			}
		});
	})
	.always(function( data ) {
		console.log( "edit_device Finished" );
	})

}

// ADD/EDIT GPIO MODULE (save to config)

function add_device(type) {

	$("#savinghint_" + type).attr("style", "color:blue").html("<TMPL_VAR "COMMON.HINT_SAVING">");
	$.ajax( { 
			url:  'ajax.cgi',
			type: 'POST',
			data: { 
				action: 'device',
				name: $("#name_" + type).val(),
				username: $("#username_" + type).val(),
				password: $("#password_" + type).val(),
				address: $("#address_" + type).val(),
				type: $("#type_" + type).val(),
				edit: $("#edit_" + type).val(),
			}
		} )
	.fail(function( data ) {
		console.log( "add_device Fail", data );
		var jsonresp = JSON.parse(data.responseText);
		$("#savinghint_" + type).attr("style", "color:red").html("<TMPL_VAR "COMMON.HINT_SAVING_FAILED">" + " Error: " + jsonresp.error + " (Statuscode: " + data.status + ").");
	})
	.done(function( data ) {
		console.log( "add_device Done", data );
		if (data.error) {
			$("#savinghint_" + type).attr("style", "color:red").html("<TMPL_VAR "COMMON.HINT_SAVING_FAILED">" + " Error: " + data.error + ").");
		} else {
			$("#savinghint_" + type).attr("style", "color:green").html("<TMPL_VAR "COMMON.HINT_SAVING_SUCCESS">" + ".");
			getconfig();
			// Close Popup
			$("#popup_device_" + type).popup( "close" );
			$( "#form_" + type )[0].reset();
			$("#savinghint_" + type).html('&nbsp;');
		}
	})
	.always(function( data ) {
		console.log( "add_device Finished", data );
	});

}

// DELETE DEIVCE: Popup

function popup_delete_device(devicename) {

	$("#deletedevicehint").html('&nbsp;');
	$("#deletedevicename").html(devicename);
	$("#popup_delete_device").popup( "open" )

}

// DELETE DEIVCE (save to config)

function delete_device() {

	$("#deletedevicehint").attr("style", "color:blue").html("<TMPL_VAR "COMMON.HINT_DELETING">");
	$.ajax( { 
			url:  'ajax.cgi',
			type: 'POST',
			data: { 
				action: 'deletedevice',
				name: $("#deletedevicename").html(),
			}
		} )
	.fail(function( data ) {
		console.log( "delete_device Fail", data );
		var jsonresp = JSON.parse(data.responseText);
		$("#deletedevicehint").attr("style", "color:red").html("<TMPL_VAR "COMMON.HINT_DELETING_FAILED">" + " Error: " + jsonresp.error + " (Statuscode: " + data.status + ").");
	})
	.done(function( data ) {
		console.log( "delete_device Done", data );
		if (data.error) {
			$("#deletedevicehint").attr("style", "color:red").html("<TMPL_VAR "COMMON.HINT_DELETING_FAILED">" + " Error: " + data.error + ").");
		} else {
			$("#deletedevicehint").attr("style", "color:green").html("<TMPL_VAR "COMMON.HINT_SAVING_SUCCESS">" + ".");
			getconfig();
			// Close Popup
			$("#popup_delete_device").popup( "close" );
			$("#deletedevicehint").html("&nbsp;");
		}
	})
	.always(function( data ) {
		console.log( "add_device Finished", data );
	});

}

// UPGRADE - VERSIONS

function update_ver()
{
	$("#currentversion").html("<TMPL_VAR COMMON.HINT_UPDATING>");
	$("#availableversion").html("<TMPL_VAR COMMON.HINT_UPDATING>");
	$.ajax( { 
			url:  'ajax.cgi',
			type: 'POST',
			data: { 
				action: 'getversions',
			}
		} )
	.done(function(resp) {
		console.log( "getversions", "success", resp );
		$("#currentversion").html(resp.versions.current);
		$("#availableversion").html(resp.versions.available);
		$(".UPGRADE").removeClass("ui-state-disabled");
	})
	.fail(function(resp) {
		console.log( "getversions", "fail", resp );
	})
	.always(function(resp) {
		console.log( "getversions", "finished", resp );
	});

}

// UPGRADE (save to config)

function upgrade() {
	$(".UPGRADE").addClass("ui-state-disabled");
	$("#currentversion").html("<TMPL_VAR COMMON.HINT_UPDATING>");
	$("#availableversion").html("<TMPL_VAR COMMON.HINT_UPDATING>");
	$("#savinghint_upgrade").attr("style", "color:blue").html("<TMPL_VAR UPGRADE.HINT_SAVE_SAVING>");
	console.log ("Upgrading MQTT-IO");
	$.ajax( { 
			url:  'ajax.cgi',
			type: 'POST',
			data: { 
				action: 'upgrade',
			}
		} )
	.fail(function( data ) {
		console.log( "upgrade Fail", data );
		$("#savinghint_upgrade").attr("style", "color:red").html("<TMPL_VAR UPGRADE.HINT_SAVE_ERROR>: "+data.statusText);
	})
	.done(function( data ) {
		console.log( "upgrade Success: ", data );
		$("#savinghint_upgrade").attr("style", "color:green").html("<TMPL_VAR UPGRADE.HINT_SAVE_OK>");
	})
	.always(function( data ) {
		update_ver();
		$(".UPGRADE").removeClass("ui-state-disabled");
		console.log( "upgrade Finished" );
	});
}

// MQTT (save to config)

function saveMQTT() {
	$(".MQTT").addClass("ui-state-disabled");
	$("#savinghint_mqtt").attr("style", "color:blue").html("<TMPL_VAR COMMON.HINT_SAVING>");
	console.log ("Saving MQTT");
	$.ajax( { 
			url:  'ajax.cgi',
			type: 'POST',
			data: { 
				action: 'savemqtt',
				topic: $("#topic").val(),
				delay: $("#delay").val(),
			}
		} )
	.fail(function( data ) {
		console.log( "saving MQTT Fail", data );
		$("#savinghint_mqtt").attr("style", "color:red").html("<TMPL_VAR COMMON.HINT_SAVING_FAILED>: "+data.statusText);
	})
	.done(function( data ) {
		console.log( "saving MQTT Success: ", data );
		$("#savinghint_mqtt").attr("style", "color:green").html("<TMPL_VAR COMMON.HINT_SAVING_SUCCESS>");
	})
	.always(function( data ) {
		getconfig();
		$(".MQTT").removeClass("ui-state-disabled");
		console.log( "saving MQTT Finished" );
	});
}

// GET CONFIG

function getconfig() {

	// Ajax request
	$.ajax({ 
		url:  'ajax.cgi',
		type: 'POST',
		data: {
			action: 'getconfig'
		}
	})
	.fail(function( data ) {
		console.log( "getconfig Fail", data );
	})
	.done(function( data ) {
		console.log( "getconfig Success", data );
		$("#main").css( 'visibility', 'visible' );

		// MQTT

		console.log( "Parse Item for MQTT Settings" );
		$("#topic").val(data.topic);
		$("#delay").val(data.delay);

		// Devices

		console.log( "Parse Item for DEVICES" );
		devices = data.devices;
		// Sort by type, than by name: https://medium.com/developer-rants/sorting-json-structures-by-multiple-fields-in-javascript-60ed96704df7
		devices = devices.sort((a, b) => {
			let retval = 0;
			if (a.type < b.type)
				retval = -1;
			if (a.type > b.type)
				retval = 1;
			if (retval === 0)
				retval = a.name < b.name ? -1 : 1;
			return retval;
		});
		$('#devices-list').empty();
		if ( data.error || jQuery.isEmptyObject(devices)) {
			$('#devices-list').html("<TMPL_VAR DEVICES.HINT_NO_MODULES>");
			devices = undefined;
		} else {
			// Create table
			var table = $('<table style="min-width:200px; width:100%" width="100%" data-role="table" id="devicestable" data-mode="reflow" class="ui-responsive table-stripe ui-body-b">').appendTo('#devices-list');
			// Add the header row
			var theader = $('<thead />').appendTo(table);
			var theaderrow = $('<tr class="ui-bar-b"/>').appendTo(theader);
			$('<th style="text-align:left; width:25%; padding:5px;"><TMPL_VAR COMMON.LABEL_NAME><\/th>').appendTo(theaderrow);
			$('<th style="text-align:left; width:20%; padding:5px;"><TMPL_VAR DEVICES.LABEL_TYPE><\/th>').appendTo(theaderrow);
			$('<th style="text-align:left; width:25%; padding:5px;"><TMPL_VAR DEVICES.LABEL_USERNAME><\/th>').appendTo(theaderrow);
			$('<th style="text-align:left; width:20%; padding:5px;"><TMPL_VAR DEVICES.LABEL_ADDRESS><\/th>').appendTo(theaderrow);
			$('<th style="text-align:left; width:10%; padding:5px;"><TMPL_VAR COMMON.LABEL_ACTIONS><\/th>').appendTo(theaderrow);
			// Create table body.
			var tbody = $('<tbody />').appendTo(table);
			// Add the data rows to the table body and dropdown lists
			$.each( devices, function( intDevId, item){
				// Table
				var row = $('<tr />').appendTo(tbody);
				$('<td style="text-align:left;">'+item.name+'<\/td>').appendTo(row);
				$('<td style="text-align:left;">'+item.type+'<\/td>').appendTo(row);
				$('<td style="text-align:left;">'+item.username+'<\/td>').appendTo(row);
				$('<td style="text-align:left;">'+item.address+'<\/td>').appendTo(row);
				$('<td />', { html: '\
				<a href="javascript:popup_edit_device(\'' + item.name + '\')" id="btneditdevice_'+item.name+'" name="btneditdevice_'+item.name+'" \
				title="<TMPL_VAR COMMON.BUTTON_EDIT> ' + item.name + '"> \
				<img src="./images/settings_20.png" height="20"></img></a> \
				<a href="javascript:popup_delete_device(\'' + item.name + '\')" id="btnaskdeletedevice_'+item.name+'" name="btnaskdeletedevice_'+item.name+'" \
				title="<TMPL_VAR COMMON.BUTTON_DELETE> ' + item.name + '"> \
				<img src="./images/cancel_20.png" height="20"></img></a> \
				' }).appendTo(row);
				$(row).trigger("create");
			});
		};
	})
	.always(function( data ) {
		console.log( "getconfig Finished" );
	})

}

</script>

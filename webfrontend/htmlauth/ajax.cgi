#!/usr/bin/perl
use warnings;
use strict;
use LoxBerry::System;
use LoxBerry::Log;
use CGI;
use JSON;
use Data::Dumper;

my $error;
my $response;
my $cgi = CGI->new;
my $q = $cgi->Vars;

#print STDERR Dumper $q;

#my $log = LoxBerry::Log->new (
#    name => 'AJAX',
#	stderr => 1,
#	loglevel => 7
#);

#LOGSTART "Request $q->{action}";


if( $q->{action} eq "servicerestart" ) {
	system ("$lbpbindir/watchdog.pl --action=restart --verbose=0 > /dev/null 2>&1");
	$response = $?;
}

if( $q->{action} eq "servicestop" ) {
	system ("$lbpbindir/watchdog.pl --action=stop --verbose=0 > /dev/null 2>&1");
	$response = $?;
}

if( $q->{action} eq "servicestatus" ) {
	my $status;
	my $count = `pgrep -c -f "pysma2mqtt.py"`;
	if ($count >= "2") {
		$status = `pgrep -o -f "pysma2mqtt.py"`;
	}
	my %response = (
		pid => $status,
	);
	chomp (%response);
	$response = encode_json( \%response );
}

if( $q->{action} eq "getversions" ) {
	my %versions;
	my %response;
	$versions{'current'} = execute("$lbpbindir/upgrade.sh current");
	$versions{'available'} = execute("$lbpbindir/upgrade.sh available");
	$response{'versions'} = \%versions;
	chomp (%response);
	$response = encode_json( \%response );
}

if( $q->{action} eq "getconfig" ) {
	if ( -e "$lbpconfigdir/plugin.json" ) {
		$response = LoxBerry::System::read_file("$lbpconfigdir/plugin.json");
		if( !$response ) {
			$response = "{ }";
		}
	}
	else {
		$response = "{ }";
	}
}

if( $q->{action} eq "upgrade" ) {
	my %response;
	my ($exitcode, $output) = execute("sudo $lbpbindir/upgrade.sh");
	$response = $exitcode;
}

if( $q->{action} eq "savemqtt" ) {

	# Check if all required parameters are defined
	if (!defined $q->{'topic'} || $q->{'topic'} eq "") {
		$q->{'topic'} = "sma2mqtt";
	}
	if (!defined $q->{'delay'} || $q->{'delay'} eq "") {
		$q->{'delay'} = "10";
	}

	# Load config
	require LoxBerry::JSON;
	my $cfgfile = "$lbpconfigdir/plugin.json";
	my $jsonobj = LoxBerry::JSON->new();
	my $cfg = $jsonobj->open(filename => $cfgfile);
	$cfg->{'topic'} = $q->{'topic'};
	$cfg->{'delay'} = $q->{'delay'};
	$jsonobj->write();
	my $resp = LoxBerry::System::write_file("$lbpconfigdir" . "/mqtt_subscriptions.cfg", $q->{'topic'} . "/#");
	$response = 0;
}

if( $q->{action} eq "device" ) {

	# Check if all required parameters are defined
	if (!defined $q->{'name'} || $q->{'name'} eq "") {
		$error = "Name cannot be empty";
	}
	if (!defined $q->{'type'} || $q->{'type'} eq "") {
		$error = "Type cannot be empty";
	}

	# Load config
	require LoxBerry::JSON;
	my $cfgfile = "$lbpconfigdir/plugin.json";
	my $jsonobj = LoxBerry::JSON->new();
	my $cfg = $jsonobj->open(filename => $cfgfile);
	# Check if name already exists
	if ( !$q->{'edit'} && $q->{'name'} ) {
		my @searchresult = $jsonobj->find( $cfg->{'devices'}, "\$_->{'name'} eq \"" . $q->{'name'} . "\"" );
		#my $elemKey = $searchresult[0];
		if (scalar(@searchresult) > 0) {
			$error = "Name '" . $q->{'name'} . "' already exists. Names must be unique.";
		}
	}
	
	# Edit existing  module
	if (!$error && $q->{'edit'}) {
		my @searchresult = $jsonobj->find( $cfg->{'devices'}, "\$_->{'name'} eq \"" . $q->{'edit'} . "\"" );
		my $elemKey = $searchresult[0];
		splice @{ $cfg->{'devices'} }, $elemKey, 1 if (defined($elemKey));
	}
	
	# Add new/edited module
	if (!$error) {
		# Required
		my %device = (
			name => $q->{'name'},
			type => $q->{'type'},
			username => $q->{'username'},
			password => $q->{'password'},
			address => $q->{'address'},
		);
		# Save
		push @{$cfg->{'devices'}}, \%device;
		$jsonobj->write();
	}
	$response = encode_json( $cfg );
	
}

if( $q->{action} eq "deletedevice" ) {

	# Check if all required parameters are defined
	if (!defined $q->{'name'} || $q->{'name'} eq "") {
		$error = "Name cannot be empty";
	}

	# Load config
	require LoxBerry::JSON;
	my $cfgfile = "$lbpconfigdir/plugin.json";
	my $jsonobj = LoxBerry::JSON->new();
	my $cfg = $jsonobj->open(filename => $cfgfile);
	# Delete existing  module
	my @searchresult = $jsonobj->find( $cfg->{'devices'}, "\$_->{'name'} eq \"" . $q->{'name'} . "\"" );
	my $elemKey = $searchresult[0];
	splice @{ $cfg->{'devices'} }, $elemKey, 1 if (defined($elemKey));
	$jsonobj->write();
	$response = encode_json( $cfg );

}

#####################################
# Manage Response and error
#####################################

if( defined $response and !defined $error ) {
	print "Status: 200 OK\r\n";
	print "Content-type: application/json; charset=utf-8\r\n\r\n";
	print $response;
	#LOGOK "Parameters ok - responding with HTTP 200";
}
elsif ( defined $error and $error ne "" ) {
	print "Status: 500 Internal Server Error\r\n";
	print "Content-type: application/json; charset=utf-8\r\n\r\n";
	print to_json( { error => $error } );
	#LOGCRIT "$error - responding with HTTP 500";
}
else {
	print "Status: 501 Not implemented\r\n";
	print "Content-type: application/json; charset=utf-8\r\n\r\n";
	$error = "Action ".$q->{action}." unknown";
	#LOGCRIT "Method not implemented - responding with HTTP 501";
	print to_json( { error => $error } );
}

END {
	#LOGEND if($log);
}

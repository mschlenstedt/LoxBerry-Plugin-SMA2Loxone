#!/usr/bin/perl

use LoxBerry::System;
use LoxBerry::IO;
use LoxBerry::Log;
use LoxBerry::JSON;
use Getopt::Long;
#use warnings;
#use strict;
use Data::Dumper;

# Version of this script
my $version = "0.1.0";

# Globals
my $error;
my $verbose;
my $action;

# Logging
my $log = LoxBerry::Log->new (  name => "watchdog",
	package => 'sma2loxone',
	logdir => "$lbplogdir",
	addtime => 1,
);

# Commandline options
GetOptions ('verbose=s' => \$verbose,
            'action=s' => \$action);

# Verbose
if ($verbose) {
        $log->stdout(1);
        $log->loglevel(7);
}

LOGSTART "Starting Watchdog";

# Lock
my $status = LoxBerry::System::lock(lockfile => 'sma2loxone-watchdog', wait => 900);
if ($status) {
	LOGCRIT "$status currently running - Quitting.";
	exit (1);
}

# Todo
if ( $action eq "start" ) {

	&start();

}

elsif ( $action eq "stop" ) {

	&stop();

}

elsif ( $action eq "restart" ) {

	&restart();

}

elsif ( $action eq "check" ) {

	&check();

}

else {

	LOGERR "No valid action specified. --action=start|stop|restart|check is required. Exiting.";
	print "No valid action specified. --action=start|stop|restart|check is required. Exiting.\n";
	exit(1);

}

exit (0);


#############################################################################
# Sub routines
#############################################################################

##
## Start
##
sub start
{

	if (-e  "$lbpconfigdir/bridge_stopped.cfg") {
		unlink("$lbpconfigdir/bridge_stopped.cfg");
	}

	my $cfgfile ="$lbpconfigdir/plugin.json";
	my $jsonobjcfg = LoxBerry::JSON->new();
	my $cfg = $jsonobjcfg->open(filename => $cfgfile, readonly => 1);
	if ( !%$cfg ) {
		LOGCRIT "Cannot open config file $cfgfile. Exiting.";
		exit (1);
	}

	# Loglevel
	my $loglevel = "INFO";
	$loglevel = "CRITICAL" if ($log->loglevel() <= 2);
	$loglevel = "ERROR" if ($log->loglevel() eq 3);
	$loglevel = "WARNING" if ($log->loglevel() eq 4 || $log->loglevel() eq 5);
	$loglevel = "DEBUG" if ($log->loglevel() eq 6 || $log->loglevel() eq 7);

	LOGINF "Starting SMA2Loxone...";
	system ("pkill -f 'pysma2mqtt.py'");
	sleep 2;
	foreach my $device ( @{$cfg->{"devices"}} ) {
		# Logging
		my $sublog = LoxBerry::Log->new (  name => "sma2loxone_" . $device->{"name"},
		package => 'sma2loxone',
		logdir => "$lbplogdir",
		addtime => 1,
		);
		$sublog->loglevel( $log->loglevel() );
		# Starting sma2loxone
		my $sublogfile = $sublog->filename();
		my $devicename = $device->{"name"};
		$sublog->default;
		LOGSTART "Starting SMA2Loxone for $devicename";
		LOGINF "Starting SMA2Loxone for $devicename";
		system ("python3 pysma2mqtt.py -d $devicename -l $loglevel >> $sublogfile 2>&1 &");
		LOGEND "";
		$log->default;
		my $output = qx(pgrep -f pysma2mqtt.py -d $devicename);
		my $exitcode  = $? >> 8;
		if ($exitcode != 0) {
			LOGWARN "SMA2Loxone ﬁor $devicename could not be started";
		} else {
			LOGOK "SMA2Loxone ﬁor $devicename started successfully.";
		}
	}
	sleep 2;

	LOGOK "Done.";

	return (0);

}

sub stop
{

	LOGINF "Stopping SMA2Loxone...";
	system ("pkill -f 'pysma2mqtt.py'");

	my $response = LoxBerry::System::write_file("$lbpconfigdir/bridge_stopped.cfg", "1");

	LOGOK "Done.";

	return(0);

}

sub restart
{

	LOGINF "Restarting SMA2Loxone...";
	&stop();
	sleep (2);
	&start();

	return(0);

}

sub check
{

	LOGINF "Checking Status of SMA2Loxone...";
	
	if (-e  "$lbpconfigdir/bridge_stopped.cfg") {
		LOGOK "SMA2Loxone was stopped manually. Nothing to do.";
		return(0);
	}

	# Creating tmp file with failed checks
	if (!-e "/dev/shm/sma2loxone-watchdog-fails.dat") {
		my $response = LoxBerry::System::write_file("/dev/shm/sma2loxone-watchdog-fails.dat", "0");
	}

#	my ($exitcode, $output)  = execute ("pgrep -f 'python3 -m mqtt_io'");
	my $output = qx(pgrep -f pysma2mqtt.py);
	my $exitcode  = $? >> 8;
	if ($exitcode != 0) {
		LOGWARN "SMA2Loxone seems to be dead - Error $exitcode";
		my $fails = LoxBerry::System::read_file("/dev/shm/sma2loxone-watchdog-fails.dat");
		chomp ($fails);
		$fails++;
		my $response = LoxBerry::System::write_file("/dev/shm/sma2loxone-watchdog-fails.dat", "$fails");
		if ($fails > 9) {
			LOGERR "Too many failures. Will stop watchdogging... Check your configuration and start SMA2Loxone manually.";
		} else {
			&restart();
		}
	} else {
		LOGOK "SMA2Loxone seems to be alive. Nothing to do.";
		my $response = LoxBerry::System::write_file("/dev/shm/sma2loxone-watchdog-fails.dat", "0");
	}

	return(0);

}

##
## Always execute when Script ends
##
END {

	LOGEND "This is the end - My only friend, the end...";
	LoxBerry::System::unlock(lockfile => 'sma2loxone-watchdog');

}

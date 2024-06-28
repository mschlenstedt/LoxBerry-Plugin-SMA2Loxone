#!/bin/bash

packageurl="https://pypi.org/pypi/pysma-plus/json"
pluginname=$(perl -e 'use LoxBerry::System; print $lbpplugindir; exit;')
oldversion=$(pip3 show pysma-plus | grep Version: | cut -d: -f 2 | sed 's/[[:blank:]]//g')

# print out versions
if [[ $1 == "current" ]]; then
	echo -n $oldversion
	exit 0
fi
if [[ $1 == "available" ]]; then
	newversion=$(curl -s $packageurl | jq -r '.info.version')
	echo -n $newversion
	exit 0
fi

if [ "$UID" -ne 0 ]; then
	echo "This script has to be run as root."
	exit
fi

# Logging
. $LBHOMEDIR/libs/bashlib/loxberry_log.sh
PACKAGE=$pluginname
NAME=upgrade
LOGDIR=${LBPLOG}/${PACKAGE}
STDERR=1
LOGSTART "MQTT-IO upgrade started."

# Install
LOGINF "Installing PYSMA-Plus via pip3..."

yes | python3 -m pip install --upgrade pip | tee -a $FILENAME
yes | python3 -m pip install --upgrade pysma-plus | tee -a $FILENAME

# End
newversion=$(pip3 show pysma-plus | grep Version: | cut -d: -f 2 | sed 's/[[:blank:]]//g')
LOGOK "Upgrading PYSMA-Plus from $oldversion to $newversion"
LOGEND "Upgrading PYSMA-Plus from $oldversion to $newversion"

chown loxberry:loxberry $FILENAME

exit 0

#!/bin/bash

# Exit code must be 0 if executed successfull. 
# Exit code 1 gives a warning but continues installation.
# Exit code 2 cancels installation.
#
# !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
# Will be executed as user "root".
# !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
#
# You can use all vars from /etc/environment in this script.
#
# We add 5 additional arguments when executing this script:
# command <TEMPFOLDER> <NAME> <FOLDER> <VERSION> <BASEFOLDER>
#
# For logging, print to STDOUT. You can use the following tags for showing
# different colorized information during plugin installation:
#
# <OK> This was ok!"
# <INFO> This is just for your information."
# <WARNING> This is a warning!"
# <ERROR> This is an error!"
# <FAIL> This is a fail!"

# To use important variables from command line use the following code:
COMMAND=$0    # Zero argument is shell command
PTEMPDIR=$1   # First argument is temp folder during install
PSHNAME=$2    # Second argument is Plugin-Name for scipts etc.
PDIR=$3       # Third argument is Plugin installation folder
PVERSION=$4   # Forth argument is Plugin version
#LBHOMEDIR=$5 # Comes from /etc/environment now. Fifth argument is
              # Base folder of LoxBerry
PTEMPPATH=$6  # Sixth argument is full temp path during install (see also $1)

# Combine them with /etc/environment
PCGI=$LBPCGI/$PDIR
PHTML=$LBPHTML/$PDIR
PTEMPL=$LBPTEMPL/$PDIR
PDATA=$LBPDATA/$PDIR
PLOG=$LBPLOG/$PDIR # Note! This is stored on a Ramdisk now!
PCONFIG=$LBPCONFIG/$PDIR
PSBIN=$LBPSBIN/$PDIR
PBIN=$LBPBIN/$PDIR

echo "<INFO> Installation as root user started."

echo "<INFO> Start installing pip3..."
yes | python3 -m pip install --upgrade pip
INSTALLED=$(pip3 list --format=columns | grep "pip" | grep -v grep | wc -l)
if [ ${INSTALLED} -ne "0" ]; then
	echo "<OK> Python Pip installed successfully."
else
	echo "<WARNING> Python Pip installation failed! The plugin will not work without."
	echo "<WARNING> Giving up."
	exit 2;
fi 

echo "<INFO> Start installing Python pysma-plus..."
yes | python3 -m pip install --upgrade pysma-plus
INSTALLED=$(pip3 list --format=columns | grep "pysma-plus" | grep -v grep | wc -l)
if [ ${INSTALLED} -ne "0" ]; then
	echo "<OK> Python pysma-plus installed successfully."
else
	echo "<WARNING> Python pysma-plus installation failed! The plugin will not work without."
	echo "<WARNING> Giving up."
	exit 2;
fi 

echo "<INFO> Start installing Python aiomqtt..."
yes | python3 -m pip install --upgrade aiomqtt==2.0.1
INSTALLED=$(pip3 list --format=columns | grep "aiomqtt" | grep -v grep | wc -l)
if [ ${INSTALLED} -ne "0" ]; then
	echo "<OK> Python aiomqtt installed successfully."
else
	echo "<WARNING> Python aiomqtt installation failed! The plugin will not work without."
	echo "<WARNING> Giving up."
	exit 2;
fi 

echo "<INFO> Adjusting permissions..."
chown root:root $PBIN/upgrade.sh
chmod 0755 $PBIN/upgrade.sh

exit 0

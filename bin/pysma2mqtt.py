#!/usr/bin/env python
"""Basic usage example and testing of pysma."""
import argparse
import asyncio
import logging
import queue
import signal
import sys
from typing import Any
from urllib.parse import urlparse
import json
import os

import aiohttp
from aiomqtt import Client, ProtocolVersion

import pysmaplus as pysma
from pysmaplus.sensor import Sensors

VAR: dict[str, Any] = {}
log_queue: queue.Queue = queue.Queue()

devices = list()
pconfig = dict()
mqttconfig = dict()
deviceindex = ""

lbpconfigdir = os.popen("perl -e 'use LoxBerry::System; print $lbpconfigdir; exit;'").read()
lbpdatadir = os.popen("perl -e 'use LoxBerry::System; print $lbpdatadir; exit;'").read()
lbplogdir = os.popen("perl -e 'use LoxBerry::System; print $lbplogdir; exit;'").read()


def readconfig(device):
    try:
        with open(lbpconfigdir + '/plugin.json') as f:
            global pconfig
            global devices
            global deviceindex
            pconfig = json.load(f)

        # Find device in config
        i = 0
        for item in pconfig['devices']:
            if str(device) == str(item['name']):
                deviceindex = i
                break
            else:
                i += 1
        if deviceindex == "":
            log.critical("Cannot find device in configuration")
            sys.exit()

        # Set default values
        if int(pconfig['delay']) < 2:
            log.warning("Delay set smaller than 2 seconds. Setting it to 2 seconds.")
            pconfig['delay'] = 2
        if str(pconfig['topic']) == "":
            log.warning("MQTT Topic is not set. Set it to default topic 'sma2mqtt'.")
            pconfig['topic'] = "sma2mqtt"

        # Read MQTT config
        global mqttconfig
        mqttconfig['hostname'] = os.popen("perl -e 'use LoxBerry::IO; my $mqttcred = LoxBerry::IO::mqtt_connectiondetails(); print $mqttcred->{brokerhost}; exit'").read()
        mqttconfig['port'] = os.popen("perl -e 'use LoxBerry::IO; my $mqttcred = LoxBerry::IO::mqtt_connectiondetails(); print $mqttcred->{brokerport}; exit'").read()
        mqttconfig['username'] = os.popen("perl -e 'use LoxBerry::IO; my $mqttcred = LoxBerry::IO::mqtt_connectiondetails(); print $mqttcred->{brokeruser}; exit'").read()
        mqttconfig['password'] = os.popen("perl -e 'use LoxBerry::IO; my $mqttcred = LoxBerry::IO::mqtt_connectiondetails(); print $mqttcred->{brokerpass}; exit'").read()

        if mqttconfig['hostname'] == "" or mqttconfig['port'] == "":
            log.critical("Cannot find mqtt configuration")
            sys.exit()

    except:
        log.critical("Cannot read plugin configuration")
        sys.exit()

def print_table(sensors: Sensors) -> None:
    """Print sensors formatted as table."""
    if len(sensors) == 0:
        log.error("No Sensors found!")
    for sen in sensors:
        if sen.value is None:
            log.debug("{:>25}".format(sen.name))
        else:
            name = sen.name
            if sen.key:
                name = sen.key
            log.debug(
                "{:>25}{:>15} {} {} {}".format(
                    name,
                    str(sen.value),
                    sen.unit if sen.unit else "",
                    sen.mapped_value if sen.mapped_value else "",
                    sen.range if sen.range else "",
                )
            )

async def reconnect_loop(args: argparse.Namespace) -> None:
    """Run reconnect loop."""

    # Logging with standard LoxBerry log format
    if args.loglevel == "":
        loglevel="ERROR"
    else:
        loglevel = args.loglevel
    global log
    log = logging.getLogger()
    numeric_loglevel = getattr(logging, loglevel.upper(), None)
    if not isinstance(numeric_loglevel, int):
        raise ValueError('Invalid log level: %s' % loglevel)
    formatter = logging.Formatter('%(asctime)s.%(msecs)03d <%(levelname)s> %(message)s',datefmt='%H:%M:%S')
    streamHandler = logging.StreamHandler(sys.stdout)
    streamHandler.setFormatter(formatter)
    log.addHandler(streamHandler)

    # Read config
    readconfig(args.device)
    item = pconfig['devices'][deviceindex]

    # Start
    log.setLevel(logging.INFO)
    log.info("This is pysma-plus lib Version %s. The Loglevel is %s" % (getVersion(),loglevel.upper()))
    log.info("Running for Device %s" % str(item['name']))
    log.setLevel(numeric_loglevel)

    # Use SSL if configured
    devurl = str(item['address'])
    if "ssl" in item:
        if item['ssl'] == "1":
            devurl = "https://" + str(item['address'])

    delay = float(pconfig['delay'])

    VAR["running"] = True
    while VAR.get("running"):
        try:
            log.info(f"Connecting to {devurl}")
            await main_loop(devurl, item)
        except Exception as e:
            log.error(f"Unknown error occured in MainLoop: {e}")

        await asyncio.sleep(delay)


async def main_loop(devurl: str, item ) -> None:
    """Run main loop."""

    # Read sensor
    async with aiohttp.ClientSession(
        connector=aiohttp.TCPConnector(ssl=False)
    ) as session:
        user = str(item['username'])
        password = str(item['password'])
        url = str(devurl)
        accessmethod = str(item['type'])
        delay = float(pconfig['delay'])

        log.debug(
            f"MainLoop called! Url: {url} User/Group: {user} Accessmethod: {accessmethod}"
        )
        VAR["sma"] = pysma.getDevice(session, url, password, user, accessmethod)
        assert VAR["sma"]
        try:
            await VAR["sma"].new_session()
        except pysma.exceptions.SmaAuthenticationException:
            log.critical("Authentication failed!")
            return
        except pysma.exceptions.SmaConnectionException:
            log.critical("Unable to connect to device at %s", url)
            return
        # We should not get any exceptions, but if we do we will close the session.
        try:
            devicelist = await VAR["sma"].device_list()
            for deviceId, deviceData in devicelist.items():
                for name, value in deviceData.asDict().items():
                    if type(value) in [str, float, int]:
                        log.info("{:>17}{:>25}".format(name, value))

            sensors: dict[str, Sensors] = {}
            for deviceId in devicelist.keys():
                sensors[deviceId] = await VAR["sma"].get_sensors(deviceId)
                for sensor in sensors[deviceId]:
                    sensor.enabled = True
            log.info("Sending received values to MQTT...")
            async with Client(
                mqttconfig['hostname'],
                port=int(mqttconfig['port']) if mqttconfig['port'] else 1883,
                username=mqttconfig['username'],
                password=mqttconfig['password'],
                protocol=ProtocolVersion.V31,
                timeout=10,
            ) as client:
                while VAR.get("running"):
                    for deviceId in devicelist.keys():
                        try:
                            await VAR["sma"].read(sensors[deviceId], deviceId)
                            for sen in sensors[deviceId]:
                                name = sen.name if sen.name is not None else sen.key
                                if name is None:
                                    continue
                                topic=str(item['name'])
                                await client.publish(
                                    f"{pconfig['topic']}/{topic}/{name}",
                                    payload=sen.value,
                                )
                                print_table(sensors[deviceId])
                        except TimeoutError as e:
                            log.error("Timeout", e)
                    await asyncio.sleep(delay)
        finally:
            log.info("Closing Session...")
            await VAR["sma"].close_session()


def getVersion() -> str:
    versionstring = "unknown"
    from importlib.metadata import PackageNotFoundError, version

    try:
        versionstring = version("pysma-plus")
    except PackageNotFoundError:
        pass
    return versionstring


async def main() -> None:

    parser = argparse.ArgumentParser(
        prog="python3 pysma2mqtt.py",
        description="Export the device data to mqtt.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action='store_true',
        help="Verbose (debug) output",
    )
    parser.add_argument(
        "-l",
        "--loglevel",
        type=str,
        help="Loglevel for logging",
        required=False
    )
    parser.add_argument(
        "-d",
        "--device",
        type=str,
        help="Device name which should be read",
        required=True
    )

    args = parser.parse_args(args=None if sys.argv[1:] else ["--help"])

    def _shutdown(*_):
        VAR["running"] = False

    signal.signal(signal.SIGINT, _shutdown)
    await reconnect_loop(args)


if __name__ == "__main__":
    asyncio.run(main())

#!/bin/bash
#
# Collect MQTT messages to create test material.
#
# You will likely need to open an SSH tunnel to reach the relevant MQTT brokers.
# Check the transitdata wiki for instructions for the SSH config.
#
# Dependencies:
# - stdbuf (https://www.gnu.org/software/coreutils/)
# - mosquitto_sub (https://mosquitto.org/)
# - ts (https://joeyh.name/code/moreutils/)

set -Eeuo pipefail

mqtt_broker='ADD_MQTT_HOST_HERE'
mqtt_port='ADD_MQTT_PORT_HERE'
mqtt_topic_filter='ADD_MQTT_TOPIC_FILTER_HERE'
mqtt_client_id_prefix='ADD_UNIQUE_MQTT_CLIENT_ID_PREFIX_HERE'

timestamp="$(date --utc '+%Y%m%dT%H%M%SZ')"

stdbuf -i 0 -o 0 -e 0 \
  mosquitto_sub \
  --host "${mqtt_broker}" \
  --port "${mqtt_port}" \
  --id-prefix "${mqtt_client_id_prefix}" \
  --qos 2 \
  --topic "${mqtt_topic_filter}" \
  --verbose \
  2>> "stderr_${timestamp}" |
  TZ=UTC ts '%Y-%m-%dT%H:%M:%.SZ' |
  while read -r line; do
    echo "${line}" >> "stdout_${timestamp}"
  done

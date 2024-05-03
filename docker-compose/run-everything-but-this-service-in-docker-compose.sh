#!/bin/bash

set -Eeuo pipefail

cat <<EOF

********************************************************************************

This script will run the transitdata partial-apc pipeline locally using Docker
Compose, excluding this service. The services are described in
./docker-compose.yml.

1. Create SSH tunnels

First we must create SSH tunnels to the data sources.

Connect now the partial-apc MQTT broker used in the dev environment to localhost
port 61883 and the HFP broker used in the dev environment to localhost port
49876. You can find advice on how to do that in the transitdata wiki.

2. Run this service

When all the other services for partial-apc pipeline are running, run this
service as you wish, for example:

> npm run build && npm run start:with-docker-compose-inspect

Also stop this service yourself when you are done, e.g. with Ctrl-C.

3. See output

Once the partial-apc service stack is running, you can find the produced APC
messages by running:

> docker-compose --file ./docker-compose-other-services.yml logs --no-log-prefix --timestamps collect-apc-results

4. Observe Pulsar state

If you wish to see the pulsar-manager UI when the stack is running, wait for 60
seconds after the services have been started, open http://localhost:9527 in your
browser and log in with the username "admin" and the password "apachepulsar".
Then click on the button "New Environment". Fill whatever to "Environment name".
Fill http://pulsar:8080 to "Service URL" and pulsar://pulsar:6650 to "Bookie
URL". Click "Confirm". Then the environment should become explorable in the UI.

********************************************************************************

Expecting the SSH tunnels to be in place, next this script will start the
pipeline similarly to this:

docker-compose down && docker-compose up --detach

EOF

read -n1 -s -r -p $'When ready to start Docker Compose, press any key.\n'

cat <<EOF

********************************************************************************

EOF

docker-compose \
	--file ./docker-compose-other-services.yml \
	down &&
	docker-compose \
		--file ./docker-compose-other-services.yml \
		up \
		--detach

cat <<EOF

********************************************************************************

EOF

read -n1 -s -r -p $'When ready to stop Docker Compose, press any key.\n'

cat <<EOF

********************************************************************************

EOF

docker-compose \
	--file ./docker-compose-other-services.yml \
	down

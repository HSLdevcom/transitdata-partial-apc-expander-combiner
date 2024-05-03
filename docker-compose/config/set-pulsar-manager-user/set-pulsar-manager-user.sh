#!/bin/bash

set -Eeuo pipefail

CSRF_TOKEN="$(curl 'http://127.0.0.1:7750/pulsar-manager/csrf-token')"
curl \
	-H "X-XSRF-TOKEN: ${CSRF_TOKEN}" \
	-H "Cookie: XSRF-TOKEN=${CSRF_TOKEN};" \
	-H 'Content-Type: application/json' \
	-X PUT \
	-d "{\"name\": \"${USERNAME}\", \"password\": \"${PASSWORD}\", \"description\": \"test\", \"email\": \"username@test.org\"}" \
	'http://127.0.0.1:7750/pulsar-manager/users/superuser'

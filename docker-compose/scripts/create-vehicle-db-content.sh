#!/bin/bash

set -Eeuo pipefail

jq -r ".[] | [.vehicle_id, .operator_id, .type] | @csv" \
	<../../tests/testData/transitlogDbEquipment.json \
	>../config/vehicle-db/transitlogDbEquipment.csv
chmod go+r ../config/vehicle-db/transitlogDbEquipment.csv

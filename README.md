# transitdata-partial-apc-expander-combiner

Expand partial APC messages with trip metadata and combine them by stops to create full APC messages.

Expand all of the partial APC messages from vehicles with trip metadata from HFP messages.
Use vehicle IDs to map between the partial APC messages and the HFP messages.
Combine the expanded messages by stops so that the combined messages look like full APC messages.

This project depends indirectly on [transitdata-common](https://github.com/HSLdevcom/transitdata-common) project for the Protobuf proto definition files though the files have been slightly modified.

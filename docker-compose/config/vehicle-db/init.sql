CREATE SCHEMA jore;

CREATE TABLE jore.equipment (
  vehicle_id TEXT NOT NULL,
  operator_id TEXT NOT NULL,
  type TEXT
);

\copy jore.equipment FROM '/transitlogDbEquipment.csv' CSV;

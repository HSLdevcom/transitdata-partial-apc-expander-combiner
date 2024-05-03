CREATE TABLE equipment (
  vehicle_id TEXT NOT NULL,
  operator_id TEXT NOT NULL,
  type TEXT
);

\copy equipment FROM '/transitlogDbEquipment.csv' CSV;

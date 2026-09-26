create index if not exists workout_import_config_updated_by
  on summer_private.workout_import_config(updated_by)
  where updated_by is not null;

-- Seed data: 5 example workouts (no user_id = public/system workouts)

insert into workouts (id, user_id, title, description, type, is_public, distance_km, elevation_gain_m, elevation_profile)
values
  (
    'a1b2c3d4-0001-0001-0001-000000000001',
    null,
    'Easy Sunday Long Run',
    'A relaxed long run to build base fitness. Keep your heart rate low and enjoy the scenery. Aim for conversational pace throughout.',
    'long',
    true,
    14.5,
    85,
    '[10,12,15,18,22,25,28,30,28,25,22,18,15,12,10,8,10,12,15,18,22,25,28,30]'::jsonb
  ),
  (
    'a1b2c3d4-0002-0002-0002-000000000002',
    null,
    'Classic 4×1km Tempo Intervals',
    'A staple track workout. Warm up well, then hit 4 hard kilometers with short recovery. Great for improving lactate threshold.',
    'intervals',
    true,
    9.0,
    30,
    '[5,5,6,6,6,7,7,7,7,7,7,7,7,7,7,7,6,6,5,5]'::jsonb
  ),
  (
    'a1b2c3d4-0003-0003-0003-000000000003',
    null,
    'Hill Repeats — Power Builder',
    'Find a steep 200m hill. Sprint up, jog back down. Builds explosive power and improves running economy on flat terrain too.',
    'hill',
    true,
    7.0,
    320,
    '[10,15,25,40,55,65,70,65,55,40,25,15,10,15,25,40,55,65,70,65,55,40,25,15,10]'::jsonb
  ),
  (
    'a1b2c3d4-0004-0004-0004-000000000004',
    null,
    'Progressive 10km — Negative Split',
    'Start at easy pace and drop 15 seconds per kilometer every 2km. Finish at 5km race pace. Teaches pacing discipline.',
    'progressive',
    true,
    10.0,
    55,
    '[8,9,10,11,12,13,13,12,11,10,9,8,7,8,9,10,11,12,11,10]'::jsonb
  ),
  (
    'a1b2c3d4-0005-0005-0005-000000000005',
    null,
    '5km Threshold Run',
    'A continuous 5km at comfortably hard effort — around 85-90% max heart rate. You should be working but able to say a few words.',
    'tempo',
    true,
    8.0,
    40,
    '[8,9,10,11,12,12,12,12,11,10,9,8,8,9,10,11,12,12,11,10]'::jsonb
  );

-- Intervals for workout 1 (Easy Long Run)
insert into intervals (workout_id, type, label, duration_seconds, distance_km, pace_min_per_km, "order")
values
  ('a1b2c3d4-0001-0001-0001-000000000001', 'warmup', 'Easy warm-up', 600, 1.5, 6.5, 0),
  ('a1b2c3d4-0001-0001-0001-000000000001', 'work', 'Long run at easy pace', 4800, 12.0, 6.5, 1),
  ('a1b2c3d4-0001-0001-0001-000000000001', 'cooldown', 'Walk/jog cool-down', 300, 1.0, null, 2);

-- Intervals for workout 2 (4×1km Tempo)
insert into intervals (workout_id, type, label, duration_seconds, distance_km, pace_min_per_km, "order")
values
  ('a1b2c3d4-0002-0002-0002-000000000002', 'warmup', 'Easy warm-up jog', 900, 2.0, 6.0, 0),
  ('a1b2c3d4-0002-0002-0002-000000000002', 'work', '1km @ threshold pace', 240, 1.0, 4.0, 1),
  ('a1b2c3d4-0002-0002-0002-000000000002', 'rest', '90s recovery jog', 90, null, null, 2),
  ('a1b2c3d4-0002-0002-0002-000000000002', 'work', '1km @ threshold pace', 240, 1.0, 4.0, 3),
  ('a1b2c3d4-0002-0002-0002-000000000002', 'rest', '90s recovery jog', 90, null, null, 4),
  ('a1b2c3d4-0002-0002-0002-000000000002', 'work', '1km @ threshold pace', 240, 1.0, 4.0, 5),
  ('a1b2c3d4-0002-0002-0002-000000000002', 'rest', '90s recovery jog', 90, null, null, 6),
  ('a1b2c3d4-0002-0002-0002-000000000002', 'work', '1km @ threshold pace', 240, 1.0, 4.0, 7),
  ('a1b2c3d4-0002-0002-0002-000000000002', 'cooldown', 'Cool-down jog', 600, 1.5, 6.5, 8);

-- Intervals for workout 3 (Hill Repeats)
insert into intervals (workout_id, type, label, duration_seconds, distance_km, pace_min_per_km, "order")
values
  ('a1b2c3d4-0003-0003-0003-000000000003', 'warmup', 'Easy warm-up including drills', 900, 2.0, 6.0, 0),
  ('a1b2c3d4-0003-0003-0003-000000000003', 'work', '200m hill sprint — hard effort', 50, 0.2, null, 1),
  ('a1b2c3d4-0003-0003-0003-000000000003', 'rest', 'Walk/jog down the hill', 90, null, null, 2),
  ('a1b2c3d4-0003-0003-0003-000000000003', 'work', '200m hill sprint', 50, 0.2, null, 3),
  ('a1b2c3d4-0003-0003-0003-000000000003', 'rest', 'Walk/jog down', 90, null, null, 4),
  ('a1b2c3d4-0003-0003-0003-000000000003', 'work', '200m hill sprint', 50, 0.2, null, 5),
  ('a1b2c3d4-0003-0003-0003-000000000003', 'rest', 'Walk/jog down', 90, null, null, 6),
  ('a1b2c3d4-0003-0003-0003-000000000003', 'work', '200m hill sprint', 50, 0.2, null, 7),
  ('a1b2c3d4-0003-0003-0003-000000000003', 'rest', 'Walk/jog down', 90, null, null, 8),
  ('a1b2c3d4-0003-0003-0003-000000000003', 'work', '200m hill sprint', 50, 0.2, null, 9),
  ('a1b2c3d4-0003-0003-0003-000000000003', 'rest', 'Walk/jog down', 90, null, null, 10),
  ('a1b2c3d4-0003-0003-0003-000000000003', 'work', '200m hill sprint', 50, 0.2, null, 11),
  ('a1b2c3d4-0003-0003-0003-000000000003', 'rest', 'Walk/jog down', 90, null, null, 12),
  ('a1b2c3d4-0003-0003-0003-000000000003', 'work', '200m hill sprint', 50, 0.2, null, 13),
  ('a1b2c3d4-0003-0003-0003-000000000003', 'rest', 'Walk/jog down', 90, null, null, 14),
  ('a1b2c3d4-0003-0003-0003-000000000003', 'work', '200m hill sprint', 50, 0.2, null, 15),
  ('a1b2c3d4-0003-0003-0003-000000000003', 'rest', 'Walk/jog down', 90, null, null, 16),
  ('a1b2c3d4-0003-0003-0003-000000000003', 'cooldown', 'Easy cool-down jog', 600, 1.5, 6.5, 17);

-- Intervals for workout 4 (Progressive 10km)
insert into intervals (workout_id, type, label, duration_seconds, distance_km, pace_min_per_km, "order")
values
  ('a1b2c3d4-0004-0004-0004-000000000004', 'work', '2km @ 6:00/km', 720, 2.0, 6.0, 0),
  ('a1b2c3d4-0004-0004-0004-000000000004', 'work', '2km @ 5:45/km', 690, 2.0, 5.75, 1),
  ('a1b2c3d4-0004-0004-0004-000000000004', 'work', '2km @ 5:30/km', 660, 2.0, 5.5, 2),
  ('a1b2c3d4-0004-0004-0004-000000000004', 'work', '2km @ 5:15/km', 630, 2.0, 5.25, 3),
  ('a1b2c3d4-0004-0004-0004-000000000004', 'work', '2km @ 5:00/km (race pace)', 600, 2.0, 5.0, 4);

-- Intervals for workout 5 (Threshold 5km)
insert into intervals (workout_id, type, label, duration_seconds, distance_km, pace_min_per_km, "order")
values
  ('a1b2c3d4-0005-0005-0005-000000000005', 'warmup', 'Easy warm-up', 900, 2.0, 6.5, 0),
  ('a1b2c3d4-0005-0005-0005-000000000005', 'work', '5km threshold run', 1050, 5.0, 3.5, 1),
  ('a1b2c3d4-0005-0005-0005-000000000005', 'cooldown', 'Easy cool-down', 600, 1.5, 7.0, 2);

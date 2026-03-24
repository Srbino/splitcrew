-- CrewSplit – Seed data for development
-- Admin password: admin123
-- All user passwords: pass1234

-- BOATS (with emoji + color)
INSERT INTO boats (id, name, emoji, color, description) VALUES
(1, 'Stella',       '⛵', 'blue',   'Bavaria Cruiser 46'),
(2, 'Blue Lagoon',  '🌊', 'teal',   'Jeanneau Sun Odyssey 440')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, emoji = EXCLUDED.emoji,
  color = EXCLUDED.color, description = EXCLUDED.description;
SELECT setval('boats_id_seq', 2);

-- USERS (10 members – 5 per boat, each with password_hash for "pass1234")
-- bcrypt hash of "pass1234" at cost 12
-- Paul (boat1) and Lucy (boat2) are captains
INSERT INTO users (id, name, phone, email, avatar, boat_id, password_hash, role) VALUES
(1,  'Paul Newman',        '+420 601 111 111', 'paul@example.com',     'avatars/seed_user_1.svg',  1, '$2b$12$uvN1iKXEA4hEIvxniXsykeQq4OfKOWhldP8.P5VsUqiLjcsUFcPnu', 'captain'),
(2,  'Jane Rivers',        '+420 602 222 222', 'jane@example.com',     'avatars/seed_user_2.svg',  1, '$2b$12$uvN1iKXEA4hEIvxniXsykeQq4OfKOWhldP8.P5VsUqiLjcsUFcPnu', 'crew'),
(3,  'Tom Taylor',         '+420 603 333 333', 'tom@example.com',      'avatars/seed_user_3.svg',  1, '$2b$12$uvN1iKXEA4hEIvxniXsykeQq4OfKOWhldP8.P5VsUqiLjcsUFcPnu', 'crew'),
(4,  'Kate Davis',         '+420 604 444 444', NULL,                   'avatars/seed_user_4.svg',  1, '$2b$12$uvN1iKXEA4hEIvxniXsykeQq4OfKOWhldP8.P5VsUqiLjcsUFcPnu', 'crew'),
(5,  'Andrew Stone',       NULL,               'andrew@example.com',   'avatars/seed_user_5.svg',  1, '$2b$12$uvN1iKXEA4hEIvxniXsykeQq4OfKOWhldP8.P5VsUqiLjcsUFcPnu', 'crew'),
(6,  'Lucy Martin',        '+420 606 666 666', 'lucy@example.com',     'avatars/seed_user_6.svg',  2, '$2b$12$uvN1iKXEA4hEIvxniXsykeQq4OfKOWhldP8.P5VsUqiLjcsUFcPnu', 'captain'),
(7,  'Martin Blake',       '+420 607 777 777', NULL,                   'avatars/seed_user_7.svg',  2, '$2b$12$uvN1iKXEA4hEIvxniXsykeQq4OfKOWhldP8.P5VsUqiLjcsUFcPnu', 'crew'),
(8,  'Eva Brooks',         NULL,               'eva@example.com',      'avatars/seed_user_8.svg',  2, '$2b$12$uvN1iKXEA4hEIvxniXsykeQq4OfKOWhldP8.P5VsUqiLjcsUFcPnu', 'crew'),
(9,  'Jake Black',         '+420 609 999 999', 'jake@example.com',     'avatars/seed_user_9.svg',  2, '$2b$12$uvN1iKXEA4hEIvxniXsykeQq4OfKOWhldP8.P5VsUqiLjcsUFcPnu', 'crew'),
(10, 'Tessa Wells',        NULL,               NULL,                   'avatars/seed_user_10.svg', 2, '$2b$12$uvN1iKXEA4hEIvxniXsykeQq4OfKOWhldP8.P5VsUqiLjcsUFcPnu', 'crew')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, phone = EXCLUDED.phone, email = EXCLUDED.email,
  avatar = EXCLUDED.avatar, boat_id = EXCLUDED.boat_id,
  password_hash = EXCLUDED.password_hash, role = EXCLUDED.role;
SELECT setval('users_id_seq', 10);

-- SETTINGS (no member_password — passwords are per-user now)
INSERT INTO settings (setting_key, setting_value) VALUES
('installed',             '1'),
('trip_name',             'Adriatic Sailing 2026'),
('trip_date_from',        '2026-07-15'),
('trip_date_to',          '2026-07-25'),
('admin_password',        '$2b$12$81bKXXZGg52ntRZGEOnjlegvoO82ygMgVQ3OlwqcemFgxf8eYPQ4S'),
('base_currency',         'EUR'),
('language',              'en'),
('app_icon',              '⛵'),
('allowed_currencies',   '["EUR","CZK"]'),
('export_currency',      'CZK')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;

-- Remove legacy member_password if it exists
DELETE FROM settings WHERE setting_key = 'member_password';

-- ITINERARY (2026 dates)
DELETE FROM itinerary;
INSERT INTO itinerary (day_number, date, title, description, location_from, location_to, type, sort_order) VALUES
(0,  '2026-07-14', 'Departure from home',        'Morning departure by car through Austria to Italy. Meeting point 5:00 AM.',    'Home',           'Caorle',         'car',     0),
(1,  '2026-07-15', 'Arrival at marina',           'Boat check-in, provisioning, getting to know the boat. Evening barbecue.',     'Caorle Marina',  'Caorle Marina',  'port',    1),
(2,  '2026-07-16', 'Caorle → Poreč',             'First leg! Crossing the Adriatic, approx. 40 NM. Wind expected NE 3–4 Bf.',   'Caorle',         'Poreč',          'sailing', 2),
(3,  '2026-07-17', 'Poreč → Rovinj',             'Short leg along the Istrian coast. Afternoon sightseeing in Rovinj.',         'Poreč',          'Rovinj',         'sailing', 3),
(4,  '2026-07-18', 'Day off – Rovinj',            'Snorkeling at Red Island, stroll through the old town.',                       'Rovinj',         'Rovinj',         'port',    4),
(5,  '2026-07-19', 'Rovinj → Pula',              'Sailing around Cape Kamenjak. Stop in a bay for swimming.',                    'Rovinj',         'Pula',           'sailing', 5),
(6,  '2026-07-20', 'Pula – sightseeing',          'Full day in Pula – amphitheater, Temple of Augustus, fish market.',            'Pula',           'Pula',           'port',    6),
(7,  '2026-07-21', 'Pula → Cres',                'Crossing to the island of Cres. Anchoring in the bay of Valun.',               'Pula',           'Cres (Valun)',   'sailing', 7),
(8,  '2026-07-22', 'Cres → Mali Lošinj',         'Crossing through the strait. Mali Lošinj – town with a palm-lined promenade.','Cres',           'Mali Lošinj',    'sailing', 8),
(9,  '2026-07-23', 'Day off – Mali Lošinj',       'Relaxation, diving, hike to Veli Lošinj on foot.',                            'Mali Lošinj',    'Mali Lošinj',    'port',    9),
(10, '2026-07-24', 'Mali Lošinj → Caorle',       'Return crossing over the Adriatic. Long leg, early morning start.',            'Mali Lošinj',    'Caorle',         'sailing', 10),
(11, '2026-07-25', 'Boat handover and return',    'Cleaning the boats, handover at the marina. Afternoon departure by car home.', 'Caorle',         'Home',           'car',     11)
ON CONFLICT DO NOTHING;

-- CHECKLIST
INSERT INTO checklist (category, item_name, description, sort_order) VALUES
('required',     'Passport or ID card',          'Valid identity document',                             1),
('required',     'Boating license',              'If you are a skipper – small vessel operator license', 2),
('required',     'Travel insurance',             'Including water sports and repatriation',              3),
('required',     'Copies of documents',          'Scanned on phone or in the cloud',                    4),
('clothing',     'Swimsuit (2–3 pcs)',           NULL,                                                  1),
('clothing',     'Waterproof jacket',            'Windbreaker for night sailing',                       2),
('clothing',     'Cap / hat',                    'Sun protection',                                      3),
('clothing',     'Boat shoes',                   'With white non-marking soles!',                       4),
('clothing',     'UV protection shirt',          'Better than sunscreen while sailing',                  5),
('gear',         'Sunglasses',                   'Polarized – removes glare from the water',            1),
('gear',         'Sunscreen SPF 50+',            'Waterproof, you burn fast on a boat',                  2),
('gear',         'Mesh bag instead of suitcase', 'Easier to fit into the cabin',                        3),
('gear',         'Headlamp',                     'For night watches and arriving at port',               4),
('gear',         'Knife / multitool',            NULL,                                                  5),
('recommended',  'Seasickness tablets',          'Kinedryl / Dramamine – take preventively',            1),
('recommended',  'Snorkel and mask',             'For stops in bays',                                    2),
('recommended',  'GoPro / waterproof camera',    NULL,                                                  3),
('recommended',  'Evening game',                 'Cards, board games, UNO...',                           4)
ON CONFLICT DO NOTHING;

-- WALLET EXPENSES (2026 dates)
INSERT INTO wallet_expenses (id, paid_by, amount, currency, amount_eur, exchange_rate, description, category, expense_date, split_type, created_by) VALUES
(1,  2,  2500.00, 'CZK',  99.17, 25.21, 'Medicine and first aid kit',               'other',          '2026-07-13 14:00:00', 'both',  2),
(2,  1,  3200.00, 'CZK', 126.93, 25.21, 'Highway tolls AT + HR',                    'transport',      '2026-07-14 06:00:00', 'both',  1),
(3,  1,   180.00, 'EUR', 180.00, NULL,   'Big grocery shopping at marina',            'food',           '2026-07-15 16:00:00', 'both',  1),
(4,  6,   120.00, 'EUR', 120.00, NULL,   'Big grocery shopping – boat 2',             'food',           '2026-07-15 16:30:00', 'boat2', 6),
(5,  3,    45.00, 'EUR',  45.00, NULL,   'Barbecue – meat and vegetables',            'food',           '2026-07-15 18:00:00', 'both',  3),
(6,  4,    85.00, 'EUR',  85.00, NULL,   'Diesel – Stella',                           'fuel',           '2026-07-16 08:00:00', 'boat1', 4),
(7,  9,    78.00, 'EUR',  78.00, NULL,   'Diesel – Blue Lagoon',                      'fuel',           '2026-07-16 08:30:00', 'boat2', 9),
(8,  7,    65.00, 'EUR',  65.00, NULL,   'Port Poreč – fee for both boats',           'marina',         '2026-07-16 15:00:00', 'both',  7),
(9,  1,    42.00, 'EUR',  42.00, NULL,   'Dinner in Poreč – pizza for everyone',      'food',           '2026-07-16 20:00:00', 'both',  1),
(10, 6,    55.00, 'EUR',  55.00, NULL,   'Port Rovinj',                               'marina',         '2026-07-17 14:00:00', 'both',  6),
(11, 8,  1200.00, 'CZK',  47.60, 25.21, 'Ice cream and coffees for everyone',        'food',           '2026-07-18 11:00:00', 'both',  8),
(12, 5,    38.00, 'EUR',  38.00, NULL,   'Snorkel gear – rental',                     'entertainment',  '2026-07-18 14:00:00', 'boat1', 5),
(13, 9,    92.00, 'EUR',  92.00, NULL,   'Diesel + water – Blue Lagoon',              'fuel',           '2026-07-19 07:00:00', 'boat2', 9),
(14, 3,    75.00, 'EUR',  75.00, NULL,   'Diesel + water – Stella',                   'fuel',           '2026-07-19 07:30:00', 'boat1', 3),
(15, 7,   110.00, 'EUR', 110.00, NULL,   'Dinner in Pula – fish restaurant',          'food',           '2026-07-20 20:00:00', 'both',  7)
ON CONFLICT (id) DO NOTHING;
SELECT setval('wallet_expenses_id_seq', 15);

-- SPLITS (unchanged amounts)
INSERT INTO wallet_expense_splits (expense_id, user_id, amount_eur) VALUES
(1, 1, 9.92), (1, 2, 9.92), (1, 3, 9.92), (1, 4, 9.92), (1, 5, 9.92),
(1, 6, 9.91), (1, 7, 9.91), (1, 8, 9.91), (1, 9, 9.92), (1, 10, 9.92),
(2, 1, 12.70), (2, 2, 12.70), (2, 3, 12.70), (2, 4, 12.69), (2, 5, 12.69),
(2, 6, 12.69), (2, 7, 12.69), (2, 8, 12.69), (2, 9, 12.69), (2, 10, 12.69),
(3, 1, 18.00), (3, 2, 18.00), (3, 3, 18.00), (3, 4, 18.00), (3, 5, 18.00),
(3, 6, 18.00), (3, 7, 18.00), (3, 8, 18.00), (3, 9, 18.00), (3, 10, 18.00),
(4, 6, 24.00), (4, 7, 24.00), (4, 8, 24.00), (4, 9, 24.00), (4, 10, 24.00),
(5, 1, 4.50), (5, 2, 4.50), (5, 3, 4.50), (5, 4, 4.50), (5, 5, 4.50),
(5, 6, 4.50), (5, 7, 4.50), (5, 8, 4.50), (5, 9, 4.50), (5, 10, 4.50),
(6, 1, 17.00), (6, 2, 17.00), (6, 3, 17.00), (6, 4, 17.00), (6, 5, 17.00),
(7, 6, 15.60), (7, 7, 15.60), (7, 8, 15.60), (7, 9, 15.60), (7, 10, 15.60),
(8, 1, 6.50), (8, 2, 6.50), (8, 3, 6.50), (8, 4, 6.50), (8, 5, 6.50),
(8, 6, 6.50), (8, 7, 6.50), (8, 8, 6.50), (8, 9, 6.50), (8, 10, 6.50),
(9, 1, 4.20), (9, 2, 4.20), (9, 3, 4.20), (9, 4, 4.20), (9, 5, 4.20),
(9, 6, 4.20), (9, 7, 4.20), (9, 8, 4.20), (9, 9, 4.20), (9, 10, 4.20),
(10, 1, 5.50), (10, 2, 5.50), (10, 3, 5.50), (10, 4, 5.50), (10, 5, 5.50),
(10, 6, 5.50), (10, 7, 5.50), (10, 8, 5.50), (10, 9, 5.50), (10, 10, 5.50),
(11, 1, 4.76), (11, 2, 4.76), (11, 3, 4.76), (11, 4, 4.76), (11, 5, 4.76),
(11, 6, 4.76), (11, 7, 4.76), (11, 8, 4.76), (11, 9, 4.76), (11, 10, 4.76),
(12, 1, 7.60), (12, 2, 7.60), (12, 3, 7.60), (12, 4, 7.60), (12, 5, 7.60),
(13, 6, 18.40), (13, 7, 18.40), (13, 8, 18.40), (13, 9, 18.40), (13, 10, 18.40),
(14, 1, 15.00), (14, 2, 15.00), (14, 3, 15.00), (14, 4, 15.00), (14, 5, 15.00),
(15, 1, 11.00), (15, 2, 11.00), (15, 3, 11.00), (15, 4, 11.00), (15, 5, 11.00),
(15, 6, 11.00), (15, 7, 11.00), (15, 8, 11.00), (15, 9, 11.00), (15, 10, 11.00)
ON CONFLICT DO NOTHING;

-- AUDIT LOG (2026 dates)
INSERT INTO wallet_audit_log (expense_id, changed_by, change_type, old_values, new_values, changed_at) VALUES
(1,  2, 'created', NULL, '{"amount":"2500.00","currency":"CZK","description":"Medicine and first aid kit"}', '2026-07-13 14:00:00'),
(2,  1, 'created', NULL, '{"amount":"3200.00","currency":"CZK","description":"Highway tolls AT + HR"}', '2026-07-14 06:00:00'),
(3,  1, 'created', NULL, '{"amount":"180.00","currency":"EUR","description":"Big grocery shopping at marina"}', '2026-07-15 16:00:00'),
(4,  6, 'created', NULL, '{"amount":"120.00","currency":"EUR","description":"Big grocery shopping – boat 2"}', '2026-07-15 16:30:00'),
(5,  3, 'created', NULL, '{"amount":"45.00","currency":"EUR","description":"Barbecue – meat and vegetables"}', '2026-07-15 18:00:00'),
(9,  1, 'created', NULL, '{"amount":"42.00","currency":"EUR","description":"Dinner in Poreč"}', '2026-07-16 20:00:00'),
(9,  1, 'edited',  '{"description":"Dinner in Poreč"}', '{"description":"Dinner in Poreč – pizza for everyone"}', '2026-07-16 20:15:00'),
(15, 7, 'created', NULL, '{"amount":"110.00","currency":"EUR","description":"Dinner in Pula – fish restaurant"}', '2026-07-20 20:00:00')
ON CONFLICT DO NOTHING;

-- SETTLEMENTS
INSERT INTO wallet_settled (from_user_id, to_user_id, settled_at, settled_by) VALUES
(10, 1, '2026-07-18 12:00:00', 10)
ON CONFLICT DO NOTHING;

-- SHOPPING LIST – BOAT 1
INSERT INTO shopping_items (boat_id, category, item_name, quantity, assigned_to, price, currency, note, is_bought, bought_by, created_by) VALUES
(1, 'groceries', 'Penne pasta',               '2 kg',     1,    2.50,  'EUR', NULL,                              false, NULL, 1),
(1, 'groceries', 'Fresh tomatoes',             '1 kg',     NULL, NULL,  'EUR', 'For salad and sauce',             false, NULL, 2),
(1, 'groceries', 'Olive oil',                  '1 litre',  4,    7.90,  'EUR', 'Extra virgin',                    true,  4,    1),
(1, 'groceries', 'Parmesan cheese',            '300 g',    NULL, 5.50,  'EUR', NULL,                              true,  1,    3),
(1, 'groceries', 'Bread / baguettes',          '4 pcs',    2,    NULL,  'EUR', 'Buy fresh in the morning',        false, NULL, 2),
(1, 'drinks',    'Bottled water (6L)',          '4 packs',  2,    8.00,  'EUR', NULL,                              true,  2,    1),
(1, 'drinks',    'Orange juice',               '2 litres', NULL, 3.20,  'EUR', NULL,                              false, NULL, 5),
(1, 'alcohol',   'Prosecco',                   '4 bottles', 1,   20.00, 'EUR', 'To celebrate setting sail',       false, NULL, 1),
(1, 'alcohol',   'Local white wine',           '3 bottles', NULL, NULL, 'EUR', 'Buy in Croatia',                  false, NULL, 3),
(1, 'hygiene',   'Sunscreen SPF 50',           '2 pcs',    NULL, 12.00, 'EUR', NULL,                              false, NULL, 4),
(1, 'medicine',  'Ibuprofen',                  '1 pack',   2,    NULL,  'CZK', NULL,                              true,  2,    2),
(1, 'other',     'Boat rope 10mm',             '20 m',     5,    180.00,'CZK', 'As a backup for the existing one', false, NULL, 5);

-- SHOPPING LIST – BOAT 2
INSERT INTO shopping_items (boat_id, category, item_name, quantity, assigned_to, price, currency, note, is_bought, bought_by, created_by) VALUES
(2, 'groceries', 'Basmati rice',              '1 kg',     6,    1.80,  'EUR', NULL,                              false, NULL, 6),
(2, 'groceries', 'Chicken breast',            '2 kg',     NULL, NULL,  'EUR', 'Marinate the day before',         false, NULL, 7),
(2, 'groceries', 'Vegetables for grilling',   '1 kg',     8,    4.50,  'EUR', 'Zucchini, peppers, onions',       true,  8,    6),
(2, 'groceries', 'Eggs',                      '20 pcs',   NULL, 3.00,  'EUR', NULL,                              false, NULL, 9),
(2, 'drinks',    'Beer (cans)',               '24 pcs',   7,    18.00, 'EUR', 'Mix of lager and dark',           false, NULL, 7),
(2, 'drinks',    'Sparkling water',           '6 bottles', 9,   4.80,  'EUR', NULL,                              true,  9,    6),
(2, 'alcohol',   'Rum',                       '1 bottle', NULL, NULL,  'EUR', 'For Mojitos',                     false, NULL, 10),
(2, 'alcohol',   'Limes',                     '10 pcs',   10,   2.50,  'EUR', 'For the rum',                     false, NULL, 10),
(2, 'hygiene',   'Mosquito repellent',        '1 pc',     NULL, 89.00, 'CZK', NULL,                              false, NULL, 8),
(2, 'other',     'Trash bags',                '1 roll',   6,    1.20,  'EUR', NULL,                              true,  6,    6);

-- LOGBOOK – BOAT 1 (2026 dates)
INSERT INTO logbook (boat_id, date, location_from, location_to, nautical_miles, departure_time, arrival_time, skipper_user_id, note, created_by) VALUES
(1, '2026-07-16', 'Caorle',     'Poreč',       42.5, '08:00:00', '14:30:00', 1, 'Excellent wind NE 3–4 Bf, sailed the entire way. Smooth sea.',                        1),
(1, '2026-07-17', 'Poreč',      'Rovinj',      18.2, '09:30:00', '12:00:00', 1, 'Calm sea, snorkeling in the bay below Red Island.',                                   2),
(1, '2026-07-19', 'Rovinj',     'Pula',        24.8, '07:00:00', '12:30:00', 3, 'Sailed around Cape Kamenjak. Beautiful cliffs, dolphins!',                             3),
(1, '2026-07-21', 'Pula',       'Cres (Valun)', 35.2, '06:30:00', '14:00:00', 1, 'Longer leg across open sea. Wind picked up to 5 Bf in the afternoon.',                1),
(1, '2026-07-22', 'Cres',       'Mali Lošinj', 15.6, '09:00:00', '11:30:00', 5, 'Passage through the narrow strait – wonderful experience. Andrew at the helm for the first time.', 5),
(1, '2026-07-24', 'Mali Lošinj','Caorle',      44.8, '05:00:00', '15:00:00', 1, 'Longest leg. Started in the dark, sunset at sea. Arrived tired but happy.',            1);

-- LOGBOOK – BOAT 2 (2026 dates)
INSERT INTO logbook (boat_id, date, location_from, location_to, nautical_miles, departure_time, arrival_time, skipper_user_id, note, created_by) VALUES
(2, '2026-07-16', 'Caorle',     'Poreč',        41.8, '08:15:00', '14:45:00', 6, 'A bit choppy at the start, then it calmed down. Good sailing.',                       6),
(2, '2026-07-17', 'Poreč',      'Rovinj',       17.5, '10:00:00', '12:30:00', 6, 'Short leg, stopped in a bay for a swim.',                                             7),
(2, '2026-07-19', 'Rovinj',     'Pula',         25.1, '07:30:00', '13:00:00', 9, 'Jake at the helm, handled it brilliantly. Lunch stop in Fažana.',                     9),
(2, '2026-07-21', 'Pula',       'Cres (Valun)', 34.8, '06:45:00', '14:15:00', 6, 'Tough day – 1.5m waves, but the boat handled it superbly.',                           6),
(2, '2026-07-22', 'Cres',       'Mali Lošinj',  16.2, '09:15:00', '12:00:00', 9, 'Calm day, snorkeling along the way.',                                                  8),
(2, '2026-07-24', 'Mali Lošinj','Caorle',       45.1, '04:45:00', '15:30:00', 6, 'Night start – beautiful stars. Longest leg, but everyone in good spirits.',            6);

-- MENU (2026 dates)
INSERT INTO menu_plan (boat_id, date, meal_type, cook_user_id, meal_description, note, created_by) VALUES
(1, '2026-07-15', 'lunch', 1,    'Grilled sausages with potatoes',      'First day – keeping it simple',   1),
(1, '2026-07-16', 'lunch', 2,    'Tuna pasta salad',                    'Cold meal at sea',                2),
(1, '2026-07-17', 'lunch', 3,    'Spaghetti aglio olio',                'Italian classic',                 3),
(1, '2026-07-18', 'lunch', 4,    'Greek salad with feta',               'Day off – light lunch',           4),
(1, '2026-07-19', 'lunch', 5,    'Seafood risotto',                     'Andrew showed off!',              5),
(1, '2026-07-21', 'lunch', 1,    'Canned goulash + bread rolls',        'Nothing complicated at sea',      1),
(1, '2026-07-22', 'lunch', 2,    'Caprese + baguette',                  NULL,                              2),
(2, '2026-07-15', 'lunch', 6,    'Chicken steak with rice',             'Brought from home',               6),
(2, '2026-07-16', 'lunch', 7,    'Chicken and vegetable wrap',          NULL,                              7),
(2, '2026-07-17', 'lunch', 8,    'Penne all''arrabbiata',               'Eva makes it great',              8),
(2, '2026-07-18', 'lunch', 9,    'Grilled vegetables + halloumi',       'Vegetarian day',                  9),
(2, '2026-07-19', 'lunch', 10,   'Fish tacos',                          'From freshly bought catch',      10),
(2, '2026-07-21', 'lunch', 6,    'One-pot lentil soup',                 NULL,                              6),
(2, '2026-07-22', 'lunch', 7,    'Tomato bruschetta',                   'Quick and tasty',                 7)
ON CONFLICT DO NOTHING;

-- CARS
INSERT INTO cars (id, driver_user_id, car_name, seats, note) VALUES
(1, 1, 'Škoda Octavia Combi', 5, 'Roof box for gear'),
(2, 6, 'VW Golf',             5, NULL),
(3, 9, 'Ford Transit Custom', 8, 'Van – room for SUP and diving gear')
ON CONFLICT DO NOTHING;
SELECT setval('cars_id_seq', 3);

INSERT INTO car_passengers (car_id, user_id) VALUES
(1, 2), (1, 3), (1, 4),
(2, 7), (2, 8),
(3, 10)
ON CONFLICT DO NOTHING;

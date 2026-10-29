-- Seed comprehensive hospitals across all 25 districts of Sri Lanka
INSERT INTO hospitals (hospital_id, name, phone, specialization, has_cardiac_icu, has_trauma_unit, is_active, gps_location)
VALUES
  -- Colombo District additions
  ('a1111111-1111-1111-1111-111111111121', 'Base Hospital Avissawella', '0362222261', 'General Medicine, Emergency Trauma, Surgery, Pediatric', false, true, true, ST_SetSRID(ST_MakePoint(80.2084, 6.9538), 4326)),
  ('a1111111-1111-1111-1111-111111111122', 'Castle Street Hospital for Women', '0112696231', 'Obstetrics, Gynecology, Neonatal Intensive Care', false, false, true, ST_SetSRID(ST_MakePoint(79.8821, 6.9114), 4326)),

  -- Gampaha District additions
  ('a1111111-1111-1111-1111-111111111123', 'Base Hospital Mirigama', '0332273261', 'Emergency Treatment, General Surgery, Acute Care', false, false, true, ST_SetSRID(ST_MakePoint(80.1287, 7.2435), 4326)),
  ('a1111111-1111-1111-1111-111111111124', 'Base Hospital Wathupitiwala', '0332280261', 'General Medicine, Trauma Support, Orthopedics', false, true, true, ST_SetSRID(ST_MakePoint(80.1258, 7.1472), 4326)),
  ('a1111111-1111-1111-1111-111111111125', 'Base Hospital Kiribathgoda', '0112911261', 'Outpatient Emergency, Acute Care, General Medicine', false, false, true, ST_SetSRID(ST_MakePoint(79.9283, 6.9792), 4326)),

  -- Kalutara District additions
  ('a1111111-1111-1111-1111-111111111126', 'Base Hospital Horana', '0342261261', 'Emergency Care, General Surgery, Intensive Care Unit', false, true, true, ST_SetSRID(ST_MakePoint(80.0617, 6.7153), 4326)),

  -- Kandy District additions
  ('a1111111-1111-1111-1111-111111111127', 'Teaching Hospital Peradeniya', '0812388001', 'Tertiary Care, Pediatrics, Cardiology, Emergency Trauma', true, true, true, ST_SetSRID(ST_MakePoint(80.5964, 7.2625), 4326)),
  ('a1111111-1111-1111-1111-111111111128', 'Base Hospital Gampola', '0812352261', 'Emergency Treatment, Surgery, Obstetrics, General Medicine', false, true, true, ST_SetSRID(ST_MakePoint(80.5694, 7.1642), 4326)),
  ('a1111111-1111-1111-1111-111111111129', 'Base Hospital Nawalapitiya', '0542222261', 'Hill Country Referral, Emergency Trauma, Surgery', false, true, true, ST_SetSRID(ST_MakePoint(80.5342, 7.0494), 4326)),

  -- Matale District
  ('a1111111-1111-1111-1111-111111111130', 'District General Hospital Matale', '0662222261', 'Central Province District Referral, Emergency Trauma Unit', false, true, true, ST_SetSRID(ST_MakePoint(80.6234, 7.4722), 4326)),
  ('a1111111-1111-1111-1111-111111111131', 'Base Hospital Dambulla', '0662284761', 'North-Central Transit Referral, Emergency Trauma, Acute Care', false, true, true, ST_SetSRID(ST_MakePoint(80.6511, 7.8742), 4326)),

  -- Nuwara Eliya District
  ('a1111111-1111-1111-1111-111111111132', 'District General Hospital Nuwara Eliya', '0522222261', 'Hill Country District Referral, Emergency Trauma, ICU', false, true, true, ST_SetSRID(ST_MakePoint(80.7672, 6.9708), 4326)),
  ('a1111111-1111-1111-1111-111111111133', 'District General Hospital Dikoya (Hatton)', '0512222261', 'Estate Sector Emergency Care, Trauma, General Surgery', false, true, true, ST_SetSRID(ST_MakePoint(80.6083, 6.8778), 4326)),

  -- Galle District additions
  ('a1111111-1111-1111-1111-111111111134', 'Teaching Hospital Mahamodara Galle', '0912234001', 'Maternal & Child Health, Emergency Obstetrics, Pediatrics', false, false, true, ST_SetSRID(ST_MakePoint(80.2078, 6.0403), 4326)),
  ('a1111111-1111-1111-1111-111111111135', 'Base Hospital Balapitiya', '0912258261', 'Coastal Southern Emergency, Trauma, Surgery, Acute Care', false, true, true, ST_SetSRID(ST_MakePoint(80.0383, 6.2758), 4326)),
  ('a1111111-1111-1111-1111-111111111136', 'Base Hospital Elpitiya', '0912291261', 'Southern Inland Referral, Emergency Treatment, Surgery', false, false, true, ST_SetSRID(ST_MakePoint(80.1444, 6.2575), 4326)),

  -- Matara District additions
  ('a1111111-1111-1111-1111-111111111137', 'Base Hospital Kamburupitiya', '0412292261', 'Emergency Treatment, General Medicine, Trauma Support', false, false, true, ST_SetSRID(ST_MakePoint(80.5647, 6.0828), 4326)),

  -- Hambantota District additions
  ('a1111111-1111-1111-1111-111111111138', 'Base Hospital Tangalle', '0472240261', 'Southern Coastal Emergency, Trauma, General Surgery', false, true, true, ST_SetSRID(ST_MakePoint(80.7933, 6.0242), 4326)),

  -- Northern Province (Jaffna, Kilinochchi, Mannar, Vavuniya, Mullaitivu)
  ('a1111111-1111-1111-1111-111111111139', 'Base Hospital Point Pedro', '0212263261', 'Northern Peninsula Emergency Care, General Medicine', false, false, true, ST_SetSRID(ST_MakePoint(80.2319, 9.8242), 4326)),
  ('a1111111-1111-1111-1111-111111111140', 'Base Hospital Tellippalai', '0212241261', 'Oncology, Emergency Trauma, General Medicine', false, false, true, ST_SetSRID(ST_MakePoint(80.0333, 9.7833), 4326)),
  ('a1111111-1111-1111-1111-111111111141', 'District General Hospital Kilinochchi', '0212285328', 'Northern Province District Referral, Emergency Trauma Unit', false, true, true, ST_SetSRID(ST_MakePoint(80.4042, 9.3803), 4326)),
  ('a1111111-1111-1111-1111-111111111142', 'District General Hospital Mannar', '0232222261', 'North-Western Coastal Referral, Emergency Services, ICU', false, true, true, ST_SetSRID(ST_MakePoint(79.9042, 8.9806), 4326)),
  ('a1111111-1111-1111-1111-111111111143', 'District General Hospital Vavuniya', '0242222261', 'Northern Gateway Referral, Emergency Trauma, Intensive Care', false, true, true, ST_SetSRID(ST_MakePoint(80.4983, 8.7542), 4326)),
  ('a1111111-1111-1111-1111-111111111144', 'District General Hospital Mullaitivu', '0212290022', 'North-East Coastal Referral, Emergency Trauma Care', false, true, true, ST_SetSRID(ST_MakePoint(80.8142, 9.2667), 4326)),

  -- Eastern Province (Batticaloa, Ampara, Trincomalee)
  ('a1111111-1111-1111-1111-111111111145', 'District General Hospital Trincomalee', '0262222261', 'Eastern Main Referral, Emergency Trauma, Intensive Care Unit', false, true, true, ST_SetSRID(ST_MakePoint(81.2333, 8.5711), 4326)),
  ('a1111111-1111-1111-1111-111111111146', 'Base Hospital Kantale', '0262234261', 'Transit Emergency Trauma, General Medicine, Surgery', false, false, true, ST_SetSRID(ST_MakePoint(80.9983, 8.3683), 4326)),
  ('a1111111-1111-1111-1111-111111111147', 'Base Hospital Eravur', '0652240261', 'Emergency Treatment, General Medicine, Pediatrics', false, false, true, ST_SetSRID(ST_MakePoint(81.6022, 7.7725), 4326)),
  ('a1111111-1111-1111-1111-111111111148', 'Base Hospital Kaluwanchikudy', '0652250261', 'Southern Batticaloa Emergency Care, General Surgery', false, false, true, ST_SetSRID(ST_MakePoint(81.7925, 7.5261), 4326)),
  ('a1111111-1111-1111-1111-111111111149', 'District General Hospital Ampara', '0632222261', 'Digamadulla District Referral, Emergency Trauma Unit, ICU', false, true, true, ST_SetSRID(ST_MakePoint(81.6722, 7.2917), 4326)),
  ('a1111111-1111-1111-1111-111111111150', 'Base Hospital Kalmunai South', '0672229261', 'Coastal Ampara Referral, Emergency Trauma, Surgery', false, true, true, ST_SetSRID(ST_MakePoint(81.8267, 7.4128), 4326)),

  -- North Western (Kurunegala, Puttalam)
  ('a1111111-1111-1111-1111-111111111151', 'Base Hospital Kuliyapitiya', '0372281261', 'Emergency Care, General Surgery, Acute Care Support', false, true, true, ST_SetSRID(ST_MakePoint(80.0408, 7.4689), 4326)),
  ('a1111111-1111-1111-1111-111111111152', 'District General Hospital Chilaw', '0322222261', 'Coastal Wayamba Main Referral, Emergency Trauma, Surgery', false, true, true, ST_SetSRID(ST_MakePoint(79.7958, 7.5758), 4326)),
  ('a1111111-1111-1111-1111-111111111153', 'Base Hospital Puttalam', '0322265261', 'Emergency Treatment, General Medicine, Pediatric Care', false, true, true, ST_SetSRID(ST_MakePoint(79.8278, 8.0333), 4326)),

  -- North Central (Anuradhapura, Polonnaruwa)
  ('a1111111-1111-1111-1111-111111111154', 'District General Hospital Polonnaruwa', '0272222261', 'North Central Referral, Emergency Trauma, Intensive Care', false, true, true, ST_SetSRID(ST_MakePoint(81.0028, 7.9403), 4326)),
  ('a1111111-1111-1111-1111-111111111155', 'Base Hospital Medawachchiya', '0252245261', 'Junction Transit Emergency, General Medicine, Surgery', false, false, true, ST_SetSRID(ST_MakePoint(80.4958, 8.5417), 4326)),

  -- Uva Province (Badulla, Monaragala)
  ('a1111111-1111-1111-1111-111111111156', 'District General Hospital Diyatalawa', '0572229261', 'Hill Country Emergency Trauma, Surgery, Intensive Care', false, true, true, ST_SetSRID(ST_MakePoint(80.9633, 6.8183), 4326)),
  ('a1111111-1111-1111-1111-111111111157', 'Base Hospital Mahiyanganaya', '0552257261', 'River Basin Referral, Emergency Trauma, General Surgery', false, true, true, ST_SetSRID(ST_MakePoint(81.0000, 7.3167), 4326)),
  ('a1111111-1111-1111-1111-111111111158', 'District General Hospital Monaragala', '0552276261', 'Wellassa District Main Referral, Emergency Trauma Unit', false, true, true, ST_SetSRID(ST_MakePoint(81.3486, 6.8722), 4326)),
  ('a1111111-1111-1111-1111-111111111159', 'Base Hospital Wellawaya', '0552274261', 'Transit Highway Emergency Care, General Medicine', false, false, true, ST_SetSRID(ST_MakePoint(81.1028, 6.7417), 4326)),

  -- Sabaragamuwa Province (Ratnapura, Kegalle)
  ('a1111111-1111-1111-1111-111111111160', 'Base Hospital Balangoda', '0452287261', 'Mountain Corridor Referral, Emergency Trauma, Surgery', false, true, true, ST_SetSRID(ST_MakePoint(80.7000, 6.6500), 4326)),
  ('a1111111-1111-1111-1111-111111111161', 'Base Hospital Embilipitiya', '0472230261', 'Southern Border Referral, Emergency Trauma, Surgery', false, true, true, ST_SetSRID(ST_MakePoint(80.8500, 6.3333), 4326)),
  ('a1111111-1111-1111-1111-111111111162', 'District General Hospital Kegalle', '0352222261', 'Sabaragamuwa District Referral, Emergency Trauma, ICU', false, true, true, ST_SetSRID(ST_MakePoint(80.3467, 7.2522), 4326)),
  ('a1111111-1111-1111-1111-111111111163', 'Base Hospital Mawanella', '0352246261', 'Highway Emergency Care, General Medicine, Surgery', false, false, true, ST_SetSRID(ST_MakePoint(80.4489, 7.2514), 4326)),
  ('a1111111-1111-1111-1111-111111111164', 'Base Hospital Karawanella', '0362266261', 'Valley Emergency Care, General Surgery, Acute Care', false, false, true, ST_SetSRID(ST_MakePoint(80.2583, 7.0250), 4326))
ON CONFLICT (hospital_id) DO NOTHING;
